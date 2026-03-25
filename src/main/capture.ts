import { desktopCapturer, screen, systemPreferences, shell } from 'electron';
import type { NativeImage } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { RegionRect, CaptureResult, DisplayInfo } from '../shared/types';
import { SNAPVIEW_TEMP_DIR } from './constants';

/**
 * Get the active display based on current cursor position.
 * Single source of truth for display info — avoids redundant screen API calls.
 */
export function getActiveDisplay(): Electron.Display {
  const cursorPos = screen.getCursorScreenPoint();
  return screen.getDisplayNearestPoint(cursorPos);
}

/**
 * Check macOS screen recording permission.
 * Must be called on every launch — Sequoia re-prompts monthly (PLAT-05).
 * On non-darwin platforms, returns 'granted' immediately.
 *
 * Note: macOS has no programmatic API to trigger the Screen Recording permission prompt.
 * askForMediaAccess() only accepts 'microphone' or 'camera', NOT 'screen'.
 * When permission is not yet determined or denied, we direct the user to System Settings.
 */
export async function checkMacOSPermission(): Promise<'granted' | 'denied' | 'unavailable'> {
  if (process.platform !== 'darwin') return 'granted';

  const status = systemPreferences.getMediaAccessStatus('screen');

  if (status === 'granted') return 'granted';

  // Both 'not-determined' and 'denied' require manual permission grant via System Settings.
  // There is no programmatic way to trigger the Screen Recording permission dialog.
  shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
  );
  return 'denied';
}

/**
 * Match a desktopCapturer source to a display by display_id.
 * Uses string comparison because Electron's display_id can be numeric or string
 * depending on platform. Falls back to index-based matching if display_id fails
 * (some Linux compositors don't populate display_id reliably).
 */
function findSourceForDisplay(
  sources: Electron.DesktopCapturerSource[],
  display: Electron.Display,
  displayIndex: number
): Electron.DesktopCapturerSource | undefined {
  // Match by display_id — NOT by array index (known Electron ordering bug)
  const matched = sources.find((s) => String(s.display_id) === String(display.id));
  if (matched) return matched;
  // Fallback: index-based matching with warning
  if (displayIndex < sources.length) {
    console.warn(`[snapview] display_id match failed for display ${display.id}, using index ${displayIndex}`);
    return sources[displayIndex];
  }
  return undefined;
}

/**
 * Get screen sources for ALL connected displays, matched by display_id.
 * Returns one DisplayInfo per display. Used by multi-monitor overlay flow.
 * Wrapped in try/catch for Wayland portal crash (PLAT-06).
 */
export async function getAllDisplaySources(): Promise<DisplayInfo[]> {
  const displays = screen.getAllDisplays();

  // Use the largest connected display's dimensions for thumbnail quality
  const maxWidth = Math.max(...displays.map((d) => d.size.width));
  const maxHeight = Math.max(...displays.map((d) => d.size.height));

  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: maxWidth, height: maxHeight },
    });

    const result: DisplayInfo[] = [];
    for (let i = 0; i < displays.length; i++) {
      const display = displays[i];
      const matched = findSourceForDisplay(sources, display, i);
      if (matched) {
        result.push({
          displayId: display.id,
          thumbnail: matched.thumbnail.toDataURL(),
          scaleFactor: display.scaleFactor,
        });
      }
    }

    return result;
  } catch (err) {
    console.error('[snapview] getAllDisplaySources failed (Wayland portal?):', (err as Error).message);
    return [];
  }
}

/**
 * Capture a screen region, crop it, and write the result as PNG to os.tmpdir()/snapview/.
 * Multiplies rect coordinates by display scaleFactor for HiDPI accuracy (Pitfall 6).
 * Uses NativeImage directly from desktopCapturer — avoids data URL round-trip.
 *
 * Uses rect.displayId to find the correct display and source for multi-monitor accuracy.
 */
export async function captureRegion(rect: RegionRect): Promise<CaptureResult> {
  // Find the target display by displayId, fall back to cursor position
  const displays = screen.getAllDisplays();
  const targetDisplay = displays.find((d) => d.id === rect.displayId) ?? getActiveDisplay();
  const scaleFactor = targetDisplay.scaleFactor;
  const { width: displayWidth, height: displayHeight } = targetDisplay.size;

  // Convert CSS pixels to physical pixels for HiDPI/Retina displays
  const physicalRect = {
    x: Math.round(rect.x * scaleFactor),
    y: Math.round(rect.y * scaleFactor),
    width: Math.round(rect.width * scaleFactor),
    height: Math.round(rect.height * scaleFactor),
  };

  let sources: Electron.DesktopCapturerSource[];
  try {
    sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: displayWidth, height: displayHeight },
    });
  } catch (err) {
    console.error('[snapview] desktopCapturer.getSources failed:', (err as Error).message);
    sources = [];
  }

  if (sources.length === 0) {
    const platform = process.platform;
    let hint = '';
    if (platform === 'darwin') {
      hint = ' Grant Screen Recording permission in System Settings > Privacy & Security.';
    } else if (platform === 'linux') {
      hint = ' Your compositor may not support screen capture. Try running on X11 instead of Wayland.';
    }
    throw new Error(`[snapview] No screen sources available.${hint}`);
  }

  // Match the correct source by display_id for multi-monitor accuracy
  const displayIndex = displays.findIndex((d) => d.id === targetDisplay.id);
  const matchedSource = findSourceForDisplay(sources, targetDisplay, displayIndex >= 0 ? displayIndex : 0);
  const fullImage: NativeImage = matchedSource ? matchedSource.thumbnail : sources[0].thumbnail;
  const cropped = fullImage.crop(physicalRect);
  const pngBuffer = cropped.toPNG();

  // Write to temp dir with unique filename
  await fs.mkdir(SNAPVIEW_TEMP_DIR, { recursive: true });
  const filename = `snapview-${Date.now()}-${crypto.randomUUID()}.png`;
  const filePath = path.join(SNAPVIEW_TEMP_DIR, filename);
  await fs.writeFile(filePath, pngBuffer);

  return { filePath };
}

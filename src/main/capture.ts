import { desktopCapturer, screen, systemPreferences, shell } from 'electron';
import type { NativeImage } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { RegionRect, CaptureResult } from '../shared/types';
import { SNAPVIEW_TEMP_DIR } from './constants';

/**
 * Get the active display based on current cursor position.
 * Single source of truth for display info — avoids redundant screen API calls.
 */
function getActiveDisplay(): Electron.Display {
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
 * Get screen sources as data URLs for the renderer overlay background.
 * Uses types: ['screen'] NOT types: ['window'] to avoid black screenshots
 * on Chromium-based windows (Pitfall 4, electron/electron#21687).
 * Wrapped in try/catch for Wayland portal crash (PLAT-06).
 */
export async function getScreenSources(): Promise<{ id: string; thumbnail: string }[]> {
  try {
    const { width, height } = getActiveDisplay().size;
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height },
    });
    return sources.map((source) => ({
      id: source.id,
      thumbnail: source.thumbnail.toDataURL(),
    }));
  } catch (err) {
    console.error('[snapview] getScreenSources failed (Wayland portal?):', (err as Error).message);
    return [];
  }
}

/**
 * Capture a screen region, crop it, and write the result as PNG to os.tmpdir()/snapview/.
 * Multiplies rect coordinates by display scaleFactor for HiDPI accuracy (Pitfall 6).
 * Uses NativeImage directly from desktopCapturer — avoids data URL round-trip.
 *
 * Display info is queried once and reused for both scaleFactor and thumbnail sizing.
 */
export async function captureRegion(rect: RegionRect): Promise<CaptureResult> {
  // Query display info once — used for both scaleFactor and capture thumbnail size
  const activeDisplay = getActiveDisplay();
  const scaleFactor = activeDisplay.scaleFactor;
  const { width: displayWidth, height: displayHeight } = activeDisplay.size;

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

  // Crop directly from the NativeImage — no data URL encode/decode needed
  const fullImage: NativeImage = sources[0].thumbnail;
  const cropped = fullImage.crop(physicalRect);
  const pngBuffer = cropped.toPNG();

  // Write to temp dir with unique filename
  await fs.mkdir(SNAPVIEW_TEMP_DIR, { recursive: true });
  const filename = `snapview-${Date.now()}-${crypto.randomUUID()}.png`;
  const filePath = path.join(SNAPVIEW_TEMP_DIR, filename);
  await fs.writeFile(filePath, pngBuffer);

  return { filePath };
}

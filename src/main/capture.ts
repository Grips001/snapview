import { desktopCapturer, nativeImage, screen, systemPreferences, shell, clipboard } from 'electron';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import type { RegionRect, CaptureResult } from '../shared/types';

/**
 * Check macOS screen recording permission.
 * Must be called on every launch — Sequoia re-prompts monthly (PLAT-05).
 * On non-darwin platforms, returns 'granted' immediately.
 */
export async function checkMacOSPermission(): Promise<'granted' | 'denied' | 'unavailable'> {
  if (process.platform !== 'darwin') return 'granted';

  const status = systemPreferences.getMediaAccessStatus('screen');

  if (status === 'granted') return 'granted';

  if (status === 'not-determined') {
    // askForMediaAccess typings don't include 'screen' in some Electron versions,
    // but the runtime API supports it on macOS — cast required.
    const granted = await systemPreferences.askForMediaAccess('screen' as 'microphone');
    return granted ? 'granted' : 'denied';
  }

  // status === 'denied' — open System Settings so user can re-enable
  shell.openExternal(
    'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'
  );
  return 'denied';
}

/**
 * Get screen sources from the active display.
 * Uses types: ['screen'] NOT types: ['window'] to avoid black screenshots
 * on Chromium-based windows (Pitfall 4, electron/electron#21687).
 * Wrapped in try/catch for Wayland portal crash (PLAT-06).
 */
export async function getScreenSources(): Promise<{ id: string; thumbnail: string }[]> {
  try {
    const cursorPos = screen.getCursorScreenPoint();
    const activeDisplay = screen.getDisplayNearestPoint(cursorPos);
    const { width, height } = activeDisplay.size;

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
 */
export async function captureRegion(rect: RegionRect): Promise<CaptureResult> {
  const cursorPos = screen.getCursorScreenPoint();
  const activeDisplay = screen.getDisplayNearestPoint(cursorPos);
  const scaleFactor = activeDisplay.scaleFactor;

  // Convert CSS pixels to physical pixels for HiDPI/Retina displays
  const physicalRect = {
    x: Math.round(rect.x * scaleFactor),
    y: Math.round(rect.y * scaleFactor),
    width: Math.round(rect.width * scaleFactor),
    height: Math.round(rect.height * scaleFactor),
  };

  const sources = await getScreenSources();
  if (sources.length === 0) {
    throw new Error('[snapview] No screen sources available for capture');
  }

  // Use the first source (primary/active screen)
  const source = sources[0];
  const fullImage = nativeImage.createFromDataURL(source.thumbnail);
  const cropped = fullImage.crop(physicalRect);
  // Auto-copy to clipboard (FILE-03) — non-fatal; capture must succeed regardless
  try {
    clipboard.writeImage(cropped);
  } catch (err) {
    console.error('[snapview] clipboard.writeImage failed (non-fatal):', (err as Error).message);
  }
  const pngBuffer = cropped.toPNG();

  // Write to os.tmpdir()/snapview/ with unique filename (timestamp + random hex)
  const tempDir = path.join(os.tmpdir(), 'snapview');
  await fs.mkdir(tempDir, { recursive: true });
  const filename = `snapview-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.png`;
  const filePath = path.join(tempDir, filename);
  await fs.writeFile(filePath, pngBuffer);

  return { filePath };
}

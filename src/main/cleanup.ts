import { promises as fs } from 'fs';
import path from 'path';
import { SNAPVIEW_TEMP_DIR } from './constants';

// Filename pattern: snapview-{timestamp}-{uuid}.png
// Extract the millisecond timestamp to determine age without a stat syscall.
const TIMESTAMP_REGEX = /^snapview-(\d+)-/;

/**
 * Sweep SNAPVIEW_TEMP_DIR and delete PNG files older than SNAPVIEW_RETENTION_HOURS (default 24h).
 * Best-effort: errors on individual files are silently ignored.
 * The entire function is wrapped in try/catch so a missing directory does not throw.
 *
 * Uses the embedded timestamp in the filename to determine age — avoids N stat syscalls.
 *
 * IMPORTANT: Callers must fire-and-forget (no await on the critical path)
 * to avoid blocking the overlay from appearing.
 */
export async function sweepOldCaptures(): Promise<void> {
  const retentionHours = parseFloat(process.env.SNAPVIEW_RETENTION_HOURS ?? '') || 24;
  const retentionMs = retentionHours * 60 * 60 * 1000;
  const cutoff = Date.now() - retentionMs;
  try {
    const entries = await fs.readdir(SNAPVIEW_TEMP_DIR);
    for (const entry of entries) {
      if (!entry.endsWith('.png')) continue;
      const match = TIMESTAMP_REGEX.exec(entry);
      if (!match) continue;
      const timestamp = Number(match[1]);
      if (timestamp < cutoff) {
        await fs.unlink(path.join(SNAPVIEW_TEMP_DIR, entry)).catch(() => {});
      }
    }
  } catch {
    // snapview dir doesn't exist yet — silently return
  }
}

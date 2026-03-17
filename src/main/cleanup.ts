import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

/**
 * Sweep os.tmpdir()/snapview/ and delete PNG files older than SNAPVIEW_RETENTION_HOURS (default 24h).
 * Best-effort: errors on individual files are silently ignored.
 * The entire function is wrapped in try/catch so a missing directory does not throw.
 *
 * IMPORTANT: Callers must fire-and-forget (no await on the critical path)
 * to avoid blocking the overlay from appearing.
 */
export async function sweepOldCaptures(): Promise<void> {
  const retentionHours = parseFloat(process.env.SNAPVIEW_RETENTION_HOURS ?? '') || 24;
  const retentionMs = retentionHours * 60 * 60 * 1000;
  const snapviewDir = path.join(os.tmpdir(), 'snapview');
  try {
    const entries = await fs.readdir(snapviewDir);
    const now = Date.now();
    for (const entry of entries) {
      // Only process files matching the snapview-*.png naming convention
      if (!entry.startsWith('snapview-') || !entry.endsWith('.png')) continue;
      const fullPath = path.join(snapviewDir, entry);
      const stat = await fs.stat(fullPath);
      if (now - stat.mtimeMs > retentionMs) {
        await fs.unlink(fullPath).catch(() => {}); // Best-effort; ignore errors
      }
    }
  } catch {
    // snapview dir doesn't exist yet — silently return
  }
}

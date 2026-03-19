import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';

// ─── fs/promises mock ────────────────────────────────────────────────────────
const mockReaddir = mock(async (_path: string) => [] as string[]);
const mockUnlink = mock(async (_path: string) => undefined);

mock.module('fs', () => ({
  promises: {
    readdir: mockReaddir,
    unlink: mockUnlink,
    mkdir: mock(async () => undefined),
    writeFile: mock(async () => undefined),
  },
}));

// Import AFTER mock.module calls
import { sweepOldCaptures } from './cleanup';

// Helper: generate a filename with an embedded timestamp
function makeFilename(timestampMs: number): string {
  return `snapview-${timestampMs}-a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d.png`;
}

describe('sweepOldCaptures', () => {
  beforeEach(() => {
    mockReaddir.mockReset();
    mockUnlink.mockReset();
  });

  test('deletes files older than 24 hours (timestamp parsed from filename, no stat)', async () => {
    const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000;
    const oldFile = makeFilename(oldTimestamp);
    mockReaddir.mockResolvedValue([oldFile] as never);
    mockUnlink.mockResolvedValue(undefined as never);

    await sweepOldCaptures();

    expect(mockUnlink).toHaveBeenCalledTimes(1);
    const unlinkPath: string = mockUnlink.mock.calls[0][0] as string;
    expect(unlinkPath).toContain(oldFile);
  });

  test('does NOT delete files younger than 24 hours', async () => {
    const recentTimestamp = Date.now() - 1 * 60 * 60 * 1000;
    const recentFile = makeFilename(recentTimestamp);
    mockReaddir.mockResolvedValue([recentFile] as never);

    await sweepOldCaptures();

    expect(mockUnlink).not.toHaveBeenCalled();
  });

  test('ignores non-snapview files in the directory', async () => {
    const otherFile = 'other-file.png';
    const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000;
    const snapviewFile = makeFilename(oldTimestamp);
    mockReaddir.mockResolvedValue([otherFile, snapviewFile] as never);
    mockUnlink.mockResolvedValue(undefined as never);

    await sweepOldCaptures();

    // Only the snapview file should be unlinked
    expect(mockUnlink).toHaveBeenCalledTimes(1);
    const unlinkPath: string = mockUnlink.mock.calls[0][0] as string;
    expect(unlinkPath).toContain(snapviewFile);
    expect(unlinkPath).not.toContain(otherFile);
  });

  test('handles missing directory gracefully — no throw', async () => {
    const enoentError = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    mockReaddir.mockRejectedValue(enoentError as never);

    await expect(sweepOldCaptures()).resolves.toBeUndefined();
  });

  test('handles unlink errors gracefully — no throw', async () => {
    const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000;
    const oldFile = makeFilename(oldTimestamp);
    mockReaddir.mockResolvedValue([oldFile] as never);
    mockUnlink.mockRejectedValue(new Error('Permission denied') as never);

    await expect(sweepOldCaptures()).resolves.toBeUndefined();
  });

  test('ignores files without valid snapview timestamp prefix', async () => {
    const badFile = 'snapview-notanumber-xyz.png';
    mockReaddir.mockResolvedValue([badFile] as never);

    await sweepOldCaptures();

    expect(mockUnlink).not.toHaveBeenCalled();
  });

  describe('SNAPVIEW_RETENTION_HOURS env var', () => {
    afterEach(() => {
      delete process.env.SNAPVIEW_RETENTION_HOURS;
    });

    test('uses SNAPVIEW_RETENTION_HOURS env var for retention window', async () => {
      process.env.SNAPVIEW_RETENTION_HOURS = '1';
      const oldTimestamp = Date.now() - 2 * 60 * 60 * 1000;
      const oldFile = makeFilename(oldTimestamp);
      mockReaddir.mockResolvedValue([oldFile] as never);
      mockUnlink.mockResolvedValue(undefined as never);

      await sweepOldCaptures();

      expect(mockUnlink).toHaveBeenCalledTimes(1);
    });

    test('defaults to 24 hours when SNAPVIEW_RETENTION_HOURS is not set', async () => {
      delete process.env.SNAPVIEW_RETENTION_HOURS;
      const recentTimestamp = Date.now() - 23 * 60 * 60 * 1000;
      const recentFile = makeFilename(recentTimestamp);
      mockReaddir.mockResolvedValue([recentFile] as never);

      await sweepOldCaptures();

      expect(mockUnlink).not.toHaveBeenCalled();
    });

    test('defaults to 24 hours when SNAPVIEW_RETENTION_HOURS is empty string', async () => {
      process.env.SNAPVIEW_RETENTION_HOURS = '';
      const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000;
      const oldFile = makeFilename(oldTimestamp);
      mockReaddir.mockResolvedValue([oldFile] as never);
      mockUnlink.mockResolvedValue(undefined as never);

      await sweepOldCaptures();

      expect(mockUnlink).toHaveBeenCalledTimes(1);
    });

    test('defaults to 24 hours when SNAPVIEW_RETENTION_HOURS is invalid', async () => {
      process.env.SNAPVIEW_RETENTION_HOURS = 'banana';
      const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000;
      const oldFile = makeFilename(oldTimestamp);
      mockReaddir.mockResolvedValue([oldFile] as never);
      mockUnlink.mockResolvedValue(undefined as never);

      await sweepOldCaptures();

      expect(mockUnlink).toHaveBeenCalledTimes(1);
    });
  });
});

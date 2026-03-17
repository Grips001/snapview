import { describe, test, expect, mock, beforeEach } from 'bun:test';
import os from 'os';
import path from 'path';

// ─── fs/promises mock ────────────────────────────────────────────────────────
const mockReaddir = mock(async (_path: string) => [] as string[]);
const mockStat = mock(async (_path: string) => ({ mtimeMs: Date.now() }));
const mockUnlink = mock(async (_path: string) => undefined);

mock.module('fs', () => ({
  promises: {
    readdir: mockReaddir,
    stat: mockStat,
    unlink: mockUnlink,
    mkdir: mock(async () => undefined),
    writeFile: mock(async () => undefined),
  },
}));

// Import AFTER mock.module calls
import { sweepOldCaptures } from './cleanup';

const snapviewDir = path.join(os.tmpdir(), 'snapview');

describe('sweepOldCaptures', () => {
  beforeEach(() => {
    mockReaddir.mockReset();
    mockStat.mockReset();
    mockUnlink.mockReset();
  });

  test('deletes files older than 24 hours', async () => {
    const oldFile = 'snapview-1000000000000-abc12345.png';
    mockReaddir.mockResolvedValue([oldFile] as never);
    // 25 hours ago
    mockStat.mockResolvedValue({ mtimeMs: Date.now() - 25 * 60 * 60 * 1000 } as never);
    mockUnlink.mockResolvedValue(undefined as never);

    await sweepOldCaptures();

    expect(mockUnlink).toHaveBeenCalledTimes(1);
    const unlinkPath: string = mockUnlink.mock.calls[0][0] as string;
    expect(unlinkPath).toContain(oldFile);
  });

  test('does NOT delete files younger than 24 hours', async () => {
    const recentFile = 'snapview-9999999999999-def12345.png';
    mockReaddir.mockResolvedValue([recentFile] as never);
    // 1 hour ago
    mockStat.mockResolvedValue({ mtimeMs: Date.now() - 1 * 60 * 60 * 1000 } as never);

    await sweepOldCaptures();

    expect(mockUnlink).not.toHaveBeenCalled();
  });

  test('ignores non-snapview files in the directory', async () => {
    const otherFile = 'other-file.png';
    const snapviewFile = 'snapview-1000000000000-abc12345.png';
    mockReaddir.mockResolvedValue([otherFile, snapviewFile] as never);
    // All old
    mockStat.mockResolvedValue({ mtimeMs: Date.now() - 25 * 60 * 60 * 1000 } as never);
    mockUnlink.mockResolvedValue(undefined as never);

    await sweepOldCaptures();

    // Only the snapview file should be stat'd and potentially unlinked
    expect(mockStat).toHaveBeenCalledTimes(1);
    const statPath: string = mockStat.mock.calls[0][0] as string;
    expect(statPath).toContain(snapviewFile);
    expect(statPath).not.toContain(otherFile);
  });

  test('handles missing directory gracefully — no throw', async () => {
    const enoentError = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
    mockReaddir.mockRejectedValue(enoentError as never);

    await expect(sweepOldCaptures()).resolves.toBeUndefined();
  });

  test('handles unlink errors gracefully — no throw', async () => {
    const oldFile = 'snapview-1000000000000-abc12345.png';
    mockReaddir.mockResolvedValue([oldFile] as never);
    mockStat.mockResolvedValue({ mtimeMs: Date.now() - 25 * 60 * 60 * 1000 } as never);
    mockUnlink.mockRejectedValue(new Error('Permission denied') as never);

    await expect(sweepOldCaptures()).resolves.toBeUndefined();
  });
});

import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload bridge — exposes exactly 3 IPC channels to the renderer via contextBridge.
 *
 * IMPORTANT: The renderer must NEVER import from 'electron' directly.
 * All privileged operations (desktopCapturer, fs, etc.) go through this bridge.
 *
 * Channels match IPC_CHANNELS constants from src/shared/types.ts:
 *   capture:get-sources  — fetch screen sources (with macOS permission gate in main)
 *   capture:region       — capture and write a region to disk
 *   capture:cancel       — user cancelled, app will quit with exit code 2
 */
contextBridge.exposeInMainWorld('snapviewBridge', {
  getSources: (): Promise<{ id: string; thumbnail: string }[] | { permissionDenied: true }> =>
    ipcRenderer.invoke('capture:get-sources'),

  captureRegion: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): Promise<{ filePath: string } | null> => ipcRenderer.invoke('capture:region', rect),

  cancel: (): Promise<void> => ipcRenderer.invoke('capture:cancel'),
});

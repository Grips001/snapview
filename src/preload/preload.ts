import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/types';

/**
 * Preload bridge — exposes exactly 3 IPC channels to the renderer via contextBridge.
 *
 * IMPORTANT: The renderer must NEVER import from 'electron' directly.
 * All privileged operations (desktopCapturer, fs, etc.) go through this bridge.
 */
contextBridge.exposeInMainWorld('snapviewBridge', {
  getSources: (): Promise<{ id: string; thumbnail: string }[] | { permissionDenied: true }> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SOURCES),

  captureRegion: (rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  }): Promise<{ filePath: string } | null> => {
    // Runtime validation — TypeScript types are erased at runtime, so validate
    // before forwarding to main process as defense-in-depth
    if (
      typeof rect !== 'object' || rect === null ||
      typeof rect.x !== 'number' || typeof rect.y !== 'number' ||
      typeof rect.width !== 'number' || typeof rect.height !== 'number' ||
      rect.width <= 0 || rect.height <= 0 ||
      !Number.isFinite(rect.x) || !Number.isFinite(rect.y) ||
      !Number.isFinite(rect.width) || !Number.isFinite(rect.height)
    ) {
      return Promise.reject(new Error('Invalid capture region'));
    }
    // Strip unexpected properties before forwarding
    return ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_REGION, {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    });
  },

  cancel: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.CANCEL),
});

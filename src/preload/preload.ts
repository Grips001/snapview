import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/types';

/**
 * Preload bridge — exposes IPC channels to the renderer via contextBridge.
 *
 * IMPORTANT: The renderer must NEVER import from 'electron' directly.
 * All privileged operations (desktopCapturer, fs, etc.) go through this bridge.
 */
contextBridge.exposeInMainWorld('snapviewBridge', {
  getSources: (): Promise<{ id: string; thumbnail: string }[] | { permissionDenied: true }> =>
    ipcRenderer.invoke(IPC_CHANNELS.GET_SOURCES),

  captureRegion: (
    rect: {
      x: number;
      y: number;
      width: number;
      height: number;
      displayId: number;
    },
    promptText?: string
  ): Promise<{ filePath: string; promptText?: string } | null> => {
    // Runtime validation — TypeScript types are erased at runtime, so validate
    // before forwarding to main process as defense-in-depth
    if (
      typeof rect !== 'object' || rect === null ||
      typeof rect.x !== 'number' || typeof rect.y !== 'number' ||
      typeof rect.width !== 'number' || typeof rect.height !== 'number' ||
      typeof rect.displayId !== 'number' ||
      rect.width <= 0 || rect.height <= 0 ||
      !Number.isFinite(rect.x) || !Number.isFinite(rect.y) ||
      !Number.isFinite(rect.width) || !Number.isFinite(rect.height) ||
      !Number.isFinite(rect.displayId)
    ) {
      return Promise.reject(new Error('Invalid capture region'));
    }

    // promptText is optional free text — validate type, trim, and cap length
    const MAX_PROMPT_LENGTH = 4000;
    const sanitizedPromptText =
      typeof promptText === 'string' ? promptText.trim().slice(0, MAX_PROMPT_LENGTH) : '';

    // Strip unexpected properties before forwarding
    return ipcRenderer.invoke(IPC_CHANNELS.CAPTURE_REGION, {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      displayId: rect.displayId,
      promptText: sanitizedPromptText,
    });
  },

  cancel: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.CANCEL),

  /** Notify main that the user clicked "Ready" on the pre-capture confirmation applet */
  confirmReady: (): void => {
    ipcRenderer.send(IPC_CHANNELS.READY_CONFIRMED);
  },

  // ─── Multi-monitor synchronization channels ────────────────────────────────

  /** Receive display info pushed from main after window load */
  onDisplayInfo: (callback: (info: { displayId: number; thumbnail: string; scaleFactor: number }) => void): void => {
    ipcRenderer.on(IPC_CHANNELS.DISPLAY_INFO, (_event, info) => callback(info));
  },

  /** Receive selection state broadcasts from main ('active' or 'inactive') */
  onSelectionState: (callback: (state: 'active' | 'inactive') => void): void => {
    ipcRenderer.on(IPC_CHANNELS.SELECTION_STATE, (_event, state) => callback(state));
  },

  /** Notify main that this window started a drag selection */
  notifyDragStart: (): void => {
    ipcRenderer.send(IPC_CHANNELS.DRAG_STARTED);
  },

  /** Notify main to reset all windows to active state (retake) */
  notifyRetake: (): void => {
    ipcRenderer.send(IPC_CHANNELS.SELECTION_RESET);
  },
});

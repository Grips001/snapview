export interface RegionRect {
  x: number;
  y: number;
  width: number;
  height: number;
  displayId: number;
}

export interface CaptureResult {
  filePath: string;
}

/** Per-display info pushed from main process to each renderer after window load */
export interface DisplayInfo {
  displayId: number;
  thumbnail: string; // data URL from desktopCapturer
  scaleFactor: number;
}

// IPC channel names — single source of truth for main, preload, and renderer
export const IPC_CHANNELS = {
  GET_SOURCES: 'capture:get-sources',
  CAPTURE_REGION: 'capture:region',
  CANCEL: 'capture:cancel',
  DISPLAY_INFO: 'capture:display-info', // main → renderer (pushed after load)
  DRAG_STARTED: 'capture:drag-started', // renderer → main (fire-and-forget)
  SELECTION_STATE: 'capture:selection-state', // main → renderer ('active' | 'inactive')
  SELECTION_RESET: 'capture:selection-reset', // renderer → main (retake resets all)
} as const;

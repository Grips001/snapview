export interface RegionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CaptureResult {
  filePath: string;
}

export type AppPhase = 'selecting' | 'previewing' | 'approved' | 'cancelled';

// IPC channel names — single source of truth for main, preload, and renderer
export const IPC_CHANNELS = {
  GET_SOURCES: 'capture:get-sources',
  CAPTURE_REGION: 'capture:region',
  CANCEL: 'capture:cancel',
} as const;

import os from 'os';
import path from 'path';

// Temp directory for screenshots — single source of truth for capture + cleanup.
// Main-process only — must NOT be in shared/types.ts because that module is
// imported by the preload, and os/path require() calls break sandbox mode.
export const SNAPVIEW_TEMP_DIR = path.join(os.tmpdir(), 'snapview');

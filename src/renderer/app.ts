/**
 * Snapview Overlay Renderer — app.ts
 *
 * Canvas-based overlay UI with drag-to-select region selection,
 * live cutout rendering, and a preview panel with approve/retake flow.
 *
 * All Electron communication is via window.snapviewBridge (contextBridge).
 * Do NOT import from 'electron' directly.
 */

// Make this file a module so that `declare global` is valid
export {};

// ----------------------------------------
// Type declaration for preload bridge
// ----------------------------------------
declare global {
  interface Window {
    snapviewBridge: {
      getSources(): Promise<{ id: string; thumbnail: string }[] | { permissionDenied: true }>;
      captureRegion(rect: { x: number; y: number; width: number; height: number }): Promise<{ filePath: string } | null>;
      cancel(): Promise<void>;
    };
  }
}

// ----------------------------------------
// State machine types
// ----------------------------------------
type AppPhase = 'selecting' | 'previewing';

// ----------------------------------------
// Module-level state
// ----------------------------------------
let currentPhase: AppPhase = 'selecting';
let screenImage: HTMLImageElement | null = null;

// Selection tracking
let isDragging = false;
let startX = 0;
let startY = 0;
let endX = 0;
let endY = 0;

// HiDPI: devicePixelRatio for canvas scaling
let dpr = 1;

// ----------------------------------------
// DOM references (populated on DOMContentLoaded)
// ----------------------------------------
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let hintBar: HTMLElement;
let previewPanel: HTMLElement;
let previewImage: HTMLImageElement;
let btnApprove: HTMLButtonElement;
let btnRetake: HTMLButtonElement;
let permissionDialog: HTMLElement;
let btnOpenSettings: HTMLButtonElement;

// ----------------------------------------
// Drawing functions
// ----------------------------------------

/**
 * Draw the full-screen dim overlay: screen image + 45% black layer.
 */
function drawDimOverlay(): void {
  if (!screenImage) return;
  // Use CSS pixel dimensions (ctx is scaled by dpr)
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(screenImage, 0, 0, w, h);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(0, 0, w, h);
}

/**
 * Draw the drag selection: dim overlay with a bright cutout and selection border.
 */
function drawSelection(sx: number, sy: number, ex: number, ey: number): void {
  if (!screenImage) return;

  const x = Math.min(sx, ex);
  const y = Math.min(sy, ey);
  const width = Math.abs(ex - sx);
  const height = Math.abs(ey - sy);

  // Don't draw a selection that's too small (likely a mis-click)
  if (width < 5 || height < 5) {
    drawDimOverlay();
    return;
  }

  // Draw the base: screen image + dim layer
  drawDimOverlay();

  // Punch through the dim layer to show full-brightness selection content:
  // Clear the dim layer pixels in the selection rect, then redraw just that region
  // of the screen image at full brightness.
  // Source coords must be in physical pixels (screenImage is at native resolution).
  ctx.clearRect(x, y, width, height);
  ctx.drawImage(screenImage, x * dpr, y * dpr, width * dpr, height * dpr, x, y, width, height);

  // Draw 2px white selection border
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, width, height);
}

// ----------------------------------------
// State transitions
// ----------------------------------------

/**
 * Transition from selecting → previewing after a valid drag selection.
 */
function transitionToPreviewing(): void {
  currentPhase = 'previewing';
  document.body.classList.remove('selecting');

  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  // Crop the selection from the screen image into a temporary canvas
  // Source coords in physical pixels, output at physical resolution for quality
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = width * dpr;
  cropCanvas.height = height * dpr;
  const cropCtx = cropCanvas.getContext('2d')!;
  cropCtx.drawImage(screenImage!, x * dpr, y * dpr, width * dpr, height * dpr, 0, 0, width * dpr, height * dpr);

  // Set preview image source
  previewImage.src = cropCanvas.toDataURL('image/png');

  // Show preview panel, hide hint bar
  hintBar.style.display = 'none';
  previewPanel.style.display = 'flex';
}

/**
 * Transition from previewing → selecting (Retake).
 */
function transitionToSelecting(): void {
  currentPhase = 'selecting';
  document.body.classList.add('selecting');

  // Reset selection state
  isDragging = false;
  startX = 0;
  startY = 0;
  endX = 0;
  endY = 0;

  // Hide preview panel, show hint bar
  previewPanel.style.display = 'none';
  hintBar.style.display = '';

  // Redraw fresh dim overlay
  drawDimOverlay();
}

// ----------------------------------------
// Mouse event handlers
// ----------------------------------------

function onMouseDown(e: MouseEvent): void {
  if (currentPhase !== 'selecting') return;
  startX = e.clientX;
  startY = e.clientY;
  endX = e.clientX;
  endY = e.clientY;
  isDragging = true;
}

function onMouseMove(e: MouseEvent): void {
  if (!isDragging) return;
  endX = e.clientX;
  endY = e.clientY;
  drawSelection(startX, startY, endX, endY);
}

function onMouseUp(e: MouseEvent): void {
  if (!isDragging) return;
  isDragging = false;
  endX = e.clientX;
  endY = e.clientY;

  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  // Click-without-drag: cancel per UI-SPEC decision
  if (width < 5 && height < 5) {
    window.snapviewBridge.cancel();
    return;
  }

  transitionToPreviewing();
}

// ----------------------------------------
// Button handlers
// ----------------------------------------

async function onApprove(): Promise<void> {
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  await window.snapviewBridge.captureRegion({ x, y, width, height });
  // Main process handles stdout output and app.quit()
}

function onRetake(): void {
  transitionToSelecting();
}

// ----------------------------------------
// Keyboard handler
// ----------------------------------------

function onKeyDown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    window.snapviewBridge.cancel();
  }
}

// ----------------------------------------
// Initialization
// ----------------------------------------

async function init(): Promise<void> {
  // Resolve DOM references
  canvas = document.getElementById('overlay-canvas') as HTMLCanvasElement;
  ctx = canvas.getContext('2d')!;
  hintBar = document.getElementById('hint-bar') as HTMLElement;
  previewPanel = document.getElementById('preview-panel') as HTMLElement;
  previewImage = document.getElementById('preview-image') as HTMLImageElement;
  btnApprove = document.getElementById('btn-approve') as HTMLButtonElement;
  btnRetake = document.getElementById('btn-retake') as HTMLButtonElement;
  permissionDialog = document.getElementById('permission-dialog') as HTMLElement;
  btnOpenSettings = document.getElementById('btn-open-settings') as HTMLButtonElement;

  // Apply selecting state cursor
  document.body.classList.add('selecting');

  // Register global keyboard handler
  document.addEventListener('keydown', onKeyDown);

  // Fetch screen sources via preload bridge
  let sources: { id: string; thumbnail: string }[] | { permissionDenied: true };
  try {
    sources = await window.snapviewBridge.getSources();
  } catch (err) {
    console.error('[snapview] getSources failed:', err);
    await window.snapviewBridge.cancel();
    return;
  }

  // Handle macOS permission denial
  if ('permissionDenied' in sources && sources.permissionDenied === true) {
    permissionDialog.style.display = 'flex';
    hintBar.style.display = 'none';

    btnOpenSettings.addEventListener('click', () => {
      window.snapviewBridge.cancel();
    });

    return; // Do not set up canvas listeners
  }

  // Handle empty sources array
  const sourceList = sources as { id: string; thumbnail: string }[];
  if (!sourceList || sourceList.length === 0) {
    console.error('[snapview] No screen sources available.');
    await window.snapviewBridge.cancel();
    return;
  }

  // Load the first source thumbnail (data URL) into an Image element
  const firstSource = sourceList[0];
  const img = new Image();

  img.onload = () => {
    screenImage = img;

    // Size canvas backing buffer to physical pixels for HiDPI accuracy.
    // ctx.scale(dpr) lets all drawing coords stay in CSS pixels (matching mouse events).
    dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.scale(dpr, dpr);

    // Draw initial dim overlay
    drawDimOverlay();

    // Register canvas mouse listeners (only after image is ready)
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);

    // Register button handlers
    btnApprove.addEventListener('click', onApprove);
    btnRetake.addEventListener('click', onRetake);
  };

  img.onerror = () => {
    console.error('[snapview] Failed to load screen source thumbnail.');
    window.snapviewBridge.cancel();
  };

  img.src = firstSource.thumbnail;
}

// ----------------------------------------
// Entry point
// ----------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  init().catch((err) => {
    console.error('[snapview] Renderer init error:', err);
    window.snapviewBridge.cancel();
  });
});

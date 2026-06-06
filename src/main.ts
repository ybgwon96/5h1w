import "./style.css";
import { App } from "./app";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const overlay = document.getElementById("overlay") as HTMLElement;
const app = new App(canvas, overlay);
const ctx = canvas.getContext("2d", { alpha: false })!;

let dpr = 1;
function resize(): void {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  app.resize(w, h);
}
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", resize);
resize();

// ---- pointer drag input -------------------------------------------------
canvas.addEventListener(
  "pointerdown",
  (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    app.pointerDown(e.clientX, e.clientY);
  },
  { passive: false }
);
canvas.addEventListener(
  "pointermove",
  (e) => {
    e.preventDefault();
    app.pointerMove(e.clientX, e.clientY);
  },
  { passive: false }
);
const end = (e: PointerEvent): void => {
  e.preventDefault();
  app.pointerUp();
};
canvas.addEventListener("pointerup", end, { passive: false });
canvas.addEventListener("pointercancel", end, { passive: false });

// ---- main loop ----------------------------------------------------------
let hidden = false;
let last = performance.now();
document.addEventListener("visibilitychange", () => {
  hidden = document.hidden;
  last = performance.now();
});
function frame(now: number): void {
  let dt = (now - last) / 1000;
  last = now;
  if (!hidden) {
    dt = Math.min(dt, 1 / 30);
    app.update(dt);
    app.render();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Expose for automated tests in dev only; stripped from production bundles.
if (import.meta.env.DEV) {
  (window as unknown as { app: App }).app = app;
}

// ---- PWA service worker -------------------------------------------------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline support is best-effort */
    });
  });
}

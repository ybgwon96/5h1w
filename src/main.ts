import "./style.css";
import { Game } from "./game";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d", { alpha: false })!;
const game = new Game(ctx);

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
  game.resize(w, h);
}

window.addEventListener("resize", resize);
window.addEventListener("orientationchange", resize);
resize();

// ---- Input: tap / click / keyboard -------------------------------------
function onTap(e: Event): void {
  e.preventDefault();
  game.tap();
}
canvas.addEventListener("pointerdown", onTap);
window.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "ArrowUp" || e.code === "Enter") {
    e.preventDefault();
    game.tap();
  }
});
// Pause the loop's clock when tabbed away so dt never explodes.
let hidden = false;
document.addEventListener("visibilitychange", () => {
  hidden = document.hidden;
  last = performance.now();
});

// ---- Main loop ----------------------------------------------------------
let last = performance.now();
function frame(now: number): void {
  let dt = (now - last) / 1000;
  last = now;
  if (!hidden) {
    // Clamp dt to avoid tunneling after a stall.
    dt = Math.min(dt, 1 / 30);
    game.update(dt);
    game.render();
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// ---- PWA service worker -------------------------------------------------
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* offline support is best-effort */
    });
  });
}

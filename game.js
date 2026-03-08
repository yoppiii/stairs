const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");
const leftBtn = document.getElementById("left-btn");
const rightBtn = document.getElementById("right-btn");

const STORAGE_KEY = "boogie-stairs-best";

const state = {
  running: false,
  score: 0,
  best: Number(localStorage.getItem(STORAGE_KEY) || 0),
  steps: [],
  player: { x: 0, y: 0, targetX: 0, targetY: 0 },
  cameraY: 0,
  dangerY: 0,
  lastTime: 0,
  stepW: 0,
  stepH: 0,
  centerX: 0,
  leftX: 0,
  rightX: 0,
  laneGap: 0,
};

bestEl.textContent = String(state.best);

function resizeCanvas() {
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const w = rect.width;
  const h = rect.height;

  state.stepW = Math.max(90, w * 0.18);
  state.stepH = Math.max(34, h * 0.045);
  state.centerX = w * 0.5;
  state.laneGap = Math.max(100, w * 0.22);
  state.leftX = state.centerX - state.laneGap * 0.5;
  state.rightX = state.centerX + state.laneGap * 0.5;

  if (!state.running) {
    draw();
  }
}

window.addEventListener("resize", resizeCanvas);

function createInitialSteps() {
  state.steps = [];
  let side = Math.random() < 0.5 ? -1 : 1;
  const total = 180;
  for (let i = 0; i < total; i += 1) {
    if (Math.random() < 0.45) side *= -1;
    const x = side === -1 ? state.leftX : state.rightX;
    const y = i * state.stepH;
    state.steps.push({ side, x, y });
  }
}

function extendStepsIfNeeded() {
  const needUntil = state.cameraY + canvas.getBoundingClientRect().height + 1000;
  while (state.steps[state.steps.length - 1].y < needUntil) {
    const prev = state.steps[state.steps.length - 1];
    let side = prev.side;
    if (Math.random() < 0.45) side *= -1;
    const x = side === -1 ? state.leftX : state.rightX;
    state.steps.push({ side, x, y: prev.y + state.stepH });
  }
}

function resetGame() {
  state.score = 0;
  state.running = true;
  scoreEl.textContent = "0";

  createInitialSteps();

  const first = state.steps[0];
  state.player.x = first.x;
  state.player.y = first.y;
  state.player.targetX = first.x;
  state.player.targetY = first.y;

  state.cameraY = Math.max(0, first.y - canvas.getBoundingClientRect().height * 0.62);
  state.dangerY = first.y - canvas.getBoundingClientRect().height * 0.18;

  state.lastTime = performance.now();

  overlay.classList.remove("visible");
  requestAnimationFrame(loop);
}

function getStepAt(index) {
  return state.steps[index] || null;
}

function nextMove(dir) {
  if (!state.running) return;

  const nextIndex = state.score + 1;
  const next = getStepAt(nextIndex);
  if (!next) return;

  if (next.side !== dir) {
    endGame();
    return;
  }

  state.score += 1;
  scoreEl.textContent = String(state.score);

  state.player.targetX = next.x;
  state.player.targetY = next.y;

  const targetCamera = Math.max(0, next.y - canvas.getBoundingClientRect().height * 0.62);
  if (targetCamera > state.cameraY) state.cameraY = targetCamera;

  if (state.score > state.best) {
    state.best = state.score;
    bestEl.textContent = String(state.best);
    localStorage.setItem(STORAGE_KEY, String(state.best));
  }

  extendStepsIfNeeded();
}

function endGame() {
  state.running = false;
  overlayTitle.textContent = "게임 오버";
  overlayText.textContent = `점수 ${state.score}점 · 다시 도전해요!`;
  overlay.classList.add("visible");
}

function drawBackground(w, h) {
  const grd = ctx.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, "#16324f");
  grd.addColorStop(0.7, "#0f253c");
  grd.addColorStop(1, "#091725");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 12; i += 1) {
    const y = ((i * 140) - (state.cameraY * 0.35)) % (h + 160);
    ctx.fillStyle = "#d9e2ec";
    ctx.fillRect(0, y - 6, w, 2);
  }
  ctx.globalAlpha = 1;
}

function drawSteps(w, h) {
  const viewTop = state.cameraY - 120;
  const viewBottom = state.cameraY + h + 120;

  for (const step of state.steps) {
    if (step.y < viewTop || step.y > viewBottom) continue;

    const sy = step.y - state.cameraY;
    const sx = step.x - state.stepW / 2;

    ctx.fillStyle = "#486581";
    ctx.fillRect(sx, sy, state.stepW, state.stepH);
    ctx.fillStyle = "#9fb3c8";
    ctx.fillRect(sx + 6, sy + 6, state.stepW - 12, state.stepH - 12);
  }
}

function drawPlayer() {
  const px = state.player.x;
  const py = state.player.y - state.cameraY - state.stepH * 0.55;

  ctx.fillStyle = "#f6ad55";
  ctx.beginPath();
  ctx.arc(px, py, state.stepH * 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#102a43";
  ctx.beginPath();
  ctx.arc(px - 6, py - 3, 2.7, 0, Math.PI * 2);
  ctx.arc(px + 6, py - 3, 2.7, 0, Math.PI * 2);
  ctx.fill();
}

function drawDanger(w) {
  const y = state.dangerY - state.cameraY;
  ctx.fillStyle = "rgba(229, 62, 62, 0.26)";
  ctx.fillRect(0, y, w, canvas.getBoundingClientRect().height - y);

  ctx.strokeStyle = "#e53e3e";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(w, y);
  ctx.stroke();
}

function draw() {
  const { width: w, height: h } = canvas.getBoundingClientRect();
  drawBackground(w, h);
  drawSteps(w, h);
  drawDanger(w);
  drawPlayer();
}

function update(dt) {
  const lerp = 1 - Math.pow(0.001, dt);
  state.player.x += (state.player.targetX - state.player.x) * lerp;
  state.player.y += (state.player.targetY - state.player.y) * lerp;

  const dangerSpeed = state.stepH * (0.55 + Math.min(0.45, state.score * 0.0025));
  state.dangerY += dangerSpeed * dt;

  if (state.player.y < state.dangerY + state.stepH * 0.6) {
    endGame();
  }
}

function loop(t) {
  if (!state.running) return;

  const dt = Math.min(0.05, (t - state.lastTime) / 1000);
  state.lastTime = t;

  update(dt);
  draw();

  requestAnimationFrame(loop);
}

function startOrRestart() {
  overlayTitle.textContent = "탭해서 시작";
  overlayText.textContent = "왼쪽/오른쪽을 선택하며 계단을 올라가세요";
  resetGame();
}

leftBtn.addEventListener("click", () => nextMove(-1));
rightBtn.addEventListener("click", () => nextMove(1));
startBtn.addEventListener("click", startOrRestart);

canvas.addEventListener("pointerdown", (e) => {
  if (!state.running) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  nextMove(x < rect.width / 2 ? -1 : 1);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") nextMove(-1);
  if (e.key === "ArrowRight") nextMove(1);
  if (e.key === " " && !state.running) startOrRestart();
});

resizeCanvas();

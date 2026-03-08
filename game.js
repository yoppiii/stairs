const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlay-title");
const overlayText = document.getElementById("overlay-text");
const startBtn = document.getElementById("start-btn");

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
  laneCount: 6,
  laneXs: [],
  laneGap: 0,
  stepW: 0,
  stepH: 0,
  currentLane: 0,
  face: "neutral",
  bumpUntil: 0,
  bumpDir: 0,
  failing: false,
  failStartedAt: 0,
  failVelocity: 0,
  failDir: 1,
  failTargetX: 0,
};

bestEl.textContent = String(state.best);

function worldToScreenY(worldY, viewportHeight) {
  return viewportHeight - (worldY - state.cameraY) - state.stepH;
}

function worldToScreenLineY(worldY, viewportHeight) {
  return viewportHeight - (worldY - state.cameraY);
}

function laneToX(lane) {
  return state.laneXs[lane] ?? state.laneXs[0] ?? 0;
}

function clampLane(lane) {
  return Math.max(0, Math.min(state.laneCount - 1, lane));
}

function pickNextLane(prevLane) {
  if (prevLane <= 0) return 1;
  if (prevLane >= state.laneCount - 1) return state.laneCount - 2;
  return prevLane + (Math.random() < 0.5 ? -1 : 1);
}

function resizeCanvas() {
  if (state.running) return;
  const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.floor(rect.width * dpr);
  canvas.height = Math.floor(rect.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const w = rect.width;
  const h = rect.height;

  state.stepH = Math.max(34, h * 0.045);
  state.stepW = Math.max(52, w * 0.09);

  const sidePadding = Math.max(26, w * 0.1);
  const laneWidth = Math.max(1, w - sidePadding * 2);
  state.laneGap = laneWidth / (state.laneCount - 1);
  state.stepW = Math.min(state.stepW, state.laneGap * 0.72);
  state.laneXs = Array.from({ length: state.laneCount }, (_, i) => sidePadding + state.laneGap * i);

  draw();
}

window.addEventListener("resize", () => {
  if (!state.running) resizeCanvas();
});

function createInitialSteps() {
  state.steps = [];
  let lane = Math.floor(state.laneCount / 2);
  const total = 180;

  for (let i = 0; i < total; i += 1) {
    if (i > 0) lane = pickNextLane(lane);
    state.steps.push({ lane, y: i * state.stepH });
  }
}

function extendStepsIfNeeded() {
  const needUntil = state.cameraY + canvas.getBoundingClientRect().height + 1000;
  while (state.steps[state.steps.length - 1].y < needUntil) {
    const prev = state.steps[state.steps.length - 1];
    state.steps.push({ lane: pickNextLane(prev.lane), y: prev.y + state.stepH });
  }
}

function resetGame() {
  state.score = 0;
  state.running = true;
  state.face = "neutral";
  state.bumpUntil = 0;
  state.bumpDir = 0;
  state.failing = false;
  state.failStartedAt = 0;
  state.failVelocity = 0;
  state.failDir = 1;
  state.failTargetX = state.player.x;
  scoreEl.textContent = "0";

  createInitialSteps();

  const first = state.steps[0];
  state.currentLane = first.lane;
  state.player.x = laneToX(first.lane);
  state.player.y = first.y;
  state.player.targetX = laneToX(first.lane);
  state.player.targetY = first.y;

  const h = canvas.getBoundingClientRect().height;
  state.cameraY = first.y - h * 0.28;
  state.dangerY = first.y - h * 0.16;

  state.lastTime = performance.now();

  overlay.classList.remove("visible");
  requestAnimationFrame(loop);
}

function getStepAt(index) {
  return state.steps[index] || null;
}

function triggerWallBump(dir) {
  state.bumpDir = dir;
  state.bumpUntil = performance.now() + 220;
}

function triggerFailFall(dir) {
  if (state.failing || !state.running) return;
  const normalizedDir = dir === -1 ? -1 : 1;
  let wrongLane = clampLane(state.currentLane + normalizedDir);
  if (wrongLane === state.currentLane) {
    wrongLane = clampLane(state.currentLane - normalizedDir);
  }
  state.failing = true;
  state.face = "dead";
  state.failStartedAt = performance.now();
  state.failVelocity = 0;
  state.failDir = normalizedDir;
  state.failTargetX = laneToX(wrongLane);
}

function nextMove(dir) {
  if (!state.running || state.failing) return;

  const atLeftEdge = state.currentLane === 0 && dir === -1;
  const atRightEdge = state.currentLane === state.laneCount - 1 && dir === 1;
  if (atLeftEdge || atRightEdge) {
    triggerWallBump(dir);
    return;
  }

  const nextIndex = state.score + 1;
  const next = getStepAt(nextIndex);
  if (!next) return;

  const expectedLane = clampLane(state.currentLane + dir);
  if (next.lane !== expectedLane) {
    triggerFailFall(dir);
    return;
  }

  state.score += 1;
  scoreEl.textContent = String(state.score);
  state.face = "smile";

  state.currentLane = next.lane;
  state.player.targetX = laneToX(next.lane);
  state.player.targetY = next.y;

  const targetCamera = next.y - canvas.getBoundingClientRect().height * 0.28;
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
  state.failing = false;
  state.face = "dead";
  overlayTitle.textContent = "게임 오버";
  overlayText.textContent = `점수 ${state.score}점 · 다시 도전해요!`;
  startBtn.textContent = "재시작";
  overlay.classList.add("game-over");
  overlay.classList.add("visible");
}

function drawBackground(w, h) {
  const grd = ctx.createLinearGradient(0, 0, 0, h);
  grd.addColorStop(0, "#d7ecff");
  grd.addColorStop(0.65, "#b3d5f6");
  grd.addColorStop(1, "#95bfe9");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);

  ctx.globalAlpha = 0.12;
  for (let i = 0; i < 12; i += 1) {
    const y = ((i * 140) - (state.cameraY * 0.35)) % (h + 160);
    ctx.fillStyle = "#f6fbff";
    ctx.fillRect(0, y - 6, w, 2);
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = "rgba(56, 97, 143, 0.18)";
  ctx.lineWidth = 1;
  for (const laneX of state.laneXs) {
    ctx.beginPath();
    ctx.moveTo(laneX, 0);
    ctx.lineTo(laneX, h);
    ctx.stroke();
  }
}

function drawSteps(w, h) {
  const viewTop = state.cameraY - 120;
  const viewBottom = state.cameraY + h + 120;

  for (const step of state.steps) {
    if (step.y < viewTop || step.y > viewBottom) continue;

    const sy = worldToScreenY(step.y, h);
    const sx = laneToX(step.lane) - state.stepW / 2;

    const capH = Math.max(5, Math.round(state.stepH * 0.18));
    const inset = Math.max(5, Math.round(state.stepW * 0.1));
    const lip = Math.max(2, Math.round(capH * 0.45));

    // Top face (trapezoid) for a light perspective effect.
    ctx.beginPath();
    ctx.moveTo(sx + inset, sy);
    ctx.lineTo(sx + state.stepW - inset, sy);
    ctx.lineTo(sx + state.stepW, sy + capH);
    ctx.lineTo(sx, sy + capH);
    ctx.closePath();
    ctx.fillStyle = "#a9bfdc";
    ctx.fill();

    // Inner highlight to separate face from background.
    ctx.beginPath();
    ctx.moveTo(sx + inset + 5, sy + 1);
    ctx.lineTo(sx + state.stepW - inset - 5, sy + 1);
    ctx.lineTo(sx + state.stepW - 5, sy + capH - 1);
    ctx.lineTo(sx + 5, sy + capH - 1);
    ctx.closePath();
    ctx.fillStyle = "#dbe7f6";
    ctx.fill();

    // Front lip (thin) with diagonal corners.
    ctx.beginPath();
    ctx.moveTo(sx, sy + capH);
    ctx.lineTo(sx + state.stepW, sy + capH);
    ctx.lineTo(sx + state.stepW - inset * 0.6, sy + capH + lip);
    ctx.lineTo(sx + inset * 0.6, sy + capH + lip);
    ctx.closePath();
    ctx.fillStyle = "#6f87a9";
    ctx.fill();
  }
}

function drawPlayer() {
  const px = state.player.x;
  const h = canvas.getBoundingClientRect().height;
  const stepTopY = worldToScreenY(state.player.y, h);
  const footY = stepTopY + 1;
  const now = performance.now();
  const t = now * 0.006;
  const bob = state.failing ? 0 : Math.sin(t) * 1.9;
  const tilt = state.failing ? 0 : Math.sin(t * 0.8) * 0.06;
  const bumpActive = now < state.bumpUntil;
  const bumpPhase = bumpActive ? 1 - (state.bumpUntil - now) / 220 : 0;
  const bumpOffsetX = bumpActive ? state.bumpDir * (Math.sin(bumpPhase * Math.PI * 3) * 6) : 0;
  const failRotProgress = state.failing ? Math.min(1, (now - state.failStartedAt) / 220) : 0;
  const failRotation = state.failing ? Math.PI * failRotProgress * state.failDir : 0;

  ctx.save();
  ctx.translate(px + bumpOffsetX, footY + bob);
  ctx.rotate(tilt + failRotation);

  const p = Math.max(2, Math.round(state.stepH * 0.1));
  const drawPx = (x, y, w, hh, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x * p), Math.round(y * p), Math.round(w * p), Math.round(hh * p));
  };
  const faceState = bumpActive ? "bump" : state.face;

  // ground contact shadow (on top surface)
  ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
  ctx.fillRect(-4 * p, -1 * p, 8 * p, 1 * p);

  // legs and shoes (anchored to footY)
  drawPx(-2, -3, 2, 3, "#8aa3c9");
  drawPx(0, -3, 2, 3, "#8aa3c9");
  drawPx(-2, -1, 2, 1, "#1c2744");
  drawPx(0, -1, 2, 1, "#1c2744");

  // body
  drawPx(-3, -8, 6, 5, "#98b4db");
  drawPx(-4, -7, 1, 2, "#98b4db");
  drawPx(3, -7, 1, 2, "#98b4db");
  drawPx(0, -7, 1, 3, "#dce9ff");
  drawPx(-3, -9, 6, 1, "#6e86b0");

  // neck
  drawPx(-1, -10, 2, 1, "#ffd6c9");

  // head
  drawPx(-5, -16, 10, 7, "#fff0e8");
  drawPx(-5, -16, 10, 1, "#f3d7cd");
  if (faceState === "dead") {
    drawPx(-4, -15, 3, 1, "#2f2a35");
    drawPx(-3, -16, 1, 3, "#2f2a35");
    drawPx(1, -15, 3, 1, "#2f2a35");
    drawPx(2, -16, 1, 3, "#2f2a35");
  } else if (faceState === "bump") {
    drawPx(-3, -14, 2, 1, "#2f2a35");
    drawPx(-2, -15, 1, 2, "#2f2a35");
    drawPx(1, -14, 2, 1, "#2f2a35");
    drawPx(2, -15, 1, 2, "#2f2a35");
  } else if (faceState === "smile") {
    // closed happy eyes
    drawPx(-3, -13, 2, 1, "#2f2a35");
    drawPx(1, -13, 2, 1, "#2f2a35");
  } else {
    drawPx(-2, -13, 1, 1, "#2f2a35");
    drawPx(1, -13, 1, 1, "#2f2a35");
  }
  drawPx(-4, -11, 2, 1, "#f2b7b4");
  drawPx(2, -11, 2, 1, "#f2b7b4");
  if (faceState === "smile") {
    // big U smile
    drawPx(-2, -11, 1, 1, "#2f2a35");
    drawPx(1, -11, 1, 1, "#2f2a35");
    drawPx(-1, -10, 2, 1, "#2f2a35");
  } else if (faceState === "bump") {
    drawPx(-2, -11, 4, 1, "#7c5057");
  } else if (faceState === "dead") {
    drawPx(-1, -11, 2, 1, "#6f6f7a");
  } else {
    drawPx(-1, -11, 2, 1, "#b07f87");
  }

  // hat (blue captain style)
  drawPx(-5, -18, 10, 2, "#6f8ebf");
  drawPx(-2, -19, 4, 1, "#8fb0db");
  drawPx(-4, -17, 8, 1, "#4f648c");

  // sparkle
  if (Math.sin(t * 1.7) > 0.15) {
    drawPx(6, -15, 1, 1, "#ffe8a3");
    drawPx(7, -14, 1, 1, "#ffe8a3");
    drawPx(6, -13, 1, 1, "#ffe8a3");
    drawPx(5, -14, 1, 1, "#ffe8a3");
  }

  ctx.restore();
}

function drawDanger(w) {
  const h = canvas.getBoundingClientRect().height;
  const y = worldToScreenLineY(state.dangerY, h) + 2;
  ctx.fillStyle = "rgba(229, 62, 62, 0.26)";
  ctx.fillRect(0, y, w, h - y);

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
  const level = Math.floor(state.score / 10);
  const dangerSpeed = state.stepH * (2.2 * Math.pow(1.3, level));
  state.dangerY += dangerSpeed * dt;

  if (state.failing) {
    const gravity = state.stepH * 18;
    state.failVelocity += gravity * dt;
    state.player.y -= state.failVelocity * dt;
    state.player.x += (state.failTargetX - state.player.x) * Math.min(1, dt * 10);

    const playerFootWorldY = state.player.y + state.stepH;
    if (playerFootWorldY <= state.dangerY + 1) {
      endGame();
    }
    return;
  }

  const lerp = 1 - Math.pow(0.001, dt);
  state.player.x += (state.player.targetX - state.player.x) * lerp;
  state.player.y += (state.player.targetY - state.player.y) * lerp;

  // Failure starts when danger reaches the top surface of the platform the player stands on.
  const playerPlatformTopWorldY = state.player.y + state.stepH;
  if (state.dangerY >= playerPlatformTopWorldY) {
    const outwardDir = state.currentLane < (state.laneCount - 1) / 2 ? -1 : 1;
    triggerFailFall(outwardDir);
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
  overlayTitle.textContent = "부기의 계단";
  overlayText.textContent = "왼쪽/오른쪽 터치로 계단을 올라가세요";
  startBtn.textContent = "무한모드";
  overlay.classList.remove("game-over");
  resetGame();
}

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

const config = {
  title: "A galaxy made for you",
  subtitle: "My love",
  enterLabel: "Enter our universe",
  hint: "Drag to explore, pinch to zoom",
  music: { src: "bye.mp3", volume: 0.6 },
  words: [
    "John Raphael Abino",
    "My whole universe",
    "I adore you",
    "Always with you",
    "Our little forever",
    "You are magic",
    "Every day with you",
    "Make a wish",
    "Stay close",
    "You feel like home",
    "My favourite person",
    "Love you endlessly"
  ],
  memories: [
    {
      title: "The night we met",
      text: "I still remember the exact moment I knew. Everything after has felt like a gift.",
      shape: "moon",
      colors: ["255,207,138", "255,143,177"]
    },
    {
      title: "The little things",
      text: "Quiet mornings, shared playlists, and the way you laugh before the punchline.",
      shape: "sparkle",
      colors: ["94,234,212", "124,92,255"]
    },
    {
      title: "Still choosing you",
      text: "In every version of the story, I would find my way back to you.",
      shape: "heart",
      colors: ["255,143,177", "255,207,138"]
    },
    {
      title: "Make a wish",
      text: "Another year of you. May it be gentle, bright, and full of everything you love.",
      shape: "star",
      colors: ["124,92,255", "94,234,212"]
    }
  ]
};

const shapes = {
  moon: "M40 6a26 26 0 1 0 18 44A22 22 0 0 1 40 6z",
  star: "M32 4l8.5 17.2 19 2.8-13.8 13.4 3.3 18.9L32 47.4l-17 8.9 3.3-18.9L4.5 24l19-2.8z",
  heart: "M32 56S6 40 6 22A13 13 0 0 1 32 16a13 13 0 0 1 26 6c0 18-26 34-26 34z",
  sparkle: "M32 4c2 14 8 20 22 28-14 8-20 14-22 28-2-14-8-20-22-28 14-8 20-14 22-28z"
};

const paths = {};
for (const [name, d] of Object.entries(shapes)) {
  paths[name] = new Path2D(d);
}

const TAU = Math.PI * 2;
const GALAXY_RADIUS = 22;
const GALAXY_HOLE = 2.4;
const CORE_RADIUS = 5.5;
const BASE_DISTANCE = 46;
const START_DISTANCE = 92;
const HEART_SCALE = 0.5;
const HEART_LIFT = 10.9;
const GALAXY_SPIN = 0.07;
const ORB_SPIN = 0.11;
const EMBER_CEILING = 9;

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const isCompact = window.matchMedia("(max-width: 700px), (pointer: coarse)").matches;
const JOURNEY_LENGTH = reduceMotion ? 1.4 : 4.4;

const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const lerp = (from, to, t) => from + (to - from) * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const $ = (id) => document.getElementById(id);
const canvas = $("sky");
const ctx = canvas.getContext("2d");
const introEl = $("intro");
const hintEl = $("hint");
const navEl = $("memoryNav");
const memoryEl = $("memory");
const memoryArt = $("memoryArt");
const memoryTitle = $("memoryTitle");
const memoryText = $("memoryText");
const memoryClose = $("memoryClose");
const enterButton = $("enter");
const music = $("music");
const soundToggle = $("soundToggle");

const view = { width: 0, height: 0, cx: 0, cy: 0, focal: 0, background: null };
const camera = { yaw: 0, yawVelocity: 0, tilt: 0.42, zoom: 1, pitch: 1, distance: START_DISTANCE };
const journey = { phase: "intro", elapsed: 0, arrive: 0, galaxyAlpha: 0, heartReveal: 0, starSpeed: 0.05 };
const pointer = { down: false, travel: 0, x: 0, y: 0, time: 0 };

let sinPitch = Math.sin(camera.pitch);
let cosPitch = Math.cos(camera.pitch);
let lastFocus = null;

const projected = { x: 0, y: 0, scale: 0, depth: 0 };

function project(x, y, z) {
  const rise = y * cosPitch + z * sinPitch;
  const depth = z * cosPitch - y * sinPitch + camera.distance;
  if (depth < 1) return false;
  const scale = view.focal / depth;
  projected.x = view.cx + x * scale;
  projected.y = view.cy - rise * scale;
  projected.scale = scale;
  projected.depth = depth;
  return true;
}

function createGlow(rgb) {
  const size = 128;
  const sprite = document.createElement("canvas");
  sprite.width = size;
  sprite.height = size;
  const g = sprite.getContext("2d");
  const gradient = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, `rgba(${rgb}, 1)`);
  gradient.addColorStop(0.25, `rgba(${rgb}, 0.5)`);
  gradient.addColorStop(1, `rgba(${rgb}, 0)`);
  g.fillStyle = gradient;
  g.fillRect(0, 0, size, size);
  return sprite;
}

function sampleColor(stops, t) {
  const position = clamp(t, 0, 1) * (stops.length - 1);
  const index = Math.min(Math.floor(position), stops.length - 2);
  const mix = position - index;
  return stops[index].map((channel, i) => Math.round(lerp(channel, stops[index + 1][i], mix)));
}

function buildStars(count) {
  return Array.from({ length: count }, () => ({
    angle: rand(0, TAU),
    reach: rand(0.25, 1.6),
    depth: rand(0.04, 1),
    tone: Math.floor(rand(0, 3))
  }));
}

function buildGalaxy(count) {
  const arms = 3;
  const colorStops = [[255, 214, 153], [255, 143, 177], [166, 140, 255], [94, 234, 212]];
  const alphas = [0.5, 0.75, 1];
  const steps = 12;
  const galaxy = {
    radius: new Float32Array(count),
    angle: new Float32Array(count),
    height: new Float32Array(count),
    size: new Float32Array(count),
    phase: new Float32Array(count),
    bins: []
  };
  const buckets = new Map();

  for (let i = 0; i < count; i++) {
    const t = Math.pow(Math.random(), 0.75);
    const radius = GALAXY_HOLE + t * (GALAXY_RADIUS - GALAXY_HOLE);
    const isHalo = Math.random() < 0.14;
    const scatter = (Math.random() + Math.random() + Math.random() - 1.5) * (0.28 + t * 0.5);
    const armAngle = (i % arms) * (TAU / arms) + radius * 0.42 + scatter;

    galaxy.radius[i] = radius;
    galaxy.angle[i] = isHalo ? rand(0, TAU) : armAngle;
    galaxy.height[i] = (Math.random() + Math.random() - 1) * (0.5 + (1 - t) * 0.9);
    galaxy.size[i] = rand(0.05, 0.12);
    galaxy.phase[i] = rand(0, TAU);

    const step = Math.round(t * (steps - 1));
    const key = step * alphas.length + Math.floor(rand(0, alphas.length));
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(i);
  }

  for (const [key, list] of buckets) {
    const step = Math.floor(key / alphas.length);
    const alpha = alphas[key % alphas.length];
    const [r, g, b] = sampleColor(colorStops, step / (steps - 1));
    galaxy.bins.push({ style: `rgba(${r}, ${g}, ${b}, ${alpha})`, indices: Int32Array.from(list) });
  }

  return galaxy;
}

function buildHeart(count) {
  const heart = {
    x: new Float32Array(count),
    y: new Float32Array(count),
    z: new Float32Array(count),
    dx: new Float32Array(count),
    dy: new Float32Array(count),
    dz: new Float32Array(count),
    size: new Float32Array(count),
    phase: new Float32Array(count),
    bins: [[], [], []]
  };

  for (let i = 0; i < count; i++) {
    const t = rand(0, TAU);
    const onEdge = Math.random() < 0.42;
    const fill = onEdge ? 1 - Math.random() * 0.04 : Math.sqrt(Math.random()) * 0.96;
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);

    heart.x[i] = hx * fill * HEART_SCALE;
    heart.y[i] = hy * fill * HEART_SCALE + HEART_LIFT;
    heart.z[i] = (Math.random() - 0.5) * 2.4 * (1 - fill * 0.5);

    const theta = rand(0, TAU);
    const lift = rand(-1, 1);
    const spread = Math.sqrt(1 - lift * lift);
    heart.dx[i] = Math.cos(theta) * spread;
    heart.dy[i] = lift;
    heart.dz[i] = Math.sin(theta) * spread;

    heart.size[i] = onEdge ? rand(0.09, 0.16) : rand(0.07, 0.13);
    heart.phase[i] = rand(0, TAU);

    const tone = Math.random() < 0.05 ? 2 : onEdge ? 0 : 1;
    heart.bins[tone].push(i);
  }

  heart.bins = heart.bins.map((list) => Int32Array.from(list));
  return heart;
}

function buildWords() {
  const radii = [9, 12, 15, 18, 20.5];
  const tints = ["#ffe2b8", "#c6fbf3", "#ffc2d6", "#ddd3ff"];
  return config.words.map((text, i) => ({
    text,
    radius: radii[i % radii.length] + rand(-0.8, 0.8),
    angle: i * 2.399,
    height: rand(0.4, 1.6),
    size: rand(0.85, 1.2),
    tint: tints[i % tints.length],
    drift: rand(0.97, 1.03),
    bob: rand(0, TAU)
  }));
}

function buildOrbs() {
  const radii = [10.5, 15, 18, 12.5];
  return config.memories.map((memory, i) => ({
    memory,
    radius: radii[i % radii.length],
    angle: (i * TAU) / config.memories.length + 0.6,
    glow: createGlow(memory.colors[0]),
    hit: { x: -999, y: -999, radius: 0 }
  }));
}

function resetEmber(ember) {
  ember.radius = rand(3, 19);
  ember.angle = rand(0, TAU);
  ember.y = 0;
  ember.rise = rand(0.5, 1.1);
  ember.size = rand(0.45, 0.9);
  ember.sway = rand(0, TAU);
  ember.tint = Math.random() < 0.5 ? "255,143,177" : "255,207,138";
  return ember;
}

function buildEmbers(count) {
  return Array.from({ length: count }, () => {
    const ember = resetEmber({});
    ember.y = rand(0, EMBER_CEILING);
    return ember;
  });
}

const stars = buildStars(520);
const galaxy = buildGalaxy(isCompact ? 8000 : 12000);
const heart = buildHeart(isCompact ? 3200 : 4200);
const words = buildWords();
const orbs = buildOrbs();
const embers = buildEmbers(reduceMotion ? 0 : isCompact ? 16 : 26);
const heartGlow = createGlow("255,190,150");
const starTones = ["#ffffff", "#ffd9e6", "#c6fbf3"];
const heartTones = ["rgba(255, 205, 150, 0.8)", "rgba(255, 143, 177, 1)", "rgba(255, 255, 255, 1)"];

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, isCompact ? 1.5 : 2);
  view.width = window.innerWidth;
  view.height = window.innerHeight;
  view.cx = view.width / 2;
  view.cy = view.height * 0.62;
  view.focal = Math.min(view.width * 1.2, view.height * 1.15);

  canvas.width = Math.round(view.width * dpr);
  canvas.height = Math.round(view.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const gradient = ctx.createRadialGradient(
    view.cx, view.cy, 0,
    view.cx, view.cy, Math.hypot(view.width, view.height) * 0.65
  );
  gradient.addColorStop(0, "#1b1046");
  gradient.addColorStop(0.5, "#0d0826");
  gradient.addColorStop(1, "#07051a");
  view.background = gradient;
}

function advanceJourney(dt) {
  if (journey.phase === "intro") return;

  journey.elapsed += dt;
  const progress = clamp(journey.elapsed / JOURNEY_LENGTH, 0, 1);
  const surge = Math.sin(Math.PI * Math.min(progress / 0.8, 1));

  journey.arrive = easeOut(progress);
  journey.galaxyAlpha = easeInOut(clamp((progress - 0.25) / 0.45, 0, 1));
  journey.heartReveal = easeOut(clamp((progress - 0.45) / 0.5, 0, 1));
  journey.starSpeed = 0.05 + (reduceMotion ? 0 : surge * 1.7);

  if (progress >= 1 && journey.phase === "warp") finishJourney();
}

function updateCamera(dt) {
  if (!pointer.down) {
    camera.yaw += camera.yawVelocity * dt;
    camera.yawVelocity *= Math.pow(0.04, dt);
  }

  camera.pitch = lerp(1, camera.tilt, journey.arrive);
  camera.distance = lerp(START_DISTANCE, BASE_DISTANCE, journey.arrive) / camera.zoom;
  sinPitch = Math.sin(camera.pitch);
  cosPitch = Math.cos(camera.pitch);
}

function drawStars(dt) {
  const speed = journey.starSpeed * (reduceMotion ? 0.3 : 1);
  const reach = Math.hypot(view.width, view.height) * 0.11;
  const cutoff = Math.hypot(view.width, view.height) * 0.6;

  for (const star of stars) {
    star.depth -= speed * dt;
    const distance = (star.reach * reach) / star.depth;
    if (star.depth < 0.04 || distance > cutoff) {
      star.depth = 1;
      star.angle = rand(0, TAU);
      star.reach = rand(0.25, 1.6);
    }
  }

  ctx.lineCap = "round";
  for (let tone = 0; tone < starTones.length; tone++) {
    ctx.fillStyle = starTones[tone];
    ctx.strokeStyle = starTones[tone];

    for (const star of stars) {
      if (star.tone !== tone) continue;

      const cos = Math.cos(star.angle);
      const sin = Math.sin(star.angle);
      const distance = (star.reach * reach) / star.depth;
      const x = view.cx + cos * distance;
      const y = view.cy + sin * distance;
      const near = 1 - star.depth;
      const size = 0.5 + near * 1.6;

      ctx.globalAlpha = Math.min(1, 0.2 + near * 1.1);

      if (speed > 0.3) {
        const tail = (star.reach * reach) / Math.min(star.depth + speed * 0.08, 1.4);
        ctx.lineWidth = size;
        ctx.beginPath();
        ctx.moveTo(view.cx + cos * tail, view.cy + sin * tail);
        ctx.lineTo(x, y);
        ctx.stroke();
      } else {
        ctx.fillRect(x - size / 2, y - size / 2, size, size);
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawCore() {
  if (!project(0, 0, 0)) return;

  const radius = CORE_RADIUS * projected.scale;
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, "rgba(7, 5, 26, 1)");
  gradient.addColorStop(0.16, "rgba(7, 5, 26, 1)");
  gradient.addColorStop(0.24, "rgba(255, 207, 138, 0.95)");
  gradient.addColorStop(0.36, "rgba(255, 143, 177, 0.55)");
  gradient.addColorStop(0.7, "rgba(124, 92, 255, 0.18)");
  gradient.addColorStop(1, "rgba(124, 92, 255, 0)");

  ctx.save();
  ctx.translate(projected.x, projected.y);
  ctx.scale(1, Math.max(sinPitch, 0.2));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function drawGalaxy(time) {
  const spin = time * GALAXY_SPIN + camera.yaw;
  const { radius, angle, height, size, phase, bins } = galaxy;

  for (const bin of bins) {
    ctx.fillStyle = bin.style;
    for (const i of bin.indices) {
      const a = angle[i] + spin;
      const y = height[i] + Math.sin(time * 0.9 + phase[i]) * 0.12;
      if (!project(Math.cos(a) * radius[i], y, Math.sin(a) * radius[i])) continue;

      const px = Math.max(size[i] * projected.scale, 0.9);
      ctx.fillRect(projected.x, projected.y, px, px);
    }
  }
}

function drawHeart(time) {
  const reveal = journey.heartReveal;
  if (reveal <= 0) return;

  const baseAlpha = ctx.globalAlpha;
  ctx.globalAlpha = baseAlpha * Math.min(1, reveal * 1.6);

  if (project(0, HEART_LIFT + 1, 0)) {
    const halo = 26 * projected.scale;
    ctx.globalAlpha *= 0.24;
    ctx.drawImage(heartGlow, projected.x - halo / 2, projected.y - halo / 2, halo, halo);
    ctx.globalAlpha = baseAlpha * Math.min(1, reveal * 1.6);
  }

  const sway = Math.sin(time * 0.45) * 0.5;
  const cos = Math.cos(sway);
  const sin = Math.sin(sway);
  const beat = 1 + Math.sin(time * 2.4) * 0.025;
  const scatter = Math.pow(1 - reveal, 2) * 16;

  for (let tone = 0; tone < heart.bins.length; tone++) {
    ctx.fillStyle = heartTones[tone];
    for (const i of heart.bins[tone]) {
      const x = heart.x[i] * beat + heart.dx[i] * scatter;
      const y = (heart.y[i] - HEART_LIFT) * beat + HEART_LIFT + heart.dy[i] * scatter;
      const z = heart.z[i] + heart.dz[i] * scatter;
      if (!project(x * cos + z * sin, y, z * cos - x * sin)) continue;

      const twinkle = 0.75 + Math.sin(time * 3 + heart.phase[i]) * 0.35;
      const px = heart.size[i] * projected.scale * twinkle;
      ctx.fillRect(projected.x, projected.y, px, px);
    }
  }

  ctx.globalAlpha = baseAlpha;
}

function drawEmbers(time, dt) {
  const baseAlpha = ctx.globalAlpha;

  for (const ember of embers) {
    ember.y += ember.rise * dt;
    if (ember.y > EMBER_CEILING) resetEmber(ember);

    const angle = ember.angle + time * 0.05 + camera.yaw;
    const radius = ember.radius + Math.sin(time * 0.8 + ember.sway) * 0.4;
    if (!project(Math.cos(angle) * radius, ember.y, Math.sin(angle) * radius)) continue;

    const fade = Math.sin(Math.PI * (ember.y / EMBER_CEILING));
    const k = (ember.size * projected.scale) / 32;

    ctx.save();
    ctx.globalAlpha = baseAlpha * fade * 0.85;
    ctx.translate(projected.x, projected.y);
    ctx.scale(k, k);
    ctx.translate(-32, -32);
    ctx.fillStyle = `rgb(${ember.tint})`;
    ctx.fill(paths.heart);
    ctx.restore();
  }
}

function drawWords(time) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (const word of words) {
    const angle = word.angle + time * GALAXY_SPIN * word.drift + camera.yaw;
    const y = word.height + Math.sin(time * 0.7 + word.bob) * 0.25;
    if (!project(Math.cos(angle) * word.radius, y, Math.sin(angle) * word.radius)) continue;

    const fontSize = Math.max(word.size * projected.scale * 1.1, isCompact ? 9 : 6);

    const nearness = clamp((camera.distance + 22 - projected.depth) / 44, 0, 1);
    ctx.globalAlpha = journey.galaxyAlpha * (0.35 + nearness * 0.65);
    ctx.font = `600 ${fontSize}px Manrope, system-ui, sans-serif`;
    ctx.shadowColor = word.tint;
    ctx.shadowBlur = 10;
    ctx.fillStyle = word.tint;
    ctx.fillText(word.text, projected.x, projected.y);
  }

  ctx.shadowBlur = 0;
  ctx.globalAlpha = journey.galaxyAlpha;
}

function drawOrbs(time) {
  for (const orb of orbs) {
    const angle = orb.angle + time * ORB_SPIN + camera.yaw;
    const y = 1.4 + Math.sin(time * 1.1 + orb.angle) * 0.3;
    if (!project(Math.cos(angle) * orb.radius, y, Math.sin(angle) * orb.radius)) continue;

    const radius = 1.5 * projected.scale;
    const pulse = 1 + Math.sin(time * 2 + orb.angle) * 0.12;
    const glowSize = radius * 4.4 * pulse;
    const rgb = orb.memory.colors[0];
    const { x, y: sy } = projected;

    ctx.globalCompositeOperation = "lighter";
    ctx.drawImage(orb.glow, x - glowSize / 2, sy - glowSize / 2, glowSize, glowSize);
    ctx.globalCompositeOperation = "source-over";

    ctx.strokeStyle = `rgba(${rgb}, 0.7)`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, sy, radius * 0.55 * pulse, 0, TAU);
    ctx.stroke();

    const k = (radius * 0.7) / 32;
    ctx.save();
    ctx.translate(x, sy);
    ctx.scale(k, k);
    ctx.translate(-32, -32);
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fill(paths[orb.memory.shape]);
    ctx.restore();

    orb.hit.x = x;
    orb.hit.y = sy;
    orb.hit.radius = Math.max(radius * 1.4, 24);
  }
}

function paint(time, dt) {
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = view.background;
  ctx.fillRect(0, 0, view.width, view.height);

  drawStars(dt);
  if (journey.galaxyAlpha < 0.001) return;

  ctx.globalAlpha = journey.galaxyAlpha;
  drawCore();

  ctx.globalCompositeOperation = "lighter";
  drawGalaxy(time);
  drawHeart(time);
  drawEmbers(time, dt);
  ctx.globalCompositeOperation = "source-over";

  drawWords(time);
  drawOrbs(time);
  ctx.globalAlpha = 1;
}

let lastFrame = performance.now();
let elapsed = 0;

function frame(now) {
  const dt = Math.min((now - lastFrame) / 1000, 0.05);
  lastFrame = now;
  elapsed += dt;

  advanceJourney(dt);
  updateCamera(dt);
  paint(elapsed, dt);
  requestAnimationFrame(frame);
}

function fadeMusicIn() {
  const step = () => {
    music.volume = Math.min(music.volume + 0.02, config.music.volume);
    if (music.volume < config.music.volume) window.setTimeout(step, 100);
  };
  music.volume = 0;
  step();
}

function startMusic() {
  music.play().then(() => {
    fadeMusicIn();
    soundToggle.hidden = false;
  }).catch(() => {
    soundToggle.hidden = true;
  });
}

function toggleMusic() {
  const shouldPlay = music.paused;
  if (shouldPlay) music.play();
  else music.pause();
  soundToggle.setAttribute("aria-pressed", String(shouldPlay));
  soundToggle.setAttribute("aria-label", shouldPlay ? "Mute music" : "Play music");
}

function startJourney() {
  if (journey.phase !== "intro") return;
  journey.phase = "warp";
  startMusic();
  introEl.classList.add("leaving");
  window.setTimeout(() => {
    introEl.hidden = true;
  }, 950);
}

function finishJourney() {
  journey.phase = "galaxy";
  navEl.classList.add("visible");
  hintEl.classList.add("visible");
  window.setTimeout(() => hintEl.classList.remove("visible"), 6000);
}

function findOrbAt(x, y) {
  if (journey.phase !== "galaxy") return null;
  let closest = null;
  let closestGap = Infinity;

  for (const orb of orbs) {
    const gap = Math.hypot(orb.hit.x - x, orb.hit.y - y);
    if (gap < orb.hit.radius && gap < closestGap) {
      closest = orb;
      closestGap = gap;
    }
  }
  return closest;
}

function openMemory(memory) {
  lastFocus = document.activeElement;
  memoryTitle.textContent = memory.title;
  memoryText.textContent = memory.text;
  memoryArt.style.setProperty("--tint-a", `rgb(${memory.colors[0]})`);
  memoryArt.style.setProperty("--tint-b", `rgba(${memory.colors[1]}, 0.35)`);
  memoryArt.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="${shapes[memory.shape]}"/></svg>`;

  memoryEl.hidden = false;
  requestAnimationFrame(() => memoryEl.classList.add("open"));
  memoryClose.focus();
}

function closeMemory() {
  memoryEl.classList.remove("open");
  window.setTimeout(() => {
    memoryEl.hidden = true;
    if (lastFocus) lastFocus.focus();
  }, 320);
}

function setupContent() {
  document.title = config.title;
  $("title").textContent = config.title;
  $("subtitle").textContent = config.subtitle;
  hintEl.textContent = config.hint;
  enterButton.textContent = config.enterLabel;
  music.src = config.music.src;

  for (const memory of config.memories) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "memory-chip";
    chip.textContent = memory.title;
    chip.addEventListener("click", () => openMemory(memory));
    navEl.appendChild(chip);
  }
}

function setupControls() {
  enterButton.addEventListener("click", startJourney);
  soundToggle.addEventListener("click", toggleMusic);
  memoryClose.addEventListener("click", closeMemory);
  memoryEl.addEventListener("click", (event) => {
    if (event.target === memoryEl) closeMemory();
  });

  document.addEventListener("keydown", (event) => {
    if (memoryEl.hidden) return;
    if (event.key === "Escape") closeMemory();
    if (event.key === "Tab") event.preventDefault();
  });

  const touches = new Map();
  let pinchGap = 0;

  const fingerGap = () => {
    const [a, b] = [...touches.values()];
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  };

  const releasePointer = (event) => {
    touches.delete(event.pointerId);
    pointer.down = touches.size > 0;

    if (touches.size === 1) {
      const [rest] = touches.values();
      pointer.x = rest.x;
      pointer.y = rest.y;
      pointer.time = event.timeStamp;
    }
    if (!pointer.down) canvas.classList.remove("dragging");
  };

  canvas.addEventListener("pointerdown", (event) => {
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (touches.size === 1) pointer.travel = 0;
    if (touches.size === 2) pinchGap = fingerGap();

    pointer.down = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.time = event.timeStamp;
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("dragging");
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!pointer.down) {
      canvas.classList.toggle("over-orb", Boolean(findOrbAt(event.clientX, event.clientY)));
      return;
    }

    if (touches.has(event.pointerId)) {
      touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }

    if (touches.size === 2) {
      const gap = fingerGap();
      camera.zoom = clamp(camera.zoom * (gap / pinchGap), 0.75, 1.5);
      pinchGap = gap;
      pointer.travel += 10;
      return;
    }

    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    const seconds = Math.max((event.timeStamp - pointer.time) / 1000, 0.008);
    const turn = dx * 0.006;

    camera.yaw += turn;
    camera.yawVelocity = clamp(turn / seconds, -3, 3);
    camera.tilt = clamp(camera.tilt + dy * 0.003, 0.18, 0.8);

    pointer.travel += Math.abs(dx) + Math.abs(dy);
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.time = event.timeStamp;
  });

  canvas.addEventListener("pointerup", (event) => {
    const wasTap = touches.size === 1 && pointer.travel <= 6;
    releasePointer(event);
    if (!wasTap) return;

    const orb = findOrbAt(event.clientX, event.clientY);
    if (orb) openMemory(orb.memory);
  });

  canvas.addEventListener("pointercancel", releasePointer);

  canvas.addEventListener("wheel", (event) => {
    camera.zoom = clamp(camera.zoom * (1 - event.deltaY * 0.001), 0.75, 1.5);
  }, { passive: true });

  window.addEventListener("resize", resize);
}

setupContent();
setupControls();
resize();
requestAnimationFrame(frame);
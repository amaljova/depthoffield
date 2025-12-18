// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    });
}

// PWA Installation Logic
let deferredPrompt;
const installContainer = document.getElementById('installContainer');
const installBtn = document.getElementById('installPrompt');

// Check if already installed or in standalone mode
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    
    if (installContainer && !isStandalone) {
        installContainer.style.display = 'flex';
    }
});

if (installBtn) {
    installBtn.onclick = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        
        deferredPrompt = null;
        if (installContainer) installContainer.style.display = 'none';
    };
}

const closeInstall = document.getElementById('closeInstall');
if (closeInstall) {
    closeInstall.onclick = () => {
        if (installContainer) installContainer.style.display = 'none';
    };
}

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (installContainer) installContainer.style.display = 'none';
    console.log('PWA was installed successfully');
});

// Canvas and DOM elements
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d', { alpha: true });
const distIn = document.getElementById('distance');
const focalIn = document.getElementById('focal');
const apertureIn = document.getElementById('aperture');
const sensorSelect = document.getElementById('sensor');

const F_STOPS = [
  0.7, 0.8, 1.0, 1.2, 1.4, 1.8, 2, 2.8, 4, 5.6, 8, 11, 16, 22, 32, 45, 64,
];
const FOCALS = [
  14, 16, 18, 20, 24, 28, 35, 50, 85, 105, 135, 200, 300, 400, 600,
];

let isDragging = false;
let dragLine = null;
let renderRequested = false;

// --- Static Data Generation ---
const trees = Array.from({ length: 45 }, (_, i) => ({
  dist: (i / 45) * 50000,
  offset: (Math.random() - 0.5) * 10,
}));

// Helper functions
function getX(dist) {
  if (dist === Infinity) return 98;
  return 15 + Math.pow(Math.min(dist, 50000) / 50000, 0.6) * 80;
}

function getDist(xPercent) {
  if (xPercent >= 98) return Infinity;
  const normalized = Math.max(0, Math.min(1, (xPercent - 15) / 80));
  return Math.pow(normalized, 1 / 0.6) * 50000;
}

// --- Scenery Initialization ---
function initScenery() {
  // 1. Stars - Only visible in dark mode
  const starsLayer = document.getElementById('stars-layer');
  if (starsLayer) {
    starsLayer.innerHTML = '';
    for (let i = 0; i < 60; i++) {
      const star = document.createElement('div');
      star.className = 'star';
      const size = 1 + Math.random() * 2;
      star.style.width = size + 'px';
      star.style.height = size + 'px';
      star.style.left = Math.random() * 100 + '%';
      star.style.top = Math.random() * 100 + '%';
      star.style.opacity = 0.2 + Math.random() * 0.8;
      starsLayer.appendChild(star);
    }
  }

  // 2. Clouds - Slower, more natural distribution
  const cloudLayer = document.getElementById('clouds-layer');
  if (cloudLayer) {
    cloudLayer.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const cloud = document.createElement('div');
      cloud.className = 'cloud';
      cloud.style.width = 60 + Math.random() * 80 + 'px';
      cloud.style.height = 25 + Math.random() * 25 + 'px';
      cloud.style.top = 5 + Math.random() * 35 + '%';

      const duration = 60 + Math.random() * 60;
      cloud.style.animationDuration = duration + 's';
      cloud.style.animationDelay = -(Math.random() * duration) + 's';
      cloudLayer.appendChild(cloud);
    }
  }

  // 3. Birds - Much Slower
  const birdLayer = document.getElementById('birds-layer');
  if (birdLayer) {
    birdLayer.innerHTML = '';
    for (let i = 0; i < 8; i++) {
      const bird = document.createElement('div');
      bird.className = 'bird';
      bird.style.top = 10 + Math.random() * 50 + '%';

      bird.innerHTML = `
                <svg viewBox='0 0 24 12' style='overflow:visible'>
                    <path stroke='currentColor' stroke-width='2' fill='none' stroke-linecap='round' stroke-linejoin='round'>
                        <animate attributeName='d' 
                                 values='M2 4 Q 12 12 22 4; M2 10 Q 12 2 22 10; M2 4 Q 12 12 22 4' 
                                 dur='${0.25 + Math.random() * 0.2}s' 
                                 repeatCount='indefinite' />
                    </path>
                </svg>`;

      const duration = 45 + Math.random() * 30; // 45-75s
      bird.style.animationDuration = duration + 's';
      bird.style.animationDelay = -(Math.random() * duration) + 's';
      birdLayer.appendChild(bird);
    }
  }

  // 4. Rocks - Sit on the ground line
  const rocksLayer = document.getElementById('rocks-layer');
  if (rocksLayer) {
    rocksLayer.innerHTML = '';
    for (let i = 0; i < 12; i++) {
      const rock = document.createElement('div');
      rock.className = 'rock';
      const w = 6 + Math.random() * 12;
      const h = w * (0.5 + Math.random() * 0.3);
      rock.style.width = w + 'px';
      rock.style.height = h + 'px';
      rock.style.left = Math.random() * 100 + '%';
      rock.style.marginBottom = -(h * 0.2) + 'px';
      rocksLayer.appendChild(rock);
    }
  }

  // 5. Grass - Small tufts
  const grassLayer = document.getElementById('grass-layer');
  if (grassLayer) {
    grassLayer.innerHTML = '';
    for (let i = 0; i < 60; i++) {
      const grass = document.createElement('div');
      grass.className = 'grass';
      const h = 6 + Math.random() * 8;
      grass.style.height = h + 'px';
      grass.style.left = Math.random() * 100 + '%';

      grass.innerHTML = `<svg viewBox='0 0 12 12' preserveAspectRatio='none' style='width:100%; height:100%;'>
                <path d='M6 12 Q 2 6 0 2 M6 12 Q 6 4 6 0 M6 12 Q 10 6 12 2' 
                      stroke='currentColor' stroke-width='1.5' fill='none' stroke-linecap='round'/>
            </svg>`;

      grassLayer.appendChild(grass);
    }
  }
}

// --- Interaction Logic ---

function adjust(id, direction) {
  const el = document.getElementById(id);
  let val = parseFloat(el.value);
  if (id === 'aperture') {
    let idx = F_STOPS.findIndex((f) => f >= val);
    if (direction > 0)
      el.value = F_STOPS[Math.min(idx + 1, F_STOPS.length - 1)];
    else {
      if (F_STOPS[idx] > val) idx--;
      el.value = F_STOPS[Math.max(idx - 1, 0)];
    }
  } else if (id === 'focal') {
    let idx = FOCALS.findIndex((f) => f >= val);
    if (direction > 0) {
      if (idx === -1 || FOCALS[idx] <= val) el.value = val + 5;
      else el.value = FOCALS[idx];
    } else el.value = Math.max(1, val - 5);
  } else {
    const step = val < 2 ? 0.1 : val < 10 ? 0.5 : 1;
    el.value = Math.max(0.1, val + step * direction).toFixed(1);
  }
  requestTick();
}

document.getElementById('distMinus').onclick = () => adjust('distance', -1);
document.getElementById('distPlus').onclick = () => adjust('distance', 1);
document.getElementById('focalMinus').onclick = () => adjust('focal', -1);
document.getElementById('focalPlus').onclick = () => adjust('focal', 1);
document.getElementById('apMinus').onclick = () => adjust('aperture', -1);
document.getElementById('apPlus').onclick = () => adjust('aperture', 1);

const themeBtn = document.getElementById('themeToggle');
themeBtn.onclick = () => {
  const current = document.body.getAttribute('data-theme');
  const next = current === 'light' ? 'dark' : 'light';
  document.body.setAttribute('data-theme', next);
  themeBtn.textContent = next === 'light' ? 'LIGHT MODE' : 'DARK MODE';
  requestTick();
};

// Dragging
const focusLine = document.getElementById('focusLine');
const hyperLine = document.getElementById('hyperLine');
const vizEl = document.getElementById('viz');

function handleDragStart(e, line) {
  isDragging = true;
  dragLine = line;
  e.target.classList.add('dragging');
  e.preventDefault();
}

function handleDragMove(e) {
  if (!isDragging || !dragLine) return;

  const rect = vizEl.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const xPercent = ((clientX - rect.left) / rect.width) * 100;
  const dist = getDist(Math.max(15, Math.min(98, xPercent)));

  if (dragLine === 'focus') {
    distIn.value = (dist / 1000).toFixed(1);
  } else if (dragLine === 'hyper') {
    const f = parseFloat(focalIn.value) || 50;
    const c = parseFloat(sensorSelect.value);
    const H = dist;
    const N = (f * f) / ((H - f) * c);
    apertureIn.value = Math.max(0.7, N).toFixed(1);
  }
  requestTick();
}

function handleDragEnd(e) {
  if (dragLine) {
    e.target.classList.remove('dragging');
  }
  isDragging = false;
  dragLine = null;
}

focusLine.addEventListener('mousedown', (e) => handleDragStart(e, 'focus'));
focusLine.addEventListener('touchstart', (e) => handleDragStart(e, 'focus'));
hyperLine.addEventListener('mousedown', (e) => handleDragStart(e, 'hyper'));
hyperLine.addEventListener('touchstart', (e) => handleDragStart(e, 'hyper'));

document.addEventListener('mousemove', handleDragMove);
document.addEventListener('touchmove', handleDragMove, { passive: false });
document.addEventListener('mouseup', handleDragEnd);
document.addEventListener('touchend', handleDragEnd);

// --- Calculation & Rendering ---

function calculateDOF() {
  const f = parseFloat(focalIn.value) || 50;
  const N = parseFloat(apertureIn.value) || 2.8;
  const s = (parseFloat(distIn.value) || 5) * 1000;
  const c = parseFloat(sensorSelect.value);

  const H = (f * f) / (N * c) + f;
  let near = (s * (H - f)) / (H + s - 2 * f);
  let far = s < H ? (s * (H - f)) / (H - s) : Infinity;
  let dof = far === Infinity ? Infinity : far - near;

  return { f, N, s, c, H, near, far, dof };
}

function updateUI(calc) {
  const { H, near, far, dof, s } = calc;

  const fX = getX(s),
    nX = getX(near),
    rX = getX(far),
    hX = getX(H);

  focusLine.style.left = fX + '%';
  hyperLine.style.left = hX + '%';
  document.getElementById('dofZone').style.left = nX + '%';
  document.getElementById('dofZone').style.width = Math.max(1, rX - nX) + '%';

  const focusDistTag = document.getElementById('focusDistTag');
  const nearTag = document.getElementById('nearTag');
  const farTag = document.getElementById('farTag');

  focusDistTag.style.left = fX + '%';
  focusDistTag.textContent = (s / 1000).toFixed(2) + 'm';

  nearTag.style.left = nX + '%';
  nearTag.textContent = (near / 1000).toFixed(2) + 'm';

  farTag.style.left = rX + '%';
  farTag.textContent = far === Infinity ? '∞' : (far / 1000).toFixed(2) + 'm';

  const res = [
    { l: 'Hyperfocal', v: (H / 1000).toFixed(2) + 'm' },
    {
      l: 'Total DOF',
      v: far === Infinity ? '∞' : (dof / 1000).toFixed(2) + 'm',
    },
    { l: 'Near Limit', v: (near / 1000).toFixed(2) + 'm' },
    {
      l: 'Far Limit',
      v: far === Infinity ? '∞' : (far / 1000).toFixed(2) + 'm',
    },
    {
      l: 'Front %',
      v: far === Infinity ? 'N/A' : (((s - near) / dof) * 100).toFixed(0) + '%',
    },
    {
      l: 'Behind %',
      v: far === Infinity ? 'N/A' : (((far - s) / dof) * 100).toFixed(0) + '%',
    },
  ];
  document.getElementById('resGrid').innerHTML = res
    .map(
      (r) => `
        <div class='res-card'><div class='res-label'>${r.l}</div><div class='res-val'>${r.v}</div></div>
    `
    )
    .join('');
}

function drawScene(calc) {
  const { near, far } = calc;
  const w = canvas.width / devicePixelRatio;
  const h = canvas.height / devicePixelRatio;
  const isLight = document.body.getAttribute('data-theme') === 'light';
  const hz = h - 0;

  // Clear canvas - Scenery is in CSS layers below
  ctx.clearRect(0, 0, w, h);

  // Trees with focus
  trees.forEach((tree) => {
    const tx = (getX(tree.dist) / 100) * w;
    let blur = 0;
    if (tree.dist < near) blur = (near - tree.dist) / 250;
    else if (tree.dist > far && far !== Infinity)
      blur = (tree.dist - far) / 700;

    ctx.save();
    if (blur > 0) ctx.filter = `blur(${Math.min(blur, 8)}px)`;
    else ctx.filter = 'none';

    const inFocus = tree.dist >= near && (tree.dist <= far || far === Infinity);
    const opacity = 1 - tree.dist / 60000;
    const rgb = inFocus
      ? isLight
        ? '5, 150, 105'
        : '16, 185, 129'
      : isLight
      ? '156, 163, 175'
      : '75, 85, 99';

    const treeH = 50 + (1 - tree.dist / 50000) * 70;
    const treeW = 20 + (1 - tree.dist / 50000) * 35;
    const trunkW = Math.max(2, treeW * 0.2);
    const trunkH = treeH * 0.3;

    // Trunk
    ctx.fillStyle = `rgba(${
      isLight ? '92, 64, 51' : '60, 30, 10'
    }, ${opacity})`;
    ctx.fillRect(tx - trunkW / 2, hz - trunkH, trunkW, trunkH);

    // Foliage
    ctx.fillStyle = `rgba(${rgb}, ${opacity})`;
    ctx.beginPath();
    ctx.moveTo(tx, hz - treeH);
    ctx.lineTo(tx - treeW / 2, hz - trunkH);
    ctx.lineTo(tx + treeW / 2, hz - trunkH);
    ctx.fill();
    ctx.restore();
  });
}

function update() {
  renderRequested = false;
  const calc = calculateDOF();
  updateUI(calc);
  drawScene(calc);
}

function requestTick() {
  if (!renderRequested) {
    renderRequested = true;
    requestAnimationFrame(update);
  }
}

window.addEventListener('resize', () => {
  canvas.width = canvas.offsetWidth * devicePixelRatio;
  canvas.height = canvas.offsetHeight * devicePixelRatio;
  ctx.scale(devicePixelRatio, devicePixelRatio);
  requestTick();
});

document.querySelectorAll('input, select').forEach((el) => {
  el.oninput = () => {
    requestTick();
  };
});

document.addEventListener('DOMContentLoaded', () => {
  initScenery();
  window.dispatchEvent(new Event('resize'));
});

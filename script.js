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
const ctx = canvas.getContext('2d', { alpha: false });
const distIn = document.getElementById('distance');
const focalIn = document.getElementById('focal');
const apertureIn = document.getElementById('aperture');
const sensorSelect = document.getElementById('sensor');

const F_STOPS = [0.7, 0.8, 1.0, 1.2, 1.4, 1.8, 2, 2.8, 4, 5.6, 8, 11, 16, 22, 32, 45, 64];
const FOCALS = [14, 16, 18, 20, 24, 28, 35, 50, 85, 105, 135, 200, 300, 400, 600];

let needsUpdate = true;
let isDragging = false;
let dragLine = null;

// Static assets
const clouds = Array.from({length: 8}, () => ({
    x: Math.random() * 110, 
    y: 8 + Math.random() * 25,
    speed: 0.003 + Math.random() * 0.01, 
    w: 35 + Math.random() * 50,
    h: 15 + Math.random() * 20
}));

const birds = Array.from({length: 6}, () => ({
    x: Math.random() * 100, 
    y: 15 + Math.random() * 30,
    speed: 0.04 + Math.random() * 0.08,
    wingPhase: Math.random() * Math.PI * 2, 
    flapSpeed: 0.1 + Math.random() * 0.1
}));

const trees = Array.from({length: 45}, (_, i) => ({
    dist: (i / 45) * 50000,
    offset: (Math.random() - 0.5) * 10
}));

const rocks = Array.from({length: 15}, () => ({
    x: Math.random() * 100,
    size: 2 + Math.random() * 5
}));

const grassTufts = Array.from({length: 80}, () => ({
    x: Math.random() * 100,
    height: 3 + Math.random() * 7
}));

function getX(dist) {
    if(dist === Infinity) return 98;
    return 15 + (Math.pow(Math.min(dist, 50000) / 50000, 0.6)) * 80;
}

function getDist(xPercent) {
    if (xPercent >= 98) return Infinity;
    const normalized = Math.max(0, Math.min(1, (xPercent - 15) / 80));
    return Math.pow(normalized, 1/0.6) * 50000;
}

function adjust(id, direction) {
    const el = document.getElementById(id);
    let val = parseFloat(el.value);
    if (id === 'aperture') {
        let idx = F_STOPS.findIndex(f => f >= val);
        if (direction > 0) el.value = F_STOPS[Math.min(idx + 1, F_STOPS.length - 1)];
        else {
            if (F_STOPS[idx] > val) idx--;
            el.value = F_STOPS[Math.max(idx - 1, 0)];
        }
    } else if (id === 'focal') {
        let idx = FOCALS.findIndex(f => f >= val);
        if (direction > 0) {
            if (idx === -1 || FOCALS[idx] <= val) el.value = val + 5;
            else el.value = FOCALS[idx];
        } else el.value = Math.max(1, val - 5);
    } else {
        const step = val < 2 ? 0.1 : val < 10 ? 0.5 : 1;
        el.value = Math.max(0.1, val + (step * direction)).toFixed(1);
    }
    needsUpdate = true;
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
    needsUpdate = true;
    if (lastCalc) {
        drawScene(lastCalc);
    }
};

// Dragging logic
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
    needsUpdate = true;
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

function calculateDOF() {
    const f = parseFloat(focalIn.value) || 50;
    const N = parseFloat(apertureIn.value) || 2.8;
    const s = (parseFloat(distIn.value) || 5) * 1000;
    const c = parseFloat(sensorSelect.value);

    const H = (f * f) / (N * c) + f;
    let near = (s * (H - f)) / (H + s - 2 * f);
    let far = (s < H) ? (s * (H - f)) / (H - s) : Infinity;
    let dof = (far === Infinity) ? Infinity : far - near;

    return { f, N, s, c, H, near, far, dof };
}

function updateUI(calc) {
    const { H, near, far, dof, s } = calc;
    
    const fX = getX(s), nX = getX(near), rX = getX(far), hX = getX(H);
    
    focusLine.style.left = fX + '%';
    hyperLine.style.left = hX + '%';
    document.getElementById('dofZone').style.left = nX + '%';
    document.getElementById('dofZone').style.width = Math.max(1, (rX - nX)) + '%';
    
    const focusTag = focusLine.querySelector('.line-tag');
    const hyperTag = hyperLine.querySelector('.line-tag');
    const focusDistTag = document.getElementById('focusDistTag');
    const nearTag = document.getElementById('nearTag');
    const farTag = document.getElementById('farTag');

    // Stagger tags to avoid overlap
    const dist = Math.abs(hX - fX);
    if (dist < 10) {
        focusTag.style.top = '20%';
        hyperTag.style.top = '35%';
    } else {
        focusTag.style.top = '20%';
        hyperTag.style.top = '20%';
    }
    
    // Update focus distance at top
    focusDistTag.style.left = fX + '%';
    focusDistTag.textContent = (s/1000).toFixed(2) + 'm';
    
    // Place near/far tags at bottom
    nearTag.style.left = nX + '%';
    nearTag.textContent = (near/1000).toFixed(2) + 'm';
    
    farTag.style.left = rX + '%';
    farTag.textContent = far === Infinity ? '∞' : (far/1000).toFixed(2) + 'm';

    const res = [
        { l: 'Hyperfocal', v: (H/1000).toFixed(2) + 'm' },
        { l: 'Total DOF', v: far === Infinity ? '∞' : (dof/1000).toFixed(2) + 'm' },
        { l: 'Near Limit', v: (near/1000).toFixed(2) + 'm' },
        { l: 'Far Limit', v: far === Infinity ? '∞' : (far/1000).toFixed(2) + 'm' },
        { l: 'Front %', v: far === Infinity ? 'N/A' : (((s-near)/dof)*100).toFixed(0) + '%' },
        { l: 'Behind %', v: far === Infinity ? 'N/A' : (((far-s)/dof)*100).toFixed(0) + '%' }
    ];
    document.getElementById('resGrid').innerHTML = res.map(r => `
        <div class="res-card"><div class="res-label">${r.l}</div><div class="res-val">${r.v}</div></div>
    `).join('');
}

function drawScene(calc) {
    const { near, far } = calc;
    const w = canvas.width / devicePixelRatio;
    const h = canvas.height / devicePixelRatio;
    const isLight = document.body.getAttribute('data-theme') === 'light';
    const hz = h - 40;

    // Sky gradient - different colors for light/dark mode
    const skyGrad = ctx.createLinearGradient(0, 0, 0, hz);
    if (isLight) {
        skyGrad.addColorStop(0, '#87CEEB');  // Sky blue
        skyGrad.addColorStop(1, '#E0F2FE');  // Light cyan
    } else {
        skyGrad.addColorStop(0, '#0F0F0F');  // Dark top
        skyGrad.addColorStop(1, '#1A1A1A');  // Dark bottom
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, hz);

    // Ground
    ctx.fillStyle = isLight ? '#D1D5DB' : '#141414';
    ctx.fillRect(0, hz, w, h - hz);

    // Clouds
    clouds.forEach(cloud => {
        cloud.x += cloud.speed;
        if (cloud.x > 110) cloud.x = -10;
        ctx.save();
        ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.1)';
        ctx.filter = 'blur(15px)';
        ctx.beginPath();
        ctx.ellipse((cloud.x/100)*w, (cloud.y/100)*h, cloud.w, cloud.h, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    // Sun/Moon
    const celestialY = h * 0.15;
    const celestialX = w * 0.8;
    ctx.save();
    if (isLight) {
        // Sun
        ctx.fillStyle = '#FDB813';
        ctx.shadowColor = '#FDB813';
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(celestialX, celestialY, 25, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Moon
        ctx.fillStyle = '#F0F0F0';
        ctx.shadowColor = '#F0F0F0';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(celestialX, celestialY, 20, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.restore();

    // Birds
    birds.forEach(bird => {
        bird.x += bird.speed;
        if (bird.x > 110) bird.x = -10;
        bird.wingPhase += bird.flapSpeed;
        const bx = (bird.x / 100) * w;
        const by = (bird.y / 100) * h + Math.sin(bird.wingPhase * 0.5) * 2;
        
        ctx.save();
        ctx.strokeStyle = isLight ? '#374151' : '#9CA3AF';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        const wd = Math.sin(bird.wingPhase) * 4;
        ctx.moveTo(bx - 6, by + wd);
        ctx.quadraticCurveTo(bx, by - 2, bx + 6, by + wd);
        ctx.stroke();
        ctx.restore();
    });

    // Horizon line
    ctx.strokeStyle = isLight ? '#D1D5DB' : '#374151';
    ctx.lineWidth = 1;
    ctx.beginPath(); 
    ctx.moveTo(0, hz); 
    ctx.lineTo(w, hz); 
    ctx.stroke();

    // Rocks
    rocks.forEach(rock => {
        ctx.fillStyle = isLight ? '#6B7280' : '#4B5563';
        ctx.beginPath();
        ctx.ellipse((rock.x/100)*w, hz, rock.size, rock.size*0.6, 0, 0, Math.PI, true);
        ctx.fill();
    });

    // Grass
    grassTufts.forEach(grass => {
        ctx.strokeStyle = isLight ? '#059669' : '#10B981';
        ctx.lineWidth = 1;
        ctx.beginPath();
        const gx = (grass.x/100)*w;
        ctx.moveTo(gx, hz);
        ctx.lineTo(gx - 2, hz - grass.height);
        ctx.moveTo(gx, hz);
        ctx.lineTo(gx + 2, hz - grass.height*0.8);
        ctx.stroke();
    });

    // Trees with focus
    trees.forEach(tree => {
        const tx = (getX(tree.dist)/100)*w;
        let blur = 0;
        if(tree.dist < near) blur = (near - tree.dist)/250;
        else if(tree.dist > far && far !== Infinity) blur = (tree.dist - far)/700;
        
        ctx.save();
        if (blur > 0) ctx.filter = `blur(${Math.min(blur, 8)}px)`;
        
        const inFocus = (tree.dist >= near && (tree.dist <= far || far === Infinity));
        const opacity = 1 - (tree.dist / 60000);
        const rgb = inFocus ? (isLight ? '5, 150, 105' : '16, 185, 129') : (isLight ? '156, 163, 175' : '75, 85, 99');
        
        const treeH = (30 + (1 - tree.dist/50000)*70);
        const treeW = (15 + (1 - tree.dist/50000)*35);
        const trunkW = Math.max(2, treeW * 0.2);
        const trunkH = treeH * 0.3;

        // Trunk
        ctx.fillStyle = `rgba(${isLight ? '92, 64, 51' : '60, 30, 10'}, ${opacity})`;
        ctx.fillRect(tx - trunkW/2, hz - trunkH, trunkW, trunkH);

        // Foliage
        ctx.fillStyle = `rgba(${rgb}, ${opacity})`;
        ctx.beginPath();
        ctx.moveTo(tx, hz - treeH);
        ctx.lineTo(tx - treeW/2, hz - trunkH);
        ctx.lineTo(tx + treeW/2, hz - trunkH);
        ctx.fill();
        ctx.restore();
    });
}

let lastCalc = null;
function animate() {
    if (needsUpdate) {
        const calc = calculateDOF();
        updateUI(calc);
        lastCalc = calc;
        needsUpdate = false;
    }
    
    if (lastCalc) {
        drawScene(lastCalc);
    }
    
    requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
    canvas.width = canvas.offsetWidth * devicePixelRatio;
    canvas.height = canvas.offsetHeight * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    needsUpdate = true;
});

document.querySelectorAll('input, select').forEach(el => {
    el.oninput = () => { needsUpdate = true; };
});

document.addEventListener('DOMContentLoaded', () => {
    window.dispatchEvent(new Event('resize'));
    animate();
});
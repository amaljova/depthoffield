/**
 * DOF.IO Logic & Visualization
 * Handles PWA installation, theme switching, calculation, and canvas rendering.
 */

const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const distSlider = document.getElementById('distance');
const focalSlider = document.getElementById('focal');
const apertureSlider = document.getElementById('aperture');
const sensorSelect = document.getElementById('sensor');
const themeToggle = document.getElementById('themeToggle');
const themeLabel = document.getElementById('themeLabel');

// PWA Installation Logic
let deferredPrompt;
const installContainer = document.getElementById('installContainer');
const installBtn = document.getElementById('installPrompt');

// Check if already installed or in standalone mode
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    
    // Update UI notify the user they can install the PWA, but only if not already standalone
    if (installContainer && !isStandalone) {
        installContainer.style.display = 'flex';
    }
});

if (installBtn) {
    installBtn.onclick = async () => {
        if (!deferredPrompt) return;
        // Show the install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        
        // We've used the prompt, and can't use it again
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
    // Clear the deferredPrompt so it can be garbage collected
    deferredPrompt = null;
    if (installContainer) installContainer.style.display = 'none';
    console.log('PWA was installed successfully');
});

// Theme Toggle Logic
themeToggle.onclick = () => {
    const current = document.body.getAttribute('data-theme');
    const next = current === 'light' ? 'dark' : 'light';
    document.body.setAttribute('data-theme', next);
    themeLabel.textContent = next === 'light' ? 'LIGHT MODE' : 'DARK MODE';
};

// Animation Scene State
let animationFrame;
const clouds = Array.from({length: 5}, () => ({
    dist: 10000 + Math.random() * 40000,
    x: Math.random() * 110,
    y: 15 + Math.random() * 30,
    speed: 0.005 + Math.random() * 0.015,
    w: 40 + Math.random() * 40
}));

const birds = Array.from({length: 6}, () => ({
    dist: 500 + Math.random() * 15000, // Varied distances
    x: Math.random() * 100,
    y: 25 + Math.random() * 40,
    speed: 0.03 + Math.random() * 0.07,
    wingPhase: Math.random() * Math.PI * 2,
    flapSpeed: 0.1 + Math.random() * 0.1
}));

/**
 * Main calculation and rendering loop
 */
function update() {
    const f = parseFloat(focalSlider.value);
    const N = parseFloat(apertureSlider.value);
    const sensorVal = parseFloat(sensorSelect.value);
    
    // Safety check for distance slider min (focal length dependent)
    const minM = (f * 10) / 1000;
    distSlider.min = minM.toFixed(2);
    if (parseFloat(distSlider.value) < minM) {
        distSlider.value = minM;
    }
    
    const s = parseFloat(distSlider.value) * 1000; // subject distance in mm
    const c = sensorVal; // circle of confusion

    // Update UI Labels
    document.getElementById('fValue').textContent = f;
    document.getElementById('aValue').textContent = N.toFixed(1);
    document.getElementById('dValue').textContent = (s/1000).toFixed(2);
    document.getElementById('sValue').textContent = c.toFixed(3);

    // DOF Math
    const H = (f * f) / (N * c) + f; // Hyperfocal distance
    let near = (s * (H - f)) / (H + s - 2 * f);
    let far = (s < H) ? (s * (H - f)) / (H - s) : Infinity;
    let dof = (far === Infinity) ? Infinity : far - near;

    const w = canvas.width / devicePixelRatio;
    const h = canvas.height / devicePixelRatio;

    // Helper to map 3D distance to 2D canvas X coordinate (Log-ish curve)
    const getX = (dist) => {
        if(dist === Infinity) return 98;
        const maxViewDist = 50000;
        return 15 + (Math.pow(Math.min(dist, maxViewDist) / maxViewDist, 0.6)) * 80;
    };

    const fX = getX(s), nX = getX(near), rX = getX(far), hX = getX(H);
    
    // Update Geometry Overlay Positions
    const focusLine = document.getElementById('focusLine');
    const hyperLine = document.getElementById('hyperLine');

    focusLine.style.left = fX + '%';
    hyperLine.style.left = hX + '%';
    
    // Adjust label positions on focus and hyperfocal lines
    const focusTag = focusLine.querySelector('.line-tag');
    const hyperTag = hyperLine.querySelector('.line-tag');
    
    if (focusTag) {
        focusTag.style.top = '50%';
        focusTag.style.transform = 'translate(-50%, -50%)';
    }
    if (hyperTag) {
        hyperTag.style.top = '0%';
        hyperTag.style.transform = 'translateX(-50%)';
    }

    document.getElementById('dofZone').style.left = nX + '%';
    document.getElementById('dofZone').style.width = (rX - nX) + '%';
    
    document.getElementById('nearTag').style.left = nX + '%';
    document.getElementById('nearTag').textContent = (near/1000).toFixed(2) + 'm';
    document.getElementById('farTag').style.left = rX + '%';
    document.getElementById('farTag').textContent = far === Infinity ? '∞' : (far/1000).toFixed(2) + 'm';

    ctx.clearRect(0,0,w,h);
    const isLight = document.body.getAttribute('data-theme') === 'light';

    // Draw Clouds (Always blurry)
    clouds.forEach(cloud => {
        cloud.x = (cloud.x + cloud.speed);
        if (cloud.x > 110) cloud.x = -10;
        const cx = (cloud.x / 100) * w;
        const cy = (cloud.y / 100) * h;
        
        ctx.save();
        ctx.filter = `blur(12px)`;
        ctx.fillStyle = isLight ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.1)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, cloud.w, cloud.w * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    // Draw Birds
    birds.forEach(bird => {
        bird.x = (bird.x + bird.speed);
        if (bird.x > 110) bird.x = -10;
        bird.wingPhase += bird.flapSpeed;
        
        const bx = (bird.x / 100) * w;
        const by = (bird.y / 100) * h + Math.sin(bird.wingPhase * 0.5) * 2;
        
        // Blur logic: calculate distance from focus zone
        let blur = 0;
        if (bird.dist < near) {
            blur = Math.min((near - bird.dist) / 400, 6);
        } else if (bird.dist > far && far !== Infinity) {
            blur = Math.min((bird.dist - far) / 1000, 8);
        }

        const isInFocus = (bird.dist >= near && (bird.dist <= far || far === Infinity));

        ctx.save();
        if (blur > 0.5) ctx.filter = `blur(${blur}px)`;
        
        // Color logic: highlight ONLY when in focus zone
        const birdColor = isInFocus ? (isLight ? '#059669' : '#10B981') : (isLight ? '#4B5563' : '#666');
        
        ctx.strokeStyle = birdColor;
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        const wingDip = Math.sin(bird.wingPhase) * 4;
        ctx.moveTo(bx - 6, by + wingDip);
        ctx.quadraticCurveTo(bx, by - 2, bx + 6, by + wingDip);
        ctx.stroke();
        ctx.restore();
    });

    // Draw Horizon Ground
    ctx.strokeStyle = isLight ? '#D1D5DB' : '#1a1a1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h-40); ctx.lineTo(w, h-40);
    ctx.stroke();

    // Draw Dynamic Trees
    const treeCount = 40;
    for(let i=0; i<treeCount; i++) {
        const dist = (i/treeCount) * 50000;
        const x = (getX(dist)/100)*w;
        let blur = 0;
        if(dist < near) blur = (near-dist)/200;
        else if(dist > far && far !== Infinity) blur = (dist-far)/600;
        
        ctx.save();
        ctx.filter = `blur(${Math.min(blur, 8)}px)`;
        const isInFocus = (dist >= near && (dist <= far || far === Infinity));
        const depthOpacity = 1 - (dist / 60000);
        const colorBase = isInFocus ? (isLight ? '5, 150, 105' : '16, 185, 129') : (isLight ? '156, 163, 175' : '34, 34, 34');
        ctx.fillStyle = `rgba(${colorBase}, ${depthOpacity})`;
        const treeH = (30 + (1 - dist/50000)*70);
        const treeW = (15 + (1 - dist/50000)*35);
        ctx.beginPath();
        ctx.moveTo(x, h - 40 - treeH);
        ctx.lineTo(x - treeW/2, h - 40);
        ctx.lineTo(x + treeW/2, h - 40);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }
    
    // Refresh Results Cards
    const results = [
        { l: 'Hyperfocal', v: (H/1000).toFixed(2) + 'm' },
        { l: 'Total DOF', v: far === Infinity ? '∞' : (dof/1000).toFixed(2) + 'm' },
        { l: 'Near Limit', v: (near/1000).toFixed(2) + 'm' },
        { l: 'Far Limit', v: far === Infinity ? '∞' : (far/1000).toFixed(2) + 'm' },
        { l: 'Front %', v: far === Infinity ? 'N/A' : (((s-near)/dof)*100).toFixed(0) + '%' },
        { l: 'Behind %', v: far === Infinity ? 'N/A' : (((far-s)/dof)*100).toFixed(0) + '%' }
    ];
    document.getElementById('resGrid').innerHTML = results.map(r => `
        <div class="res-card">
            <div class="res-label">${r.l}</div>
            <div class="res-val">${r.v}</div>
        </div>
    `).join('');

    animationFrame = requestAnimationFrame(update);
}

// Handle Window Resize for Canvas High-DPI
function onResize() {
    canvas.width = canvas.offsetWidth * devicePixelRatio;
    canvas.height = canvas.offsetHeight * devicePixelRatio;
    ctx.scale(devicePixelRatio, devicePixelRatio);
}

window.addEventListener('resize', onResize);

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    onResize();
    update();
    
    // Trigger update on any input change
    document.querySelectorAll('input, select').forEach(el => {
        el.oninput = () => {}; // update loop handles values via global refs
    });

    // Register Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered'))
            .catch(err => console.log('SW failed', err));
    }
});
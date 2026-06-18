// DOM Elements
const sourceInput = document.getElementById('source-input');
const targetInput = document.getElementById('target-input');
const sourceDropzone = document.getElementById('source-dropzone');
const targetDropzone = document.getElementById('target-dropzone');
const sourcePreview = document.getElementById('source-preview');
const targetPreview = document.getElementById('target-preview');
const presetButtons = document.querySelectorAll('.btn-preset');
const btnProcess = document.getElementById('btn-process');
const btnAnimate = document.getElementById('btn-animate');
const btnDownload = document.getElementById('btn-download');
const outputCanvas = document.getElementById('output-canvas');
const canvasPlaceholder = document.getElementById('canvas-placeholder');
const statusBadge = document.getElementById('status-text');
const resolutionRange = document.getElementById('range-resolution');
const resolutionVal = document.getElementById('val-resolution');
const metricSelect = document.getElementById('select-metric');
const speedRange = document.getElementById('range-speed');
const speedVal = document.getElementById('val-speed');

// 3D Control Elements
const btnMode2D = document.getElementById('btn-mode-2d');
const btnMode3D = document.getElementById('btn-mode-3d');
const dragHint = document.getElementById('drag-hint');
const btnExport3D = document.getElementById('btn-export-3d');
const depthRange = document.getElementById('range-depth');
const depthVal = document.getElementById('val-depth');

// Context and States
const ctx = outputCanvas.getContext('2d');
let sourceImg = null;
let targetImg = null; // Can be an Image object or a Canvas for presets
let currentPreset = 'lincoln';
let particles = [];
let animationFrameId = null;
let isAnimating = false;

// 3D States
let viewMode = '2d'; // '2d' or '3d'
let depthScale = 1.0;
let yaw = -0.5;   // rotation around Y-axis
let pitch = -0.4; // rotation around X-axis
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;
let active3DPixels = []; // Store current set of 3D pixels (source or rearranged)

// Setup Resolution Label
resolutionRange.addEventListener('input', () => {
    resolutionVal.textContent = `${resolutionRange.value} × ${resolutionRange.value}`;
});

// Setup Speed Label
speedRange.addEventListener('input', () => {
    const val = parseInt(speedRange.value);
    if (val < 30) speedVal.textContent = 'Slow';
    else if (val < 70) speedVal.textContent = 'Normal';
    else speedVal.textContent = 'Fast';
});

// Drag and Drop Handlers
function setupDragAndDrop(dropzone, input, onFileLoaded) {
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove('dragover');
        }, false);
    });

    dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length > 0) {
            input.files = files;
            handleFile(files[0], onFileLoaded);
        }
    });

    input.addEventListener('change', (e) => {
        if (input.files.length > 0) {
            handleFile(input.files[0], onFileLoaded);
        }
    });
}

function handleFile(file, callback) {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => callback(img);
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// Setup Source & Target Inputs
setupDragAndDrop(sourceDropzone, sourceInput, (img) => {
    sourceImg = img;
    sourcePreview.src = img.src;
    sourcePreview.classList.remove('hidden');
    sourceDropzone.querySelector('.dropzone-content').classList.add('hidden');
    
    // Auto-build 3D points from source image
    build3DPixelsFromSource();
    checkReadyState();
});

setupDragAndDrop(targetDropzone, targetInput, (img) => {
    targetImg = img;
    targetPreview.src = img.src;
    targetPreview.classList.remove('hidden');
    targetDropzone.querySelector('.dropzone-content').classList.add('hidden');
    // Deactivate presets if user uploads custom target
    presetButtons.forEach(btn => btn.classList.remove('active'));
    currentPreset = null;
    checkReadyState();
});

// Preset Buttons Selection
presetButtons.forEach(button => {
    button.addEventListener('click', () => {
        presetButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        currentPreset = button.dataset.preset;
        targetImg = null; // Clear custom target
        targetPreview.classList.add('hidden');
        targetDropzone.querySelector('.dropzone-content').classList.remove('hidden');
        targetInput.value = '';
        checkReadyState();
    });
});

function draw2DSource() {
    if (!sourceImg) return;
    const size = parseInt(resolutionRange.value);
    outputCanvas.width = size;
    outputCanvas.height = size;
    ctx.drawImage(sourceImg, 0, 0, size, size);
}

function checkReadyState() {
    if (sourceImg) {
        canvasPlaceholder.classList.add('hidden');
        btnExport3D.disabled = false;
        if (viewMode === '3d') {
            render3D();
        } else if (particles.length === 0) {
            // Draw original source as preview if not rearranged yet
            draw2DSource();
        }
    }
    if (sourceImg && (targetImg || currentPreset)) {
        btnProcess.disabled = false;
    } else {
        btnProcess.disabled = true;
        btnAnimate.disabled = true;
    }
}

// Pixel Sorting Metrics helpers
function getPixelMetric(r, g, b, metric) {
    switch (metric) {
        case 'luminance':
            return 0.299 * r + 0.587 * g + 0.114 * b;
        case 'red':
            return r;
        case 'green':
            return g;
        case 'blue':
            return b;
        case 'rgbsum':
            return r + g + b;
        case 'hue':
        case 'saturation':
            const hsl = rgbToHsl(r, g, b);
            return metric === 'hue' ? hsl.h : hsl.s;
        default:
            return 0.299 * r + 0.587 * g + 0.114 * b;
    }
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h, s, l };
}

// Generate Preset Canvas
function generatePresetCanvas(type, size) {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = size;
    pCanvas.height = size;
    const pCtx = pCanvas.getContext('2d');

    // Fill white background
    pCtx.fillStyle = '#ffffff';
    pCtx.fillRect(0, 0, size, size);

    pCtx.fillStyle = '#000000';
    
    if (type === 'lincoln') {
        // Simple artistic portrait silhouette silhouette representation
        pCtx.beginPath();
        // Head back
        pCtx.moveTo(size * 0.3, size * 0.25);
        pCtx.bezierCurveTo(size * 0.25, size * 0.1, size * 0.75, size * 0.05, size * 0.7, size * 0.3);
        // Nose, mouth, beard profile
        pCtx.lineTo(size * 0.72, size * 0.38); // forehead
        pCtx.lineTo(size * 0.75, size * 0.44); // nose tip
        pCtx.lineTo(size * 0.68, size * 0.48); // nose base
        pCtx.lineTo(size * 0.71, size * 0.52); // lips
        pCtx.lineTo(size * 0.65, size * 0.56);
        pCtx.lineTo(size * 0.73, size * 0.72); // beard
        pCtx.lineTo(size * 0.60, size * 0.85); // neck front
        pCtx.lineTo(size * 0.35, size * 0.85); // shoulder
        pCtx.lineTo(size * 0.35, size * 0.65); // neck back
        pCtx.closePath();
        pCtx.fill();

        // Draw classic hat
        pCtx.fillStyle = '#000000';
        pCtx.fillRect(size * 0.35, size * 0.08, size * 0.3, size * 0.15); // Hat crown
        pCtx.fillRect(size * 0.28, size * 0.23, size * 0.44, size * 0.03); // Hat brim
    } else if (type === 'monalisa') {
        // High contrast portrait geometry (Mona Lisa styling outline)
        pCtx.beginPath();
        // Hair & Veil outline
        pCtx.moveTo(size * 0.5, size * 0.15);
        pCtx.bezierCurveTo(size * 0.25, size * 0.18, size * 0.25, size * 0.75, size * 0.3, size * 0.85);
        pCtx.lineTo(size * 0.7, size * 0.85);
        pCtx.bezierCurveTo(size * 0.75, size * 0.75, size * 0.75, size * 0.18, size * 0.5, size * 0.15);
        pCtx.fill();

        // Face cut-out (white negative space)
        pCtx.fillStyle = '#ffffff';
        pCtx.beginPath();
        pCtx.arc(size * 0.5, size * 0.38, size * 0.14, 0, Math.PI * 2);
        pCtx.fill();

        // Portrait details
        pCtx.fillStyle = '#000000';
        pCtx.beginPath();
        pCtx.arc(size * 0.5, size * 0.38, size * 0.08, 0, Math.PI); // hair contour
        pCtx.fill();

        // Hands resting profile
        pCtx.beginPath();
        pCtx.ellipse(size * 0.5, size * 0.78, size * 0.18, size * 0.07, Math.PI / 12, 0, Math.PI * 2);
        pCtx.fill();
    } else if (type === 'geometric') {
        // Dynamic vortex / spiral pattern
        const centerX = size / 2;
        const centerY = size / 2;
        pCtx.fillStyle = '#ffffff';
        pCtx.fillRect(0, 0, size, size);
        pCtx.strokeStyle = '#000000';
        pCtx.lineWidth = size * 0.03;
        
        for (let r = 5; r < size * 0.7; r += 7) {
            pCtx.beginPath();
            pCtx.arc(centerX, centerY, r, 0, Math.PI * 2);
            pCtx.stroke();
        }
    } else if (type === 'star') {
        // Classic Star geometry
        const cx = size / 2;
        const cy = size / 2;
        const spikes = 5;
        const outerRadius = size * 0.42;
        const innerRadius = size * 0.18;

        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;

        pCtx.beginPath();
        pCtx.moveTo(cx, cy - outerRadius);
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            pCtx.lineTo(x, y);
            rot += step;

            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            pCtx.lineTo(x, y);
            rot += step;
        }
        pCtx.lineTo(cx, cy - outerRadius);
        pCtx.closePath();
        pCtx.fill();
    }

    return pCanvas;
}

// Build Pixel Structures & Rearrange
function processPixels() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    isAnimating = false;

    const size = parseInt(resolutionRange.value);
    outputCanvas.width = size;
    outputCanvas.height = size;

    // 1. Draw source image onto temp offscreen canvas to extract pixels
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = size;
    srcCanvas.height = size;
    const srcCtx = srcCanvas.getContext('2d');
    srcCtx.drawImage(sourceImg, 0, 0, size, size);
    const srcData = srcCtx.getImageData(0, 0, size, size).data;

    // 2. Draw target image or preset onto target offscreen canvas
    const tgtCanvas = document.createElement('canvas');
    tgtCanvas.width = size;
    tgtCanvas.height = size;
    const tgtCtx = tgtCanvas.getContext('2d');

    if (targetImg) {
        tgtCtx.drawImage(targetImg, 0, 0, size, size);
    } else {
        const presetCanvas = generatePresetCanvas(currentPreset, size);
        tgtCtx.drawImage(presetCanvas, 0, 0, size, size);
    }
    const tgtData = tgtCtx.getImageData(0, 0, size, size).data;

    // 3. Collect source & target pixel arrays
    const srcPixels = [];
    const tgtPixels = [];
    const metric = metricSelect.value;

    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4;
            const sr = srcData[idx];
            const sg = srcData[idx + 1];
            const sb = srcData[idx + 2];
            const sa = srcData[idx + 3];

            const tr = tgtData[idx];
            const tg = tgtData[idx + 1];
            const tb = tgtData[idx + 2];
            const ta = tgtData[idx + 3];

            srcPixels.push({
                r: sr, g: sg, b: sb, a: sa,
                key: getPixelMetric(sr, sg, sb, metric),
                origX: x, origY: y
            });

            tgtPixels.push({
                r: tr, g: tg, b: tb, a: ta,
                key: getPixelMetric(tr, tg, tb, metric),
                targetX: x, targetY: y
            });
        }
    }

    // 4. Sort arrays by chosen metric
    srcPixels.sort((a, b) => a.key - b.key);
    tgtPixels.sort((a, b) => a.key - b.key);

    // 5. Match sorted source pixels to target layout positions
    particles = [];
    for (let i = 0; i < srcPixels.length; i++) {
        const s = srcPixels[i];
        const t = tgtPixels[i];

        particles.push({
            r: s.r, g: s.g, b: s.b, a: s.a,
            // Start at original source position
            x: s.origX, y: s.origY,
            startX: s.origX, startY: s.origY,
            // End at matching target position
            endX: t.targetX, endY: t.targetY,
            t: 0 // Animation progress [0, 1]
        });
    }

    // Render immediate matched output
    drawImmediate();

    // Populate active 3D pixel cloud from matched output
    build3DFromRearranged();

    statusBadge.textContent = 'Rearranged!';
    statusBadge.className = 'status-badge complete';
    btnAnimate.disabled = false;
    btnDownload.disabled = false;
}

function drawImmediate() {
    const size = parseInt(resolutionRange.value);
    const imgData = ctx.createImageData(size, size);
    
    // Draw each particle at its end target coordinate
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const idx = (p.endY * size + p.endX) * 4;
        imgData.data[idx] = p.r;
        imgData.data[idx + 1] = p.g;
        imgData.data[idx + 2] = p.b;
        imgData.data[idx + 3] = p.a;
    }
    
    ctx.putImageData(imgData, 0, 0);
}

// Particle Morph Animation
function runMorphAnimation() {
    if (particles.length === 0) return;
    
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }

    isAnimating = true;
    statusBadge.textContent = 'Morphing...';
    statusBadge.className = 'status-badge working';

    const size = parseInt(resolutionRange.value);
    const speed = parseFloat(speedRange.value) / 1500; // Normalised speed step
    let t = 0;

    function animate() {
        // Clear canvas
        ctx.fillStyle = '#040508';
        ctx.fillRect(0, 0, size, size);

        const imgData = ctx.createImageData(size, size);
        
        t = Math.min(1, t + speed);
        const ease = easeInOutCubic(t);

        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            
            // Interpolate position based on precalculated easing factor
            const x = p.startX + (p.endX - p.startX) * ease;
            const y = p.startY + (p.endY - p.startY) * ease;

            // Draw to pixel grid buffer (round to nearest pixel)
            const px = Math.round(x);
            const py = Math.round(y);

            if (px >= 0 && px < size && py >= 0 && py < size) {
                const idx = (py * size + px) * 4;
                imgData.data[idx] = p.r;
                imgData.data[idx + 1] = p.g;
                imgData.data[idx + 2] = p.b;
                imgData.data[idx + 3] = p.a;
            }
        }

        ctx.putImageData(imgData, 0, 0);

        if (t < 1 && isAnimating) {
            animationFrameId = requestAnimationFrame(animate);
        } else {
            isAnimating = false;
            statusBadge.textContent = 'Finished!';
            statusBadge.className = 'status-badge complete';
            // Repopulate 3D cloud once morph is finished
            build3DFromRearranged();
        }
    }

    animate();
}

function easeInOutCubic(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// 3D Rendering & Projections
function build3DPixelsFromSource() {
    if (!sourceImg) return;
    const size = parseInt(resolutionRange.value);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = size;
    tempCanvas.height = size;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(sourceImg, 0, 0, size, size);
    const data = tempCtx.getImageData(0, 0, size, size).data;
    
    active3DPixels = [];
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            const idx = (y * size + x) * 4;
            const r = data[idx];
            const g = data[idx+1];
            const b = data[idx+2];
            const a = data[idx+3];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            
            active3DPixels.push({
                r, g, b, a,
                x: x - size / 2,
                y: y - size / 2,
                z: (lum / 255) * size * 0.4 // Depth map
            });
        }
    }
}

function build3DFromRearranged() {
    const size = parseInt(resolutionRange.value);
    if (particles.length === 0) return;
    active3DPixels = [];
    for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const lum = 0.299 * p.r + 0.587 * p.g + 0.114 * p.b;
        active3DPixels.push({
            r: p.r, g: p.g, b: p.b, a: p.a,
            x: p.endX - size / 2,
            y: p.endY - size / 2,
            z: (lum / 255) * size * 0.4
        });
    }
}

function render3D() {
    if (active3DPixels.length === 0) return;
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
    }
    isAnimating = false;

    const size = parseInt(resolutionRange.value);
    outputCanvas.width = size;
    outputCanvas.height = size;

    // Clear canvas
    ctx.fillStyle = '#040508';
    ctx.fillRect(0, 0, size, size);

    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const cosX = Math.cos(pitch);
    const sinX = Math.sin(pitch);

    const fov = size * 1.3;
    const cameraZ = size * 1.5;
    const center = size / 2;

    const projected = [];

    for (let i = 0; i < active3DPixels.length; i++) {
        const p = active3DPixels[i];
        
        // 1. Yaw rotation (Y-axis)
        const rx1 = p.x * cosY - p.z * depthScale * sinY;
        const rz1 = p.x * sinY + p.z * depthScale * cosY;

        // 2. Pitch rotation (X-axis)
        const ry2 = p.y * cosX - rz1 * sinX;
        const rz2 = p.y * sinX + rz1 * cosX;

        const distZ = cameraZ + rz2;
        if (distZ <= 10) continue;

        const projX = (rx1 * fov) / distZ + center;
        const projY = (ry2 * fov) / distZ + center;

        projected.push({
            r: p.r, g: p.g, b: p.b, a: p.a,
            projX, projY,
            depth: rz2
        });
    }

    // Depth sort (Painter's algorithm: draw back-to-front)
    projected.sort((a, b) => b.depth - a.depth);

    const imgData = ctx.createImageData(size, size);

    for (let i = 0; i < projected.length; i++) {
        const p = projected[i];
        const px = Math.round(p.projX);
        const py = Math.round(p.projY);

        if (px >= 0 && px < size && py >= 0 && py < size) {
            const idx = (py * size + px) * 4;
            imgData.data[idx] = p.r;
            imgData.data[idx + 1] = p.g;
            imgData.data[idx + 2] = p.b;
            imgData.data[idx + 3] = p.a;
        }
    }

    ctx.putImageData(imgData, 0, 0);
}

// Export point cloud to OBJ with vertex colors (Blender format)
function exportToOBJ() {
    if (active3DPixels.length === 0) return;

    statusBadge.textContent = 'Exporting...';
    statusBadge.className = 'status-badge working';

    const lines = [
        "# OBJ export from Pixel Rearranger",
        `# Vertices: ${active3DPixels.length}`
    ];

    for (let i = 0; i < active3DPixels.length; i++) {
        const p = active3DPixels[i];
        const r = (p.r / 255).toFixed(4);
        const g = (p.g / 255).toFixed(4);
        const b = (p.b / 255).toFixed(4);
        const z = (p.z * depthScale).toFixed(4);
        
        // Blender-compatible format using vertex coordinates and color definitions: v x y z r g b
        lines.push(`v ${p.x.toFixed(2)} ${(-p.y).toFixed(2)} ${z} ${r} ${g} ${b}`);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'pixel-3d-model.obj';
    link.href = url;
    link.click();

    statusBadge.textContent = 'Exported!';
    statusBadge.className = 'status-badge complete';
}

// Download Canvas Output
function downloadCanvas() {
    const link = document.createElement('a');
    link.download = `pixel-rearranged-${metricSelect.value}.png`;
    link.href = outputCanvas.toDataURL('image/png');
    link.click();
}

// Depth Scale Controls
depthRange.addEventListener('input', () => {
    depthScale = parseFloat(depthRange.value);
    depthVal.textContent = depthScale.toFixed(1);
    if (viewMode === '3d') {
        render3D();
    }
});

// Resolution update rebuild
resolutionRange.addEventListener('change', () => {
    if (sourceImg) {
        build3DPixelsFromSource();
        if (particles.length > 0) {
            build3DFromRearranged();
        }
        if (viewMode === '3d') {
            render3D();
        } else if (particles.length === 0) {
            draw2DSource();
        }
    }
});

// 2D/3D View Mode Switches
btnMode2D.addEventListener('click', () => {
    viewMode = '2d';
    btnMode2D.classList.add('active');
    btnMode3D.classList.remove('active');
    dragHint.classList.add('hidden');
    if (particles.length > 0) {
        drawImmediate();
    } else if (sourceImg) {
        draw2DSource();
    }
});

btnMode3D.addEventListener('click', () => {
    viewMode = '3d';
    btnMode3D.classList.add('active');
    btnMode2D.classList.remove('active');
    if (sourceImg) {
        dragHint.classList.remove('hidden');
        render3D();
    }
});

// Drag to Rotate event listeners
outputCanvas.addEventListener('mousedown', (e) => {
    if (viewMode !== '3d') return;
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});

window.addEventListener('mousemove', (e) => {
    if (!isDragging || viewMode !== '3d') return;
    const dx = e.clientX - lastMouseX;
    const dy = e.clientY - lastMouseY;
    yaw += dx * 0.007;
    pitch += dy * 0.007;
    pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    render3D();
});

window.addEventListener('mouseup', () => {
    isDragging = false;
});

// Mobile Touch Rotations
outputCanvas.addEventListener('touchstart', (e) => {
    if (viewMode !== '3d' || e.touches.length === 0) return;
    isDragging = true;
    lastMouseX = e.touches[0].clientX;
    lastMouseY = e.touches[0].clientY;
});

outputCanvas.addEventListener('touchmove', (e) => {
    if (!isDragging || viewMode !== '3d' || e.touches.length === 0) return;
    const dx = e.touches[0].clientX - lastMouseX;
    const dy = e.touches[0].clientY - lastMouseY;
    yaw += dx * 0.007;
    pitch += dy * 0.007;
    pitch = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1, pitch));
    lastMouseX = e.touches[0].clientX;
    lastMouseY = e.touches[0].clientY;
    render3D();
});

outputCanvas.addEventListener('touchend', () => {
    isDragging = false;
});

// Event Listeners for actions
btnProcess.addEventListener('click', processPixels);
btnAnimate.addEventListener('click', runMorphAnimation);
btnDownload.addEventListener('click', downloadCanvas);
btnExport3D.addEventListener('click', exportToOBJ);


const PUZZLE_ROWS = 10;
const PUZZLE_COLS = 10;
const TOTAL_PIECES = PUZZLE_ROWS * PUZZLE_COLS;
let PIECE_WIDTH, PIECE_HEIGHT;

let pieces = [];
let selectedPiece = null;
let hoveredPiece = null;
let offsetX = 0, offsetY = 0;
// Snap distance in pixels
const SNAP_THRESHOLD = 20;

const mainCanvas = document.getElementById('puzzle-canvas');
const mainCtx = mainCanvas.getContext('2d');
const sidebarCanvas = document.getElementById('sidebar-canvas');
const sidebarCtx = sidebarCanvas.getContext('2d');
const sidebarContainer = document.querySelector('.pieces-container');
const puzzleSelect = document.getElementById('puzzle-select');
const customImageInput = document.getElementById('custom-image-input');
const uploadBtn = document.getElementById('upload-btn');

// Puzzle Configuration
const AVAILABLE_PUZZLES = [
    { name: 'Mountain View', src: 'images/mountain.jpg' },
    { name: 'Coding Setup', src: 'images/code.jpg' },
    { name: 'Mountain Lake', src: 'images/mountain-lake.jpg' }
];

// Use a high-quality image from Unsplash
const img = new Image();
img.crossOrigin = "Anonymous";
// Default image
img.src = AVAILABLE_PUZZLES[0].src;

// Sound effects (optional, can be added later)
// const clickSound = new Audio('click.mp3'); 

img.onload = () => {
    initGame();
};

img.onerror = () => {
    console.error("Failed to load image:", img.src);
    // Fallback if local image fails (e.g. if user didn't run the download commands)
    if (!img.src.startsWith('data:')) {
        alert("Could not load image. If you are running locally, make sure the 'images' folder exists and contains 'mountain.jpg'.");
    }
};

// Populate Select
AVAILABLE_PUZZLES.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.src;
    opt.textContent = p.name;
    puzzleSelect.appendChild(opt);
});

// Handle Selection
puzzleSelect.addEventListener('change', (e) => {
    if (e.target.value === 'custom') return; // Placeholder
    img.src = e.target.value;
});

// Handle Custom Upload
uploadBtn.addEventListener('click', () => customImageInput.click());
customImageInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (event) => {
            img.src = event.target.result;
            // Add to dropdown as "Custom"
            const opt = document.createElement('option');
            opt.value = event.target.result;
            opt.textContent = "Custom Image (" + e.target.files[0].name + ")";
            opt.selected = true;
            puzzleSelect.appendChild(opt);
        };
        reader.readAsDataURL(e.target.files[0]);
    }
});

window.addEventListener('resize', handleResize);

function handleResize() {
    // Re-adjust sidebar canvas size
    const rect = sidebarContainer.getBoundingClientRect();
    sidebarCanvas.width = rect.width;
    sidebarCanvas.height = rect.height;
    drawSidebar();
}

function initGame() {
    // Set main canvas to image size (or scaled down if image is huge)
    // For simplicity, let's limit max width to 800 for the main canvas
    const maxWidth = 800;
    const scale = Math.min(1, maxWidth / img.width);

    mainCanvas.width = img.width * scale;
    mainCanvas.height = img.height * scale;

    PIECE_WIDTH = mainCanvas.width / PUZZLE_COLS;
    PIECE_HEIGHT = mainCanvas.height / PUZZLE_ROWS;

    handleResize(); // Init sidebar size

    // Reset game state
    pieces = [];
    selectedPiece = null;

    generatePieces();
    randomizePieces();

    // Initial draw
    requestAnimationFrame(gameLoop);

    // Event listeners
    setupInput(mainCanvas, true);
    setupInput(sidebarCanvas, false);
}

// Generate tabs (-1: inward, 0: flat, 1: outward)
function generatePieces() {
    pieces = [];
    for (let r = 0; r < PUZZLE_ROWS; r++) {
        for (let c = 0; c < PUZZLE_COLS; c++) {
            const piece = {
                id: r * PUZZLE_COLS + c,
                r: r,
                c: c,
                currentX: 0, // Current position on screen (relative to its canvas)
                currentY: 0,
                correctX: c * PIECE_WIDTH, // Correct position on MAIN canvas
                correctY: r * PIECE_HEIGHT,
                targetCanvas: 'sidebar', // 'sidebar' or 'main'
                isLocked: false,
                tabs: {
                    top: (r === 0) ? 0 : -pieces[(r - 1) * PUZZLE_COLS + c].tabs.bottom,
                    right: (c === PUZZLE_COLS - 1) ? 0 : (Math.random() > 0.5 ? 1 : -1),
                    bottom: (r === PUZZLE_ROWS - 1) ? 0 : (Math.random() > 0.5 ? 1 : -1),
                    left: (c === 0) ? 0 : -pieces[r * PUZZLE_COLS + (c - 1)].tabs.right
                }
            };
            pieces.push(piece);
        }
    }
}

function randomizePieces() {
    pieces.forEach(p => {
        p.targetCanvas = 'sidebar';
        p.isLocked = false;
        // Random position within sidebar
        // Note: Sidebar canvas height might be smaller than total pile, 
        // effectively we're just placing them in a scrollable-like area visualized on the canvas
        // For a simple start, scatter them within the visible sidebar area
        p.currentX = Math.random() * (sidebarCanvas.width - PIECE_WIDTH);
        p.currentY = Math.random() * (sidebarCanvas.height - PIECE_HEIGHT);
    });
}

function getPieceAt(x, y, targetCanvasName) {
    // Search in reverse order to pick top-most piece
    // Only search pieces belonging to this canvas
    const relevantPieces = pieces.filter(p => p.targetCanvas === targetCanvasName && !p.isLocked);

    for (let i = relevantPieces.length - 1; i >= 0; i--) {
        const p = relevantPieces[i];
        if (x > p.currentX && x < p.currentX + PIECE_WIDTH &&
            y > p.currentY && y < p.currentY + PIECE_HEIGHT) {
            return p;
        }
    }
    return null;
}

function setupInput(canvasEl, isMain) {
    const getPos = (e) => {
        const rect = canvasEl.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };

    canvasEl.addEventListener('mousedown', (e) => {
        const pos = getPos(e);
        const p = getPieceAt(pos.x, pos.y, isMain ? 'main' : 'sidebar');
        if (p) {
            selectedPiece = p;
            offsetX = pos.x - p.currentX;
            offsetY = pos.y - p.currentY;
            // Move to end of array to draw on top
            // Note: We might need a better z-index strategy if using single array
            // But for now, let's just keep 'locked' pieces as bottom layer logic in draw
        }
    });

    window.addEventListener('mousemove', (e) => {
        if (selectedPiece) {
            // We need to calculate position relative to the canvas the piece is currently "over"
            // However, dragging between canvases is tricky with two separate canvases.
            // A simpler approach for this MVP:
            // - If dragging from sidebar:
            //   - If mouse moves over main canvas, switch the piece's context to 'main'
            //   - Else stay in sidebar

            const mainRect = mainCanvas.getBoundingClientRect();
            const sidebarRect = sidebarCanvas.getBoundingClientRect();

            // Check if mouse is over main canvas
            if (e.clientX >= mainRect.left && e.clientX <= mainRect.right &&
                e.clientY >= mainRect.top && e.clientY <= mainRect.bottom) {

                if (selectedPiece.targetCanvas !== 'main') {
                    // Switch to main
                    selectedPiece.targetCanvas = 'main';
                }
                selectedPiece.currentX = (e.clientX - mainRect.left) - offsetX;
                selectedPiece.currentY = (e.clientY - mainRect.top) - offsetY;

            } else if (e.clientX >= sidebarRect.left && e.clientX <= sidebarRect.right &&
                e.clientY >= sidebarRect.top && e.clientY <= sidebarRect.bottom) {

                if (selectedPiece.targetCanvas !== 'sidebar') {
                    // Switch to sidebar
                    selectedPiece.targetCanvas = 'sidebar';
                }
                selectedPiece.currentX = (e.clientX - sidebarRect.left) - offsetX;
                selectedPiece.currentY = (e.clientY - sidebarRect.top) - offsetY;
            } else {
                // Dragging outside both? Keep it in the last known, updating coords relative to it
                // This might feel disconnected if mouse bounds are far. 
                // Let's just update based on current targetCanvas.
                if (selectedPiece.targetCanvas === 'main') {
                    selectedPiece.currentX = (e.clientX - mainRect.left) - offsetX;
                    selectedPiece.currentY = (e.clientY - mainRect.top) - offsetY;
                } else {
                    selectedPiece.currentX = (e.clientX - sidebarRect.left) - offsetX;
                    selectedPiece.currentY = (e.clientY - sidebarRect.top) - offsetY;

                }
            }
        }
    });

    window.addEventListener('mouseup', () => {
        if (selectedPiece) {
            // Check snap only if on main canvas
            if (selectedPiece.targetCanvas === 'main') {
                const dist = Math.hypot(selectedPiece.currentX - selectedPiece.correctX, selectedPiece.currentY - selectedPiece.correctY);
                if (dist < SNAP_THRESHOLD) {
                    selectedPiece.currentX = selectedPiece.correctX;
                    selectedPiece.currentY = selectedPiece.correctY;
                    selectedPiece.isLocked = true;
                    // Play snap sound here
                }
            }
            selectedPiece = null;
        }
    });
}

function gameLoop() {
    drawMain();
    drawSidebar();
    requestAnimationFrame(gameLoop);
}

function drawMain() {
    mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);

    // Draw outline/grid (optional hint)
    mainCtx.globalAlpha = 0.1;
    mainCtx.drawImage(img, 0, 0, mainCanvas.width, mainCanvas.height);
    mainCtx.globalAlpha = 1.0;

    // Draw pieces
    // 1. Locked pieces
    // 2. Loose pieces on main canvas

    pieces.forEach(p => {
        if (p.targetCanvas === 'main') {
            drawPiece(mainCtx, p);
        }
    });
}

function drawSidebar() {
    sidebarCtx.fillStyle = '#252525';
    sidebarCtx.fillRect(0, 0, sidebarCanvas.width, sidebarCanvas.height);

    pieces.forEach(p => {
        if (p.targetCanvas === 'sidebar') {
            drawPiece(sidebarCtx, p);
        }
    });
}

function drawPiece(ctx, p) {
    if (!p) return;

    ctx.save();
    ctx.translate(p.currentX, p.currentY);

    // Create the path
    const path = new Path2D();
    const w = PIECE_WIDTH;
    const h = PIECE_HEIGHT;

    // Basic shape drawing with tabs
    // Keep it simple but recognizable: 
    // Start top-left
    let x = 0, y = 0;
    path.moveTo(x, y);

    // Top
    if (p.tabs.top !== 0) {
        path.lineTo(w * 0.35, y);
        path.bezierCurveTo(w * 0.35, y - w * 0.2 * p.tabs.top, w * 0.65, y - w * 0.2 * p.tabs.top, w * 0.65, y);
    }
    path.lineTo(w, y);

    // Right
    if (p.tabs.right !== 0) {
        path.lineTo(w, h * 0.35);
        path.bezierCurveTo(w + h * 0.2 * p.tabs.right, h * 0.35, w + h * 0.2 * p.tabs.right, h * 0.65, w, h * 0.65);
    }
    path.lineTo(w, h);

    // Bottom
    if (p.tabs.bottom !== 0) {
        path.lineTo(w * 0.65, h);
        path.bezierCurveTo(w * 0.65, h + w * 0.2 * p.tabs.bottom, w * 0.35, h + w * 0.2 * p.tabs.bottom, w * 0.35, h);
    }
    path.lineTo(0, h);

    // Left
    if (p.tabs.left !== 0) {
        path.lineTo(0, h * 0.65);
        path.bezierCurveTo(-h * 0.2 * p.tabs.left, h * 0.65, -h * 0.2 * p.tabs.left, h * 0.35, 0, h * 0.35);
    }
    path.lineTo(0, 0);
    path.closePath();

    ctx.clip(path);

    // Draw the image part corresponding to this piece
    // We need to map the piece's correct position in the source image
    // sourceX = p.c * (img.width / PUZZLE_COLS)
    // sourceY = p.r * (img.height / PUZZLE_ROWS)
    // sourceW = img.width / PUZZLE_COLS
    // sourceH = img.height / PUZZLE_ROWS
    // BUT we need to account for tabs potentially grabbing pixels outside the square
    // It's easier to just draw the whole image translated negatively

    // Correct logic:
    // Translate context to piece position (done)
    // Translate standard back by correctX, correctY
    ctx.drawImage(
        img,
        0, 0, img.width, img.height, // Source
        -p.correctX, -p.correctY, mainCanvas.width, mainCanvas.height // Destination
    );

    // Draw border
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke(path);

    // Highlight if selected
    if (selectedPiece === p) {
        ctx.strokeStyle = '#ffeb3b';
        ctx.lineWidth = 2;
        ctx.stroke(path);
    }

    ctx.restore();
}

// shuffle button
document.getElementById('shuffle-btn').addEventListener('click', () => {
    randomizePieces();
});


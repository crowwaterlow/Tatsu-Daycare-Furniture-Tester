const canvas = document.getElementById('testerCanvas');
const ctx = canvas.getContext('2d');

// Catalog of repo-hosted furniture items
const FURNITURE_CATALOG = {
  chair: { 
    name: "Office Chair", 
    src: "./assets/furniture/chair-sheet.png", 
    footprint: { w: 2, d: 1 },
    offsetX: 0,
    offsetY: 0
  },
  table: { 
    name: "Large Table", 
    src: "./assets/furniture/table-sheet.png", 
    footprint: { w: 2, d: 2 },
    offsetX: 0,
    offsetY: 0
  }
};

let currentFurnitureKey = 'chair';
let activeFurnitureConfig = FURNITURE_CATALOG[currentFurnitureKey];

// Layout state (Default 2x2 room: 8x8 tiles)
let layoutConfig = { key: '2x2', cols: 8, rows: 8 };
let grid = Array.from({ length: 8 }, () => Array(8).fill(null));
let placedItems = [];
let selectedItemInstance = null;

// Isometric Constants
const ORIGIN_X = 256;
const ORIGIN_Y = 160;
const TILE_W = 64;
const TILE_H = 32;

// Image Assets
let roomImg = new Image();
let furnitureImg = new Image();
let roomLoaded = false;
let furnitureLoaded = false;

let currentRotation = 0;
let mouseGrid = { r: -1, c: -1 };

// Load Room Image from your custom Images/Rooms/ path
function loadRoomImage(layoutKey) {
  roomLoaded = false;
  roomImg.src = `./Images/Rooms/${layoutKey}.png`;
  roomImg.onload = () => {
    roomLoaded = true;
    drawScene();
  };
  roomImg.onerror = () => {
    console.error(`Failed to load room image: ./Images/Rooms/${layoutKey}.png`);
  };
}

// Load Furniture Image from catalog
function loadFurnitureImage(furnitureKey) {
  furnitureLoaded = false;
  activeFurnitureConfig = FURNITURE_CATALOG[furnitureKey];
  furnitureImg.src = activeFurnitureConfig.src;
  furnitureImg.onload = () => {
    furnitureLoaded = true;
    drawScene();
  };
  furnitureImg.onerror = () => {
    console.error(`Failed to load furniture image: ${activeFurnitureConfig.src}`);
  };
}

// Initialize default assets on startup
loadRoomImage('2x2');
loadFurnitureImage('chair');

// --- UI Event Listeners ---
document.getElementById('layoutSelect').addEventListener('change', (e) => {
  const val = e.target.value; // e.g., "2x3"
  const [roomsW, roomsH] = val.split('x').map(Number);
  
  layoutConfig = { key: val, cols: roomsW * 4, rows: roomsH * 4 };

  // Filter out any placed items that fall out of bounds with the new layout size
  placedItems = placedItems.filter(item => {
    const { w, d } = getEffectiveFootprint(item.footprint, item.rotation);
    return item.row + d <= layoutConfig.rows && item.col + w <= layoutConfig.cols;
  });

  // Clear selection if selected item was removed
  if (selectedItemInstance && !placedItems.includes(selectedItemInstance)) {
    selectedItemInstance = null;
    updateSelectionUI();
  }

  rebuildGrid();
  loadRoomImage(val);
});

document.getElementById('furnitureSelect').addEventListener('change', (e) => {
  currentFurnitureKey = e.target.value;
  currentRotation = 0;
  loadFurnitureImage(currentFurnitureKey);
});

// Selection UI Toggle
const selectedActionsPanel = document.getElementById('selectedActionsPanel');
function updateSelectionUI() {
  if (selectedItemInstance) {
    selectedActionsPanel.classList.remove('hidden');
  } else {
    selectedActionsPanel.classList.add('hidden');
  }
}

// --- Grid & Coordinate Math ---
function screenToGrid(screenX, screenY) {
  const relX = screenX - ORIGIN_X;
  const relY = screenY - ORIGIN_Y;
  const col = (relX / (TILE_W / 2) + relY / (TILE_H / 2)) / 2;
  const row = (relY / (TILE_H / 2) - relX / (TILE_W / 2)) / 2;
  return { r: Math.floor(row), c: Math.floor(col) };
}

function gridToScreen(row, col) {
  const screenX = ORIGIN_X + (col - row) * (TILE_W / 2);
  const screenY = ORIGIN_Y + (col + row) * (TILE_H / 2);
  return { x: screenX, y: screenY };
}

function getEffectiveFootprint(footprint, rotation) {
  const isSwapped = rotation % 2 === 1;
  return {
    w: isSwapped ? footprint.d : footprint.w,
    d: isSwapped ? footprint.w : footprint.d
  };
}

function checkCollision(startRow, startCol, footprint, rotation, ignoreId = null) {
  const { w, d } = getEffectiveFootprint(footprint, rotation);
  if (startRow < 0 || startCol < 0 || startRow + d > layoutConfig.rows || startCol + w > layoutConfig.cols) {
    return true;
  }
  for (let r = startRow; r < startRow + d; r++) {
    for (let c = startCol; c < startCol + w; c++) {
      if (grid[r][c] !== null && grid[r][c] !== ignoreId) {
        return true;
      }
    }
  }
  return false;
}

// --- Mouse Interaction ---
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const { r, c } = screenToGrid(e.clientX - rect.left, e.clientY - rect.top);
  if (r !== mouseGrid.r || c !== mouseGrid.c) {
    mouseGrid = { r, c };
    drawScene();
  }
});

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  const { r, c } = screenToGrid(e.clientX - rect.left, e.clientY - rect.top);
  
  if (r < 0 || r >= layoutConfig.rows || c < 0 || c >= layoutConfig.cols) return;

  // 1. If clicking an existing item, select it
  const occupantId = grid[r][c];
  if (occupantId !== null) {
    selectedItemInstance = placedItems.find(item => item.id === occupantId);
    updateSelectionUI();
    drawScene();
    return;
  }

  // 2. Otherwise, place new furniture if valid
  if (furnitureLoaded) {
    const footprint = activeFurnitureConfig.footprint;
    if (!checkCollision(r, c, footprint, currentRotation)) {
      const newItem = {
        id: Date.now() + Math.random(),
        row: r,
        col: c,
        footprint: { ...footprint },
        rotation: currentRotation,
        offsetX: activeFurnitureConfig.offsetX,
        offsetY: activeFurnitureConfig.offsetY
      };
      placedItems.push(newItem);
      selectedItemInstance = newItem; // Auto-select the newly placed item
      rebuildGrid();
      updateSelectionUI();
      drawScene();
    }
  }
});

function rebuildGrid() {
  grid = Array.from({ length: layoutConfig.rows }, () => Array(layoutConfig.cols).fill(null));
  placedItems.forEach(item => {
    const { w, d } = getEffectiveFootprint(item.footprint, item.rotation);
    for (let r = item.row; r < item.row + d; r++) {
      for (let c = item.col; c < item.col + w; c++) {
        if (r < layoutConfig.rows && c < layoutConfig.cols) {
          grid[r][c] = item.id;
        }
      }
    }
  });
}

// --- Rotation & Deletion Handlers ---
function rotateSelectedItem(direction) {
  if (!selectedItemInstance) return;
  // direction: 1 for CW, -1 for CCW
  const nextRot = (selectedItemInstance.rotation + direction + 4) % 4;
  if (!checkCollision(selectedItemInstance.row, selectedItemInstance.col, selectedItemInstance.footprint, nextRot, selectedItemInstance.id)) {
    selectedItemInstance.rotation = nextRot;
    rebuildGrid();
    drawScene();
  }
}

document.getElementById('rotateCWBtn').addEventListener('click', () => rotateSelectedItem(1));
document.getElementById('rotateCCWBtn').addEventListener('click', () => rotateSelectedItem(-1));

document.getElementById('deleteSelectedBtn').addEventListener('click', () => {
  if (!selectedItemInstance) return;
  placedItems = placedItems.filter(item => item.id !== selectedItemInstance.id);
  selectedItemInstance = null;
  updateSelectionUI();
  rebuildGrid();
  drawScene();
});

document.getElementById('clearBtn').addEventListener('click', () => {
  grid = Array.from({ length: layoutConfig.rows }, () => Array(layoutConfig.cols).fill(null));
  placedItems = [];
  selectedItemInstance = null;
  updateSelectionUI();
  drawScene();
});

// Keyboard shortcut ('R' to rotate preview or selected item)
window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r') {
    if (selectedItemInstance) {
      rotateSelectedItem(1);
    } else {
      currentRotation = (currentRotation + 1) % 4;
      drawScene();
    }
  }
});

// --- Rendering Logic ---
function drawSprite(ctx, img, rotation, screenX, screenY, offsetX = 0, offsetY = 0) {
  const frameW = img.width / 2;
  const frameH = img.height / 2;
  const col = rotation % 2;
  const row = Math.floor(rotation / 2);

  ctx.drawImage(
    img,
    col * frameW, row * frameH, frameW, frameH,
    screenX - (frameW / 2) + offsetX, screenY - frameH + 16 + offsetY,
    frameW, frameH
  );
}

function drawScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Draw Repo Room Background
  if (roomLoaded) {
    ctx.drawImage(roomImg, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = '#1e1e24';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#9ca3af';
    ctx.font = '14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Loading room asset...', canvas.width / 2, canvas.height / 2);
  }

  // 2. Draw Placed Furniture (Sorted by Painter's Algorithm for proper depth)
  const sortedItems = [...placedItems].sort((a, b) => (a.row + a.col) - (b.row + b.col));
  sortedItems.forEach(item => {
    const { w, d } = getEffectiveFootprint(item.footprint, item.rotation);
    const centerRow = item.row + d / 2;
    const centerCol = item.col + w / 2;
    const screenPos = gridToScreen(centerRow, centerCol);
    
    if (furnitureLoaded) {
      drawSprite(ctx, furnitureImg, item.rotation, screenPos.x, screenPos.y, item.offsetX, item.offsetY);
      
      // Highlight selection border if this item is currently selected
      if (item === selectedItemInstance) {
        ctx.save();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.strokeRect(screenPos.x - 20, screenPos.y - 20, 40, 40);
        ctx.restore();
      }
    }
  });

  // 3. Draw Hover Ghost Preview
  const { r, c } = mouseGrid;
  if (r >= 0 && r < layoutConfig.rows && c >= 0 && c < layoutConfig.cols && furnitureLoaded) {
    const footprint = activeFurnitureConfig.footprint;
    const isColliding = checkCollision(r, c, footprint, currentRotation);
    const { w, d } = getEffectiveFootprint(footprint, currentRotation);

    // Draw footprint tile highlights
    for (let rowIdx = r; rowIdx < r + d; rowIdx++) {
      for (let colIdx = c; colIdx < c + w; colIdx++) {
        if (rowIdx >= 0 && rowIdx < layoutConfig.rows && colIdx >= 0 && colIdx < layoutConfig.cols) {
          const tilePos = gridToScreen(rowIdx, colIdx);
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(tilePos.x, tilePos.y);
          ctx.lineTo(tilePos.x + TILE_W / 2, tilePos.y + TILE_H / 2);
          ctx.lineTo(tilePos.x, tilePos.y + TILE_H);
          ctx.lineTo(tilePos.x - TILE_W / 2, tilePos.y + TILE_H / 2);
          ctx.closePath();
          ctx.fillStyle = isColliding ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)';
          ctx.fill();
          ctx.strokeStyle = isCollizing = isColliding ? '#ef4444' : '#22c55e';
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Draw ghost sprite preview if valid placement
    if (!isColliding) {
      const centerRow = r + d / 2;
      const centerCol = c + w / 2;
      const screenPos = gridToScreen(centerRow, centerCol);
      ctx.save();
      ctx.globalAlpha = 0.6;
      drawSprite(ctx, furnitureImg, currentRotation, screenPos.x, screenPos.y, activeFurnitureConfig.offsetX, activeFurnitureConfig.offsetY);
      ctx.restore();
    }
  }
}

const canvas = document.getElementById('testerCanvas');
const ctx = canvas.getContext('2d');

// Catalog of repo-hosted furniture items (Path updated to Images/Furnitures/)
const FURNITURE_CATALOG = {
  chair: { 
    name: "Office Chair", 
    src: "./Images/Furnitures/chair-sheet.png", 
    footprint: { w: 2, d: 1 },
    offsetX: 0,
    offsetY: 0,
    img: new Image(),
    loaded: false
  },
  table: { 
    name: "Large Table", 
    src: "./Images/Furnitures/table-sheet.png", 
    footprint: { w: 2, d: 2 },
    offsetX: 0,
    offsetY: 0,
    img: new Image(),
    loaded: false
  }
};

// Preload all furniture sprites
Object.values(FURNITURE_CATALOG).forEach(item => {
  item.img.src = item.src;
  item.img.onload = () => { item.loaded = true; drawScene(); };
  item.img.onerror = () => console.error(`Missing furniture sprite: ${item.src}`);
});

let currentFurnitureKey = 'chair';
let layoutConfig = { key: '2x2', cols: 8, rows: 8 };
let grid = Array.from({ length: 8 }, () => Array(8).fill(null));
let placedItems = [];
let selectedItemInstance = null;

// Base Isometric Tile Ratios (2:1)
const BASE_TILE_W = 64;
const BASE_TILE_H = 32;
let viewMetrics = { scale: 1, tileW: 64, tileH: 32, originX: 256, originY: 160 };

function updateViewMetrics() {
  const totalIsoW = (layoutConfig.cols + layoutConfig.rows) * (BASE_TILE_W / 2);
  const totalIsoH = (layoutConfig.cols + layoutConfig.rows) * (BASE_TILE_H / 2);

  const scaleX = (canvas.width - 64) / totalIsoW;
  const scaleY = (canvas.height - 180) / totalIsoH;
  const scale = Math.min(1, scaleX, scaleY);

  const tileW = BASE_TILE_W * scale;
  const tileH = BASE_TILE_H * scale;
  const originX = (canvas.width / 2) + (layoutConfig.rows - layoutConfig.cols) * (tileW / 4);
  const originY = (canvas.height - (layoutConfig.cols + layoutConfig.rows) * (tileH / 2)) / 2 + 40;

  viewMetrics = { scale, tileW, tileH, originX, originY };
}

// Asset Images for Rooms and Furnishing
let roomImg = new Image();
let wallpaperImg = new Image();
let flooringImg = new Image();

let roomLoaded = false;
let wallpaperLoaded = false;
let flooringLoaded = false;

function loadRoomImage(layoutKey) {
  roomLoaded = false;
  roomImg.src = `./Images/Rooms/${layoutKey} Daycare.png`;
  roomImg.onload = () => { roomLoaded = true; drawScene(); };
  roomImg.onerror = () => { console.error(`Missing room asset: Images/Rooms/${layoutKey} Daycare.png`); drawScene(); };
}

function loadWallpaperImage(wallpaperKey) {
  if (wallpaperKey === 'default') {
    wallpaperLoaded = false;
    drawScene();
    return;
  }
  wallpaperLoaded = false;
  wallpaperImg.src = `./Images/Furnishing/${wallpaperKey}.png`;
  wallpaperImg.onload = () => { wallpaperLoaded = true; drawScene(); };
  wallpaperImg.onerror = () => { wallpaperLoaded = false; drawScene(); };
}

function loadFlooringImage(flooringKey) {
  if (flooringKey === 'default') {
    flooringLoaded = false;
    drawScene();
    return;
  }
  flooringLoaded = false;
  flooringImg.src = `./Images/Furnishing/${flooringKey}.png`;
  flooringImg.onload = () => { flooringLoaded = true; drawScene(); };
  flooringImg.onerror = () => { flooringLoaded = false; drawScene(); };
}

// Initialize startup state
updateViewMetrics();
loadRoomImage('2x2');

// --- UI Event Listeners ---
document.getElementById('layoutSelect').addEventListener('change', (e) => {
  const val = e.target.value;
  const [roomsW, roomsH] = val.split('x').map(Number);
  layoutConfig = { key: val, cols: roomsW * 4, rows: roomsH * 4 };
  updateViewMetrics();

  placedItems = placedItems.filter(item => {
    const { w, d } = getEffectiveFootprint(item.footprint, item.rotation);
    return item.row + d <= layoutConfig.rows && item.col + w <= layoutConfig.cols;
  });

  if (selectedItemInstance && !placedItems.includes(selectedItemInstance)) {
    selectedItemInstance = null;
    updateSelectionUI();
  }

  rebuildGrid();
  loadRoomImage(val);
});

document.getElementById('wallpaperSelect').addEventListener('change', (e) => {
  loadWallpaperImage(e.target.value);
});

document.getElementById('flooringSelect').addEventListener('change', (e) => {
  loadFlooringImage(e.target.value);
});

document.getElementById('furnitureSelect').addEventListener('change', (e) => {
  currentFurnitureKey = e.target.value;
  currentRotation = 0;
  drawScene();
});

const selectedActionsPanel = document.getElementById('selectedActionsPanel');
function updateSelectionUI() {
  selectedActionsPanel.classList.toggle('hidden', !selectedItemInstance);
}

// --- Coordinate Math ---
let currentRotation = 0;
let mouseGrid = { r: -1, c: -1 };

function screenToGrid(screenX, screenY) {
  const { originX, originY, tileW, tileH } = viewMetrics;
  const relX = screenX - originX;
  const relY = screenY - originY;
  const col = (relX / (tileW / 2) + relY / (tileH / 2)) / 2;
  const row = (relY / (tileH / 2) - relX / (tileW / 2)) / 2;
  return { r: Math.floor(row), c: Math.floor(col) };
}

function gridToScreen(row, col) {
  const { originX, originY, tileW, tileH } = viewMetrics;
  return {
    x: originX + (col - row) * (tileW / 2),
    y: originY + (col + row) * (tileH / 2)
  };
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
  if (startRow < 0 || startCol < 0 || startRow + d > layoutConfig.rows || startCol + w > layoutConfig.cols) return true;
  for (let r = startRow; r < startRow + d; r++) {
    for (let c = startCol; c < startCol + w; c++) {
      if (grid[r][c] !== null && grid[r][c] !== ignoreId) return true;
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

  const occupantId = grid[r][c];
  if (occupantId !== null) {
    selectedItemInstance = placedItems.find(item => item.id === occupantId);
    updateSelectionUI();
    drawScene();
    return;
  }

  const config = FURNITURE_CATALOG[currentFurnitureKey];
  if (config && config.loaded && !checkCollision(r, c, config.footprint, currentRotation)) {
    const newItem = {
      id: Date.now() + Math.random(),
      type: currentFurnitureKey,
      row: r,
      col: c,
      footprint: { ...config.footprint },
      rotation: currentRotation,
      offsetX: config.offsetX,
      offsetY: config.offsetY
    };
    placedItems.push(newItem);
    selectedItemInstance = newItem;
    rebuildGrid();
    updateSelectionUI();
    drawScene();
  }
});

function rebuildGrid() {
  grid = Array.from({ length: layoutConfig.rows }, () => Array(layoutConfig.cols).fill(null));
  placedItems.forEach(item => {
    const { w, d } = getEffectiveFootprint(item.footprint, item.rotation);
    for (let r = item.row; r < item.row + d; r++) {
      for (let c = item.col; c < item.col + w; c++) {
        if (r < layoutConfig.rows && c < layoutConfig.cols) grid[r][c] = item.id;
      }
    }
  });
}

function rotateSelectedItem(direction) {
  if (!selectedItemInstance) return;
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

window.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'r') {
    if (selectedItemInstance) rotateSelectedItem(1);
    else { currentRotation = (currentRotation + 1) % 4; drawScene(); }
  }
});

// --- Rendering Logic ---
function drawSprite(ctx, img, rotation, screenX, screenY, offsetX = 0, offsetY = 0) {
  const { scale, tileH } = viewMetrics;
  const frameW = img.width / 2;
  const frameH = img.height / 2;
  const drawW = frameW * scale;
  const drawH = frameH * scale;

  const col = rotation % 2;
  const row = Math.floor(rotation / 2);

  ctx.drawImage(
    img,
    col * frameW, row * frameH, frameW, frameH,
    screenX - (drawW / 2) + (offsetX * scale),
    screenY - drawH + (tileH / 2) + (offsetY * scale),
    drawW,
    drawH
  );
}

function drawScene() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 1. Draw Room Base
  if (roomLoaded) {
    ctx.drawImage(roomImg, 0, 0, canvas.width, canvas.height);
  } else {
    ctx.fillStyle = '#1e1e24';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // 2. Draw Flooring / Wallpaper layers if loaded
  if (flooringLoaded) {
    ctx.drawImage(flooringImg, 0, 0, canvas.width, canvas.height);
  }
  if (wallpaperLoaded) {
    ctx.drawImage(wallpaperImg, 0, 0, canvas.width, canvas.height);
  }

  // 3. Draw Placed Furniture (Depth Sorted)
  const sortedItems = [...placedItems].sort((a, b) => (a.row + a.col) - (b.row + b.col));
  sortedItems.forEach(item => {
    const config = FURNITURE_CATALOG[item.type];
    if (!config || !config.loaded) return;

    const { w, d } = getEffectiveFootprint(item.footprint, item.rotation);
    const screenPos = gridToScreen(item.row + d / 2, item.col + w / 2);

    drawSprite(ctx, config.img, item.rotation, screenPos.x, screenPos.y, item.offsetX, item.offsetY);

    if (item === selectedItemInstance) {
      ctx.save();
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.strokeRect(screenPos.x - 20, screenPos.y - 20, 40, 40);
      ctx.restore();
    }
  });

  // 4. Draw Hover Ghost Preview
  const { r, c } = mouseGrid;
  const activeConfig = FURNITURE_CATALOG[currentFurnitureKey];
  if (r >= 0 && r < layoutConfig.rows && c >= 0 && c < layoutConfig.cols && activeConfig && activeConfig.loaded) {
    const { tileW, tileH } = viewMetrics;
    const isColliding = checkCollision(r, c, activeConfig.footprint, currentRotation);
    const { w, d } = getEffectiveFootprint(activeConfig.footprint, currentRotation);

    for (let rowIdx = r; rowIdx < r + d; rowIdx++) {
      for (let colIdx = c; colIdx < c + w; colIdx++) {
        if (rowIdx >= 0 && rowIdx < layoutConfig.rows && colIdx >= 0 && colIdx < layoutConfig.cols) {
          const tilePos = gridToScreen(rowIdx, colIdx);
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(tilePos.x, tilePos.y);
          ctx.lineTo(tilePos.x + tileW / 2, tilePos.y + tileH / 2);
          ctx.lineTo(tilePos.x, tilePos.y + tileH);
          ctx.lineTo(tilePos.x - tileW / 2, tilePos.y + tileH / 2);
          ctx.closePath();
          ctx.fillStyle = isColliding ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)';
          ctx.fill();
          ctx.strokeStyle = isColliding ? '#ef4444' : '#22c55e';
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    if (!isColliding) {
      const screenPos = gridToScreen(r + d / 2, c + w / 2);
      ctx.save();
      ctx.globalAlpha = 0.6;
      drawSprite(ctx, activeConfig.img, currentRotation, screenPos.x, screenPos.y, activeConfig.offsetX, activeConfig.offsetY);
      ctx.restore();
    }
  }
}

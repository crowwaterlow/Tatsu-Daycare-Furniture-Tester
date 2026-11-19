// Global State for Daycare
let currentLayout = null;
let currentZoom = 1.0; // Default scale multiplier
let activeRoomId = 1;

const WALL_SLOTS_PER_HALF = 4; // 4 left (1-4) + 4 right (5-8); 12 per wallpaper half across a 3x3 layout
const splitWallpaperCache = {};

const daycareState = {
    furnishings: {
        floor: {}, // Supports combined floor input and per-room flooring (floor[roomId])
        wall: {}   // Supports combined wall input and per-room wallpaper (wall[roomId])
    },
    furniture: {}
};

const FALLBACK_LAYOUTS = [
    { name: "1x1 Daycare", cols: 4, rows: 4, baseImage: "Images/Rooms/1x1 Daycare.png" },
    { name: "1x2 Daycare", cols: 4, rows: 8, baseImage: "Images/Rooms/1x2 Daycare.png" },
    { name: "2x1 Daycare", cols: 8, rows: 4, baseImage: "Images/Rooms/2x1 Daycare.png" },
    { name: "2x2 Daycare", cols: 8, rows: 8, baseImage: "Images/Rooms/2x2 Daycare.png" },
    { name: "2x3 Daycare", cols: 8, rows: 12, baseImage: "Images/Rooms/2x3 Daycare.png" },
    { name: "3x2 Daycare", cols: 12, rows: 8, baseImage: "Images/Rooms/3x2 Daycare.png" },
    { name: "3x3 Daycare", cols: 12, rows: 12, baseImage: "Images/Rooms/3x3 Daycare.png" }
];

// Exact wall slot numbers per layout and roomId
// Left wall slots: 1-4 | Right wall slots: 5-8
const WALL_SLOT_MAP = {
    "1x1": {
        1: [1, 2, 3, 4, 5, 6, 7, 8]
    },
    "1x2": {
        1: [1, 2, 3, 4, 5, 6, 7, 8],
        2: [1, 2, 3, 4]
    },
    "2x1": {
        1: [1, 2, 3, 4, 5, 6, 7, 8],
        2: [5, 6, 7, 8]
    },
    "2x2": {
        1: [1, 2, 3, 4, 5, 6, 7, 8],
        2: [1, 2, 3, 4],
        3: [5, 6, 7, 8]
    },
    "2x3": {
        1: [1, 2, 3, 4, 5, 6, 7, 8],
        2: [1, 2, 3, 4],
        3: [5, 6, 7, 8],
        4: [1, 2, 3, 4]
    },
    "3x2": {
        1: [1, 2, 3, 4, 5, 6, 7, 8],
        2: [1, 2, 3, 4],
        3: [5, 6, 7, 8],
        5: [5, 6, 7, 8]
    },
    "3x3": {
        1: [1, 2, 3, 4, 5, 6, 7, 8],
        2: [1, 2, 3, 4],
        3: [5, 6, 7, 8],
        4: [1, 2, 3, 4],
        6: [5, 6, 7, 8]
    }
};

// DOM Elements
const roomLayer = document.getElementById('room-layer');
const furnitureStageLayers = document.getElementById('furniture-stage-layers');

function getAvailableLayouts() {
    if (typeof masterLayouts !== 'undefined' && Array.isArray(masterLayouts) && masterLayouts.length > 0) {
        return masterLayouts;
    }
    return FALLBACK_LAYOUTS;
}

function getLayoutKey(layout) {
    if (!layout) return "1x1";
    const nameMatch = (layout.name || "").match(/\b([1-3]x[1-3])\b/i);
    if (nameMatch) return nameMatch[1].toLowerCase();

    if (layout.cols === 4 && layout.rows === 4) return "1x1";
    if (layout.cols === 4 && layout.rows === 8) return "1x2";
    if (layout.cols === 8 && layout.rows === 4) return "2x1";
    if (layout.cols === 8 && layout.rows === 8) return "2x2";
    if (layout.cols === 8 && layout.rows === 12) return "2x3";
    if (layout.cols === 12 && layout.rows === 8) return "3x2";
    if (layout.cols === 12 && layout.rows === 12) return "3x3";
    return "1x1";
}

function getWallSlotsForRoom(layout, roomId) {
    const layoutKey = getLayoutKey(layout);
    const layoutConfig = WALL_SLOT_MAP[layoutKey];
    if (!layoutConfig) return [];
    return layoutConfig[roomId] || [];
}

function getRoomsWithWallSlots(layout) {
    const totalRooms = getTotalRoomsForCurrentLayout();
    const eligibleRooms = [];
    for (let rId = 1; rId <= totalRooms; rId++) {
        const slots = getWallSlotsForRoom(layout, rId);
        if (slots.length > 0) {
            eligibleRooms.push({
                roomId: rId,
                slots,
                hasLeft: slots.some(s => s >= 1 && s <= 4),
                hasRight: slots.some(s => s >= 5 && s <= 8)
            });
        }
    }
    return eligibleRooms;
}

function getFlooringNameForRoom(roomId) {
    if (Object.prototype.hasOwnProperty.call(daycareState.furnishings.floor, roomId)) {
        return daycareState.furnishings.floor[roomId];
    }
    return daycareState.furnishings.floor['combined'] || '';
}

function setFlooringNameForRoom(roomId, value) {
    daycareState.furnishings.floor[roomId] = value;
    if (!daycareState.furnishings.floor['combined'] && value) {
        daycareState.furnishings.floor['combined'] = value;
    }
}

function syncFloorInputForActiveRoom() {
    const floorInput = document.getElementById('slot-floor');
    if (!floorInput) return;
    floorInput.value = getFlooringNameForRoom(activeRoomId);
    floorInput.placeholder = `Search flooring for Room ${activeRoomId}...`;
    onSearchInput(floorInput, 'floor-clear-btn');
}

function getWallpaperNameForRoom(roomId) {
    if (Object.prototype.hasOwnProperty.call(daycareState.furnishings.wall, roomId)) {
        return daycareState.furnishings.wall[roomId];
    }
    return daycareState.furnishings.wall['combined'] || '';
}

function setWallpaperNameForRoom(roomId, value) {
    daycareState.furnishings.wall[roomId] = value;
    if (!daycareState.furnishings.wall['combined'] && value) {
        daycareState.furnishings.wall['combined'] = value;
    }
}

function syncWallInputForActiveRoom() {
    const wallInput = document.getElementById('slot-wall');
    if (!wallInput) return;
    wallInput.value = getWallpaperNameForRoom(activeRoomId);
    wallInput.placeholder = `Search wallpaper for Room ${activeRoomId}...`;
    onSearchInput(wallInput, 'wall-clear-btn');
}

// Utility: Toggle Clear Button
function onSearchInput(inputElem, clearBtnId) {
    const clearBtn = document.getElementById(clearBtnId);
    if (!clearBtn) return;
    clearBtn.style.display = inputElem.value.trim().length > 0 ? 'flex' : 'none';
}

function clearSearch(inputId, clearBtnId) {
    const inputElem = document.getElementById(inputId);
    const clearBtn = document.getElementById(clearBtnId);
    if (!inputElem) return;

    inputElem.value = '';
    if (clearBtn) clearBtn.style.display = 'none';
    if (inputId === 'slot-floor') {
        daycareState.furnishings.floor[activeRoomId] = '';
    } else if (inputId === 'slot-wall') {
        daycareState.furnishings.wall[activeRoomId] = '';
    }
    inputElem.dispatchEvent(new Event('input', { bubbles: true }));
    inputElem.focus();
}

function hideAllDropdowns() {
    document.querySelectorAll('.custom-dropdown').forEach(d => d.style.display = 'none');
}

// --- 1. ZOOM CONTROLS ---
function adjustZoom(amount) {
    currentZoom = Math.max(0.5, Math.min(2.0, currentZoom + amount)); // Limits scale between 50% and 200%
    applyZoom();
}

function resetZoom() {
    currentZoom = 1.0;
    applyZoom();
}

function applyZoom() {
    const scaleValue = `scale(${currentZoom})`;
    if (roomLayer) roomLayer.style.transform = scaleValue;
    if (furnitureStageLayers) furnitureStageLayers.style.transform = scaleValue;
}

// --- 2. ROOM SELECTOR UI & ROOM CLEAR ACTIONS ---
function getTotalRoomsForCurrentLayout() {
    if (!currentLayout) return 1;
    if (currentLayout.cols === 4 && currentLayout.rows === 4) return 1;   // 1x1
    if (currentLayout.cols === 4 && currentLayout.rows === 8) return 2;   // 1x2
    if (currentLayout.cols === 8 && currentLayout.rows === 4) return 2;   // 2x1
    if (currentLayout.cols === 8 && currentLayout.rows === 8) return 4;   // 2x2
    if (currentLayout.cols === 8 && currentLayout.rows === 12) return 6;  // 2x3
    if (currentLayout.cols === 12 && currentLayout.rows === 8) return 6;  // 3x2
    if (currentLayout.cols === 12 && currentLayout.rows === 12) return 9; // 3x3
    return 1;
}

function getRoomsPerRow() {
    return Math.max(1, Math.ceil((currentLayout?.cols || 4) / 4));
}

function isKeyInRoom(key, targetRoomId) {
    if (key.includes(',')) {
        const [c, r] = key.split(',').map(Number);
        if (Number.isNaN(c) || Number.isNaN(r)) return false;
        return getRoomIdForTile(c, r) === targetRoomId;
    }
    const wallMatch = key.match(/^room(\d+)-wall-\d+$/i);
    if (wallMatch) {
        return parseInt(wallMatch[1], 10) === targetRoomId;
    }
    return false;
}

function clearActiveRoomFurniture(shouldRender = true) {
    const roomToClear = activeRoomId;

    Object.keys(daycareState.furniture).forEach(key => {
        if (isKeyInRoom(key, roomToClear)) {
            delete daycareState.furniture[key];
        }
    });

    buildDynamicFurnitureSlots();
    if (shouldRender) {
        renderDaycareStage();
    }
}

function clearActiveRoomFurnishings(shouldRender = true) {
    const roomToClear = activeRoomId;
    const prevFloor = daycareState.furnishings.floor[roomToClear];
    const prevWall = daycareState.furnishings.wall[roomToClear];

    daycareState.furnishings.floor[roomToClear] = '';
    daycareState.furnishings.wall[roomToClear] = '';

    if (prevFloor && daycareState.furnishings.floor['combined'] === prevFloor) {
        daycareState.furnishings.floor['combined'] = '';
    }
    if (prevWall && daycareState.furnishings.wall['combined'] === prevWall) {
        daycareState.furnishings.wall['combined'] = '';
    }

    syncFloorInputForActiveRoom();
    syncWallInputForActiveRoom();

    if (shouldRender) {
        renderDaycareStage();
    }
}

function clearAllActiveRoom() {
    clearActiveRoomFurniture(false);
    clearActiveRoomFurnishings(false);
    renderDaycareStage();
}

function styleRoomActionButton(btn, borderColor, bgColor, textColor) {
    btn.type = 'button';
    btn.style.flex = '1 1 auto';
    btn.style.minWidth = '100px';
    btn.style.padding = '8px 10px';
    btn.style.borderRadius = '6px';
    btn.style.border = `1px solid ${borderColor}`;
    btn.style.backgroundColor = bgColor;
    btn.style.color = textColor;
    btn.style.fontSize = '12px';
    btn.style.fontWeight = '600';
    btn.style.cursor = 'pointer';
}

function ensureRoomActionButtons() {
    const panel = document.querySelector('.room-selector-panel');
    if (!panel) return;

    let actionsRow = document.getElementById('roomActionsRow');
    if (!actionsRow) {
        actionsRow = document.createElement('div');
        actionsRow.id = 'roomActionsRow';
        actionsRow.style.display = 'flex';
        actionsRow.style.flexWrap = 'wrap';
        actionsRow.style.gap = '6px';
        actionsRow.style.marginTop = '10px';
        panel.appendChild(actionsRow);
    }

    let clearFurnitureBtn = document.getElementById('clearFurnitureBtn');
    if (!clearFurnitureBtn) {
        clearFurnitureBtn = document.createElement('button');
        clearFurnitureBtn.id = 'clearFurnitureBtn';
        styleRoomActionButton(clearFurnitureBtn, '#5c4732', '#3a2f22', '#f2d5b8');
        clearFurnitureBtn.onclick = () => clearActiveRoomFurniture(true);
        actionsRow.appendChild(clearFurnitureBtn);
    }

    let clearFurnishingsBtn = document.getElementById('clearFurnishingsBtn');
    if (!clearFurnishingsBtn) {
        clearFurnishingsBtn = document.createElement('button');
        clearFurnishingsBtn.id = 'clearFurnishingsBtn';
        styleRoomActionButton(clearFurnishingsBtn, '#32485c', '#22313a', '#b8dcf2');
        clearFurnishingsBtn.onclick = () => clearActiveRoomFurnishings(true);
        actionsRow.appendChild(clearFurnishingsBtn);
    }

    let clearAllBtn = document.getElementById('clearAllRoomBtn');
    if (!clearAllBtn) {
        clearAllBtn = document.createElement('button');
        clearAllBtn.id = 'clearAllRoomBtn';
        styleRoomActionButton(clearAllBtn, '#5c3236', '#3a2225', '#f2b8bd');
        clearAllBtn.onclick = clearAllActiveRoom;
        actionsRow.appendChild(clearAllBtn);
    }

    // Remove legacy single button if present
    const legacyBtn = document.getElementById('clearRoomBtn');
    if (legacyBtn) legacyBtn.remove();

    clearFurnitureBtn.textContent = `Clear Furniture (Rm ${activeRoomId})`;
    clearFurnishingsBtn.textContent = `Clear Furnishings (Rm ${activeRoomId})`;
    clearAllBtn.textContent = `Clear All (Rm ${activeRoomId})`;
}

function updateRoomSelectorUI() {
    const gridContainer = document.getElementById('roomButtonsGrid');
    if (!gridContainer) return;

    gridContainer.innerHTML = '';
    const totalRooms = getTotalRoomsForCurrentLayout();

    if (activeRoomId > totalRooms) {
        activeRoomId = 1;
    }

    for (let i = 1; i <= totalRooms; i++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `room-btn ${i === activeRoomId ? 'active' : ''}`;
        btn.innerHTML = `<span>🏠</span> Room ${i}`;

        btn.onclick = () => {
            activeRoomId = i;
            document.querySelectorAll('.room-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            ensureRoomActionButtons();
            syncFloorInputForActiveRoom();
            syncWallInputForActiveRoom();
            buildDynamicFurnitureSlots();
        };

        gridContainer.appendChild(btn);
    }

    ensureRoomActionButtons();
}

// --- 3. INITIALIZE DEFAULT LAYOUT & DROPDOWN ---
function initDefaultLayout() {
    const layoutSelect = document.getElementById('layoutSelect') || document.getElementById('layout-select');
    const layoutsList = getAvailableLayouts();

    if (layoutSelect) {
        layoutSelect.innerHTML = '';
        layoutsList.forEach((layout, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = layout.name;
            layoutSelect.appendChild(option);
        });

        layoutSelect.addEventListener('change', (e) => {
            switchLayout(e.target.value);
        });
    }

    currentLayout = layoutsList[0];

    if (roomLayer && currentLayout) {
        roomLayer.src = currentLayout.baseImage;
        roomLayer.style.display = 'block';
    }

    activeRoomId = 1;
    updateRoomSelectorUI();
    syncFloorInputForActiveRoom();
    syncWallInputForActiveRoom();
    buildDynamicFurnitureSlots();
    renderDaycareStage();
}

// --- 4. SWITCH LAYOUT DYNAMICALLY ---
function switchLayout(index) {
    const layoutsList = getAvailableLayouts();
    const layoutIndex = Number(index);
    if (!layoutsList[layoutIndex]) return;

    currentLayout = layoutsList[layoutIndex];
    if (roomLayer) {
        roomLayer.src = currentLayout.baseImage;
    }

    activeRoomId = 1;
    daycareState.furniture = {}; // Clear furniture on switch to prevent out-of-bound errors

    updateRoomSelectorUI();
    syncFloorInputForActiveRoom();
    syncWallInputForActiveRoom();
    buildDynamicFurnitureSlots();
    renderDaycareStage();
}

// --- 5. ROTATION BOUNDARY VALIDATION ---
function canRotateSafely(col, row, itemData, rotation) {
    if (!itemData || !itemData.is2Slot) return true;

    let affectedTiles = [`${col},${row}`];

    if (rotation === 0) affectedTiles.push(`${col + 1},${row}`);
    else if (rotation === 1) affectedTiles.push(`${col},${row + 1}`);
    else if (rotation === 2) affectedTiles.push(`${col - 1},${row}`);
    else if (rotation === 3) affectedTiles.push(`${col},${row - 1}`);

    const roomMinCol = Math.floor(col / 4) * 4;
    const roomMaxCol = roomMinCol + 3;
    const roomMinRow = Math.floor(row / 4) * 4;
    const roomMaxRow = roomMinRow + 3;

    for (let tileKey of affectedTiles) {
        const [c, r] = tileKey.split(',').map(Number);
        if (c < 0 || c >= currentLayout.cols || r < 0 || r >= currentLayout.rows) return false;
        if (c < roomMinCol || c > roomMaxCol || r < roomMinRow || r > roomMaxRow) {
            return false;
        }
    }
    return true;
}

// Helper: Resolve Room ID (1-based) for a 4x4 room block at tile (c, r)
function getRoomIdForTile(c, r) {
    if (currentLayout && typeof currentLayout.getCustomSlotLabel === 'function') {
        const label = currentLayout.getCustomSlotLabel(c, r);
        const match = label && label.match(/Room\s+(\d+)/i);
        if (match) return parseInt(match[1], 10);
    }

    const roomCol = Math.floor(c / 4);
    const roomRow = Math.floor(r / 4);
    const roomsPerRow = getRoomsPerRow();
    return roomRow * roomsPerRow + roomCol + 1;
}

// Helper: Coordinate label ("A1".."D4") within each 4x4 room block
function getFallbackSlotLabel(c, r) {
    const localCol = c % 4; // 0..3 -> 1..4
    const localRow = r % 4; // 0..3 -> A..D
    const rowLetter = String.fromCharCode(65 + localRow);
    const colNumber = localCol + 1;
    return `${rowLetter}${colNumber}`;
}

function getTileCoordinatesSafe(c, r) {
    if (currentLayout && typeof currentLayout.getTileCoordinates === 'function') {
        return currentLayout.getTileCoordinates(c, r);
    }
    return { x: (c - r) * 32, y: (c + r) * 16, zIndex: 10 + c + r };
}

function getRoomFlooringAnchor(roomId) {
    const roomsPerRow = getRoomsPerRow();
    const roomIndex = Math.max(0, roomId - 1);
    const roomCol = roomIndex % roomsPerRow;
    const roomRow = Math.floor(roomIndex / roomsPerRow);
    const centerTile = getTileCoordinatesSafe(roomCol * 4 + 1.5, roomRow * 4 + 1.5);
    return {
        x: centerTile.x || 0,
        y: centerTile.y || 0,
        zIndex: 2
    };
}

function parseWallSlotKey(key) {
    // Format: "room<id>-wall-<slotNum>" (where 1-4 is left wall and 5-8 is right wall)
    const match = key.match(/^room(\d+)-wall-(\d+)$/i);
    if (!match) {
        return { roomId: activeRoomId, slotNumber: 1, side: 'left-wall', halfIndex: 0 };
    }
    const roomId = parseInt(match[1], 10);
    const slotNumber = parseInt(match[2], 10);
    const isRight = slotNumber >= 5;
    return {
        roomId,
        slotNumber,
        side: isRight ? 'right-wall' : 'left-wall',
        halfIndex: isRight ? slotNumber - 5 : slotNumber - 1 // 0..3 within the wall half
    };
}

function getRoomWallpaperAnchor(roomId, side) {
    const roomsPerRow = getRoomsPerRow();
    const roomIndex = Math.max(0, roomId - 1);
    const roomCol = roomIndex % roomsPerRow;
    const roomRow = Math.floor(roomIndex / roomsPerRow);

    if (currentLayout && typeof currentLayout.getWallCoordinates === 'function') {
        const baseCoords = currentLayout.getWallCoordinates(side, 0, roomId, side === 'left-wall' ? 1 : 5) || { x: 0, y: 0, zIndex: 5 };
        if (side === 'left-wall') {
            return {
                x: (baseCoords.x || -60) - roomRow * WALL_SLOTS_PER_HALF * 14,
                y: (baseCoords.y || -40) + roomRow * WALL_SLOTS_PER_HALF * 10,
                zIndex: baseCoords.zIndex || 5
            };
        } else {
            return {
                x: (baseCoords.x || 60) + roomCol * WALL_SLOTS_PER_HALF * 14,
                y: (baseCoords.y || -40) + roomCol * WALL_SLOTS_PER_HALF * 10,
                zIndex: baseCoords.zIndex || 5
            };
        }
    }

    if (side === 'left-wall') {
        return {
            x: -60 - roomRow * WALL_SLOTS_PER_HALF * 14,
            y: -40 + roomRow * WALL_SLOTS_PER_HALF * 10,
            zIndex: 5
        };
    } else {
        return {
            x: 60 + roomCol * WALL_SLOTS_PER_HALF * 14,
            y: -40 + roomCol * WALL_SLOTS_PER_HALF * 10,
            zIndex: 5
        };
    }
}

function getWallCoordinatesSafe(key) {
    const { roomId, slotNumber, side, halfIndex } = parseWallSlotKey(key);
    const anchor = getRoomWallpaperAnchor(roomId, side);

    if (currentLayout && typeof currentLayout.getWallCoordinates === 'function') {
        const slotCoords = currentLayout.getWallCoordinates(side, halfIndex, roomId, slotNumber);
        if (slotCoords && typeof slotCoords.x === 'number' && typeof slotCoords.y === 'number') {
            return {
                x: slotCoords.x,
                y: slotCoords.y,
                zIndex: slotCoords.zIndex || anchor.zIndex || 5
            };
        }
    }

    if (side === 'left-wall') {
        return {
            x: anchor.x - halfIndex * 14,
            y: anchor.y + halfIndex * 10,
            zIndex: anchor.zIndex || 5
        };
    } else {
        return {
            x: anchor.x + halfIndex * 14,
            y: anchor.y + halfIndex * 10,
            zIndex: anchor.zIndex || 5
        };
    }
}

// --- 6. DYNAMIC FURNITURE SLOTS & ROTATION CONTROLS ---
function buildDynamicFurnitureSlots() {
    const container = document.getElementById('dynamic-furniture-slots');
    if (!container) return;
    container.innerHTML = '';

    if (!currentLayout) return;

    // Build slots only for tiles belonging to the active 4x4 room
    for (let r = 0; r < currentLayout.rows; r++) {
        for (let c = 0; c < currentLayout.cols; c++) {
            const tileRoomId = getRoomIdForTile(c, r);
            if (tileRoomId !== activeRoomId) continue;

            const tileKey = `${c},${r}`;
            const slotLabel = (typeof currentLayout.getCustomSlotLabel === 'function')
                ? currentLayout.getCustomSlotLabel(c, r)
                : getFallbackSlotLabel(c, r);

            container.appendChild(createFurnitureSlotRow(tileKey, slotLabel, 'floor'));
        }
    }

    // Per-layout, per-room wall slots (1-4 on left wall half, 5-8 on right wall half)
    const wallSlots = getWallSlotsForRoom(currentLayout, activeRoomId);
    if (wallSlots.length > 0) {
        const wallHeader = document.createElement('div');
        wallHeader.className = 'swap-label';
        wallHeader.textContent = `ROOM ${activeRoomId} - WALL FURNITURE & WALLPAPER`;
        container.appendChild(wallHeader);

        wallSlots.forEach(slotNum => {
            const isRight = slotNum >= 5;
            const sideText = isRight ? 'Right Wall' : 'Left Wall';
            const slotKey = `room${activeRoomId}-wall-${slotNum}`;
            const slotLabel = `${slotNum}`;
            const placeholderLabel = `Room ${activeRoomId} ${sideText} Slot ${slotNum}`;
            container.appendChild(createFurnitureSlotRow(slotKey, slotLabel, 'wall', placeholderLabel));
        });
    }
}

function createFurnitureSlotRow(key, labelText, type, placeholderText = null) {
    const rowDiv = document.createElement('div');
    rowDiv.className = 'select-row layer-row search-container';
    rowDiv.style.marginBottom = '10px';

    const badge = document.createElement('span');
    badge.className = 'layer-badge';
    badge.textContent = labelText;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'furniture-search';
    input.dataset.key = key;
    input.placeholder = `Search item for ${placeholderText || labelText}...`;
    input.value = daycareState.furniture[key]?.name || '';
    input.autocomplete = 'off';

    const rotGroup = document.createElement('div');
    rotGroup.className = 'rotation-group';
    rotGroup.style.display = (daycareState.furniture[key]?.name) ? 'flex' : 'none';
    rotGroup.style.position = 'absolute';
    rotGroup.style.right = '40px';
    rotGroup.style.gap = '2px';

    const rotCCW = document.createElement('button');
    rotCCW.type = 'button';
    rotCCW.className = 'clear-btn';
    rotCCW.innerHTML = '↺';
    rotCCW.title = 'Rotate Counter-Clockwise';
    rotCCW.style.position = 'static';
    rotCCW.onclick = () => {
        let itemData = daycareState.furniture[key];
        if (!itemData || !itemData.name) return;

        const masterItem = (typeof masterFurniture !== 'undefined' && masterFurniture.floorItems) ?
            (masterFurniture.floorItems.find(i => i.name === itemData.name) ||
                masterFurniture.wallItems.find(i => i.name === itemData.name)) : null;
        const maxRot = (type === 'floor') ? 4 : 2;
        const [col, row] = key.includes(',') ? key.split(',').map(Number) : [0, 0];

        let testRot = itemData.rotation;
        for (let i = 1; i <= maxRot; i++) {
            testRot = (testRot - 1 + maxRot) % maxRot;
            if (type === 'wall' || canRotateSafely(col, row, masterItem, testRot)) {
                itemData.rotation = testRot;
                break;
            }
        }
        renderDaycareStage();
    };

    const rotCW = document.createElement('button');
    rotCW.type = 'button';
    rotCW.className = 'clear-btn';
    rotCW.innerHTML = '↻';
    rotCW.title = 'Rotate Clockwise';
    rotCW.style.position = 'static';
    rotCW.onclick = () => {
        let itemData = daycareState.furniture[key];
        if (!itemData || !itemData.name) return;

        const masterItem = (typeof masterFurniture !== 'undefined' && masterFurniture.floorItems) ?
            (masterFurniture.floorItems.find(i => i.name === itemData.name) ||
                masterFurniture.wallItems.find(i => i.name === itemData.name)) : null;
        const maxRot = (type === 'floor') ? 4 : 2;
        const [col, row] = key.includes(',') ? key.split(',').map(Number) : [0, 0];

        let testRot = itemData.rotation;
        for (let i = 1; i <= maxRot; i++) {
            testRot = (testRot + 1) % maxRot;
            if (type === 'wall' || canRotateSafely(col, row, masterItem, testRot)) {
                itemData.rotation = testRot;
                break;
            }
        }
        renderDaycareStage();
    };

    rotGroup.appendChild(rotCCW);
    rotGroup.appendChild(rotCW);

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'clear-btn';
    clearBtn.innerHTML = '&times;';
    clearBtn.id = `clear-${key}`;
    clearBtn.style.display = input.value ? 'flex' : 'none';

    clearBtn.onclick = () => {
        input.value = '';
        delete daycareState.furniture[key];
        clearBtn.style.display = 'none';
        rotGroup.style.display = 'none';
        renderDaycareStage();
    };

    const dropdown = document.createElement('div');
    dropdown.className = 'custom-dropdown';
    dropdown.id = `dropdown-${key}`;
    dropdown.style.display = 'none';

    input.addEventListener('focus', () => {
        hideAllDropdowns();
        renderFurnitureDropdown(key, type, input.value);
    });

    input.addEventListener('input', (e) => {
        const val = e.target.value;
        if (!val.trim()) {
            delete daycareState.furniture[key];
            rotGroup.style.display = 'none';
        } else {
            if (!daycareState.furniture[key]) {
                daycareState.furniture[key] = { name: val, rotation: 0 };
            } else {
                daycareState.furniture[key].name = val;
            }
            rotGroup.style.display = 'flex';
        }
        onSearchInput(e.target, `clear-${key}`);
        renderFurnitureDropdown(key, type, val);
        renderDaycareStage();
    });

    rowDiv.appendChild(badge);
    rowDiv.appendChild(input);
    rowDiv.appendChild(rotGroup);
    rowDiv.appendChild(clearBtn);
    rowDiv.appendChild(dropdown);
    return rowDiv;
}

// --- 7. DROPDOWNS ---
function renderFurnitureDropdown(key, type, filter = '') {
    const dropdown = document.getElementById(`dropdown-${key}`);
    if (!dropdown) return;
    dropdown.innerHTML = '';
    const query = filter.toLowerCase().trim();

    const list = (type === 'floor') ?
        (typeof masterFurniture !== 'undefined' ? masterFurniture.floorItems : []) :
        (typeof masterFurniture !== 'undefined' ? masterFurniture.wallItems : []);
    const filtered = list.filter(item => item.name.toLowerCase().includes(query));

    if (filtered.length === 0) {
        dropdown.innerHTML = '<div class="dropdown-no-results">No matching items</div>';
    } else {
        filtered.forEach(itemData => {
            const div = document.createElement('div');
            div.className = 'dropdown-item';
            div.innerHTML = `<img src="${itemData.images[0]}" alt=""><span>${itemData.name}</span>`;
            div.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const inputEl = document.querySelector(`input[data-key="${key}"]`);
                if (inputEl) inputEl.value = itemData.name;
                daycareState.furniture[key] = { name: itemData.name, rotation: 0 };

                const row = inputEl ? inputEl.parentNode : null;
                if (row) {
                    row.querySelector('.rotation-group').style.display = 'flex';
                    row.querySelector('.clear-btn').style.display = 'flex';
                }

                hideAllDropdowns();
                renderDaycareStage();
            });
            dropdown.appendChild(div);
        });
    }
    dropdown.style.display = 'block';
}

['floor', 'wall'].forEach(furnishType => {
    const input = document.getElementById(`slot-${furnishType}`);
    if (!input) return;

    input.addEventListener('focus', () => {
        hideAllDropdowns();
        renderFurnishingDropdown(furnishType, input.value);
    });

    input.addEventListener('input', (e) => {
        if (furnishType === 'floor') {
            setFlooringNameForRoom(activeRoomId, e.target.value);
        } else {
            setWallpaperNameForRoom(activeRoomId, e.target.value);
        }
        onSearchInput(e.target, `${furnishType}-clear-btn`);
        renderFurnishingDropdown(furnishType, e.target.value);
        renderDaycareStage();
    });
});

function renderFurnishingDropdown(type, filter = '') {
    const dropdown = document.getElementById(`dropdown-${type}`);
    if (!dropdown) return;
    dropdown.innerHTML = '';
    const query = filter.toLowerCase().trim();
    const list = (typeof masterFurnishings !== 'undefined') ? (masterFurnishings[type] || []) : [];
    const filtered = list.filter(item => item.name.toLowerCase().includes(query));

    if (filtered.length === 0) {
        dropdown.innerHTML = `<div class="dropdown-no-results">No matching ${type}s</div>`;
    } else {
        filtered.forEach(itemData => {
            const div = document.createElement('div');
            div.className = 'dropdown-item';
            div.innerHTML = `<img src="${itemData.image}" alt=""><span>${itemData.name}</span>`;
            div.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const inputEl = document.getElementById(`slot-${type}`);
                if (inputEl) inputEl.value = itemData.name;
                if (type === 'floor') {
                    setFlooringNameForRoom(activeRoomId, itemData.name);
                } else {
                    setWallpaperNameForRoom(activeRoomId, itemData.name);
                }
                onSearchInput(inputEl, `${type}-clear-btn`);
                hideAllDropdowns();
                renderDaycareStage();
            });
            dropdown.appendChild(div);
        });
    }
    dropdown.style.display = 'block';
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.layer-row') && !e.target.closest('#workspace-layout') && !e.target.closest('.room-selector-panel')) {
        hideAllDropdowns();
    }
});

// --- 8. FLOORING, WALLPAPER SPLITTER & PER-ROOM STAGE RENDERER ---
function processCombinedWallpaper(imageSrc, callback) {
    if (splitWallpaperCache[imageSrc]) {
        callback(splitWallpaperCache[imageSrc]);
        return;
    }

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageSrc;

    img.onload = function() {
        const width = img.width;
        const height = img.height;
        const halfWidth = width / 2;

        const canvas = document.createElement('canvas');
        canvas.width = halfWidth;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, halfWidth, height);
        ctx.drawImage(img, 0, 0, halfWidth, height, 0, 0, halfWidth, height);
        const leftHalf = canvas.toDataURL('image/png');

        ctx.clearRect(0, 0, halfWidth, height);
        ctx.drawImage(img, halfWidth, 0, halfWidth, height, 0, 0, halfWidth, height);
        const rightHalf = canvas.toDataURL('image/png');

        const splitPair = { left: leftHalf, right: rightHalf };
        splitWallpaperCache[imageSrc] = splitPair;
        callback(splitPair);
    };
}

function renderRoomFlooringsForLayout(container) {
    if (typeof masterFurnishings === 'undefined' || !Array.isArray(masterFurnishings.floor)) return;

    const totalRooms = getTotalRoomsForCurrentLayout();
    for (let roomId = 1; roomId <= totalRooms; roomId++) {
        const flooringName = getFlooringNameForRoom(roomId);
        if (!flooringName) continue;

        const floorData = masterFurnishings.floor.find(i => i.name === flooringName);
        if (!floorData || !floorData.image) continue;

        const floorImg = document.createElement('img');
        floorImg.src = floorData.image;
        floorImg.className = 'layer-img flooring-layer';
        floorImg.dataset.roomId = String(roomId);
        const fCoords = getRoomFlooringAnchor(roomId);
        floorImg.style.transform = `translate(calc(-50% + ${fCoords.x}px), calc(-50% + ${fCoords.y}px))`;
        floorImg.style.zIndex = fCoords.zIndex || 2;
        container.appendChild(floorImg);
    }
}

function renderRoomWallpapersForLayout(container) {
    if (typeof masterFurnishings === 'undefined' || !Array.isArray(masterFurnishings.wall)) return;

    const eligibleRooms = getRoomsWithWallSlots(currentLayout);
    eligibleRooms.forEach(roomInfo => {
        const wallpaperName = getWallpaperNameForRoom(roomInfo.roomId);
        if (!wallpaperName) return;

        const wallpaperData = masterFurnishings.wall.find(i => i.name === wallpaperName);
        if (!wallpaperData || !wallpaperData.image) return;

        processCombinedWallpaper(wallpaperData.image, (splitImages) => {
            if (roomInfo.hasLeft) {
                const leftWall = document.createElement('img');
                leftWall.src = splitImages.left;
                leftWall.className = 'layer-img wallpaper-layer';
                leftWall.dataset.roomId = String(roomInfo.roomId);
                leftWall.dataset.side = 'left-wall';
                const lCoords = getRoomWallpaperAnchor(roomInfo.roomId, 'left-wall');
                leftWall.style.transform = `translate(calc(-50% + ${lCoords.x}px), calc(-50% + ${lCoords.y}px))`;
                leftWall.style.zIndex = lCoords.zIndex || 5;
                container.appendChild(leftWall);
            }

            if (roomInfo.hasRight) {
                const rightWall = document.createElement('img');
                rightWall.src = splitImages.right;
                rightWall.className = 'layer-img wallpaper-layer';
                rightWall.dataset.roomId = String(roomInfo.roomId);
                rightWall.dataset.side = 'right-wall';
                const rCoords = getRoomWallpaperAnchor(roomInfo.roomId, 'right-wall');
                rightWall.style.transform = `translate(calc(-50% + ${rCoords.x}px), calc(-50% + ${rCoords.y}px))`;
                rightWall.style.zIndex = rCoords.zIndex || 5;
                container.appendChild(rightWall);
            }
        });
    });
}

function renderDaycareStage() {
    if (!furnitureStageLayers) return;
    furnitureStageLayers.innerHTML = '';
    if (!currentLayout) return;

    // Render per-room flooring first, then per-room wallpaper on rooms with wall slots
    renderRoomFlooringsForLayout(furnitureStageLayers);
    renderRoomWallpapersForLayout(furnitureStageLayers);

    Object.keys(daycareState.furniture).forEach(key => {
        const placedItem = daycareState.furniture[key];
        if (!placedItem || !placedItem.name) return;

        let itemData = (typeof masterFurniture !== 'undefined') ?
            (masterFurniture.floorItems.find(i => i.name === placedItem.name) ||
                masterFurniture.wallItems.find(i => i.name === placedItem.name)) : null;
        if (!itemData || !itemData.images) return;

        const img = document.createElement('img');
        const rotIndex = placedItem.rotation || 0;

        img.src = itemData.images[rotIndex];
        img.className = 'layer-img';
        img.alt = placedItem.name;

        let coords = { x: 0, y: 0 };
        if (key.includes(',')) {
            const [c, r] = key.split(',').map(Number);
            coords = getTileCoordinatesSafe(c, r);
        } else {
            coords = getWallCoordinatesSafe(key);
        }

        img.style.transform = `translate(calc(-50% + ${coords.x}px), calc(-50% + ${coords.y}px))`;
        img.style.zIndex = coords.zIndex || 20;
        img.style.display = 'block';

        furnitureStageLayers.appendChild(img);
    });

    applyZoom();
}

// Initial Run on Page Load
document.addEventListener('DOMContentLoaded', () => {
    initDefaultLayout();
});

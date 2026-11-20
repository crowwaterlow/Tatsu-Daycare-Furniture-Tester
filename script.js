// Global State for Daycare
let currentLayout = null;
let currentZoom = 1.0; // Default scale multiplier
let activeRoomId = 1;
let activeSlotKey = null;
let activeSlotType = 'floor'; // 'floor' or 'wall'
let activeSlotLabel = '';

const WALL_SLOTS_PER_HALF = 4; // 4 left (1-4) + 4 right (5-8); 12 per wallpaper half across a 3x3 layout
const splitWallpaperCache = {};

const daycareState = {
    furnishings: {
        floor: {}, // Per-room flooring (floor[roomId])
        wall: {}   // Per-room wallpaper (wall[roomId])
    },
    furniture: {}  // Floor tiles ("c,r") and wall furniture slots ("room<id>-wall-<slotNum>")
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
const furnishingsStageLayers = document.getElementById('furnishings-stage-layers');
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

function roomHasWallpaper(layout, roomId) {
    return getWallSlotsForRoom(layout, roomId).length > 0;
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

// --- FURNISHINGS STATE HELPERS (FLOOR & WALLPAPER) ---
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
    if (!roomHasWallpaper(currentLayout, roomId)) return '';
    if (Object.prototype.hasOwnProperty.call(daycareState.furnishings.wall, roomId)) {
        return daycareState.furnishings.wall[roomId];
    }
    return daycareState.furnishings.wall['combined'] || '';
}

function setWallpaperNameForRoom(roomId, value) {
    if (!roomHasWallpaper(currentLayout, roomId)) return;
    daycareState.furnishings.wall[roomId] = value;
    if (!daycareState.furnishings.wall['combined'] && value) {
        daycareState.furnishings.wall['combined'] = value;
    }
}

function syncWallInputForActiveRoom() {
    const wallInput = document.getElementById('slot-wall');
    const clearBtn = document.getElementById('wall-clear-btn');
    const dropdown = document.getElementById('dropdown-wall');
    if (!wallInput) return;

    const hasWall = roomHasWallpaper(currentLayout, activeRoomId);
    const wallRow = wallInput.closest('.layer-row');

    if (!hasWall) {
        wallInput.value = '';
        wallInput.disabled = true;
        if (clearBtn) clearBtn.style.display = 'none';
        if (dropdown) {
            dropdown.style.display = 'none';
            dropdown.classList.remove('show', 'open');
        }
        if (wallRow) {
            wallRow.style.display = 'none';
        }
        return;
    }

    wallInput.disabled = false;
    if (wallRow) {
        wallRow.style.display = '';
    }

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
    document.querySelectorAll('.custom-dropdown').forEach(d => {
        d.style.display = 'none';
        d.classList.remove('show', 'open');
    });
}

// --- 1. ZOOM CONTROLS ---
function adjustZoom(amount) {
    currentZoom = Math.max(0.5, Math.min(2.0, Number((currentZoom + amount).toFixed(2))));
    applyZoom();
}

function resetZoom() {
    currentZoom = 1.0;
    applyZoom();
}

function applyZoom() {
    const transformValue = `translate(-50%, -50%) scale(${currentZoom})`;
    if (roomLayer) roomLayer.style.transform = transformValue;
    if (furnishingsStageLayers) furnishingsStageLayers.style.transform = transformValue;
    if (furnitureStageLayers) furnitureStageLayers.style.transform = transformValue;
}

// --- 2. ROOM SELECTOR UI & ROOM CLEAR ACTIONS ---
function getTotalRoomsForCurrentLayout() {
    if (!currentLayout) return 0;
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
    if (roomHasWallpaper(currentLayout, roomToClear)) {
        daycareState.furnishings.wall[roomToClear] = '';
    }

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

    const legacyBtn = document.getElementById('clearRoomBtn');
    if (legacyBtn) legacyBtn.remove();

    clearFurnitureBtn.textContent = `Clear Furniture (Rm ${activeRoomId})`;
    clearFurnishingsBtn.textContent = `Clear Furnishings (Rm ${activeRoomId})`;
    clearAllBtn.textContent = `Clear All (Rm ${activeRoomId})`;
}

function updateRoomSelectorUI() {
    const gridContainer = document.getElementById('roomButtonsGrid');
    const existingActions = document.getElementById('roomActionsRow');
    if (!gridContainer) return;

    gridContainer.innerHTML = '';
    const totalRooms = getTotalRoomsForCurrentLayout();

    if (totalRooms === 0) {
        if (existingActions) existingActions.remove();
        return;
    }

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

// --- 3. INITIALIZE LAYOUT DROPDOWN (NO DEFAULT LAYOUT SELECTED) ---
function initDefaultLayout() {
    const layoutSelect = document.getElementById('layoutSelect') || document.getElementById('layout-select');
    const layoutsList = getAvailableLayouts();

    currentLayout = null;
    activeRoomId = 1;

    if (layoutSelect) {
        layoutSelect.innerHTML = '';

        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = '-- Select a Layout --';
        placeholderOption.disabled = true;
        placeholderOption.selected = true;
        layoutSelect.appendChild(placeholderOption);

        layoutsList.forEach((layout, index) => {
            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = layout.name;
            layoutSelect.appendChild(option);
        });

        layoutSelect.addEventListener('change', (e) => {
            if (e.target.value !== '') {
                switchLayout(e.target.value);
            }
        });
    }

    if (roomLayer) {
        roomLayer.removeAttribute('src');
        roomLayer.style.display = 'none';
    }

    if (furnishingsStageLayers) furnishingsStageLayers.innerHTML = '';
    if (furnitureStageLayers) furnitureStageLayers.innerHTML = '';

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
        roomLayer.style.display = 'block';
    }

    activeRoomId = 1;
    daycareState.furniture = {};

    updateRoomSelectorUI();
    syncFloorInputForActiveRoom();
    syncWallInputForActiveRoom();
    buildDynamicFurnitureSlots();
    renderDaycareStage();
}

// --- 5. ROTATION BOUNDARY VALIDATION ---
function canRotateSafely(col, row, itemData, rotation) {
    if (!itemData || !itemData.is2Slot) return true;

    const affectedTiles = [`${col},${row}`];

    if (rotation === 0) affectedTiles.push(`${col + 1},${row}`);
    else if (rotation === 1) affectedTiles.push(`${col},${row + 1}`);
    else if (rotation === 2) affectedTiles.push(`${col - 1},${row}`);
    else if (rotation === 3) affectedTiles.push(`${col},${row - 1}`);

    const roomMinCol = Math.floor(col / 4) * 4;
    const roomMaxCol = roomMinCol + 3;
    const roomMinRow = Math.floor(row / 4) * 4;
    const roomMaxRow = roomMinRow + 3;

    for (const tileKey of affectedTiles) {
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
    const localCol = c % 4;
    const localRow = r % 4;
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

// --- WALLPAPER ANCHORS (SEPARATE FROM WALL FURNITURE) ---
function getWallpaperAnchorSafe(roomId, side) {
    const roomsPerRow = getRoomsPerRow();
    const roomIndex = Math.max(0, roomId - 1);
    const roomCol = roomIndex % roomsPerRow;
    const roomRow = Math.floor(roomIndex / roomsPerRow);

    if (currentLayout && typeof currentLayout.getWallpaperCoordinates === 'function') {
        const customAnchor = currentLayout.getWallpaperCoordinates(side, roomId);
        if (customAnchor && typeof customAnchor.x === 'number' && typeof customAnchor.y === 'number') {
            return {
                x: customAnchor.x,
                y: customAnchor.y,
                zIndex: customAnchor.zIndex || 4
            };
        }
    }

    if (currentLayout && typeof currentLayout.getWallCoordinates === 'function') {
        const baseCoords = currentLayout.getWallCoordinates(side, 0, roomId, side === 'left-wall' ? 1 : 5) || { x: 0, y: 0, zIndex: 4 };
        if (side === 'left-wall') {
            return {
                x: (baseCoords.x || -60) - roomRow * WALL_SLOTS_PER_HALF * 14,
                y: (baseCoords.y || -40) + roomRow * WALL_SLOTS_PER_HALF * 10,
                zIndex: 4
            };
        }
        return {
            x: (baseCoords.x || 60) + roomCol * WALL_SLOTS_PER_HALF * 14,
            y: (baseCoords.y || -40) + roomCol * WALL_SLOTS_PER_HALF * 10,
            zIndex: 4
        };
    }

    if (side === 'left-wall') {
        return {
            x: -60 - roomRow * WALL_SLOTS_PER_HALF * 14,
            y: -40 + roomRow * WALL_SLOTS_PER_HALF * 10,
            zIndex: 4
        };
    }
    return {
        x: 60 + roomCol * WALL_SLOTS_PER_HALF * 14,
        y: -40 + roomCol * WALL_SLOTS_PER_HALF * 10,
        zIndex: 4
    };
}

function getCombinedWallpaperAnchorSafe(roomId) {
    if (currentLayout && typeof currentLayout.getCombinedWallpaperCoordinates === 'function') {
        const customCombined = currentLayout.getCombinedWallpaperCoordinates(roomId);
        if (customCombined && typeof customCombined.x === 'number' && typeof customCombined.y === 'number') {
            return {
                x: customCombined.x,
                y: customCombined.y,
                zIndex: customCombined.zIndex || 4
            };
        }
    }

    const leftAnchor = getWallpaperAnchorSafe(roomId, 'left-wall');
    const rightAnchor = getWallpaperAnchorSafe(roomId, 'right-wall');
    return {
        x: (leftAnchor.x + rightAnchor.x) / 2,
        y: Math.min(leftAnchor.y, rightAnchor.y),
        zIndex: leftAnchor.zIndex || rightAnchor.zIndex || 4
    };
}

// --- WALL FURNITURE COORDINATES (SEPARATE FROM WALLPAPERS) ---
function parseWallFurnitureSlotKey(key) {
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
        halfIndex: isRight ? slotNumber - 5 : slotNumber - 1
    };
}

function getWallFurnitureCoordinatesSafe(key) {
    const { roomId, slotNumber, side, halfIndex } = parseWallFurnitureSlotKey(key);
    const anchor = getWallpaperAnchorSafe(roomId, side);

    if (currentLayout && typeof currentLayout.getWallCoordinates === 'function') {
        const slotCoords = currentLayout.getWallCoordinates(side, halfIndex, roomId, slotNumber);
        if (slotCoords && typeof slotCoords.x === 'number' && typeof slotCoords.y === 'number') {
            return {
                x: slotCoords.x,
                y: slotCoords.y,
                zIndex: Math.max(15, slotCoords.zIndex || 15)
            };
        }
    }

    if (side === 'left-wall') {
        return {
            x: anchor.x - halfIndex * 14,
            y: anchor.y + halfIndex * 10,
            zIndex: 15 + halfIndex
        };
    }
    return {
        x: anchor.x + halfIndex * 14,
        y: anchor.y + halfIndex * 10,
        zIndex: 15 + halfIndex
    };
}

// --- 6. DYNAMIC FURNITURE SLOT GRID & SINGLE SEARCH EDITOR ---
function getAvailableSlotsForActiveRoom() {
    const slots = [];
    if (!currentLayout) return slots;

    // 1. Floor furniture slots (4x4 tiles for active room)
    for (let r = 0; r < currentLayout.rows; r++) {
        for (let c = 0; c < currentLayout.cols; c++) {
            if (getRoomIdForTile(c, r) !== activeRoomId) continue;

            const tileKey = `${c},${r}`;
            const rawLabel = (typeof currentLayout.getCustomSlotLabel === 'function')
                ? currentLayout.getCustomSlotLabel(c, r)
                : getFallbackSlotLabel(c, r);
            const shortLabel = rawLabel.replace(/^Room\s+\d+\s*[-:]?\s*/i, '') || getFallbackSlotLabel(c, r);

            slots.push({
                key: tileKey,
                type: 'floor',
                shortLabel,
                fullLabel: `Floor Slot ${shortLabel}`
            });
        }
    }

    // 2. Wall furniture slots
    const wallSlots = getWallSlotsForRoom(currentLayout, activeRoomId);
    wallSlots.forEach(slotNum => {
        const isRight = slotNum >= 5;
        const sideText = isRight ? 'Right Wall' : 'Left Wall';
        slots.push({
            key: `room${activeRoomId}-wall-${slotNum}`,
            type: 'wall',
            shortLabel: `W${slotNum}`,
            fullLabel: `${sideText} Slot ${slotNum}`
        });
    });

    return slots;
}

function rotateActiveSlotFurniture(delta) {
    if (!activeSlotKey) return;
    const itemData = daycareState.furniture[activeSlotKey];
    if (!itemData || !itemData.name) return;

    const masterItem = (typeof masterFurniture !== 'undefined' && masterFurniture.floorItems)
        ? (masterFurniture.floorItems.find(i => i.name === itemData.name) ||
            masterFurniture.wallItems.find(i => i.name === itemData.name))
        : null;

    const maxRot = (activeSlotType === 'floor') ? 4 : 2;
    const [col, row] = activeSlotKey.includes(',') ? activeSlotKey.split(',').map(Number) : [0, 0];

    let testRot = itemData.rotation || 0;
    for (let i = 1; i <= maxRot; i++) {
        testRot = (testRot + delta + maxRot) % maxRot;
        if (activeSlotType === 'wall' || canRotateSafely(col, row, masterItem, testRot)) {
            itemData.rotation = testRot;
            break;
        }
    }

    updateActiveSlotControls();
    renderDaycareStage();
}

function updateActiveSlotControls() {
    const badge = document.getElementById('active-slot-badge');
    const input = document.getElementById('active-furniture-search');
    const rotGroup = document.getElementById('active-slot-rot-group');
    const clearBtn = document.getElementById('active-slot-clear-btn');
    const statusText = document.getElementById('current-furniture-display');

    if (!input || !statusText) return;

    const placed = activeSlotKey ? daycareState.furniture[activeSlotKey] : null;
    const placedName = (placed && placed.name && placed.name.trim()) ? placed.name.trim() : '';

    if (badge) {
        badge.textContent = activeSlotLabel || 'Slot';
    }

    input.placeholder = `Search ${activeSlotType === 'wall' ? 'wall' : 'floor'} item for ${activeSlotLabel}...`;
    input.value = placedName;

    if (rotGroup) {
        rotGroup.style.display = placedName ? 'flex' : 'none';
    }
    if (clearBtn) {
        clearBtn.style.display = placedName ? 'flex' : 'none';
    }

    statusText.innerHTML = `Current Furniture: <strong>${placedName || 'None'}</strong>`;

    document.querySelectorAll('.slot-grid-btn').forEach(btn => {
        const key = btn.dataset.slotKey;
        const hasItem = Boolean(daycareState.furniture[key]?.name?.trim());
        btn.classList.toggle('active', key === activeSlotKey);
        btn.classList.toggle('occupied', hasItem);
    });
}

function createSlotGridButton(slot) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot-grid-btn';
    btn.dataset.slotKey = slot.key;
    btn.title = slot.fullLabel;
    btn.textContent = slot.shortLabel;

    btn.onclick = () => {
        activeSlotKey = slot.key;
        activeSlotType = slot.type;
        activeSlotLabel = slot.shortLabel;
        hideAllDropdowns();
        updateActiveSlotControls();
    };

    return btn;
}

function buildDynamicFurnitureSlots() {
    const container = document.getElementById('dynamic-furniture-slots');
    if (!container) return;
    container.innerHTML = '';

    if (!currentLayout) {
        activeSlotKey = null;
        return;
    }

    const roomSlots = getAvailableSlotsForActiveRoom();
    if (roomSlots.length === 0) {
        activeSlotKey = null;
        return;
    }

    const existingMatch = roomSlots.find(s => s.key === activeSlotKey);
    const selectedSlot = existingMatch || roomSlots[0];
    activeSlotKey = selectedSlot.key;
    activeSlotType = selectedSlot.type;
    activeSlotLabel = selectedSlot.shortLabel;

    // 1. Floor Slots Grid
    const floorSlots = roomSlots.filter(s => s.type === 'floor');
    if (floorSlots.length > 0) {
        const floorHeader = document.createElement('div');
        floorHeader.className = 'swap-label';
        floorHeader.style.marginTop = '0';
        floorHeader.textContent = `ROOM ${activeRoomId} - FLOOR SLOTS`;
        container.appendChild(floorHeader);

        const floorGrid = document.createElement('div');
        floorGrid.className = 'slot-buttons-grid floor-slots-grid';
        floorSlots.forEach(slot => {
            floorGrid.appendChild(createSlotGridButton(slot));
        });
        container.appendChild(floorGrid);
    }

    // 2. Wall Slots Grid
    const wallSlots = roomSlots.filter(s => s.type === 'wall');
    if (wallSlots.length > 0) {
        const wallHeader = document.createElement('div');
        wallHeader.className = 'swap-label';
        wallHeader.textContent = `ROOM ${activeRoomId} - WALL SLOTS`;
        container.appendChild(wallHeader);

        const wallGrid = document.createElement('div');
        wallGrid.className = 'slot-buttons-grid wall-slots-grid';
        wallSlots.forEach(slot => {
            wallGrid.appendChild(createSlotGridButton(slot));
        });
        container.appendChild(wallGrid);
    }

    // 3. Single Shared Furniture Search Row
    const searchWrapper = document.createElement('div');
    searchWrapper.className = 'single-furniture-editor';

    const rowDiv = document.createElement('div');
    rowDiv.className = 'select-row layer-row search-container';

    const badge = document.createElement('span');
    badge.id = 'active-slot-badge';
    badge.className = 'layer-badge';
    badge.textContent = activeSlotLabel;

    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'active-furniture-search';
    input.className = 'furniture-search';
    input.autocomplete = 'off';

    const rotGroup = document.createElement('div');
    rotGroup.id = 'active-slot-rot-group';
    rotGroup.className = 'rotation-group';
    rotGroup.style.display = 'none';
    rotGroup.style.gap = '2px';

    const rotCCW = document.createElement('button');
    rotCCW.type = 'button';
    rotCCW.className = 'clear-btn';
    rotCCW.style.display = 'flex';
    rotCCW.innerHTML = '↺';
    rotCCW.title = 'Rotate Counter-Clockwise';
    rotCCW.onclick = () => rotateActiveSlotFurniture(-1);

    const rotCW = document.createElement('button');
    rotCW.type = 'button';
    rotCW.className = 'clear-btn';
    rotCW.style.display = 'flex';
    rotCW.innerHTML = '↻';
    rotCW.title = 'Rotate Clockwise';
    rotCW.onclick = () => rotateActiveSlotFurniture(1);

    rotGroup.appendChild(rotCCW);
    rotGroup.appendChild(rotCW);

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.id = 'active-slot-clear-btn';
    clearBtn.className = 'clear-btn';
    clearBtn.innerHTML = '&times;';
    clearBtn.title = 'Remove Furniture from Slot';
    clearBtn.onclick = () => {
        if (!activeSlotKey) return;
        delete daycareState.furniture[activeSlotKey];
        updateActiveSlotControls();
        renderDaycareStage();
    };

    const dropdown = document.createElement('div');
    dropdown.className = 'custom-dropdown';
    dropdown.id = 'dropdown-active-furniture';

    input.addEventListener('focus', () => {
        hideAllDropdowns();
        renderFurnitureDropdown(input.value);
    });

    input.addEventListener('input', (e) => {
        if (!activeSlotKey) return;
        const val = e.target.value;
        if (!val.trim()) {
            delete daycareState.furniture[activeSlotKey];
        } else {
            if (!daycareState.furniture[activeSlotKey]) {
                daycareState.furniture[activeSlotKey] = { name: val, rotation: 0 };
            } else {
                daycareState.furniture[activeSlotKey].name = val;
            }
        }
        updateActiveSlotControls();
        renderFurnitureDropdown(val);
        renderDaycareStage();
    });

    rowDiv.appendChild(badge);
    rowDiv.appendChild(input);
    rowDiv.appendChild(rotGroup);
    rowDiv.appendChild(clearBtn);
    rowDiv.appendChild(dropdown);

    // 4. Current Furniture Status Line Below Search Bar
    const statusLine = document.createElement('div');
    statusLine.id = 'current-furniture-display';
    statusLine.className = 'current-furniture-status';
    statusLine.innerHTML = 'Current Furniture: <strong>None</strong>';

    searchWrapper.appendChild(rowDiv);
    searchWrapper.appendChild(statusLine);
    container.appendChild(searchWrapper);

    updateActiveSlotControls();
}

// --- 7. DROPDOWNS ---
function renderFurnitureDropdown(filter = '') {
    const dropdown = document.getElementById('dropdown-active-furniture');
    if (!dropdown || !activeSlotKey) return;
    dropdown.innerHTML = '';
    const query = filter.toLowerCase().trim();

    const list = (activeSlotType === 'floor')
        ? (typeof masterFurniture !== 'undefined' ? masterFurniture.floorItems : [])
        : (typeof masterFurniture !== 'undefined' ? masterFurniture.wallItems : []);
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
                daycareState.furniture[activeSlotKey] = { name: itemData.name, rotation: 0 };
                updateActiveSlotControls();
                hideAllDropdowns();
                renderDaycareStage();
            });
            dropdown.appendChild(div);
        });
    }
    dropdown.style.display = 'block';
    dropdown.classList.add('show');
}

['floor', 'wall'].forEach(furnishType => {
    const input = document.getElementById(`slot-${furnishType}`);
    if (!input) return;

    input.addEventListener('focus', () => {
        if (furnishType === 'wall' && !roomHasWallpaper(currentLayout, activeRoomId)) return;
        hideAllDropdowns();
        renderFurnishingDropdown(furnishType, input.value);
    });

    input.addEventListener('input', (e) => {
        if (furnishType === 'wall' && !roomHasWallpaper(currentLayout, activeRoomId)) return;
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
    if (type === 'wall' && !roomHasWallpaper(currentLayout, activeRoomId)) return;

    const dropdown = document.getElementById(`dropdown-${type}`);
    if (!dropdown) return;
    dropdown.innerHTML = '';
    const query = filter.toLowerCase().trim();
    const list = (typeof masterFurnishings !== 'undefined') ? (masterFurnishings[type] || []) : [];
    const filtered = list.filter(item => item.name.toLowerCase().includes(query));

    if (filtered.length === 0) {
        dropdown.innerHTML = `<div class="dropdown-no-results">No matching ${type === 'wall' ? 'wallpapers' : 'floors'}</div>`;
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
    dropdown.classList.add('show');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
        hideAllDropdowns();
    }
});

// --- 8. SEPARATED FURNISHINGS (FLOOR & WALLPAPER) & FURNITURE RENDERERS ---
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
    if (!container || typeof masterFurnishings === 'undefined' || !Array.isArray(masterFurnishings.floor)) return;

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
    if (!container || typeof masterFurnishings === 'undefined' || !Array.isArray(masterFurnishings.wall)) return;

    const eligibleRooms = getRoomsWithWallSlots(currentLayout);
    eligibleRooms.forEach(roomInfo => {
        const wallpaperName = getWallpaperNameForRoom(roomInfo.roomId);
        if (!wallpaperName) return;

        const wallpaperData = masterFurnishings.wall.find(i => i.name === wallpaperName);
        if (!wallpaperData || !wallpaperData.image) return;

        // Render whole combined wallpaper when a room uses both left (1-4) and right (5-8) walls
        if (roomInfo.hasLeft && roomInfo.hasRight) {
            const wholeWall = document.createElement('img');
            wholeWall.src = wallpaperData.image;
            wholeWall.className = 'layer-img wallpaper-layer whole-wallpaper-layer';
            wholeWall.dataset.roomId = String(roomInfo.roomId);
            wholeWall.dataset.side = 'both-walls';
            const cCoords = getCombinedWallpaperAnchorSafe(roomInfo.roomId);
            wholeWall.style.transform = `translate(calc(-50% + ${cCoords.x}px), calc(-50% + ${cCoords.y}px))`;
            wholeWall.style.zIndex = cCoords.zIndex || 4;
            container.appendChild(wholeWall);
            return;
        }

        // Otherwise split and paste only the needed half
        processCombinedWallpaper(wallpaperData.image, (splitImages) => {
            if (roomInfo.hasLeft) {
                const leftWall = document.createElement('img');
                leftWall.src = splitImages.left;
                leftWall.className = 'layer-img wallpaper-layer';
                leftWall.dataset.roomId = String(roomInfo.roomId);
                leftWall.dataset.side = 'left-wall';
                const lCoords = getWallpaperAnchorSafe(roomInfo.roomId, 'left-wall');
                leftWall.style.transform = `translate(calc(-50% + ${lCoords.x}px), calc(-50% + ${lCoords.y}px))`;
                leftWall.style.zIndex = lCoords.zIndex || 4;
                container.appendChild(leftWall);
            }

            if (roomInfo.hasRight) {
                const rightWall = document.createElement('img');
                rightWall.src = splitImages.right;
                rightWall.className = 'layer-img wallpaper-layer';
                rightWall.dataset.roomId = String(roomInfo.roomId);
                rightWall.dataset.side = 'right-wall';
                const rCoords = getWallpaperAnchorSafe(roomInfo.roomId, 'right-wall');
                rightWall.style.transform = `translate(calc(-50% + ${rCoords.x}px), calc(-50% + ${rCoords.y}px))`;
                rightWall.style.zIndex = rCoords.zIndex || 4;
                container.appendChild(rightWall);
            }
        });
    });
}

function renderPlacedFurnitureForLayout(container) {
    if (!container) return;

    Object.keys(daycareState.furniture).forEach(key => {
        const placedItem = daycareState.furniture[key];
        if (!placedItem || !placedItem.name) return;

        const isFloorTile = key.includes(',');
        const itemData = (typeof masterFurniture !== 'undefined')
            ? (isFloorTile
                ? masterFurniture.floorItems.find(i => i.name === placedItem.name)
                : masterFurniture.wallItems.find(i => i.name === placedItem.name))
            : null;
        if (!itemData || !itemData.images) return;

        const img = document.createElement('img');
        const rotIndex = placedItem.rotation || 0;

        img.src = itemData.images[rotIndex];
        img.className = isFloorTile ? 'layer-img floor-furniture-layer' : 'layer-img wall-furniture-layer';
        img.alt = placedItem.name;

        let coords = { x: 0, y: 0 };
        if (isFloorTile) {
            const [c, r] = key.split(',').map(Number);
            coords = getTileCoordinatesSafe(c, r);
        } else {
            coords = getWallFurnitureCoordinatesSafe(key);
        }

        img.style.transform = `translate(calc(-50% + ${coords.x}px), calc(-50% + ${coords.y}px))`;
        img.style.zIndex = coords.zIndex || (isFloorTile ? 20 : 15);
        img.style.display = 'block';

        container.appendChild(img);
    });
}

function renderDaycareStage() {
    if (!currentLayout) return;

    const furnishingsTarget = furnishingsStageLayers || furnitureStageLayers;
    if (furnishingsStageLayers) furnishingsStageLayers.innerHTML = '';
    if (furnitureStageLayers) furnitureStageLayers.innerHTML = '';

    // 1. Render base room furnishings (flooring & wallpapers)
    renderRoomFlooringsForLayout(furnishingsTarget);
    renderRoomWallpapersForLayout(furnishingsTarget);

    // 2. Render placed furniture (floor items & wall items) on top
    renderPlacedFurnitureForLayout(furnitureStageLayers);

    applyZoom();
}

// Initial Run on Page Load
document.addEventListener('DOMContentLoaded', () => {
    initDefaultLayout();
});

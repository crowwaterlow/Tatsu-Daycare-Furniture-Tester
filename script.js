// Global State for Daycare
let currentLayout = null;
let currentZoom = 1.0; // Default scale multiplier
let activeRoomId = 1;

const daycareState = {
    furnishings: {
        floor: {}, 
        wall: {}   
    },
    furniture: {}  
};

// DOM Elements
const roomLayer = document.getElementById('room-layer');
const furnitureStageLayers = document.getElementById('furniture-stage-layers');

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

// --- 2. ROOM SELECTOR UI INTEGRATION ---
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
            buildDynamicFurnitureSlots();
        };

        gridContainer.appendChild(btn);
    }
}

// --- 3. INITIALIZE DEFAULT LAYOUT & DROPDOWN ---
function initDefaultLayout() {
    const layoutSelect = document.getElementById('layoutSelect') || document.getElementById('layout-select');
    
    if (layoutSelect && typeof masterLayouts !== 'undefined' && masterLayouts.length > 0) {
        layoutSelect.innerHTML = '';
        masterLayouts.forEach((layout, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = layout.name;
            layoutSelect.appendChild(option);
        });
        
        // Ensure event listener is properly attached
        layoutSelect.onchange = (e) => {
            switchLayout(e.target.value);
        };
    }

    if (typeof masterLayouts !== 'undefined' && masterLayouts.length > 0) {
        currentLayout = masterLayouts[0]; 
    } else {
        console.error("masterLayouts is not defined! Check if layouts.js is loaded correctly.");
    }

    if (roomLayer && currentLayout) {
        roomLayer.src = currentLayout.baseImage;
        roomLayer.style.display = 'block';
    }

    activeRoomId = 1;
    updateRoomSelectorUI();
    buildDynamicFurnitureSlots();
    renderDaycareStage();
}


// --- 4. SWITCH LAYOUT DYNAMICALLY ---
function switchLayout(index) {
    if (!masterLayouts || !masterLayouts[index]) return;
    
    currentLayout = masterLayouts[index];
    if (roomLayer) {
        roomLayer.src = currentLayout.baseImage;
    }
    
    activeRoomId = 1;
    daycareState.furniture = {}; // Clear furniture on layout switch to prevent out-of-bound errors

    updateRoomSelectorUI();
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

// Helper: Extract Room ID for a tile from layouts.js custom label function
function getRoomIdForTile(c, r) {
    if (currentLayout && typeof currentLayout.getCustomSlotLabel === 'function') {
        const label = currentLayout.getCustomSlotLabel(c, r);
        const match = label.match(/Room\s+(\d+)/i);
        if (match) return parseInt(match[1], 10);
    }
    return 1;
}

// --- 6. DYNAMIC FURNITURE SLOTS & ROTATION CONTROLS ---
function buildDynamicFurnitureSlots() {
    const container = document.getElementById('dynamic-furniture-slots');
    if (!container) return;
    container.innerHTML = '';

    if (!currentLayout) return;

    // Build slots only for tiles belonging to the active room
    for (let r = 0; r < currentLayout.rows; r++) {
        for (let c = 0; c < currentLayout.cols; c++) {
            const tileRoomId = getRoomIdForTile(c, r);
            if (tileRoomId !== activeRoomId) continue;

            const tileKey = `${c},${r}`;
            const slotLabel = (typeof currentLayout.getCustomSlotLabel === 'function')
                ? currentLayout.getCustomSlotLabel(c, r)
                : `Tile [${c},${r}]`;

            container.appendChild(createFurnitureSlotRow(tileKey, slotLabel, 'floor'));
        }
    }

    const wallHeader = document.createElement('div');
    wallHeader.className = 'swap-label';
    wallHeader.textContent = `ROOM ${activeRoomId} - WALL FURNITURE / DÉCOR`;
    container.appendChild(wallHeader);

    ['left-wall', 'right-wall'].forEach(wallSide => {
        const wallLabel = wallSide === 'left-wall' ? `Room ${activeRoomId} - Left Wall` : `Room ${activeRoomId} - Right Wall`;
        container.appendChild(createFurnitureSlotRow(wallSide, wallLabel, 'wall'));
    });
}

function createFurnitureSlotRow(key, labelText, type) {
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
    input.placeholder = `Search item for ${labelText}...`;
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
        daycareState.furnishings[furnishType]['combined'] = e.target.value;
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
                daycareState.furnishings[type]['combined'] = itemData.name;
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

// --- 8. WALLPAPER SPLITTER & STAGE RENDERER ---
function processCombinedWallpaper(imageSrc, callback) {
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

        callback({ left: leftHalf, right: rightHalf });
    };
}

function renderDaycareStage() {
    if (!furnitureStageLayers) return;
    furnitureStageLayers.innerHTML = '';
    if (!currentLayout) return;

    const selectedWallpaperName = daycareState.furnishings.wall['combined'];
    if (selectedWallpaperName && typeof masterFurnishings !== 'undefined') {
        const wallpaperData = masterFurnishings.wall.find(i => i.name === selectedWallpaperName);
        if (wallpaperData && wallpaperData.image) {
            processCombinedWallpaper(wallpaperData.image, (splitImages) => {
                const leftWall = document.createElement('img');
                leftWall.src = splitImages.left;
                leftWall.className = 'layer-img';
                let lCoords = currentLayout.getWallCoordinates('left-wall');
                leftWall.style.transform = `translate(calc(-50% + ${lCoords.x}px), calc(-50% + ${lCoords.y}px))`;
                leftWall.style.zIndex = lCoords.zIndex || 5;
                furnitureStageLayers.appendChild(leftWall);

                const rightWall = document.createElement('img');
                rightWall.src = splitImages.right;
                rightWall.className = 'layer-img';
                let rCoords = currentLayout.getWallCoordinates('right-wall');
                rightWall.style.transform = `translate(calc(-50% + ${rCoords.x}px), calc(-50% + ${rCoords.y}px))`;
                rightWall.style.zIndex = rCoords.zIndex || 5;
                furnitureStageLayers.appendChild(rightWall);
            });
        }
    }

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
            coords = currentLayout.getTileCoordinates(c, r);
        } else {
            coords = currentLayout.getWallCoordinates(key);
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

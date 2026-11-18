// Global State for Daycare
let currentLayout = null;
let activeMainCategory = 'furnishings'; // 'furnishings' or 'furniture'

const daycareState = {
    furnishings: {
        floor: {}, 
        wall: {}   
    },
    furniture: {}  
};

// DOM Elements
const catButtons = document.querySelectorAll('.cat-btn');
const workspaceFurnishings = document.getElementById('workspace-furnishings');
const workspaceFurniture = document.getElementById('workspace-furniture');
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

// --- 1. INITIALIZE DEFAULT LAYOUT ---
function initDefaultLayout() {
    if (typeof masterLayouts !== 'undefined' && masterLayouts.length > 0) {
        currentLayout = masterLayouts[0]; 
    } else {
        currentLayout = {
            name: "3x3 Room",
            cols: 3,
            rows: 3,
            baseImage: "Images/Layouts/3x3.png", 
            getTileCoordinates: (c, r) => ({ x: (c - r) * 32, y: (c + r) * 16, zIndex: 10 + c + r }),
            getWallCoordinates: (side) => ({ x: side === 'left-wall' ? -60 : 60, y: -40, zIndex: 5 })
        };
    }

    roomLayer.src = currentLayout.baseImage;
    roomLayer.style.display = 'block';

    buildDynamicFurnitureSlots();
    renderDaycareStage();
}

// --- 2. MAIN CATEGORY TABS ---
catButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        catButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeMainCategory = btn.getAttribute('data-maincat');
        
        if (activeMainCategory === 'furnishings') {
            workspaceFurnishings.style.display = 'block';
            workspaceFurniture.style.display = 'none';
        } else {
            workspaceFurnishings.style.display = 'none';
            workspaceFurniture.style.display = 'block';
        }
        hideAllDropdowns();
    });
});

// --- 3. DYNAMIC FURNITURE SLOTS & ROTATION CONTROLS ---
function buildDynamicFurnitureSlots() {
    const container = document.getElementById('dynamic-furniture-slots');
    container.innerHTML = '';

    if (!currentLayout) return;

    // Generate grid slot inputs based on columns and rows
    for (let r = 0; r < currentLayout.rows; r++) {
        for (let c = 0; c < currentLayout.cols; c++) {
            const tileKey = `${c},${r}`;
            container.appendChild(createFurnitureSlotRow(tileKey, `Tile [${c},${r}]`, 'floor'));
        }
    }

    // Wall Furniture / Décor Section
    const wallHeader = document.createElement('div');
    wallHeader.className = 'swap-label';
    wallHeader.textContent = 'WALL FURNITURE / DÉCOR';
    container.appendChild(wallHeader);

    ['left-wall', 'right-wall'].forEach(wallSide => {
        container.appendChild(createFurnitureSlotRow(wallSide, wallSide === 'left-wall' ? 'Left Wall' : 'Right Wall', 'wall'));
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

    // Rotation Control Group (Counter-Clockwise & Clockwise buttons)
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
        const maxRot = (type === 'floor') ? 4 : 2;
        itemData.rotation = (itemData.rotation - 1 + maxRot) % maxRot;
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
        const maxRot = (type === 'floor') ? 4 : 2;
        itemData.rotation = (itemData.rotation + 1) % maxRot;
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

// --- 4. DROPDOWNS ---
function renderFurnitureDropdown(key, type, filter = '') {
    const dropdown = document.getElementById(`dropdown-${key}`);
    dropdown.innerHTML = '';
    const query = filter.toLowerCase().trim();
    
    const list = (type === 'floor') ? masterFurniture.floorItems : masterFurniture.wallItems;
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
                document.querySelector(`input[data-key="${key}"]`).value = itemData.name;
                daycareState.furniture[key] = { name: itemData.name, rotation: 0 };
                
                const row = document.querySelector(`input[data-key="${key}" ]`).parentNode;
                row.querySelector('.rotation-group').style.display = 'flex';
                row.querySelector('.clear-btn').style.display = 'flex';

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
    dropdown.innerHTML = '';
    const query = filter.toLowerCase().trim();
    const list = masterFurnishings[type] || [];
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
                document.getElementById(`slot-${type}`).value = itemData.name;
                daycareState.furnishings[type]['combined'] = itemData.name;
                onSearchInput(document.getElementById(`slot-${type}`), `${type}-clear-btn`);
                hideAllDropdowns();
                renderDaycareStage();
            });
            dropdown.appendChild(div);
        });
    }
    dropdown.style.display = 'block';
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.layer-row')) {
        hideAllDropdowns();
    }
});

// --- 5. WALLPAPER SPLITTER & STAGE RENDERER ---
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

        // Extract LEFT half
        ctx.clearRect(0, 0, halfWidth, height);
        ctx.drawImage(img, 0, 0, halfWidth, height, 0, 0, halfWidth, height);
        const leftHalf = canvas.toDataURL('image/png');

        // Extract RIGHT half
        ctx.clearRect(0, 0, halfWidth, height);
        ctx.drawImage(img, halfWidth, 0, halfWidth, height, 0, 0, halfWidth, height);
        const rightHalf = canvas.toDataURL('image/png');

        callback({ left: leftHalf, right: rightHalf });
    };
}

function renderDaycareStage() {
    furnitureStageLayers.innerHTML = '';
    if (!currentLayout) return;

    // 1. Render Wallpaper Segments
    const selectedWallpaperName = daycareState.furnishings.wall['combined'];
    if (selectedWallpaperName) {
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

    // 2. Render Placed Furniture
    Object.keys(daycareState.furniture).forEach(key => {
        const placedItem = daycareState.furniture[key];
        if (!placedItem || !placedItem.name) return;

        let itemData = masterFurniture.floorItems.find(i => i.name === placedItem.name) ||
                       masterFurniture.wallItems.find(i => i.name === placedItem.name);
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
}

// Initial Run
initDefaultLayout();

let currentLayout = null;
let activeRoomId = 1;

// Retrieve slot label using active layout's custom function
function getRoomSlotLabel(c, r) {
    if (currentLayout && typeof currentLayout.getCustomSlotLabel === 'function') {
        return currentLayout.getCustomSlotLabel(c, r);
    }
    return `Tile [${c},${r}]`;
}

// Calculate how many rooms belong to the active layout dimensions
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

// Render or update room buttons dynamically based on active layout
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
        btn.className = `room-btn ${i === activeRoomId ? 'active' : ''}`;
        btn.innerHTML = `<span>🏠</span> R${i}`;
        
        btn.onclick = () => {
            activeRoomId = i;
            document.querySelectorAll('.room-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            onRoomSelected(activeRoomId);
        };

        gridContainer.appendChild(btn);
    }
}

// Populate dropdown options from masterLayouts
function initializeLayoutDropdown() {
    const selectElement = document.getElementById('layoutSelect');
    if (!selectElement) return;

    selectElement.innerHTML = '';
    masterLayouts.forEach((layout, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = layout.name;
        selectElement.appendChild(option);
    });

    // Set default layout
    currentLayout = masterLayouts[0];
    selectElement.onchange = (e) => {
        const selectedIndex = e.target.value;
        handleLayoutSwitch(masterLayouts[selectedIndex]);
    };
}

// Triggered when layout changes from your dropdown menu
function handleLayoutSwitch(layoutObject) {
    currentLayout = layoutObject;
    activeRoomId = 1;        
    updateRoomSelectorUI();  
    console.log(`Switched layout to: ${layoutObject.name}`);
}

function onRoomSelected(roomId) {
    console.log(`Active room changed to: Room ${roomId}`);
}

// Initialization on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeLayoutDropdown();
    updateRoomSelectorUI();
});

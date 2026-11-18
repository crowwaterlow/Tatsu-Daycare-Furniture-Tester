const masterLayouts = [
    {
        name: "3x3 Room",
        cols: 12,
        rows: 12,
        baseImage: "Images/Rooms/3x3 Daycare.png", 
        getTileCoordinates: (c, r) => ({ 
            x: (c - r) * 32, 
            y: (c + r) * 16, 
            zIndex: 10 + c + r 
        }),
        getWallCoordinates: (side) => ({ 
            x: side === 'left-wall' ? -60 : 60, 
            y: -40, 
            zIndex: 5 
        })
    },
    {
        name: "2x2 Room",
        cols: 8,
        rows: 8,
        baseImage: "Images/Rooms/2x2 Daycare.png", 
        getTileCoordinates: (c, r) => ({ 
            x: (c - r) * 32, 
            y: (c + r) * 16, 
            zIndex: 10 + c + r 
        }),
        getWallCoordinates: (side) => ({ 
            x: side === 'left-wall' ? -50 : 50, 
            y: -35, 
            zIndex: 5 
        })
    }
];

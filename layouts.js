const masterLayouts = [
    {
        name: "3x3 Room",
        cols: 3,
        rows: 3,
        baseImage: "Images/Layouts/3x3.png", 
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
        cols: 2,
        rows: 2,
        baseImage: "Images/Layouts/2x2.png", 
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

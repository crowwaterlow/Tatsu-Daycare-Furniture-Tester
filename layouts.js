const masterLayouts = [
    {
        name: "1x1 Daycare",
        cols: 4,   
        rows: 4,   
        baseImage: "Images/Rooms/1x1 Daycare.png",[span_0](start_span)[span_0](end_span)
        
        getTileCoordinates: (c, r) => ({ 
            x: (c - r) * 32, 
            y: (c + r) * 16, 
            zIndex: 10 + c + r 
        }),
        getWallCoordinates: (side) => ({ 
            x: side === 'left-wall' ? -60 : 60, 
            y: -40, 
            zIndex: 5 
        }),

        getCustomSlotLabel: function(c, r) {
            const colLetters = ['A', 'B', 'C', 'D'];[span_1](start_span)[span_1](end_span)
            const rowNumbers = ['4', '3', '2', '1'];[span_2](start_span)[span_2](end_span)

            return `Room 1 - Slot ${colLetters[c]}${rowNumbers[r]}`;[span_3](start_span)[span_3](end_span)
        }
    },
    {
        name: "1x2 Daycare",
        cols: 4,   
        rows: 8,   
        baseImage: "Images/Rooms/1x2 Daycare.png",[span_4](start_span)[span_4](end_span)
        
        getTileCoordinates: (c, r) => ({ 
            x: (c - r) * 32, 
            y: (c + r) * 16, 
            zIndex: 10 + c + r 
        }),
        getWallCoordinates: (side) => ({ 
            x: side === 'left-wall' ? -60 : 60, 
            y: -40, 
            zIndex: 5 
        }),

        getCustomSlotLabel: function(c, r) {
            const roomNumber = (r < 4) ? 1 : 2;
            const localC = c;
            const localR = r % 4;

            const colLetters = ['A', 'B', 'C', 'D'];
            const rowNumbers = ['4', '3', '2', '1'];

            return `Room ${roomNumber} - Slot ${colLetters[localC]}${rowNumbers[localR]}`;
        }
    },
    {
        name: "2x1 Daycare",
        cols: 8,[span_5](start_span)[span_5](end_span)   
        rows: 4,[span_6](start_span)[span_6](end_span)  
        baseImage: "Images/Rooms/2x1 Daycare.png",[span_7](start_span)[span_7](end_span)
        
        getTileCoordinates: (c, r) => ({ 
            x: (c - r) * 32, 
            y: (c + r) * 16, 
            zIndex: 10 + c + r 
        }),
        getWallCoordinates: (side) => ({ 
            x: side === 'left-wall' ? -60 : 60, 
            y: -40, 
            zIndex: 5 
        }),

        getCustomSlotLabel: function(c, r) {
            const roomNumber = (c < 4) ? 1 : 2;
            const localC = c % 4;
            const localR = r;

            const colLetters = ['A', 'B', 'C', 'D'];
            const rowNumbers = ['4', '3', '2', '1'];

            return `Room ${roomNumber} - Slot ${colLetters[localC]}${rowNumbers[localR]}`;
        }
    },
    {
        name: "2x2 Daycare",
        cols: 8,[span_8](start_span)[span_8](end_span)   
        rows: 8,[span_9](start_span)[span_9](end_span)  
        baseImage: "Images/Rooms/2x2 Daycare.png",[span_10](start_span)[span_10](end_span)
        
        getTileCoordinates: (c, r) => ({ 
            x: (c - r) * 32, 
            y: (c + r) * 16, 
            zIndex: 10 + c + r 
        }),
        getWallCoordinates: (side) => ({ 
            x: side === 'left-wall' ? -60 : 60, 
            y: -40, 
            zIndex: 5 
        }),

        getCustomSlotLabel: function(c, r) {
            const roomCol = Math.floor(c / 4); 
            const roomRow = Math.floor(r / 4); 
            
            const roomMap = [
                [1, 3], 
                [2, 4]  
            ];
            
            const roomNumber = roomMap[roomRow][roomCol];
            const localC = c % 4;
            const localR = r % 4;
            const colLetters = ['A', 'B', 'C', 'D'];
            const rowNumbers = ['4', '3', '2', '1'];

            return `Room ${roomNumber} - Slot ${colLetters[localC]}${rowNumbers[localR]}`;
        }
    },
    {
        name: "2x3 Daycare",
        cols: 8,[span_11](start_span)[span_11](end_span)   
        rows: 12,[span_12](start_span)[span_12](end_span) 
        baseImage: "Images/Rooms/2x3 Daycare.png",[span_13](start_span)[span_13](end_span)
        
        getTileCoordinates: (c, r) => ({ 
            x: (c - r) * 32, 
            y: (c + r) * 16, 
            zIndex: 10 + c + r 
        }),
        getWallCoordinates: (side) => ({ 
            x: side === 'left-wall' ? -60 : 60, 
            y: -40, 
            zIndex: 5 
        }),

        getCustomSlotLabel: function(c, r) {
            const roomCol = Math.floor(c / 4); 
            const roomRow = Math.floor(r / 4); 
            
            let roomNumber = 1;
            if (roomRow === 0) roomNumber = 1;
            else if (roomRow === 1) roomNumber = (roomCol === 0) ? 2 : 3;
            else if (roomRow === 2) roomNumber = (roomCol === 0) ? 4 : 5;
            if (roomRow >= 3) roomNumber = 6;

            const localC = c % 4;
            const localR = r % 4;
            const colLetters = ['A', 'B', 'C', 'D'];
            const rowNumbers = ['4', '3', '2', '1'];

            return `Room ${roomNumber} - Slot ${colLetters[localC]}${rowNumbers[localR]}`;
        }
    },
    {
        name: "3x2 Daycare",
        cols: 12,[span_14](start_span)[span_14](end_span)  
        rows: 8,[span_15](start_span)[span_15](end_span)   
        baseImage: "Images/Rooms/3x2 Daycare.png",[span_16](start_span)[span_16](end_span)
        
        getTileCoordinates: (c, r) => ({ 
            x: (c - r) * 32, 
            y: (c + r) * 16, 
            zIndex: 10 + c + r 
        }),
        getWallCoordinates: (side) => ({ 
            x: side === 'left-wall' ? -60 : 60, 
            y: -40, 
            zIndex: 5 
        }),

        getCustomSlotLabel: function(c, r) {
            const roomCol = Math.floor(c / 4); 
            const roomRow = Math.floor(r / 4); 
            
            const roomMap = [
                [2, 1, 3], 
                [4, 6, 5]  
            ];
            
            const roomNumber = roomMap[roomRow][roomCol] || 1;
            const localC = c % 4;
            const localR = r % 4;
            const colLetters = ['A', 'B', 'C', 'D'];
            const rowNumbers = ['4', '3', '2', '1'];

            return `Room ${roomNumber} - Slot ${colLetters[localC]}${rowNumbers[localR]}`;
        }
    },
    {
        name: "3x3 Daycare",
        cols: 12,
        rows: 12,
        baseImage: "Images/Rooms/3x3 Daycare.png",[span_17](start_span)[span_17](end_span)
        
        getTileCoordinates: (c, r) => ({ 
            x: (c - r) * 32, 
            y: (c + r) * 16, 
            zIndex: 10 + c + r 
        }),
        getWallCoordinates: (side) => ({ 
            x: side === 'left-wall' ? -60 : 60, 
            y: -40, 
            zIndex: 5 
        }),

        getCustomSlotLabel: function(c, r) {
            const roomCol = Math.floor(c / 4); 
            const roomRow = Math.floor(r / 4); 
            
            const roomMap = [
                [1, 2, 3], 
                [4, 5, 6], 
                [7, 8, 9]  
            ];
            
            const roomNumber = roomMap[roomRow][roomCol];
            const localC = c % 4;
            const localR = r % 4;
            const colLetters = ['A', 'B', 'C', 'D'];
            const rowNumbers = ['4', '3', '2', '1'];

            return `Room ${roomNumber} - Slot ${colLetters[localC]}${rowNumbers[localR]}`;
        }
    }
];

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files
app.use(express.static(__dirname));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/api/game/start', (req, res) => {
    res.json({ 
        message: 'राधे राधे - Welcome to Raj Shukla Chess Game',
        status: 'ready',
        timestamp: new Date().toISOString()
    });
});

app.post('/api/game/save', (req, res) => {
    const gameData = req.body;
    // In a real application, save to database
    res.json({ 
        success: true, 
        message: 'Game saved successfully',
        saveId: Date.now().toString()
    });
});

app.get('/api/game/load/:id', (req, res) => {
    const saveId = req.params.id;
    // In a real application, load from database
    res.json({ 
        success: true, 
        message: 'Game loaded successfully',
        saveId: saveId
    });
});

// WebSocket for real-time multiplayer
const games = new Map();

io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);
    
    socket.on('join-game', (gameId) => {
        socket.join(gameId);
        socket.gameId = gameId;
        
        if (!games.has(gameId)) {
            games.set(gameId, {
                players: [socket.id],
                board: null,
                moves: [],
                status: 'waiting'
            });
            socket.emit('game-created', { gameId, playerColor: 'white' });
        } else {
            const game = games.get(gameId);
            if (game.players.length < 2) {
                game.players.push(socket.id);
                game.status = 'playing';
                socket.emit('game-joined', { gameId, playerColor: 'black' });
                io.to(gameId).emit('game-start', { 
                    message: 'Both players connected. Game starting!' 
                });
            } else {
                socket.emit('game-full', { gameId });
            }
        }
    });
    
    socket.on('make-move', (data) => {
        const { gameId, from, to, promotion } = data;
        const game = games.get(gameId);
        
        if (game && game.players.includes(socket.id)) {
            game.moves.push(data);
            
            // Broadcast move to all players in the game
            socket.to(gameId).emit('move-made', data);
            socket.emit('move-confirmed', data);
            
            // Check for game over conditions
            // This would require proper chess logic implementation
        }
    });
    
    socket.on('chat-message', (data) => {
        const { gameId, message } = data;
        socket.to(gameId).emit('chat-message', {
            playerId: socket.id,
            message: message,
            timestamp: new Date().toISOString()
        });
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        if (socket.gameId) {
            const game = games.get(socket.gameId);
            if (game) {
                game.players = game.players.filter(id => id !== socket.id);
                if (game.players.length === 0) {
                    games.delete(socket.gameId);
                } else {
                    io.to(socket.gameId).emit('player-left', { playerId: socket.id });
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('राधे राधे - Chess Game Server Started');
    console.log('Welcome to Raj Shukla Chess Game');
});
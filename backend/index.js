var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http, {
    cors: {
        origin: "https://hitbox.online",
        methods: ["GET", "POST"]
    },
    cookie: false,
    perMessageDeflate: true
});

var Game = require('./game');
var games = {};

io.on('connection', (socket) => {
    console.log('Player connected.')
    socket.on('spectate', (room) => {
        if(!room){
            room = '';
        }
        if(!games[room]){
            games[room] = new Game(room);
            games[room].gameLoop();
        }
        games[room].addSpectator(socket);
    });
    socket.on('play', (player) => {
        for (var room in games) {
            games[room].removeSpectator(socket);
        }
        if(!player.room){
            player.room = '';
        }
        if(!games[player.room]){
            games[player.room] = new Game(player.room);
            games[player.room].gameLoop();
        }
        if(!socket.player || socket.player.disconnected){
            games[player.room].addClient(player, socket);
        }
    });
});

http.listen(process.env.PORT || 3001, () => {
    console.log('listening on *:3001');
});
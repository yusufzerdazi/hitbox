var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

var Game = require('./game');

var game = new Game();
game.gameLoop();

io.on('connection', (socket) => {
    console.log('Player connected.')
    socket.on('play', (player) => {
        if(!socket.player || socket.player.disconnected){
            game.addClient(socket);
        }
    });
});

http.listen(process.env.PORT || 3001, () => {
    console.log('listening on *:3001');
});
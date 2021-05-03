import express from 'express';
import { Server } from 'colyseus';
import { GameRoom } from './rooms/gameRoom';

const app = express();
const server = require('http').createServer(app);

// var io = require('socket.io')(server, {
//     cors: {
//         origin: "https://hitbox.online",
//         methods: ["GET", "POST"]
//     },
//     cookie: false,
//     perMessageDeflate: true
// });

const port = Number(process.env.PORT || 3001);

// var games = {};

// io.on('connection', (socket) => {
//     console.log('Player connected.')
//     socket.on('spectate', (room) => {
//         if(!room){
//             room = '';
//         }
//         if(!games[room]){
//             games[room] = new Game(room);
//             games[room].gameLoop();
//         }
//         games[room].addSpectator(socket);
//     });
//     socket.on('play', (player) => {
//         for (var room in games) {
//             games[room].removeSpectator(socket);
//         }
//         if(!player.room){
//             player.room = '';
//         }
//         if(!games[player.room]){
//             games[player.room] = new Game(player.room);
//             games[player.room].gameLoop();
//         }
//         if(!socket.player || socket.player.disconnected){
//             games[player.room].addClient(player, socket);
//         }
//     });
// });

// server.listen(process.env.PORT || 3001, () => {
//     console.log('listening on *:3001');
// });


const gameServer = new Server({
    server,
});

gameServer.define('Game', GameRoom);

gameServer.listen(port);
console.log(`Listening on ws://localhost:${ port }`)
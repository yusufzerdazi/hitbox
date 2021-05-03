import express from 'express';
import { Server } from 'colyseus';
import { GameRoom } from './rooms/gameRoom';

const app = express();
const server = require('http').createServer(app);

const port = Number(process.env.PORT || 3001);

const gameServer = new Server({
    server
});

gameServer.define('Game', GameRoom);

gameServer.listen(port);
console.log(`Listening on ws://localhost:${ port }`)
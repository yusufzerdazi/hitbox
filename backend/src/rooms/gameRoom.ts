import { Room, Client, generateId } from '@colyseus/core';
import Player from '../players/player';
import Utils from '../utils';
import { HitboxRoomState } from "./schema/HitboxRoomState";
import Game from '../game';
import https from 'https';
import http from 'http';

export class GameRoom extends Room<HitboxRoomState> {
    game: Game;

    async onCreate(options: any) {
        this.maxClients = 100;

        this.setState(new HitboxRoomState());

        this.setPatchRate(1000 / 60);

        this.state.map = options.map;
        this.game = new Game();
        if(options.gameMode){
            this.game.gameModes.forEach(g => {
                if(g.name.toLowerCase() == options.gameMode.toLowerCase()){
                    this.game.gameModes = [g];
                }
            });
        }
        
        this.onMessage('right', (client, request) => {
            if(this.state.players.get(client.sessionId))
                this.state.players.get(client.sessionId).right = request;
        });

        this.onMessage('left', (client, request) => {
            if(this.state.players.get(client.sessionId))
                this.state.players.get(client.sessionId).left = request;
        });

        this.onMessage('space', (client, request) => {
            if(this.state.players.get(client.sessionId))
                this.state.players.get(client.sessionId).space = request;
        });

        this.onMessage('down', (client, request) => {
            if(this.state.players.get(client.sessionId))
                this.state.players.get(client.sessionId).down = request;
        });

        this.onMessage('boostLeft', (client, request) => {
            if(this.state.players.get(client.sessionId))
                this.state.players.get(client.sessionId).boostLeft = request;
        });

        this.onMessage('boostRight', (client, request) => {
            if(this.state.players.get(client.sessionId))
                this.state.players.get(client.sessionId).boostRight = request;
        });

        this.onMessage('play', (client, request) => {
            if(Array.from(this.state.players.values()).filter(p => !p.ai).length == 0){
                this.game.gameMode.addAiPlayer();
            } else {
                this.removeAiPlayer();
            }
            this.onPlay(client, request);
        });

        this.onMessage('addAi', () => {
            this.game.gameMode.addAiPlayer();
        });

        this.onMessage('removeAi', () => {
            this.removeAiPlayer();
        });

        this.onMessage('quit', (client) => {
            this.onQuit(client);
            this.removeAiPlayer();
        });

        this.onMessage('nameChange', (client, name) => {
            if(this.state.players.get(client.sessionId))
                this.state.players.get(client.sessionId).name = name;
        });

        this.onMessage('changeAvatar', (client, avatar) => {
            this.broadcast('changeAvatar', avatar);
        });

        this.setSimulationInterval(async dt => {
            this.state.serverTime += dt;
            await this.game.gameLoop(this);
        });
    }

    async onLeave(client: Client, consented: boolean) {
        this.state.players.delete(client.sessionId);
    }

    async onDispose () { }

    removeAiPlayer(){
        var deleted = false;
        this.state.players.forEach(p => {
            if(p.ai && !p.type && !deleted){
                this.state.players.delete(p.clientId);
                deleted = true;
            }
        });
    }

    onPlay(client: Client, options: any){
        let newPlayer = new Player(Utils.randomColor(),
                options.user.name, null, null, false,
                options.user.id,
                options.rank).assign({
            clientId: client.id,
            sessionId: client.sessionId,
        });
        this.state.players.set(client.sessionId, newPlayer);
        this.game.gameMode.onPlayerJoin();
        newPlayer.respawn(Array.from(this.state.players.values()), this.state.level, this.game.gameMode.teamBased);
        https.get('https://maker.ifttt.com/trigger/hitbox_player_joined/json/with/key/' + process.env.IFTTT_KEY);
    }

    onQuit(client: Client){
        this.state.players.delete(client.sessionId);
    }
}

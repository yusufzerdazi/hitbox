import { Room, Client } from '@colyseus/core';
import Player3D from './player3d';
import Utils from '../utils';
import Game3D from './game3d';
import { Hitbox3DRoomState } from './roomState3d';

// Colyseus room for Hitbox 3D. Same lifecycle as GameRoom; the movement
// messages differ because 3D input is a camera-relative direction vector.
export class GameRoom3D extends Room<Hitbox3DRoomState> {
    game: Game3D;

    async onCreate(options: any) {
        this.maxClients = 100;
        this.setState(new Hitbox3DRoomState());
        this.setPatchRate(1000 / 60);

        this.state.map = options.map;
        this.game = new Game3D();
        if(options.gameMode){
            this.game.gameModes.forEach(g => {
                if(g.name.toLowerCase().replace("3d", "") == options.gameMode.toLowerCase()){
                    this.game.gameModes = [g];
                }
            });
        }
        this.game.initializeGameMode(this);

        // World-space movement direction, components in -1..1.
        this.onMessage('move', (client, request) => {
            var player = this.state.players.get(client.sessionId);
            if(player && request){
                player.moveX = Math.max(-1, Math.min(1, +request.x || 0));
                player.moveZ = Math.max(-1, Math.min(1, +request.z || 0));
            }
        });

        // Dash in a world-space direction.
        this.onMessage('boost', (client, request) => {
            var player = this.state.players.get(client.sessionId);
            if(player && request){
                player.boostX = +request.x || 0;
                player.boostZ = +request.z || 0;
            }
        });

        this.onMessage('space', (client, request) => {
            var player = this.state.players.get(client.sessionId);
            if(player)
                player.space = request;
        });

        this.onMessage('down', (client, request) => {
            var player = this.state.players.get(client.sessionId);
            if(player)
                player.down = request;
        });

        this.onMessage('play', async (client, request) => {
            this.onPlay(client, request);
            this.manageAiPlayers();
        });

        this.onMessage('addAi', () => {
            this.game.gameMode.addAiPlayer();
        });

        this.onMessage('removeAi', () => {
            this.removeAiPlayer();
        });

        this.onMessage('quit', (client) => {
            this.onQuit(client);
        });

        this.onMessage('nameChange', (client, name) => {
            if(this.state.players.get(client.sessionId))
                this.state.players.get(client.sessionId).name = name;
        });

        this.onMessage('changeAvatar', (client, avatar) => {
            this.broadcast('changeAvatar', avatar);
        });

        // Sent by the shared HUD; not applicable in 3D.
        this.onMessage('toggleAi', () => {});

        this.setSimulationInterval(async dt => {
            this.state.serverTime += dt;
            await this.game.gameLoop(this);
        });

        this.manageAiPlayers();
    }

    async onLeave(client: Client, consented: boolean) {
        this.state.players.delete(client.sessionId);
        this.manageAiPlayers();
    }

    removeAiPlayer(){
        var deleted = false;
        this.state.players.forEach(p => {
            if(p.ai && !p.type && !deleted){
                this.state.players.delete(p.clientId);
                deleted = true;
            }
        });
    }

    manageAiPlayers() {
        if (!this.game || !this.game.gameMode) {
            return;
        }

        const humanCount = Array.from(this.state.players.values()).filter(p => !p.ai).length;

        let targetAiCount = 0;
        if (humanCount === 0) {
            targetAiCount = 4;
        } else if (humanCount === 1) {
            targetAiCount = 3;
        }

        let currentAiCount = Array.from(this.state.players.values()).filter(p => p.ai && !p.type).length;

        while (currentAiCount > targetAiCount) {
            this.removeAiPlayer();
            currentAiCount--;
        }
        while (currentAiCount < targetAiCount) {
            this.game.gameMode.addAiPlayer();
            currentAiCount++;
        }
    }

    onPlay(client: Client, options: any){
        let newPlayer = new Player3D(Utils.randomColor(),
                options.user.name, false,
                options.user.id,
                options.rank).assign({
            clientId: client.id,
            sessionId: client.sessionId,
        });
        this.state.players.set(client.sessionId, newPlayer);
        this.game.gameMode.onPlayerJoin();
        newPlayer.respawn(Array.from(this.state.players.values()), this.state.level, this.game.gameMode.teamBased);
    }

    onQuit(client: Client){
        this.state.players.delete(client.sessionId);
        this.manageAiPlayers();
    }
}

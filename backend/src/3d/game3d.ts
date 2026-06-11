import { MapSchema } from "@colyseus/schema";
import { Room } from 'colyseus';

import Player3D from './player3d';
import Physics3D from './physics3d';
import GameMode3D from './gameMode3d';
import BattleRoyale3D from './battleRoyale3d';
import Tag3D from './tag3d';
import CollectTheBoxes3D from './collectTheBoxes3d';
import Football3D from './football3d';
import CaptureTheFlag3D from './captureTheFlag3d';
import DeathWall3D from './deathWall3d';
import Flood3D from './flood3d';
import Spleef3D from './spleef3d';
import Level3D from './level3d';
import PlayerTypes3D from './playerTypes3d';
import EndStatus from '../ranking/endStatus';
import { Hitbox3DRoomState } from './roomState3d';

const state = {
    STARTED: "started",
    STARTING: "starting"
};

// 3D port of the Game loop: starting countdown, run physics + game mode until
// the end condition, announce the winner, then roll a new random mode.
class Game3D {
    state: string;
    physics: Physics3D;
    gameMode: GameMode3D;
    gameModes: (typeof GameMode3D)[];
    ending: any;

    constructor(){
        this.physics = new Physics3D();
        this.gameModes = [CaptureTheFlag3D, CollectTheBoxes3D, DeathWall3D, Flood3D, BattleRoyale3D, Tag3D, Football3D, Spleef3D];
    }

    randomGameMode(roomRef: Room<Hitbox3DRoomState>){
        return new this.gameModes[Math.floor(Math.random() * this.gameModes.length)](roomRef);
    }

    // Drop mode-specific entities (ball, orb, flags) between rounds; the next
    // mode adds its own.
    reset(players: MapSchema<Player3D>) {
        players.forEach((player) => {
            if(player.type){
                players.delete(player.clientId);
            }
        });
    }

    respawn(players: MapSchema<Player3D>, level: Level3D, keepTeam: boolean){
        players.forEach(player => {
            if(!player.type){
                player.respawn(Array.from(players.values()), level, keepTeam);
            }
        });
    }

    calculateDeadPlayers(players: Player3D[], gameMode: GameMode3D, level: Level3D) {
        PlayerTypes3D.livingPlayers(players).forEach(player => {
            if(player.health == 0){
                player.alive = false;
                gameMode.onPlayerDeath(player, players, level);
            }
        });
    }

    private startingGameLogic(roomRef: Room<Hitbox3DRoomState>) {
        var countdown = Math.max(Math.round(100 - roomRef.state.serverTime * 60 / 1000), 0);
        if (countdown == 0) {
            this.state = state.STARTED;
        } else {
            roomRef.broadcast("gameMode", { title: this.gameMode.title, subtitle: this.gameMode.subtitle });
        }
        roomRef.broadcast("starting", countdown);
    }

    private async endGameLogic(endStatus: EndStatus, roomRef: Room<Hitbox3DRoomState>) {
        this.ending = true;
        if(endStatus.winner){
            endStatus.winner.score += 1;
            roomRef.broadcast('winner', endStatus.winner);
        } else if(endStatus.winners){
            endStatus.winners.forEach(w => w.score += 1);
            roomRef.broadcast('winner', { name: endStatus.winningTeam + " team" });
        }
        roomRef.state.serverTime = 0;
        this.reset(roomRef.state.players);
        this.gameMode = this.randomGameMode(roomRef);
        this.respawn(roomRef.state.players, roomRef.state.level, this.gameMode.teamBased);
        this.gameMode.onGameStart();
        this.state = state.STARTING;
        this.ending = false;
    }

    private runGameLogic(roomRef: Room<Hitbox3DRoomState>) {
        this.gameMode.onTick();
        var players = Array.from(roomRef.state.players.values());
        var messages = this.physics.calculate(players, roomRef.state.level, this.gameMode);
        messages.forEach(m => roomRef.broadcast(m[0], m[1]));
        players.filter(p => p.ai).forEach(p => p.move(players.filter(pl => pl.clientId != p.clientId), roomRef.state.serverTime, roomRef.state.level));
        this.calculateDeadPlayers(players, this.gameMode, roomRef.state.level);
        return this.gameMode.endCondition();
    }

    public initializeGameMode(roomRef: Room<Hitbox3DRoomState>) {
        if (!this.gameMode) {
            this.gameMode = this.randomGameMode(roomRef);
        }
    }

    async gameLoop(roomRef: Room<Hitbox3DRoomState>){
        if(this.ending){
            return;
        }
        this.initializeGameMode(roomRef);
        switch(this.state){
            case state.STARTED:
                var endStatus = this.runGameLogic(roomRef);
                if(endStatus.end) {
                    await this.endGameLogic(endStatus, roomRef);
                }
                break;
            default:
                this.startingGameLogic(roomRef);
                break;
        }
    }
}

export default Game3D;

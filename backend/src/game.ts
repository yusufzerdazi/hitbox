import { MapSchema } from "@colyseus/schema";

import Player from './players/player';
import BattleRoyale from './game/battleRoyale';
import Tag from './game/tag';
import DeathWall from './game/deathWall';
import CollectTheBoxes from './game/collectTheBoxes';
import Football from './game/football';
import CaptureTheFlag from './game/captureTheFlag';
import Physics from './physics/physics';
import PlayerTypes from './players/playerTypes';
import GameMode from './game/gameMode';
import Level from './level/level';
import { Room } from 'colyseus';
import { HitboxRoomState } from './rooms/schema/HitboxRoomState';
import Ranking from './ranking/ranking';
import EndStatus from "./ranking/endStatus";

const state = {
    STARTED: "started",
    STARTING: "starting"
};

class Game {
    state: string;
    physics: Physics;
    gameMode: GameMode;
    ranking: Ranking;
    gameModes: (typeof GameMode)[];

    constructor(){
        this.physics = new Physics();
        this.ranking = new Ranking();
        this.gameModes = [CaptureTheFlag, CollectTheBoxes, DeathWall, BattleRoyale, Tag, Football];
    }

    randomGameMode(roomRef: Room<HitboxRoomState>){
        return new this.gameModes[Math.floor(Math.random() * this.gameModes.length)](roomRef);
    }
    
    reset(players: MapSchema<Player>) {
        players.forEach((player)=> {
            if(player.type){
                players.delete(player.clientId);
            }
        });
    }

    respawn(players: MapSchema<Player>, level: Level, keepTeam: boolean){
        players.forEach(player => {
            if(!player.type){
                player.respawn(Array.from(players.values()), level, keepTeam);
            }
        })
    }
    
    calculateDeadPlayers(players: Player[], gameMode: GameMode, level: Level) {
        PlayerTypes.livingPlayers(players).forEach(player => {
            if(player.health == 0){
                player.alive = false;
                gameMode.onPlayerDeath(player, players, level);
            }
        });
    }

    private startingGameLogic(roomRef: Room<HitboxRoomState, any>) {
        var countdown = Math.max(Math.round(100 - roomRef.state.serverTime * 60 / 1000), 0);
        if (countdown == 0) {
            this.state = state.STARTED;
        } else {
            roomRef.broadcast("gameMode", { title: this.gameMode.title, subtitle: this.gameMode.subtitle });
        }
        roomRef.broadcast("starting", countdown);
    }

    private endGameLogic(endStatus: EndStatus, roomRef: Room<HitboxRoomState, any>) {
        this.ranking.calculateRank(endStatus, roomRef);
        roomRef.state.serverTime = 0;
        this.reset(roomRef.state.players);
        this.gameMode = this.randomGameMode(roomRef);
        this.respawn(roomRef.state.players, roomRef.state.level, this.gameMode.teamBased);
        this.gameMode.onGameStart();
        this.state = state.STARTING;
    }

    private runGameLogic(roomRef: Room<HitboxRoomState, any>) {
        this.gameMode.onTick();
        roomRef.state.runningPlayers = PlayerTypes.movingPlayers(Array.from(roomRef.state.players.values())).reduce((acc, cur) => {
            return acc + +(cur.type != "ball" && cur.onSurface && cur.xVelocity != 0)
        }, 0);
        var messages = this.physics.calculate(Array.from(roomRef.state.players.values()), roomRef.state.level, this.gameMode);
        messages.forEach(m => roomRef.broadcast(m[0], m[1]));
        var players = Array.from(roomRef.state.players.values());
        players.filter(p => p.ai).forEach(p => p.move(players.filter(pl => pl.clientId != p.clientId), roomRef.state.serverTime, roomRef.state.level));
        this.calculateDeadPlayers(Array.from(roomRef.state.players.values()), this.gameMode, roomRef.state.level);
        return this.gameMode.endCondition();
    }

    private initialiseGame(roomRef: Room<HitboxRoomState, any>) {
        if (!this.gameMode) {
            this.gameMode = this.randomGameMode(roomRef);
        }
    }

    gameLoop(roomRef: Room<HitboxRoomState>){
        this.initialiseGame(roomRef);
        switch(this.state){
            case state.STARTED:
                var endStatus = this.runGameLogic(roomRef);
                if(endStatus.end) {
                    this.endGameLogic(endStatus, roomRef);
                }
                break;
            default: 
                this.startingGameLogic(roomRef);
                break;
        }
    }
}

export default Game;
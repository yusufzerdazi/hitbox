import EloRating from 'elo-rating';
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
import Level from './level';
import { Room } from 'colyseus';
import { HitboxRoomState } from './rooms/schema/HitboxRoomState';

const GameModes = [Tag]// [CaptureTheFlag, CollectTheBoxes, DeathWall, BattleRoyale, Tag, BattleRoyale, BattleRoyale, Football];

const state = {
    STARTED: "started",
    STARTING: "starting"
};

class Game {
    state: string;
    physics: Physics;
    gameMode: GameMode;

    constructor(){
        this.physics = new Physics();
    }

    // constructor(room){
    //     this.room = room;
    //     players = [];
    //     this.spectators = [];
    //     this.state = state.STARTING;
    //     this.aiEnabled = true;
    //     this.maxPlayers = 100;
    //     this.startingTicks = 0;
    //     this.ticks = 0;

    //     this.physics = new Physics();
        
    //     this.gameMode = ;
    // }

    // addLonelyAiPlayer(){
    //     if(PlayerTypes.humanPlayers(players).length == 1 && PlayerTypes.aiPlayers(players).length == 0){
    //         this.addAiPlayer();
    //     } else if(PlayerTypes.humanPlayers(players).length > 1 && PlayerTypes.aiPlayers(players).length > 0){
    //         this.removeAiPlayer();
    //     }
    // }

    // addAiPlayer(){
    //     if(players.filter(c => c).length == this.maxPlayers) {
    //         return;
    //     }
    //     var ai = null;
    //     if(this.gameMode.title == "Death Wall"){
    //         ai = new RunningAi(Utils.randomColor(),
    //         Utils.generateName())
    //     } else if(Math.random() > 0.5){
    //         ai = new SimpleAi(Utils.randomColor(),
    //             Utils.generateName())
    //     } else {
    //         ai = new CleverAi(Utils.randomColor(),
    //             Utils.generateName());
    //     }
    //     players.push({
    //         player: ai
    //     });
    //     ai.respawn(players, this.gameMode.level);
    //     this.gameMode.updateClients(players);
    // }

    // removeAiPlayer(){
    //     var aiClients = PlayerTypes.aiPlayers(players);
    //     if(aiClients.length){
    //         aiClients[0].disconnected = true;
    //     }
    // }

    calculateEnd(players: Player[], gameMode: GameMode, serverTime: number) {
        var endStatus = gameMode.endCondition(serverTime, players);
        if(endStatus.end){
            if(endStatus.winner){
                if(PlayerTypes.aiPlayers(players).length == 0 && players.filter(c => c.name == endStatus.winner.name).length > 0){
                    var eloRatingChanges: any = {};
                    var beatenPlayers = PlayerTypes.players(players).filter(c => c.name != endStatus.winner.name);
                    //endStatus.winner.emit("beaten", beatenPlayers.length);
                    //endStatus.winner.emit("win");
                    beatenPlayers.forEach(c => {
                        var newElo = EloRating.calculate(endStatus.winner.rank || 1000, c.rank || 1000);
                        eloRatingChanges[endStatus.winner.name] = (eloRatingChanges[endStatus.winner.name] || 0) + (newElo.playerRating - (endStatus.winner.rank || 1000));
                        eloRatingChanges[c.name] = (newElo.opponentRating - c.rank || 1000);
                        //c.emit("loss");
                    });
                    for(var key in eloRatingChanges){
                        var player = players.filter(c => c.name == key)[0];
                        player.rank = (player.rank || 1000) + eloRatingChanges[key];
                        //player.emit("rank", player.rank);
                    }
                }
                endStatus.winner.score += 1;
                //this.emitToAllClients('winner', endStatus.winner);
            }
            else if(endStatus.winners){
                if(PlayerTypes.aiPlayers(players).length == 0){
                    var eloRatingChanges: any = {};
                    endStatus.winners.forEach(w => {
                        endStatus.losers.forEach(l => {
                            var newElo = EloRating.calculate(w.rank || 1000, l.rank || 1000);
                            eloRatingChanges[w.name] = (eloRatingChanges[w.name] || 0) + (newElo.playerRating - (w.rank || 1000));
                            eloRatingChanges[l.name] = (eloRatingChanges[l.name] || 0) + (newElo.opponentRating - (l.rank || 1000));
                        });
                    });
                    endStatus.winners.forEach(w => {
                        w.rank = (w.rank || 1000) + eloRatingChanges[w.name] / endStatus.losers.length;
                        w.emit("rank", w.rank);
                        w.emit("win");
                    });
                    endStatus.losers.forEach(l => {
                        l.rank = (l.rank || 1000) + eloRatingChanges[l.name] / endStatus.winners.length;
                        l.emit("rank", l.rank);
                        l.emit("loss");
                    });
                }
                endStatus.winners.forEach(w => {
                    w.score += 1;
                });
                //this.emitToAllClients('winner', {name: endStatus.winningTeam + " team"});
            }
            else {
                //this.emitToAllClients('winner', null);
            }
            // this.state = state.STARTING;
            // this.startingTicks = this.ticks;
            // this.reset();
            //this.emitToAllClients('newGame', players.map(socket => this.mapSocketToPlayer(socket)));
        }
    }

    randomGameMode(roomRef: Room<HitboxRoomState>){
        return new GameModes[Math.floor(Math.random() * GameModes.length)](roomRef);
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
    
    // removeDisconnectedPlayers() {
    //     var disconnectedHumans = PlayerTypes.humanPlayers(players).filter(player => player.disconnected);
    //     players = players.filter(player => !player.disconnected);
    //     if(disconnectedHumans.length > 0){
    //         this.addLonelyAiPlayer();
    //     }
    //     this.spectators = this.spectators.concat(disconnectedHumans);
    //     this.gameMode.updateClients(players);
    // }
    
    moveAi() {
        PlayerTypes.livingPlayers(players).filter(p => p.ai).forEach(ai => {
            var otherPlayers = PlayerTypes.livingPlayers(players).filter(p => p != ai).map(p => p);
            ai.move(otherPlayers, this.ticks, this.gameMode.level);
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

    gameLoop(roomRef: Room<HitboxRoomState>){
        if(!this.gameMode){
            this.gameMode = this.randomGameMode(roomRef);
        }
        if(this.state == state.STARTED){
            var messages = this.physics.calculate(Array.from(roomRef.state.players.values()), roomRef.state.level, this.gameMode);
            messages.forEach(m => roomRef.broadcast(m[0], m[1]));

            var players = Array.from(roomRef.state.players.values());
            players.filter(p => p.ai).forEach(p => p.move(players, roomRef.state.serverTime, roomRef.state.level));
            this.calculateDeadPlayers(Array.from(roomRef.state.players.values()), this.gameMode, roomRef.state.level);
            var endStatus = this.gameMode.endCondition();
            
            if(endStatus.end) {
                roomRef.state.serverTime = 0;
                this.reset(roomRef.state.players);
                this.gameMode = this.randomGameMode(roomRef);
                this.respawn(roomRef.state.players, roomRef.state.level, this.gameMode.teamBased);
                this.gameMode.onGameStart();
                this.state = state.STARTING;
            }
            this.gameMode.onTick();
        } else {
            var countdown = Math.max(Math.round(100 - roomRef.state.serverTime * 60 / 1000), 0);
            if(countdown == 0){
                this.state = state.STARTED
            } else {
                roomRef.broadcast("gameMode", {title: this.gameMode.title, subtitle: this.gameMode.subtitle});
            }
            roomRef.broadcast("starting", countdown);
        }
    }

    // gameLoop() {
    //     setInterval(() => {
    //         this.removeDisconnectedPlayers();
    //         if(this.state == state.STARTED){
    //             var messages = this.physics.calculate(players, this.gameMode);
    //             messages.forEach(m => this.emitToAllClients(m[0], m[1]));
    //             if(this.aiEnabled){
    //                 this.moveAi();
    //             }
    //             this.calculateDeadPlayers();
    //             this.calculateEnd();
    //         } else {
    //             this.calculateStartGame();
    //         }
    //         var redrawLevel = this.gameMode.onTick();
    //         if(redrawLevel){
    //             this.emitToAllClients("level", this.gameMode.level.platforms);
    //         }
    //         if(this.gameMode.title == "Tag"){
    //             this.emitToAllClients("gameCountdown", (this.gameMode.startingTicks + this.gameMode.gameLength) - this.ticks);
    //         }
    //         this.ticks++;
    //     }, 1000 / 60);

    //     setInterval(() => {
    //         var runningPlayers = PlayerTypes.movingPlayers(players).reduce((acc, cur) => {
    //             return acc + (cur.type != "ball" && cur.onSurface.includes(true) && cur.xVelocity != 0)
    //         }, 0);
    //         this.emitToAllClients("allPlayers", [
    //             runningPlayers,
    //             players.map(socket => this.mapSocketToPlayer(socket)),
    //             this.gameMode.title == "Death Wall" ? {
    //                 deathWallX: this.gameMode.deathWallX,
    //                 levelMaxDistance: this.gameMode.level.maxDistance,
    //                 maxDistance: this.gameMode.maxDistance
    //             } : this.gameMode.title == "Football" ? 
    //             this.gameMode.scores : 
    //             {}
    //         ]);
    //     }, 1000 / 60);
    // }
}

export default Game;
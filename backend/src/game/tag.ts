import GameMode from './gameMode';
import Utils from '../utils';
import Constants from '../constants';
import Levels from '../level/levels';
import { Room } from 'colyseus';
import { HitboxRoomState } from '../rooms/schema/HitboxRoomState';
import Player from '../players/player';
import EndStatus from '../ranking/endStatus';

class Tag extends GameMode {
    finished: boolean;
    gameLength: number;
    constructor(roomRef: Room<HitboxRoomState>){
        super(roomRef);
        this.damageEnabled = false;
        var possibleLevels = [Levels.Space, Levels.Complex, Levels.Maze];
        if(this.roomRef.state.players.size < 10){
            possibleLevels.push(Levels.Basic);
        }
        this.roomRef.state.level = this.getLevel();
        
        this.gameLength = 10000;
        this.title = "Tag";
        this.subtitle = "Keep the halo!";
        this.finished = false;
        this.choosePlayerIt();
        this.setModeSpecificPlayers();
    }

    choosePlayerIt(){
        var players = Array.from(this.roomRef.state.players.values());
        if(players.length > 0 && players.filter(p => p.it).length == 0){
            players[Math.floor(Math.random() * players.length)].it = true;
        }
    }

    endCondition(){
        var players = Array.from(this.roomRef.state.players.values());
        if(this.roomRef.state.serverTime > this.gameLength){
            var winner = players.filter(c => c.it);
            this.finished = true;
            return new EndStatus(true, players.length > 1 ? winner[0] : null);
        }
        return new EndStatus(false);
    }

    onCollision(player1: Player, player2: Player){
        var client1wasIt = player1.it;
        var client2wasIt = player2.it;
        if(client1wasIt){
            player2.it = true;
            player1.it = false;
            player2.invincibility = 1000;
            this.roomRef.broadcast("event", {
                type: "halo",
                from: {
                    name: player1.name,
                    colour: player1.colour
                },
                to: {
                    name: player2.name,
                    colour: player2.colour
                }
            });
        }
        if(client2wasIt){
            player2.it = false;
            player1.it = true;
            player1.invincibility = 1000;
            this.roomRef.broadcast("event", {
                type: "halo",
                from: {
                    name: player2.name,
                    colour: player2.colour
                },
                to: {
                    name: player1.name,
                    colour: player1.colour
                }
            });
        }
    }

    onGameStart(){
        this.choosePlayerIt();
    }

    onPlayerJoin(){
        this.choosePlayerIt();
    }

    onPlayerDeath(player: Player){
        var stillHasStar = false;
        var players = Array.from(this.roomRef.state.players.values());
        if(player.it && players.length > 1){
            player.it = false;
            var possibleNewIt = players.filter(p => p.clientId != player.clientId);
            possibleNewIt[Math.floor(Math.random() * possibleNewIt.length)].it = true;
        }
        else if(player.it){
            stillHasStar = true;
        }
        setTimeout(() => {
            if(!this.finished){
                stillHasStar = stillHasStar || player.it;
                player.respawn(players, this.roomRef.state.level);
                player.it = stillHasStar;
            }
        }, 1000);
    }

    onTick(){
        if(this.gameLength - this.roomRef.state.serverTime >= 0){
            this.roomRef.broadcast("gameCountdown", Math.floor((this.gameLength - this.roomRef.state.serverTime) * 3/50));
        }
    }
}

export default Tag;
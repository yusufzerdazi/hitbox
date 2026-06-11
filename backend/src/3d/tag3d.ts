import { Room } from "colyseus";
import GameMode3D from './gameMode3d';
import EndStatus from '../ranking/endStatus';
import Player3D from './player3d';
import { Hitbox3DRoomState } from './roomState3d';

class Tag3D extends GameMode3D {
    finished: boolean;
    gameLength: number;

    constructor(roomRef: Room<Hitbox3DRoomState>){
        super(roomRef);
        this.damageEnabled = false;
        this.roomRef.state.level = this.getLevel();
        this.gameLength = 30000;
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
            return new EndStatus(true, (players.length > 1 ? winner[0] : null) as any);
        }
        return new EndStatus(false);
    }

    onCollision(player1: Player3D, player2: Player3D){
        var client1wasIt = player1.it;
        var client2wasIt = player2.it;
        if(client1wasIt){
            player2.it = true;
            player1.it = false;
            player2.invincibility = 1000;
            this.broadcastHalo(player1, player2);
        }
        if(client2wasIt){
            player2.it = false;
            player1.it = true;
            player1.invincibility = 1000;
            this.broadcastHalo(player2, player1);
        }
    }

    broadcastHalo(from: Player3D, to: Player3D){
        this.roomRef.broadcast("event", {
            type: "halo",
            from: { name: from.name, colour: from.colour },
            to: { name: to.name, colour: to.colour }
        });
    }

    onGameStart(){
        super.onGameStart();
        this.choosePlayerIt();
    }

    onPlayerJoin(){
        this.choosePlayerIt();
    }

    onPlayerDeath(player: Player3D){
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
            this.roomRef.broadcast("gameCountdown", Math.floor((this.roomRef.state.serverTime < this.gameLength ?
                this.gameLength - this.roomRef.state.serverTime : 0) * 3 / 50));
        }
    }
}

export default Tag3D;

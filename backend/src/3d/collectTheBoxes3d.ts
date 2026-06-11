import { Room } from "colyseus";
import GameMode3D from './gameMode3d';
import Orb3D from './orb3d';
import Player3D from './player3d';
import EndStatus from '../ranking/endStatus';
import { Hitbox3DRoomState } from './roomState3d';

class CollectTheBoxes3D extends GameMode3D {
    finished: boolean;

    constructor(roomRef: Room<Hitbox3DRoomState>){
        super(roomRef);
        this.damageEnabled = true;
        this.roomRef.state.level = this.getLevel();
        this.title = "Collect the Boxes";
        this.subtitle = "First to 5!";
        this.finished = false;
        this.roomRef.state.players.forEach(p => {
            p.lives = 0;
        });
        this.setModeSpecificPlayers();
    }

    setModeSpecificPlayers() {
        super.setModeSpecificPlayers();
        var orb = new Orb3D();
        orb.respawn(Array.from(this.roomRef.state.players.values()), this.roomRef.state.level);
        this.roomRef.state.players.set(orb.clientId, orb);
    }

    endCondition(){
        var players = Array.from(this.roomRef.state.players.values());
        var winner = players.filter(c => c.lives === 5);
        if(winner.length === 1){
            this.finished = true;
            return new EndStatus(true, (players.filter(c => !c.orb).length > 1 ? winner[0] : null) as any);
        }
        return new EndStatus(false);
    }

    onCollision(player1: Player3D, player2: Player3D){
        var players = Array.from(this.roomRef.state.players.values());
        var orb = player1.orb ? player1 : player2.orb ? player2 : null;
        var collector = player1.orb ? player2 : player2.orb ? player1 : null;
        if(orb && collector && !collector.type){
            collector.lives += 1;
            orb.respawn(players, this.roomRef.state.level);
            this.roomRef.broadcast("event", {
                type: "box",
                player: { name: collector.name, colour: collector.colour },
                location: { x: orb.x, y: orb.y, z: orb.z }
            });
        }
    }

    onPlayerDeath(player: Player3D){
        var players = Array.from(this.roomRef.state.players.values());
        var playerLives = player.lives;
        setTimeout(() => {
            if(!this.finished){
                player.respawn(players, this.roomRef.state.level);
                player.lives = playerLives;
            }
        }, 1000);
    }
}

export default CollectTheBoxes3D;

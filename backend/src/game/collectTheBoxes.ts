import GameMode from './gameMode';
import Levels from '../level/levels';
import Orb from '../players/orb';
import Player from '../players/player';
import { Room } from 'colyseus';
import { HitboxRoomState } from '../rooms/schema/HitboxRoomState';
import EndStatus from '../ranking/endStatus';

class CollectTheBoxes extends GameMode {
    finished: boolean;

    constructor(roomRef: Room<HitboxRoomState>){
        super(roomRef);
        this.damageEnabled = true;
        this.possibleLevels = [Levels.Space, Levels.Complex, Levels.Towers, Levels.Island, Levels.Maze];
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
        var players = Array.from(this.roomRef.state.players.values());
        var orb = new Orb();
        orb.respawn(players, this.roomRef.state.level);
        this.roomRef.state.players.set(orb.clientId, orb);
    }

    endCondition(){
        var players = Array.from(this.roomRef.state.players.values());
        var winner = players.filter(c => c.lives === 5);
        if(winner.length === 1){
            this.finished = true;
            return new EndStatus(true, players.filter(c => !c.orb).length > 1 ? winner[0] : null);
        }
        return new EndStatus(false);
    }

    onCollision(player1: Player, player2: Player){
        var players = Array.from(this.roomRef.state.players.values());
        if(player1.orb){
            player2.lives += 1;
            player1.respawn(players, this.roomRef.state.level);
            this.roomRef.broadcast("event", {
                type: "box",
                player: {
                    name: player2.name,
                    colour: player2.colour
                }
            });
        } else if(player2.orb){
            player1.lives += 1;
            player2.respawn(players, this.roomRef.state.level);
            this.roomRef.broadcast("event", {
                type: "box",
                player: {
                    name: player1.name,
                    colour: player1.colour
                }
            });
        }
    }

    onPlayerDeath(player: Player){
        var players = Array.from(this.roomRef.state.players.values());
        var playerLives = player.lives;
        setTimeout(() => {
            if(!this.finished){
                player.respawn(players, this.roomRef.state.level);
                player.lives = playerLives;
            }
        }, 1000);
    }

    onTick(){
        this.roomRef.state.players.get("orb").xVelocity = 0;
        this.roomRef.state.players.get("orb").yVelocity = 0;
    }
}

export default CollectTheBoxes;
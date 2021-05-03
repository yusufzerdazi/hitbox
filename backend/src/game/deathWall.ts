import GameMode from './gameMode';
import Levels from '../levels';
import Constants from '../constants';
import Square from '../square';
import Utils from '../utils';
import RunningAi from '../players/runningAi';
import { Room } from 'colyseus';
import { HitboxRoomState } from '../rooms/schema/HitboxRoomState';
import EndStatus from '../ranking/endStatus';

class DeathWall extends GameMode {
    jumpDistance: number;
    maxDistance: number;
    deathWallSpeed: number;
    winner: any;

    constructor(roomRef: Room<HitboxRoomState>){
        super(false, roomRef);
        this.possibleLevels = [Levels.DeathWall];
        this.roomRef.state.level = this.getLevel();
        this.title = "Death Wall";
        this.subtitle = "Don't touch the wall!";
        this.jumpDistance = 2 * ((2 * Constants.JUMPSPEED) / Constants.VERTICALACCELERATION) * Constants.TERMINAL;
        this.roomRef.state.level.deathWallX = - 2000;
        this.deathWallSpeed = 10;
        this.winner = null;
        this.setModeSpecificPlayers();
    }

    setModeSpecificPlayers() {
        this.roomRef.state.players.forEach((player, clientId) => {
            if(player.ai){
                var newAI = new RunningAi(player.colour, player.name)
                newAI.score = player.score;
                this.roomRef.state.players.set(clientId, newAI);
            }
        });
    }

    endCondition(){
        var players = Array.from(this.roomRef.state.players.values());
        var alivePlayers = players.filter(c => c.alive)
        var alive = alivePlayers.length;
        if(alive > 1 || players.length < 2){
            if(!(players.length == 1 && alive == 0)){
                return new EndStatus(false);
            }
        }
        if(alive == 1){
            this.winner = alivePlayers[0];
        }
        if(alive == 0){
            return new EndStatus(true, this.winner);
        }
        return new EndStatus(false);
    }

    onGameStart(){
        this.roomRef.state.level.currentDistance = 0;
    }

    onTick(){
        var players = Array.from(this.roomRef.state.players.values());
        var farthestRigthPlatformX = Math.max.apply(Math, this.roomRef.state.level.platforms.map((platform) => platform.rightX()));
        var farthestRightPlayer = Math.max.apply(Math, players.map(c => c.x));
        this.deathWallSpeed = Math.min(Constants.TERMINAL + 1, this.deathWallSpeed * 1.001);
        if(players.length > 0){
            this.roomRef.state.level.deathWallX += this.deathWallSpeed;
        } else {
            this.roomRef.state.level.deathWallX = - 2000;
            this.deathWallSpeed = 10;
        }
        this.roomRef.state.level.currentDistance = Math.max(farthestRightPlayer, this.roomRef.state.level.currentDistance);
        this.roomRef.state.level.maxDistance = Math.max(this.roomRef.state.level.currentDistance, this.roomRef.state.level.maxDistance);
        players.forEach(p => {
            if(p.x < this.roomRef.state.level.deathWallX && p.health > 0){
                p.death();
                this.roomRef.broadcast("event", {
                    type: "death",
                    timestamp: Utils.millis(),
                    causeOfDeath: "wall",
                    colour: "orange",
                    killed: {
                        name: p.name,
                        colour: p.colour
                    },
                    location: {
                        x: p.x,
                        y: p.y
                    },
                    method: " was consumed by the wall"
                })
            }
        })
        if(farthestRightPlayer + 4000 < farthestRigthPlatformX){
            return false;
        }

        var newPlatformX = farthestRigthPlatformX + (this.jumpDistance) * Math.random() + (farthestRigthPlatformX / 50);
        var newPlatformY = Constants.HEIGHT / 2 - Math.random() * 1000;
        var newPlatformWidth = 200 + Math.random() * 1000;
        var newPlatformHeight = 200;

        this.roomRef.state.level.platforms.push(new Square(newPlatformX, newPlatformY, newPlatformWidth, newPlatformHeight));
        return true;
    }
}

export default DeathWall;
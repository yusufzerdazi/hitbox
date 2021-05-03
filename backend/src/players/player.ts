import { Schema, type, MapSchema } from "@colyseus/schema";
import Constants from '../constants';
import Level from "../level";
import Utils from '../utils';

class Player extends Schema {
    @type("string") colour: string;
    @type("string") name: string;
    @type("string") id: string;
    @type("string") type: string;
    @type("string") team: string;
    @type("string") clientId: string;
    @type("string") sessionId: string;
    @type("string") attachedToPlayer: string;
    @type("number") x: number;
    @type("number") y: number;
    @type("number") lives: number;
    @type("number") xVelocity: number;
    @type("number") yVelocity: number;
    @type("number") newXVelocity: number;
    @type("number") newYVelocity: number;
    @type("number") angle: number;
    @type("number") width: number;
    @type("number") height: number;
    @type("number") health: number;
    @type("number") score: number;
    @type("number") invincibility: number;
    @type("number") boostCooldown: number;
    @type("number") rank: number;
    @type("number") angularVelocity: number;
    @type("number") attachedPlayers: number;
    @type("boolean") ai: boolean;
    @type("boolean") ducked: boolean;
    @type("boolean") down: boolean;
    @type("boolean") left: boolean;
    @type("boolean") right: boolean;
    @type("boolean") space: boolean;
    @type("boolean") boostLeft: boolean | number;
    @type("boolean") boostRight: boolean | number;
    @type("boolean") boostDown: boolean;
    @type("boolean") clicked: boolean;
    @type("boolean") onSurface: boolean;
    @type("boolean") alive: boolean;
    @type("boolean") orb: boolean;
    @type("boolean") it: boolean;

    constructor(colour: string, name: string, x: number, y: number, 
            ai: boolean = false, id: string = null, rank: number = 1000){
        super();
        this.colour = colour;
        this.name = name;
        this.id = id;
        this.x = x;
        this.y = y;
        this.ai = ai;
        this.ducked = false;
        this.left = false;
        this.right = false;
        this.onSurface = false;
        this.lives = 0;

        this.xVelocity = 0;
        this.yVelocity = 0;
        this.health = 100;
        this.score = 0;
        this.alive = true;
        this.invincibility = 0;
        this.boostCooldown = 20;
        this.rank = rank;
        this.orb = null;
        this.type = null
        this.angle = null;

        this.width = Constants.PLAYERWIDTH;
        this.height = Constants.PLAYERHEIGHT;
    }

    reset(x: number, y: number, keepTeam: boolean = false){
        this.x = x;
        this.y = y;
        this.xVelocity = 0;
        this.yVelocity = 0;
        this.ducked = false;
        this.left = false;
        this.right = false;
        this.health = 100;
        this.alive = true;
        this.invincibility = 0;
        this.boostCooldown = 20;
        this.onSurface = false;
        this.it = false;
        this.lives = 0;
        this.team = keepTeam ? this.team : null;
    }

    respawn(players: Player[] = null, level: Level = null, keepTeam: boolean = false){
        var newPosition;
        var anyCollision = true
        var onLand = false;
        while(anyCollision || !onLand){
            anyCollision = false;

            newPosition = {
                x: level.spawnArea.leftX() + Utils.getRandomInt(level.spawnArea.width),
                y: level.spawnArea.topY() + Constants.PLAYERHEIGHT + Utils.getRandomInt(level.spawnArea.height)
            };

            for(var i = 0; i < players.length; i++){
                var xCollision = Math.abs((newPosition.x) - (players[i].x)) <= Constants.PLAYERWIDTH + 20;
                var yCollision = Math.abs((newPosition.y) - (players[i].y)) <= Constants.PLAYERHEIGHT + 20;
                if(xCollision && yCollision){
                    anyCollision = true;
                    break;
                }
            };

            onLand = false;
            for(var i = 0; i < level.platforms.length; i++){
                var xCollision = newPosition.x <= level.platforms[i].rightX() + 20 && newPosition.x >= (level.platforms[i].leftX() - Constants.PLAYERWIDTH) - 20;
                var yCollision = newPosition.y >= level.platforms[i].topY() - 20 && newPosition.y <= (level.platforms[i].bottomY() + Constants.PLAYERHEIGHT) + 20;
                if((xCollision && yCollision) || level.platforms[i].type == "border" && newPosition.y <= level.platforms[i].topY()){
                    anyCollision = true;
                    break;
                }
                if(xCollision && newPosition.y <= level.platforms[i].topY()){
                    onLand = true;
                }
            };
        }
        this.reset(newPosition.x, newPosition.y, keepTeam);
    }

    isCollision(player: Player): boolean {
        if(player.type == "ball"){
            return player.isCollision(this);
        }

        var xCollision = Math.abs((this.x + this.xVelocity) - (player.x + player.xVelocity)) <= Constants.PLAYERWIDTH;
        var yCollision = Math.abs((this.y + this.yVelocity) - (player.y + player.yVelocity)) <= Constants.PLAYERHEIGHT;
        var duckedYCollision = (Math.abs((this.y + this.yVelocity) - (player.y + player.yVelocity)) <= Constants.PLAYERHEIGHT * Constants.DUCKEDHEIGHT) ||
            player.y + player.yVelocity > Constants.PLATFORMHEIGHT;
    
        return (!this.ducked && xCollision && yCollision) || (this.ducked && xCollision && duckedYCollision);
    }

    speed(){
        return Math.sqrt(Math.pow(this.xVelocity, 2) + Math.pow(this.yVelocity, 2));
    }

    death(){
        this.health = 0;
        this.xVelocity = 0;
        this.yVelocity = 0;
    }

    move(players: Player[], ticks: number, level: Level){
        
    }
}

export default Player;
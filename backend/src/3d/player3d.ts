import { Schema, type } from "@colyseus/schema";
import Constants from '../constants';
import Constants3D from './constants3d';
import Utils from '../utils';
import Level3D from "./level3d";
import { terrainHeightAt } from "./terrain3d";

// 3D port of Player. Position is the centre of the feet; y is up.
// Entities (ball, orb, flag) are players with a `type`, exactly like 2D.
class Player3D extends Schema {
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
    @type("number") z: number;
    @type("number") xVelocity: number;
    @type("number") yVelocity: number;
    @type("number") zVelocity: number;
    @type("number") width: number;
    @type("number") height: number;
    @type("number") depth: number;
    @type("number") health: number;
    @type("number") score: number;
    @type("number") lives: number;
    @type("number") invincibility: number;
    @type("number") boostCooldown: number;
    @type("number") rank: number;
    @type("number") attachedPlayers: number;
    @type("boolean") ai: boolean;
    @type("boolean") orb: boolean;
    @type("boolean") ducked: boolean;
    @type("boolean") onSurface: boolean;
    @type("boolean") alive: boolean;
    @type("boolean") it: boolean;

    // Inputs (not synced)
    moveX: number;        // desired world-space direction, -1..1
    moveZ: number;
    space: boolean;
    down: boolean;
    boostX: number;       // dash request, world-space direction (0 = none)
    boostZ: number;
    airJumped: boolean;   // one stamina jump per airtime, so no flying

    newXVelocity: number;
    newYVelocity: number;
    newZVelocity: number;

    constructor(colour: string, name: string, ai: boolean = false, id: string = null, rank: number = 1000){
        super();
        this.colour = colour;
        this.name = name;
        this.id = id;
        this.ai = ai;
        this.rank = rank;
        this.score = 0;
        this.type = null;
        this.orb = false;
        this.width = Constants.PLAYERWIDTH;
        this.height = Constants.PLAYERHEIGHT;
        this.depth = Constants3D.PLAYERDEPTH;
        this.reset(0, 1000, 0);
    }

    reset(x: number, y: number, z: number, keepTeam: boolean = false){
        this.x = x;
        this.y = y;
        this.z = z;
        this.xVelocity = 0;
        this.yVelocity = 0;
        this.zVelocity = 0;
        this.moveX = 0;
        this.moveZ = 0;
        this.space = false;
        this.down = false;
        this.boostX = 0;
        this.boostZ = 0;
        this.airJumped = false;
        this.ducked = false;
        this.health = 100;
        this.alive = true;
        this.invincibility = 0;
        this.boostCooldown = 20;
        this.onSurface = false;
        this.it = false;
        this.lives = 0;
        this.attachedToPlayer = null;
        this.attachedPlayers = 0;
        this.team = keepTeam ? this.team : null;
    }

    currentHeight(){
        return this.ducked ? this.height * Constants.DUCKEDHEIGHT : this.height;
    }

    respawn(players: Player3D[], level: Level3D, keepTeam: boolean = false){
        // Team modes spawn you above your own team's coloured platform.
        const teamPlatform = level.platforms.filter(p => p.colour && p.colour == this.team)[0];
        const area = teamPlatform || level.spawnArea;
        const areaTop = teamPlatform ? teamPlatform.topY() + 200 : area.bottomY();
        const areaHeight = teamPlatform ? 200 : level.spawnArea.height;
        const landable = level.platforms.filter(p => !["border", "tree", "goal"].includes(p.type) && p.durability > 0);
        let position = { x: 0, y: areaTop + areaHeight, z: 0 };
        for(let attempt = 0; attempt < 200; attempt++){
            position = {
                x: area.leftX() + Utils.getRandomInt(area.width),
                y: areaTop + Utils.getRandomInt(areaHeight),
                z: area.backZ() + Utils.getRandomInt(area.depth)
            };

            const playerCollision = players.some(p => p != this &&
                Math.abs(position.x - p.x) <= Constants.PLAYERWIDTH + 20 &&
                Math.abs(position.y - p.y) <= Constants.PLAYERHEIGHT + 20 &&
                Math.abs(position.z - p.z) <= Constants3D.PLAYERDEPTH + 20);
            if(playerCollision) continue;

            const insidePlatform = level.platforms.some(p =>
                !["tree", "goal"].includes(p.type) &&
                p.containsXZ(position.x, position.z) &&
                position.y + Constants.PLAYERHEIGHT >= p.bottomY() && position.y <= p.topY());
            if(insidePlatform) continue;

            const terrainTop = terrainHeightAt(level, position.x, position.z);
            if(terrainTop != null && position.y < terrainTop + 10) continue; // inside a hill

            const onLand = landable.some(p => p.containsXZ(position.x, position.z) && p.topY() <= position.y) ||
                (terrainTop != null && terrainTop > level.waterLevel && terrainTop <= position.y);
            if(onLand) break;
        }
        this.reset(position.x, position.y, position.z, keepTeam);
    }

    isCollision(player: Player3D): boolean {
        const xCollision = Math.abs((this.x + this.xVelocity) - (player.x + player.xVelocity)) <= (this.width + player.width) / 2;
        const zCollision = Math.abs((this.z + this.zVelocity) - (player.z + player.zVelocity)) <= (this.depth + player.depth) / 2;
        const halfHeights = (this.currentHeight() + player.currentHeight()) / 2;
        const thisCentre = this.y + this.yVelocity + this.currentHeight() / 2;
        const otherCentre = player.y + player.yVelocity + player.currentHeight() / 2;
        const yCollision = Math.abs(thisCentre - otherCentre) <= halfHeights;
        return xCollision && yCollision && zCollision;
    }

    speed(){
        return Math.sqrt(this.xVelocity ** 2 + this.yVelocity ** 2 + this.zVelocity ** 2);
    }

    horizontalSpeed(){
        return Math.sqrt(this.xVelocity ** 2 + this.zVelocity ** 2);
    }

    death(){
        this.health = 0;
        this.xVelocity = 0;
        this.yVelocity = 0;
        this.zVelocity = 0;
    }

    move(players: Player3D[], serverTime: number, level: Level3D){

    }
}

export default Player3D;

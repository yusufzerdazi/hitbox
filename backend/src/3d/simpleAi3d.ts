import SimplexNoise from 'simplex-noise';
import Player3D from './player3d';
import Level3D from './level3d';
import Utils from '../utils';
import { terrainHeightAt } from './terrain3d';

const SIMPLEX = new SimplexNoise();

// 3D port of SimpleAi: chase the nearest living player with noise mixed in,
// boost when charging, jump to follow targets above, dive to slam ones below.
class SimpleAi3D extends Player3D {
    boostThreshold: number;
    randomJumpThreshold: number;
    jumpThreshold: number;
    poundThreshold: number;
    duckThreshold: number;
    ticksScaling: number;

    constructor(colour: string, name: string){
        super(colour, name, true);
        this.boostThreshold = 0.985 + 0.01 * Math.random();
        this.randomJumpThreshold = 0.96 + 0.04 * Math.random();
        this.jumpThreshold = 0.3;
        this.poundThreshold = 0.97;
        this.duckThreshold = -0.75;
        this.ticksScaling = 0.01;
    }

    move(players: Player3D[], serverTime: number, level: Level3D){
        if(!this.alive){
            return;
        }
        var ticks = serverTime * 60 / 1000;
        var playerId = Utils.getHashCode(this.name);

        var targets = players.filter(p => p.alive && p != this);
        var target: Player3D = null;
        targets.forEach(p => {
            if(!target || this.distanceTo(p) < this.distanceTo(target)){
                target = p;
            }
        });

        if(target){
            var dx = target.x - this.x;
            var dz = target.z - this.z;
            var distance = Math.hypot(dx, dz) || 1;
            // Steer toward the target, wobbling with noise so movement looks organic.
            var wobble = SIMPLEX.noise2D(2 * playerId, ticks * this.ticksScaling) * Math.PI / 2;
            var angle = Math.atan2(dz, dx) + wobble;
            this.moveX = Math.cos(angle);
            this.moveZ = Math.sin(angle);

            // Edge awareness: if there's no land ahead, jump the gap toward the
            // target or pull back instead of running into the water.
            if(this.onSurface && !this.landAhead(level, this.moveX, this.moveZ)){
                if(this.landAhead(level, dx / distance, dz / distance) || Math.random() < 0.3){
                    this.space = true;
                } else {
                    this.moveX = -this.moveX;
                    this.moveZ = -this.moveZ;
                }
            }

            // Charge with a boost when lined up and somewhat close.
            if(Math.random() > this.boostThreshold && distance < 1500 && this.boostCooldown < 30){
                this.boostX = dx / distance;
                this.boostZ = dz / distance;
            }

            // Jump to follow players above, with a bit of randomness.
            if((target.y > this.y + 50 && Math.random() < this.jumpThreshold) || Math.random() > this.randomJumpThreshold){
                this.space = true;
            } else {
                this.space = false;
                // Dive-bomb targets below every once in a while.
                this.down = !this.onSurface && target.y < this.y - 100 && Math.random() > this.poundThreshold;
            }
        } else {
            this.moveX = 0;
            this.moveZ = 0;
            this.space = false;
        }

        // Randomly duck every once in a while, same as the 2D AI.
        if(this.onSurface && SIMPLEX.noise2D(playerId, ticks * this.ticksScaling) < this.duckThreshold){
            this.down = true;
        } else if(this.onSurface){
            this.down = false;
        }
    }

    landAhead(level: Level3D, dirX: number, dirZ: number){
        var aheadX = this.x + dirX * 150;
        var aheadZ = this.z + dirZ * 150;
        if(level.platforms.some(p => !["border", "tree", "goal"].includes(p.type) &&
                p.containsXZ(aheadX, aheadZ) && p.topY() <= this.y + 1)){
            return true;
        }
        var terrainTop = terrainHeightAt(level, aheadX, aheadZ);
        return terrainTop != null && terrainTop > level.waterLevel - 20;
    }

    distanceTo(player: Player3D){
        return Math.hypot(player.x - this.x, player.y - this.y, player.z - this.z);
    }
}

export default SimpleAi3D;

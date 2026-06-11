import { Room } from "colyseus";
import GameMode3D from './gameMode3d';
import Levels3D from './levels3d';
import Box3D from './box3d';
import Constants3D from './constants3d';
import EndStatus from '../ranking/endStatus';
import { Hitbox3DRoomState } from './roomState3d';

// The Flood: pads keep spawning upward while the water rises ever faster.
// Climb or drown — last one dry wins.
class Flood3D extends GameMode3D {
    winner: any;
    waterSpeed: number;
    spawnTimer: number;
    highestPadTop: number;

    constructor(roomRef: Room<Hitbox3DRoomState>){
        super(roomRef);
        this.damageEnabled = false;
        this.possibleLevels = [Levels3D.Flood];
        this.roomRef.state.level = this.getLevel();
        this.title = "The Flood";
        this.subtitle = "Climb! The water keeps rising!";
        this.waterSpeed = 0.6;
        this.spawnTimer = 0;
        this.highestPadTop = Constants3D.WATERLEVEL + 670;
        this.winner = null;
        this.setModeSpecificPlayers();
    }

    endCondition(){
        var players = Array.from(this.roomRef.state.players.values());
        var alivePlayers = players.filter(c => c.alive);
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
        super.onGameStart();
        this.roomRef.state.level.waterLevel = 0;
        this.waterSpeed = 0.6;
        this.highestPadTop = Constants3D.WATERLEVEL + 670;
    }

    onTick(){
        var level = this.roomRef.state.level;
        this.waterSpeed = Math.min(9, this.waterSpeed * 1.0018);
        level.waterLevel += this.waterSpeed;

        // Spawn a fresh pad every ~0.7s, a jump-and-boost away from a recent one.
        this.spawnTimer -= 1;
        if(this.spawnTimer <= 0){
            this.spawnTimer = 42;
            var pads = level.platforms.filter(p => p.type == "pad" && p.topY() > level.waterLevel - 200);
            var anchor = pads.length > 0 ? pads[Math.floor(Math.random() * pads.length)] : null;
            var anchorX = anchor ? anchor.leftX() + anchor.width / 2 : 0;
            var anchorZ = anchor ? anchor.backZ() + anchor.depth / 2 : 0;
            var angle = Math.random() * Math.PI * 2;
            var reach = 350 + Math.random() * 350;
            var x = Math.max(-1900, Math.min(1900, anchorX + Math.cos(angle) * reach));
            var z = Math.max(-1900, Math.min(1900, anchorZ + Math.sin(angle) * reach));
            var size = 280 + Math.random() * 180;
            this.highestPadTop = Math.max(this.highestPadTop, level.waterLevel + 500);
            var y = this.highestPadTop - 250 + Math.random() * 500;
            level.platforms.push(new Box3D(x - size / 2, y, z - size / 2, size, 70, size, "pad"));
            this.highestPadTop = Math.max(this.highestPadTop, y + 70);
        }

        // Prune pads drowned far below so the level doesn't grow forever.
        for(var i = level.platforms.length - 1; i >= 0; i--){
            var platform = level.platforms[i];
            if(platform.type == "pad" && platform.topY() < level.waterLevel - 700){
                level.platforms.splice(i, 1);
            }
        }
    }
}

export default Flood3D;

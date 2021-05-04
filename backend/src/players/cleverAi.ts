import Player from './player';
import Constants from '../constants';
import Utils from '../utils';
import Level from '../level';
import Square from '../square';

class CleverAi extends Player {
    playerId: any;
    xBoostDistanceThreshold: number;
    yBoostDistanceThreshold: number;
    duckingCooldown: number;
    ticksScaling: number;
    alwaysHigher: boolean;

    constructor(colour: string, name: string, x: number = null, y: number = null){
        var playerId = Utils.getHashCode(name);
        super(colour, name, x, y, true);
        this.playerId = playerId;
        this.xBoostDistanceThreshold = 120;
        this.yBoostDistanceThreshold = 100;
        this.duckingCooldown = 0;
        this.ticksScaling = 0.01;
        this.alwaysHigher = this.playerId % 2 == 0;
    }

    duckBoostingPlayers(players: Player[]){
        players.forEach(p => {
            var playerMovingTowardsMe = this.x < p.x && p.xVelocity < 0 || this.x > p.x && p.xVelocity > 0;
            var playerFasterThanMe = Math.abs(p.xVelocity) > Math.abs(this.xVelocity);
            var playerCloseToMe = Math.abs(p.x - this.x) < this.xBoostDistanceThreshold && Math.abs(p.y - this.y) < this.yBoostDistanceThreshold;

            if(playerMovingTowardsMe && playerFasterThanMe && playerCloseToMe){
                this.down = true;
                this.duckingCooldown = 50;
            } else if (this.duckingCooldown > 0) {
                this.down = true;
                this.duckingCooldown -= 1;
            } else {
                this.down = false;
            }
        });
    }

    jumpDuckingPlayers(players: Player[]){
        players.forEach(p => {
            if(p.ducked && this.y == Constants.PLATFORMHEIGHT){
                this.space = true;
            }
        });
    }

    poundPlayersBelow(players: Player[]){
        players.forEach(p => {
            var playerBelowMe = this.y < p.y;
            var playerCloseToMe = Math.abs(p.x - this.x) < 100;

            if(playerBelowMe && playerCloseToMe){
                this.down = true;
            }
            else {
                this.down = false;
            }
        });
    }

    followFirstPlayer(players: Player[], ticks: number){
        var followedPlayer = players.filter(p => p.type == "orb" || p.it || ((p.type == "flag" && p.colour != this.team && p.attachedToPlayer != this.name)));
        var followablePlayers = followedPlayer.length > 0 ? followedPlayer : players;
        if(followablePlayers[0] && followablePlayers[0].x < this.x){
            var playerCloseToMeVertically = Math.abs(followablePlayers[0].y - this.y) < this.yBoostDistanceThreshold;
            if(playerCloseToMeVertically || (this.y > followablePlayers[0].y && this.x > 480)){
                this.boostLeft = true;
            }
            this.left = true;
            this.right = false;
        } else if (followablePlayers[0]) {
            var playerCloseToMeVertically = Math.abs(followablePlayers[0].y - this.y) < this.yBoostDistanceThreshold;
            if(playerCloseToMeVertically || (this.y > followablePlayers[0].y && this.x <= 480)){
                this.boostRight = true;
            }
            this.left = false;
            this.right = true;
        }

        if(followablePlayers[0] && followablePlayers[0].y <= this.y){
            this.space = true;
        } else {
            this.space = false;
        }
    }

    dontFallToDeath(){
        if(this.y > Constants.PLATFORMHEIGHT) {
            this.space = true;
        }
    }

    jumpRandomly(){
        this.space = Math.random() > 0.98;
    }

    captureTheFlag(level: Level){
        if(this.attachedPlayers){
            var myGoal: Square = level.platforms.filter(p => p.type == "goal" && p.colour == this.team)[0];
            var leftOfGoal = this.x < (myGoal.leftX() + myGoal.rightX()) / 2;
            this.right = leftOfGoal;
            this.left = !leftOfGoal;
        }
    }

    move(players: Player[], ticks: number, level: Level){
        this.duckBoostingPlayers(players);
        this.jumpDuckingPlayers(players);
        this.poundPlayersBelow(players);
        this.followFirstPlayer(players, ticks * 60 / 1000);
        if(players.filter(p => p.type == "flag")){
            this.captureTheFlag(level);
        }
        this.dontFallToDeath();
        this.jumpRandomly();
    }
}

export default CleverAi;
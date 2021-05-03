import Constants from "../constants";
import GameMode from "../game/gameMode";
import Level from "../level";
import Player from "../players/player";
import PlayerTypes from "../players/playerTypes";
import Utils from "../utils";
import Calculation from "./calculation";

class Collision extends Calculation {
    calculate(players: Player[], level: Level, gameMode: GameMode){
        var collisions: Player[][] = [];
        var messages: any[] = [];
        PlayerTypes.vulnerablePlayers(players).forEach(player => {
            PlayerTypes.movingPlayers(players).filter(c => c != player && c.invincibility == 0).forEach(otherPlayer=> {
                if(player.isCollision(otherPlayer) && this.isDamaged(player, otherPlayer)) {
                    var clientSpeed = player.speed();
                    var otherClientSpeed = otherPlayer.speed();
                    var speedDifference = Math.abs(clientSpeed - otherClientSpeed);
                    
                    if(clientSpeed < otherClientSpeed){
                        if(gameMode.damageEnabled && !["ball","flag"].includes(player.type) && !["ball","flag"].includes(otherPlayer.type)) {
                            player.health = Math.max(player.health - (gameMode.playerDamage ? gameMode.playerDamage : otherClientSpeed), 0);
                        }
                        if(player.health == 0){
                            if(!player.ai && !otherPlayer.ai && !player.orb && !otherPlayer.orb){
                                //player.emit("death");
                                //otherPlayer.emit("kill");
                            }
                            player.death();
                            messages.push(["event", {
                                type: "death",
                                timestamp: Utils.millis(),
                                causeOfDeath: "murder",
                                method: Constants.DEATHMETHODS[Math.floor(Math.random() * Constants.DEATHMETHODS.length)],
                                killed: {
                                    name: player.name,
                                    colour: player.colour
                                },
                                location: {
                                    x: player.x,
                                    y: player.y
                                },
                                killer: {
                                    name: otherPlayer.name,
                                    colour: otherPlayer.colour
                                }
                            }]);
                        }
                        player.invincibility = 100;
                    } else if(speedDifference == 0){
                        if(gameMode.damageEnabled) player.health = Math.max(player.health - (gameMode.playerDamage ? 0 : 0.5 * otherClientSpeed), 0);
                    }
    
                    if(Math.abs(player.xVelocity) < Math.abs(otherPlayer.xVelocity)){
                        player.newXVelocity = otherPlayer.xVelocity + (Constants.SHUNTSPEED * Math.sign(otherPlayer.xVelocity));
                    } else if (Math.abs(player.xVelocity) == Math.abs(otherPlayer.xVelocity)) {
                        var flip = Math.sign(player.xVelocity) * Math.sign(otherPlayer.xVelocity)
                        player.newXVelocity = flip * player.xVelocity;
                    }
    
                    if(player.ducked){
                        player.newYVelocity = - Math.min(otherPlayer.yVelocity, Constants.JUMPSPEED);
                        player.boostCooldown = Math.min(100, player.boostCooldown + 80);
                        //player.y = player.y - Constants.PLAYERHEIGHT
                        otherPlayer.newYVelocity = 0;
                    }else if(Math.abs(player.yVelocity) < Math.abs(otherPlayer.yVelocity)){
                        otherPlayer.newYVelocity = - Math.min(otherPlayer.yVelocity, Constants.JUMPSPEED);
                        player.newYVelocity = otherPlayer.yVelocity + (Constants.SHUNTSPEED * Math.sign(otherPlayer.yVelocity));
                    } else if (Math.abs(player.yVelocity) == Math.abs(otherPlayer.yVelocity)) {
                        var flip = Math.sign(player.yVelocity) * Math.sign(otherPlayer.yVelocity)
                        player.newYVelocity = flip * player.yVelocity;
                    }

                    if(players.indexOf(player) < players.indexOf(otherPlayer)){
                        collisions.push([player, otherPlayer]);
                    }
                }
            })
        });
        collisions.forEach(c => {
            messages.push(["collision", {
                type: this.getCollisionType(c),
                location: this.getCollisionLocation(c),
                speed: Math.max(c[0].speed(), c[1].speed())
            }]);
            gameMode.onCollision(c[0], c[1], players);
        });
        PlayerTypes.livingPlayers(players).forEach(player => {
            if(player.newXVelocity){
                player.xVelocity = player.newXVelocity;
                player.newXVelocity = null;
            }
            if(player.newYVelocity){
                player.yVelocity = player.newYVelocity;
                player.newYVelocity = null;
            }
            if(player.y >= Constants.HEIGHT + Constants.PLAYERHEIGHT){
                player.death();
                messages.push(["event", {
                    type: "death",
                    timestamp: Utils.millis(),
                    causeOfDeath: "water",
                    killed: {
                        name: player.name,
                        colour: player.colour
                    },
                    location: {
                        x: player.x,
                        y: player.y
                    },
                    method: Constants.SUICIDEMETHODS[Math.floor(Math.random() * Constants.SUICIDEMETHODS.length)]
                }]);
            }
        })
        PlayerTypes.invulnerablePlayers(players).forEach((player, i) => {
            player.invincibility -= 20;
        });
        return messages;
    }

    isDamaged(player1: Player, player2: Player) {
        return !player1.ducked || player2.yVelocity > 0;
    }

    getCollisionType(collision: Player[]){
        var collisionType = "player";
        collision.forEach(player => {
            if(player.orb || player.it || player.type == "flag"){
                collisionType = "box";
            }
            if(player.type == "ball"){
                collisionType = "football";
            }
        })
        return collisionType;
    }

    getCollisionLocation(collision: Player[]){
        var ball = collision.filter(c => c.type == "ball");
        var notBall = collision.filter(c => c.type != "ball");
        if(ball[0]){
            var ballCenter = {
                x: ball[0].x + Constants.BALLWIDTH / 2,
                y: ball[0].y - Constants.BALLWIDTH / 2,
            };
            var playerCenter = {
                x: notBall[0].x + Constants.PLAYERWIDTH / 2,
                y: notBall[0].y - Constants.PLAYERHEIGHT / 2,
            };
            var angle = Math.atan2(playerCenter.y - ballCenter.y, playerCenter.x - ballCenter.x);
            return {
                x: ballCenter.x + Math.cos(angle) * Constants.BALLWIDTH / 2,
                y: ballCenter.y + Math.sin(angle) * Constants.BALLWIDTH / 2
            }
        } else {
            return {
                x: (collision[0].x + collision[1].x + Constants.PLAYERWIDTH) / 2,
                y: (collision[0].y + collision[1].y - Constants.PLAYERHEIGHT) / 2
            }
        }
    }
}

export default Collision;
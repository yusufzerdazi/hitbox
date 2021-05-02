const Constants = require("../constants");
const PlayerTypes = require("../players/playerTypes");
const Utils = require("../utils");
const Calculation = require("./calculation");

class Collision extends Calculation {
    calculate(clients, gameMode){
        var collisions = [];
        var messages = [];
        PlayerTypes.vulnerablePlayers(clients).forEach(client => {
            PlayerTypes.movingPlayers(clients).filter(c => c != client && c.player.invincibility == 0).forEach(otherClient=> {
                if(client.player.isCollision(otherClient.player) && this.isDamaged(client.player, otherClient.player)) {
                    var clientSpeed = client.player.speed();
                    var otherClientSpeed = otherClient.player.speed();
                    var speedDifference = Math.abs(clientSpeed - otherClientSpeed);
                    
                    if(clientSpeed < otherClientSpeed){
                        if(gameMode.damageEnabled && !["ball","flag"].includes(client.player.type) && !["ball","flag"].includes(otherClient.player.type)) {
                            client.player.health = Math.max(client.player.health - (gameMode.playerDamage ? gameMode.playerDamage : otherClientSpeed), 0);
                        }
                        if(client.player.health == 0){
                            if(!client.player.ai && !otherClient.player.ai && !client.player.orb && !otherClient.player.orb){
                                client.emit("death");
                                otherClient.emit("kill");
                            }
                            client.player.death();
                            messages.push(["event", {
                                type: "death",
                                timestamp: Utils.millis(),
                                causeOfDeath: "murder",
                                method: Constants.DEATHMETHODS[Math.floor(Math.random() * Constants.DEATHMETHODS.length)],
                                killed: {
                                    name: client.player.name,
                                    colour: client.player.colour
                                },
                                location: {
                                    x: client.player.x,
                                    y: client.player.y
                                },
                                killer: {
                                    name: otherClient.player.name,
                                    colour: otherClient.player.colour
                                }
                            }]);
                        }
                        client.player.invincibility = 100;
                    } else if(speedDifference == 0){
                        if(gameMode.damageEnabled) client.player.health = Math.max(client.player.health - (gameMode.playerDamage ? 0 : 0.5 * otherClientSpeed), 0);
                    }
    
                    if(Math.abs(client.player.xVelocity) < Math.abs(otherClient.player.xVelocity)){
                        client.player.newXVelocity = otherClient.player.xVelocity + (Constants.SHUNTSPEED * Math.sign(otherClient.player.xVelocity));
                    } else if (Math.abs(client.player.xVelocity) == Math.abs(otherClient.player.xVelocity)) {
                        var flip = Math.sign(client.player.xVelocity) * Math.sign(otherClient.player.xVelocity)
                        client.player.newXVelocity = flip * client.player.xVelocity;
                    }
    
                    if(client.player.ducked){
                        client.player.newYVelocity = - Math.min(otherClient.player.yVelocity, Constants.JUMPSPEED);
                        client.player.boostCooldown = Math.min(100, client.player.boostCooldown + 80);
                        //client.player.y = client.player.y - Constants.PLAYERHEIGHT
                        otherClient.player.newYVelocity = 0;
                    }else if(Math.abs(client.player.yVelocity) < Math.abs(otherClient.player.yVelocity)){
                        otherClient.player.newYVelocity = - Math.min(otherClient.player.yVelocity, Constants.JUMPSPEED);
                        client.player.newYVelocity = otherClient.player.yVelocity + (Constants.SHUNTSPEED * Math.sign(otherClient.player.yVelocity));
                    } else if (Math.abs(client.player.yVelocity) == Math.abs(otherClient.player.yVelocity)) {
                        var flip = Math.sign(client.player.yVelocity) * Math.sign(otherClient.player.yVelocity)
                        client.player.newYVelocity = flip * client.player.yVelocity;
                    }

                    if(clients.indexOf(client) < clients.indexOf(otherClient)){
                        collisions.push([client, otherClient]);
                    }
                }
            })
        });
        collisions.forEach(c => {
            messages.push(["collision", {
                type: this.getCollisionType(c),
                location: this.getCollisionLocation(c),
                speed: Math.max(c[0].player.speed(), c[1].player.speed())
            }]);
            gameMode.onCollision(c[0], c[1]);
        });
        PlayerTypes.livingPlayers(clients).forEach(client => {
            if(client.player.newXVelocity){
                client.player.xVelocity = client.player.newXVelocity;
                client.player.newXVelocity = null;
            }
            if(client.player.newYVelocity){
                client.player.yVelocity = client.player.newYVelocity;
                client.player.newYVelocity = null;
            }
            if(client.player.y >= Constants.HEIGHT + Constants.PLAYERHEIGHT){
                client.player.death();
                messages.push(["event", {
                    type: "death",
                    timestamp: Utils.millis(),
                    causeOfDeath: "water",
                    killed: {
                        name: client.player.name,
                        colour: client.player.colour
                    },
                    location: {
                        x: client.player.x,
                        y: client.player.y
                    },
                    method: Constants.SUICIDEMETHODS[Math.floor(Math.random() * Constants.SUICIDEMETHODS.length)]
                }]);
            }
        })
        PlayerTypes.invulnerablePlayers(clients).forEach((client, i) => {
            client.player.invincibility -= 20;
        });
        return messages;
    }

    isDamaged(player1, player2) {
        return !player1.ducked || player2.yVelocity > 0;
    }

    getCollisionType(collision){
        var collisionType = "player";
        collision.forEach(client => {
            if(client.player.orb || client.player.it || client.player.type == "flag"){
                collisionType = "box";
            }
            if(client.player.type == "ball"){
                collisionType = "football";
            }
        })
        return collisionType;
    }

    getCollisionLocation(collision){
        var ball = collision.filter(c => c.player.type == "ball");
        var notBall = collision.filter(c => c.player.type != "ball");
        if(ball[0]){
            var ballCenter = {
                x: ball[0].player.x + Constants.BALLWIDTH / 2,
                y: ball[0].player.y - Constants.BALLWIDTH / 2,
            };
            var playerCenter = {
                x: notBall[0].player.x + Constants.PLAYERWIDTH / 2,
                y: notBall[0].player.y - Constants.PLAYERHEIGHT / 2,
            };
            var angle = Math.atan2(playerCenter.y - ballCenter.y, playerCenter.x - ballCenter.x);
            return {
                x: ballCenter.x + Math.cos(angle) * Constants.BALLWIDTH / 2,
                y: ballCenter.y + Math.sin(angle) * Constants.BALLWIDTH / 2
            }
        } else {
            return {
                x: (collision[0].player.x + collision[1].player.x + Constants.PLAYERWIDTH) / 2,
                y: (collision[0].player.y + collision[1].player.y - Constants.PLAYERHEIGHT) / 2
            }
        }
    }
}

module.exports = Collision;
const Constants = require("../constants");
const PlayerTypes = require("../players/playerTypes");
const Calculation = require("./calculation");


class Movement extends Calculation {
    calculate(clients, gameMode){
        var messages = [];

        PlayerTypes.movingPlayers(clients).forEach(client => client.player.attachedPlayers = 0);
        PlayerTypes.attachedPlayers(clients).forEach(client => {
            var attachedPlayer = PlayerTypes.movingPlayers(clients).filter(p => p.player.name == client.player.attachedToPlayer)[0];
            if(!attachedPlayer) {
                client.player.attachedToPlayer = null;
                client.player.invincibility = 1000;
                return;
            }
            attachedPlayer.player.attachedPlayers = (attachedPlayer.player.attachedPlayers | 0) + 1
            client.player.x = attachedPlayer.player.x;
            client.player.y = attachedPlayer.player.y - 100 * attachedPlayer.player.attachedPlayers;
        });

        PlayerTypes.movingPlayers(clients).forEach(client => {
            var previouslyOnSurface = client.player.onSurface.includes(true);
            var currentSpeed = client.player.speed();
            client.player.onSurface = [];
            gameMode.level.platforms.filter(x => x.type != "goal").forEach(platform => {
                if(client.player.x >= platform.rightX() &&
                        client.player.x + client.player.xVelocity < platform.rightX() && 
                        client.player.y + client.player.yVelocity > platform.topY() && 
                        client.player.y + client.player.yVelocity < (platform.bottomY() + client.player.height)) {
                    client.player.x = platform.rightX();
                    client.player.xVelocity = -client.player.xVelocity * Constants.WALLDAMPING;
                    messages.push(['hitWall', { 
                        hitType: 'leftWall', 
                        location: {x: client.player.x, y: client.player.y}, 
                        speed: currentSpeed,
                        size: {
                            width: client.player.width,
                            height: client.player.height
                        }
                    }]);
                }

                if(client.player.x <= (platform.leftX() - client.player.width) &&
                        client.player.x + client.player.xVelocity > (platform.leftX() - client.player.width) && 
                        client.player.y + client.player.yVelocity > platform.topY() && 
                        client.player.y + client.player.yVelocity < (platform.bottomY() + client.player.height)) {
                    client.player.x = platform.leftX() - client.player.width;
                    client.player.xVelocity = -client.player.xVelocity * Constants.WALLDAMPING;;
                    messages.push(['hitWall', { 
                        hitType: 'rightWall', 
                        location: {x: client.player.x, y: client.player.y}, 
                        speed: currentSpeed,
                        size: {
                            width: client.player.width,
                            height: client.player.height
                        }
                    }]);
                }
                if(client.player.y >= (platform.bottomY() + client.player.height) && // Currently above platform
                        client.player.y + client.player.yVelocity <= (platform.bottomY() + client.player.height) && // Will be below on next time step
                        client.player.x + client.player.xVelocity <= platform.rightX() &&
                        client.player.x + client.player.xVelocity >= (platform.leftX() - client.player.width)) {
                    client.player.y = (platform.bottomY() + client.player.height);
                    client.player.yVelocity = 0;
                    messages.push(['hitWall', { 
                        hitType: 'ceiling', 
                        location: {x: client.player.x, y: client.player.y}, 
                        speed: currentSpeed,
                        size: {
                            width: client.player.width,
                            height: client.player.height
                        }
                    }]);
                }
                if(client.player.y <= platform.topY() && // Currently above platform
                        client.player.y + client.player.yVelocity >= platform.topY() && // Will be below on next time step
                        client.player.x + client.player.xVelocity <= platform.rightX() &&
                        client.player.x + client.player.xVelocity >= (platform.leftX() - client.player.width)) {
                    client.player.y = platform.topY();
                    if(client.player.type == "ball"){
                        client.player.yVelocity = -Math.floor(client.player.yVelocity * Constants.WALLDAMPING);
                    } else {
                        client.player.yVelocity = 0;
                    }
                    client.player.onSurface.push(true);
                    if(!previouslyOnSurface){
                        messages.push(['hitWall', { 
                            hitType: 'floor', 
                            location: {x: client.player.x, y: client.player.y}, 
                            speed: currentSpeed,
                            size: {
                                width: client.player.width,
                                height: client.player.height
                            }
                        }]);
                    }
                } else {
                    client.player.onSurface.push(false);
                }

                if(client.player.angularVelocity){
                    client.player.angle += client.player.angularVelocity;
                }
            });
        });
        PlayerTypes.movingPlayers(clients).forEach(client => {
            client.player.x += client.player.xVelocity;
            client.player.y = client.player.y+client.player.yVelocity
        });
        return messages;
    }
}

module.exports = Movement;
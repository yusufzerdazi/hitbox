import Constants from "../constants";
import Level from "../level/level";
import Player from "../players/player";
import PlayerTypes from "../players/playerTypes";
import Square from "../level/square";
import Calculation from "./calculation";
import GameMode from "../game/gameMode";


class Movement extends Calculation {
    calculate(players: Player[], level: Level, gameMode: GameMode){
        var messages: any[] = [];

        PlayerTypes.movingPlayers(players).forEach(player => player.attachedPlayers = 0);
        PlayerTypes.attachedPlayers(players).forEach(player => {
            var attachedPlayer = PlayerTypes.movingPlayers(players).filter(p => p.name == player.attachedToPlayer)[0];
            if(!attachedPlayer) {
                player.attachedToPlayer = null;
                player.invincibility = 1000;
                return;
            }
            attachedPlayer.attachedPlayers = (attachedPlayer.attachedPlayers | 0) + 1
            player.x = attachedPlayer.x;
            player.y = attachedPlayer.y - 100 * attachedPlayer.attachedPlayers;
        });

        PlayerTypes.movingPlayers(players).forEach(player => {
            var previouslyOnSurface = player.onSurface == true;
            var currentSpeed = player.speed();
            player.onSurface = false;
            level.platforms.filter(x => !['trunk', 'leaves', 'goal', 'backgroundleaves'].includes(x.type) && x.durability > 0).forEach((platform: Square) => {
                if(player.x >= platform.rightX() &&
                        player.x + player.xVelocity < platform.rightX() && 
                        player.y + player.yVelocity > platform.topY() && 
                        player.y + player.yVelocity < (platform.bottomY() + player.height)) {
                    player.x = platform.rightX();
                    player.xVelocity = -player.xVelocity * Constants.WALLDAMPING;
                    messages.push(['hitWall', { 
                        hitType: 'leftWall', 
                        location: {x: player.x, y: player.y}, 
                        speed: currentSpeed,
                        size: {
                            width: player.width,
                            height: player.height
                        }
                    }]);
                }

                if(player.x <= (platform.leftX() - player.width) &&
                        player.x + player.xVelocity > (platform.leftX() - player.width) && 
                        player.y + player.yVelocity > platform.topY() && 
                        player.y + player.yVelocity < (platform.bottomY() + player.height)) {
                    player.x = platform.leftX() - player.width;
                    player.xVelocity = -player.xVelocity * Constants.WALLDAMPING;;
                    messages.push(['hitWall', { 
                        hitType: 'rightWall', 
                        location: {x: player.x, y: player.y}, 
                        speed: currentSpeed,
                        size: {
                            width: player.width,
                            height: player.height
                        }
                    }]);
                }
                if(player.y >= (platform.bottomY() + player.height) && // Currently above platform
                        player.y + player.yVelocity <= (platform.bottomY() + player.height) && // Will be below on next time step
                        player.x + player.xVelocity <= platform.rightX() &&
                        player.x + player.xVelocity >= (platform.leftX() - player.width)) {
                    player.y = (platform.bottomY() + player.height);
                    player.yVelocity = 0;
                    messages.push(['hitWall', { 
                        hitType: 'ceiling', 
                        location: {x: player.x, y: player.y}, 
                        speed: currentSpeed,
                        size: {
                            width: player.width,
                            height: player.height
                        }
                    }]);
                }
                if(player.y <= platform.topY() && // Currently above platform
                        player.y + player.yVelocity >= platform.topY() && // Will be below on next time step
                        player.x + player.xVelocity <= platform.rightX() &&
                        player.x + player.xVelocity >= (platform.leftX() - player.width)) {
                    player.y = platform.topY();
                    gameMode.onLanding(platform, player);
                    if(player.type == "ball"){
                        player.yVelocity = -Math.floor(player.yVelocity * Constants.WALLDAMPING);
                    } else {
                        player.yVelocity = 0;
                    }
                    player.onSurface = true;
                    if(!previouslyOnSurface){
                        messages.push(['hitWall', { 
                            hitType: 'floor', 
                            location: {x: player.x, y: player.y}, 
                            speed: currentSpeed,
                            size: {
                                width: player.width,
                                height: player.height
                            }
                        }]);
                    }
                }

                if(player.angularVelocity){
                    player.angle += player.angularVelocity;
                }
            });
        });
        PlayerTypes.movingPlayers(players).forEach(player => {
            player.x += player.xVelocity;
            player.y = player.y+player.yVelocity
        });
        players.forEach(player => {
            if(level.platforms.filter(platform => player.y <= platform.topY() && // Currently above platform
                    player.y + player.yVelocity >= platform.topY() && // Will be below on next time step
                    player.x + player.xVelocity <= platform.rightX() &&
                    player.x + player.xVelocity >= (platform.leftX() - player.width)).length === 0){
                player.onSurface = false;
            }
        })
        return messages;
    }
}

export default Movement;
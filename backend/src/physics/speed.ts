import Constants from "../constants";
import Level from "../level";
import Player from "../players/player";
import Utils from "../utils";
import Calculation from "./calculation";

class Speed extends Calculation {
    calculate(players: Player[], level: Level): any[]{
        var messages: any[] = [];

        players.forEach(player => {
            if(player.boostRight && player.boostLeft){
                // do nothing
            } else if(player.boostRight && player.boostCooldown + Constants.BOOSTCOST <= 100 && player.alive){
                player.xVelocity = Constants.BOOSTSPEED;
                player.boostCooldown += Constants.BOOSTCOST;
                messages.push(["boost", {name: player.name, direction: 'right'}]);
            } else if(player.boostLeft && player.boostCooldown + Constants.BOOSTCOST <= 100 && player.alive){
                player.xVelocity = -Constants.BOOSTSPEED;
                player.boostCooldown += Constants.BOOSTCOST;
                messages.push(["boost", {name: player.name, direction: 'left'}]);
            } else if(player.clicked && player.boostRight == 0 && player.xVelocity != 0 && player.boostCooldown + Constants.BOOSTCOST <= 100 && player.alive){
                player.xVelocity = Constants.BOOSTSPEED * Math.sign(player.xVelocity);
                player.boostCooldown += Constants.BOOSTCOST;
                messages.push(["boost", {name: player.name, direction: player.xVelocity > 0 ? 'right' : 'left'}]);
            }

            if(player.down && player.onSurface && player.yVelocity >= 0){
                player.ducked = true;
                player.yVelocity = 0;
                player.boostCooldown = Math.max(player.boostCooldown, 50);
            } else {
                player.ducked = false;
            }
    
            if(player.down && player.boostCooldown + Constants.BOOSTCOST <= 100 && !player.onSurface && player.alive){
                player.yVelocity = Constants.BOOSTSPEED;
                player.boostCooldown += Constants.BOOSTCOST;
                messages.push(["boost", {name: player.name, direction: 'down', timestamp: Utils.millis()}]);
            }
            else if(Math.abs(player.xVelocity) <= Constants.TERMINAL){
                if(player.right){
                    var rightMultiplier = player.right == true ? 1 : (1/0.75) * player.right;
                    player.xVelocity = rightMultiplier * Math.min(player.xVelocity + Constants.ACCELERATION, Constants.TERMINAL);
                }
                if(player.left){
                    var leftMultiplier = player.left == true ? 1 : (1/0.75) * player.left;
                    player.xVelocity = leftMultiplier * Math.max(player.xVelocity - Constants.ACCELERATION, -Constants.TERMINAL);
                }
            } else {
                if(player.right && player.xVelocity < 0){
                    var rightMultiplier = player.right == true ? 1 : (1/0.75) * player.right;
                    player.xVelocity = rightMultiplier * Math.min(player.xVelocity + Constants.ACCELERATION, Constants.TERMINAL);
                }
                else if(player.left && player.xVelocity > 0){
                    var leftMultiplier = player.left == true ? 1 : (1/0.75) * player.left;
                    player.xVelocity = leftMultiplier * Math.max(player.xVelocity - Constants.ACCELERATION, -Constants.TERMINAL);
                } else {
                    player.xVelocity = player.xVelocity * Constants.FRICTION;
                }
            }
            var inAirBoostCooldown = (!player.onSurface ? level.inAirBoostCooldown || 1 : 1);
            player.boostCooldown = Math.max(player.boostCooldown - inAirBoostCooldown, 0);
            player.boostRight = false;
            player.boostLeft = false;
            player.boostDown = false;
            player.clicked = false;
    
            if(player.space && player.onSurface && player.alive){
                player.yVelocity = -Constants.JUMPSPEED;
                player.space = false;
            }
            if(player.space && player.y != Constants.PLATFORMHEIGHT && player.boostCooldown + Constants.BOOSTCOST <= 100 && player.alive){
                player.yVelocity = -Constants.JUMPSPEED;
                player.boostCooldown += Constants.BOOSTCOST;
            }
            if(!player.right && !player.left){
                var velSign = Math.sign(player.xVelocity);
                var magnitude = Math.abs(player.xVelocity);
                switch(player.type){
                    case("ball"):
                        var newMagnitude = Math.max(0, magnitude - Constants.BALLACCELERATION);
                        break;
                    default:
                        var newMagnitude = Math.max(0, magnitude - Constants.ACCELERATION);
                        break;
                }
                player.xVelocity = newMagnitude * velSign;
            }
            if((player.health != 0) && (player.y != Constants.PLATFORMHEIGHT || player.x + Constants.PLAYERHEIGHT < 100 || player.x > 860 || player.yVelocity < 0)
                && !player.attachedToPlayer) {
                player.yVelocity += Constants.VERTICALACCELERATION * level.gravity;
            } else {
                player.yVelocity = 0;
            }

            if(player.angularVelocity){
                player.angularVelocity = player.angularVelocity * 0.99;
            }
        });

        return messages;
    }
}

export default Speed;
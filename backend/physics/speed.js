const Constants = require("../constants");
const Utils = require("../utils");
const Calculation = require("./calculation");

class Speed extends Calculation {
    calculate(clients, gameMode){
        var messages = [];

        clients.forEach(client => {
            if(client.player.boostRight && client.player.boostLeft){
                // do nothing
            } else if(client.player.boostRight && client.player.boostCooldown + Constants.BOOSTCOST <= 100 && client.player.alive){
                client.player.xVelocity = Constants.BOOSTSPEED;
                client.player.boostCooldown += Constants.BOOSTCOST;
                messages.push(["boost", {name: client.player.name, direction: 'right'}]);
            } else if(client.player.boostLeft && client.player.boostCooldown + Constants.BOOSTCOST <= 100 && client.player.alive){
                client.player.xVelocity = -Constants.BOOSTSPEED;
                client.player.boostCooldown += Constants.BOOSTCOST;
                messages.push(["boost", {name: client.player.name, direction: 'left'}]);
            } else if(client.player.clicked && client.player.boostRight == 0 && client.player.xVelocity != 0 && client.player.boostCooldown + Constants.BOOSTCOST <= 100 && client.player.alive){
                client.player.xVelocity = Constants.BOOSTSPEED * Math.sign(client.player.xVelocity);
                client.player.boostCooldown += Constants.BOOSTCOST;
                messages.push(["boost", {name: client.player.name, direction: client.player.xVelocity > 0 ? 'right' : 'left'}]);
            }

            if(client.player.down && client.player.onSurface.includes(true) && client.player.yVelocity >= 0){
                client.player.ducked = true;
                client.player.yVelocity = 0;
                client.player.boostCooldown = Math.max(client.player.boostCooldown, 50);
            } else {
                client.player.ducked = false;
            }
    
            if(client.player.down && client.player.boostCooldown + Constants.BOOSTCOST <= 100 && !client.player.onSurface.includes(true) && client.player.alive){
                client.player.yVelocity = Constants.BOOSTSPEED;
                client.player.boostCooldown += Constants.BOOSTCOST;
                messages.push(["boost", {name: client.player.name, direction: 'down', timestamp: Utils.millis()}]);
            }
            else if(Math.abs(client.player.xVelocity) <= Constants.TERMINAL){
                if(client.player.right){
                    var rightMultiplier = client.player.right == true ? 1 : (1/0.75) * client.player.right;
                    client.player.xVelocity = rightMultiplier * Math.min(client.player.xVelocity + Constants.ACCELERATION, Constants.TERMINAL);
                }
                if(client.player.left){
                    var leftMultiplier = client.player.left == true ? 1 : (1/0.75) * client.player.left;
                    client.player.xVelocity = leftMultiplier * Math.max(client.player.xVelocity - Constants.ACCELERATION, -Constants.TERMINAL);
                }
            } else {
                if(client.player.right && client.player.xVelocity < 0){
                    var rightMultiplier = client.player.right == true ? 1 : (1/0.75) * client.player.right;
                    client.player.xVelocity = rightMultiplier * Math.min(client.player.xVelocity + Constants.ACCELERATION, Constants.TERMINAL);
                }
                else if(client.player.left && client.player.xVelocity > 0){
                    var leftMultiplier = client.player.left == true ? 1 : (1/0.75) * client.player.left;
                    client.player.xVelocity = leftMultiplier * Math.max(client.player.xVelocity - Constants.ACCELERATION, -Constants.TERMINAL);
                } else {
                    client.player.xVelocity = client.player.xVelocity * Constants.FRICTION;
                }
            }
            var inAirBoostCooldown = (!client.player.onSurface.includes(true) ? gameMode.level.inAirBoostCooldown || 1 : 1);
            client.player.boostCooldown = Math.max(client.player.boostCooldown - inAirBoostCooldown, 0);
            client.player.boostRight = false;
            client.player.boostLeft = false;
            client.player.boostDown = false;
            client.player.clicked = false;
    
            if(client.player.space && client.player.onSurface.includes(true) && client.player.alive){
                client.player.yVelocity = -Constants.JUMPSPEED;
                client.player.space = false;
            }
            if(client.player.space && client.player.y != Constants.PLATFORMHEIGHT && client.player.boostCooldown + Constants.BOOSTCOST <= 100 && client.player.alive){
                client.player.yVelocity = -Constants.JUMPSPEED;
                client.player.boostCooldown += Constants.BOOSTCOST;
            }
            if(!client.player.right && !client.player.left){
                var velSign = Math.sign(client.player.xVelocity);
                var magnitude = Math.abs(client.player.xVelocity);
                switch(client.player.type){
                    case("ball"):
                        var newMagnitude = Math.max(0, magnitude - Constants.BALLACCELERATION);
                        break;
                    default:
                        var newMagnitude = Math.max(0, magnitude - Constants.ACCELERATION);
                        break;
                }
                client.player.xVelocity = newMagnitude * velSign;
            }
            if((client.player.health != 0) && (client.player.y != Constants.PLATFORMHEIGHT || client.player.x + Constants.PLAYERHEIGHT < 100 || client.player.x > 860 || client.player.yVelocity < 0)
                && !client.player.attachedToPlayer) {
                client.player.yVelocity += Constants.VERTICALACCELERATION * gameMode.level.gravity;
            } else {
                client.player.yVelocity = 0;
            }

            if(client.player.angularVelocity){
                client.player.angularVelocity = client.player.angularVelocity * 0.99;
            }
        });

        return messages;
    }
}

module.exports = Speed;
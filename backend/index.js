var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);
var SimplexNoise = require('simplex-noise');

var PlayFab = require("./node_modules/playfab-sdk/Scripts/PlayFab/PlayFab");
var PlayFabClient = require("./node_modules/playfab-sdk/Scripts/PlayFab/PlayFabClient");
PlayFab.settings.titleId = "B15E8";

const ACCELERATION = 2;
const VERTICALACCELERATION = 0.4;
const TERMINAL = 15;
const JUMPSPEED = 15;
const PLATFORMHEIGHT = 400;
const PLAYERSIZE = 50;
const SHUNTSPEED = 5;
const WIDTH = 960;
const HEIGHT = 540;
const WALLDAMPING = 0.75;
const DAMAGETHRESHOLD = 5;
const FRICTION = 0.96;
const BOOSTSPEED = 35;
const DUCKEDHEIGHT = 1/5;
const SIMPLEX = new SimplexNoise();

var TICKS = 0;
var AIALIVE = true;

var allClients = [];
io.on('connection', (socket) => {
    console.log('Got connect.')
    socket.on('play', (player) => {
        if(!socket.player || socket.player.disconnected){
            allClients.push(socket);
            socket.player = {
                name: player.name,
                colour: randomColor(),
                x: 100 + 100 * allClients.length,
                y: PLATFORMHEIGHT,
                xVelocity: 0,
                yVelocity: 0,
                health: 100,
                score: 0,
                alive: true,
                invincibility: 0,
                boostCooldown: 0,
                ducked: false
            }
        }
    });

    socket.on('right', pressed => {
        socket.player ? socket.player.right = pressed : null;
    });
    socket.on('boostRight', pressed => {
        socket.player ? socket.player.boostRight = true : null;
    });
    socket.on('boostLeft', pressed => {
        socket.player ? socket.player.boostLeft = true : null;
    });
    socket.on('down', pressed => {
        socket.player ? socket.player.down = pressed : null;
    });
    socket.on('left', pressed => {
        socket.player ? socket.player.left = pressed : null;
    });
    socket.on('space', pressed => {
        socket.player ? socket.player.space = pressed : null;
    });
    socket.on('click', () => {
        socket.player ? socket.player.clicked = true : null;
    })

    socket.on('addAi', () =>{
        var colour = randomColor();
        allClients.push({player: {
            colour: colour,
            name: colour,
            x: getRandomInt(WIDTH - PLAYERSIZE),
            y: PLATFORMHEIGHT,
            xVelocity: 0,
            yVelocity: 0,
            health: 100,
            score: 0,
            ai: true,
            alive: true,
            invincibility: 0,
            boostCooldown: 0,
            ducked: false
        }})
    })

    socket.on('removeAi', () =>{
        aiClients = allClients.filter(c => c.player.ai);
        if(aiClients.length){
            aiClients[0].player.disconnected = true;
        }
    })

    socket.on('quit', function() {
        if(socket.player) socket.player.disconnected = true;
    });

    socket.on('toggleAi', function() {
        AIALIVE = !AIALIVE;
    });
    
    socket.on('disconnect', function() {
       if(socket.player) socket.player.disconnected = true;
    });
});

livingPlayers = () => {
    return allClients.filter(c => c.player.alive);
}

movingPlayers = () => {
    return livingPlayers().filter(c => !c.player.ducked);
}

vulnerablePlayers = () => {
    return livingPlayers().filter(c => c.player.invincibility == 0);
}

invulnerablePlayers = () => {
    return livingPlayers().filter(c => c.player.invincibility > 0);
}

calculateSpeed = () => {
    allClients.forEach(client => {
        if(client.player.boostRight && client.player.boostLeft){
            // do nothing
        } else if(client.player.boostRight && client.player.boostCooldown == 0){
            client.player.xVelocity = BOOSTSPEED;
            client.player.boostCooldown = 100;
        } else if(client.player.boostLeft && client.player.boostCooldown == 0){
            client.player.xVelocity = -BOOSTSPEED;
            client.player.boostCooldown = 100;
        } else if(client.player.clicked && client.player.boostRight == 0 && client.player.xVelocity != 0 && client.player.boostCooldown == 0){
            client.player.xVelocity = BOOSTSPEED * Math.sign(client.player.xVelocity);
            client.player.boostCooldown = 100;
        }

        if(client.player.down && client.player.y == PLATFORMHEIGHT && client.player.yVelocity >= 0){
            client.player.ducked = true;
            client.player.boostCooldown = Math.max(client.player.boostCooldown, 20);
        } else {
            client.player.ducked = false;
        }

        if(client.player.down && client.player.boostCooldown == 0 && client.player.y != PLATFORMHEIGHT){
            client.player.yVelocity = BOOSTSPEED;
            client.player.boostCooldown = 100;
        }
        else if(Math.abs(client.player.xVelocity) <= TERMINAL){
            if(client.player.right){
                client.player.xVelocity = Math.min(client.player.xVelocity + ACCELERATION, TERMINAL);
            }
            if(client.player.left){
                client.player.xVelocity = Math.max(client.player.xVelocity - ACCELERATION, -TERMINAL);
            }
        } else {
            client.player.xVelocity = client.player.xVelocity * FRICTION;
        }

        client.player.boostCooldown = Math.max(client.player.boostCooldown - 1, 0);
        client.player.boostRight = false;
        client.player.boostLeft = false;
        client.player.boostDown = false;
        client.player.clicked = false;

        if(client.player.space && client.player.y == PLATFORMHEIGHT){
            client.player.yVelocity = -JUMPSPEED;
            client.player.space = false;
        }
        if(client.player.space && client.player.y != PLATFORMHEIGHT && client.player.boostCooldown < 40){
            client.player.yVelocity = -JUMPSPEED;
            client.player.boostCooldown = Math.min(100, client.player.boostCooldown + 60);
        }
        if(!client.player.right && !client.player.left){
            var velSign = Math.sign(client.player.xVelocity);
            var magnitude = Math.abs(client.player.xVelocity);
            var newMagnitude = Math.max(0, magnitude - ACCELERATION);
            client.player.xVelocity = newMagnitude * velSign;
        }
        if(client.player.y != PLATFORMHEIGHT || client.player.yVelocity < 0) {
            client.player.yVelocity += VERTICALACCELERATION;
        } else {
            client.player.yVelocity = 0;
        }
    })
}

calculateMovement = () => {
    movingPlayers().forEach(client => {
        client.player.x += client.player.xVelocity;
        client.player.y = Math.min(client.player.y + client.player.yVelocity, PLATFORMHEIGHT);
    });
    movingPlayers().forEach(client => {
        if(client.player.x < 0) {
            client.player.x = 0;
            client.player.xVelocity = -client.player.xVelocity * WALLDAMPING;
        }
        if(client.player.x > (WIDTH - PLAYERSIZE)) {
            client.player.x = WIDTH - PLAYERSIZE;
            client.player.xVelocity = -client.player.xVelocity * WALLDAMPING;;
        }
        if(client.player.y < PLAYERSIZE) {
            client.player.y = PLAYERSIZE;
            client.player.yVelocity = 0;
        }
    });
}

isCollision = (player1, player2) => {
    xCollision = Math.abs((player1.x + player1.xVelocity) - (player2.x + player2.xVelocity)) <= PLAYERSIZE;
    yCollision = Math.abs((player1.y + player1.yVelocity) - (player2.y + player2.yVelocity)) <= PLAYERSIZE - 10;
    duckedYCollision = (Math.abs((player1.y + player1.yVelocity) - (player2.y + player2.yVelocity)) <= PLAYERSIZE * DUCKEDHEIGHT) ||
        player2.y + player2.yVelocity > PLATFORMHEIGHT;

    return (!player1.ducked && xCollision && yCollision) || (player1.ducked && xCollision && duckedYCollision);
}

isDamaged = (player1, player2) => {
    return !player1.ducked || player2.yVelocity > 0;
}

calculateCollision = () => {
    var wasCollision = false;
    vulnerablePlayers().forEach(client => {
        movingPlayers().filter(c => c != client && c.player.invincibility == 0).forEach(otherClient => {
            if(isCollision(client.player, otherClient.player) && isDamaged(client.player, otherClient.player)) {
                wasCollision = true;

                clientSpeed = Math.sqrt(Math.pow(client.player.xVelocity, 2) + Math.pow(client.player.yVelocity, 2));
                otherClientSpeed = Math.sqrt(Math.pow(otherClient.player.xVelocity, 2) + Math.pow(otherClient.player.yVelocity, 2));
                speedDifference = Math.abs(clientSpeed - otherClientSpeed);

                if(clientSpeed < otherClientSpeed){
                    client.player.health = Math.max(client.player.health - otherClientSpeed, 0);
                    client.player.invincibility = 100;
                } else if(speedDifference == 0){
                    client.player.health = Math.max(client.player.health - 0.5 * otherClientSpeed, 0);
                }

                if(Math.abs(client.player.xVelocity) < Math.abs(otherClient.player.xVelocity)){
                    client.player.newXVelocity = otherClient.player.xVelocity + (SHUNTSPEED * Math.sign(otherClient.player.xVelocity));
                } else if (Math.abs(client.player.xVelocity) == Math.abs(otherClient.player.xVelocity)) {
                    var flip = Math.sign(client.player.xVelocity) * Math.sign(otherClient.player.xVelocity)
                    client.player.newXVelocity = flip * client.player.xVelocity;
                }

                if(client.player.ducked){
                    client.player.newYVelocity = - otherClient.player.yVelocity;
                    otherClient.player.newYVelocity = 0;
                }else if(Math.abs(client.player.yVelocity) < Math.abs(otherClient.player.yVelocity)){
                    otherClient.player.newYVelocity = - otherClient.player.yVelocity;
                    client.player.newYVelocity = otherClient.player.yVelocity + (SHUNTSPEED * Math.sign(otherClient.player.yVelocity));
                } else if (Math.abs(client.player.yVelocity) == Math.abs(otherClient.player.yVelocity)) {
                    var flip = Math.sign(client.player.yVelocity) * Math.sign(otherClient.player.yVelocity)
                    client.player.newYVelocity = flip * client.player.yVelocity;
                }
            }
        })
    });
    livingPlayers().forEach(client => {
        if(client.player.newXVelocity){
            client.player.xVelocity = client.player.newXVelocity;
            client.player.newXVelocity = null;
        }
        if(client.player.newYVelocity){
            client.player.yVelocity = client.player.newYVelocity;
            client.player.newYVelocity = null;
        }
    })
    invulnerablePlayers().forEach((client, i) => {
        client.player.invincibility -= 20;
    });
    return wasCollision;
}

calculateEnd = () => {
    alivePlayers = livingPlayers();
    alive = alivePlayers.length;
    if(alive > 1 || allClients.length < 2){
        return;
    }
    if(alive == 1){
        alivePlayers[0].player.score += 1;
        io.emit('winner', alivePlayers[0].player);
    }
    if(allClients.filter(x => x.player.ai).length == 0){
        allClients.forEach(client => {
            if(client == alivePlayers[0]){
                client.emit('win');
            } else {
                client.emit('loss');
            }
        })
    }
    reset();
}

reset = () => {
    allClients.forEach((client, i)=> {
        client.player = {
            name: client.player.name,
            colour: client.player.colour,
            x: getRandomInt(WIDTH - PLAYERSIZE),
            y: PLATFORMHEIGHT,
            xVelocity: 0,
            yVelocity: 0,
            health: 100,
            score: client.player.score,
            ai: client.player.ai,
            alive: true,
            invincibility: 0,
            left: client.player.left,
            right: client.player.right,
            boostCooldown: 0,
            ducked: false
        }
    });
}

removeDisconnectedPlayers = () => {
    allClients = allClients.filter(client => !client.player.disconnected);
}

moveAi = () => {
    livingPlayers().filter(client => client.player.ai).forEach((client, i) => {
        playerId = parseInt('0x'+client.player.colour.substr(1));
        playersOnLeft = 0;
        playersOnRight = 0;
        playersAbove = 0;
        playersBelow = 0;
        livingPlayers().forEach(otherClient => {
            if(otherClient.player.x > client.player.x){
                playersOnRight ++;
            }
            if(otherClient.player.x < client.player.x){
                playersOnLeft ++;
            }
        });
        if(playersOnLeft > playersOnRight){
            client.player.left = SIMPLEX.noise2D(2 * playerId, TICKS * 0.01) < 0.8;
            client.player.right = SIMPLEX.noise2D(2 * playerId, TICKS * 0.01) > 0.8;
            client.player.boostLeft = Math.random() < 0.01;
        } else if(playersOnLeft < playersOnRight){
            client.player.left = SIMPLEX.noise2D(2 * playerId, TICKS * 0.01) > 0.8;
            client.player.right = SIMPLEX.noise2D(2 * playerId, TICKS * 0.01) < 0.8;
            client.player.boostRight = Math.random() > 0.99;
        } else {
            client.player.left = SIMPLEX.noise2D(2 * playerId, TICKS * 0.01) > 0;
            client.player.right = SIMPLEX.noise2D(2 * playerId, TICKS * 0.01) < 0;
            client.player.boostRight = Math.random() > 0.995;
            client.player.boostLeft = Math.random() > 0.995;
        }

        livingPlayers().filter(x => x != client).forEach(otherClient => {
            if(otherClient.player.y >= client.player.y){
                playersBelow ++;
            }
            if(otherClient.player.y < client.player.y){
                playersAbove ++;
            }
        });
        if((playersAbove > playersBelow && Math.random() < 0.3) || Math.random() > 0.99){
            client.player.space = true;
        } else {
            client.player.space = false;
            client.player.boostDown = Math.random() < 0.9;
        }
        
        client.player.down = SIMPLEX.noise2D(playerId, TICKS * 0.01) < -0.5;
    });
}

calculateDeadPlayers = () => {
    livingPlayers().forEach(client => {
        if(client.player.health == 0){
            client.player.alive = false;
        }
    });
}

setInterval(() => {
    removeDisconnectedPlayers();
    calculateSpeed();
    calculateMovement();
    wasCollision = calculateCollision();
    if(wasCollision){
        io.emit("collision");
    }
    AIALIVE ? moveAi() : null;
    calculateDeadPlayers();
    calculateEnd();
    io.emit("allPlayers", allClients.map(socket => socket.player));
    TICKS++;
}, 1000 / 60);

http.listen(process.env.PORT || 3001, () => {
  console.log('listening on *:3001');
});

var randomColor = () => "#000000".replace(/0/g,function(){return (~~(Math.random()*16)).toString(16);});

function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}
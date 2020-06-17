var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

const ACCELERATION = 2;
const VERTICALACCELERATION = 1;
const TERMINAL = 20;
const JUMPSPEED = 20;
const PLATFORMHEIGHT = 400;
const PLAYERSIZE = 50;
const SHUNTSPEED = 5;
const WIDTH = 960;
const HEIGHT = 540;
const WALLDAMPING = 0.75;
const DAMAGETHRESHOLD = 5;

var AIALIVE = true;

var allClients = [];
io.on('connection', (socket) => {
    console.log('Got connect.')
    socket.on('play', () => {
        if(!socket.player || socket.player.disconnected){
            allClients.push(socket);
            socket.player = {
                colour: randomColor(),
                x: 100 + 100 * allClients.length,
                y: PLATFORMHEIGHT,
                xVelocity: 0,
                yVelocity: 0,
                health: 100,
                score: 0,
                alive: true,
                invincibility: 0
            }
        }
    });

    socket.on('right', pressed => {
        socket.player ? socket.player.right = pressed : null;
    });
    socket.on('left', pressed => {
        socket.player ? socket.player.left = pressed : null;
    });
    socket.on('space', pressed => {
        socket.player ? socket.player.space = pressed : null;
    })

    socket.on('addAi', () =>{
        allClients.push({player: {
            colour: randomColor(),
            x: getRandomInt(WIDTH - PLAYERSIZE),
            y: PLATFORMHEIGHT,
            xVelocity: 0,
            yVelocity: 0,
            health: 100,
            score: 0,
            ai: true,
            alive: true,
            invincibility: 0
        }})
    })

    socket.on('removeAi', () =>{
        aiClients = allClients.filter(c => c.player.ai);
        if(aiClients.length){
            aiClients[0].player.disconnected = true;
        }
    })

    socket.on('quit', function() {
        socket.player.disconnected = true;
    });

    socket.on('toggleAi', function() {
        AIALIVE = !AIALIVE;
    });
    
    socket.on('disconnect', function() {
       var i = allClients.indexOf(socket);
       if(allClients[i]){  
           allClients[i].disconnected = true;
       }
    });
});

calculateSpeed = () => {
    allClients.forEach(client => {
        if(client.player.right){
            client.player.xVelocity = Math.min(client.player.xVelocity + ACCELERATION, TERMINAL);
        }
        if(client.player.left){
            client.player.xVelocity = Math.max(client.player.xVelocity - ACCELERATION, -TERMINAL);
        }
        if(client.player.space && client.player.y == PLATFORMHEIGHT){
            client.player.yVelocity = -JUMPSPEED;
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
    allClients.filter(c => c.player.alive).forEach(client => {
        client.player.x += client.player.xVelocity;
        client.player.y = Math.min(client.player.y + client.player.yVelocity, PLATFORMHEIGHT);
    });
    allClients.filter(c => c.player.alive).forEach(client => {
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

calculateCollision = () => {
    var wasCollision = false;
    allClients.filter(c => c.player.alive && c.player.invincibility == 0).forEach((client, i) => {
        allClients.filter(c => c.player.alive && c != client).forEach(otherClient => {
            if(Math.abs((client.player.x + client.player.xVelocity) - (otherClient.player.x + otherClient.player.xVelocity)) <= PLAYERSIZE
                    && Math.abs((client.player.y + client.player.yVelocity) - (otherClient.player.y + otherClient.player.yVelocity)) <= PLAYERSIZE) {
                wasCollision = true;

                clientSpeed = Math.sqrt(Math.pow(client.player.xVelocity, 2) + Math.pow(client.player.yVelocity, 2));
                otherClientSpeed = Math.sqrt(Math.pow(otherClient.player.xVelocity, 2) + Math.pow(otherClient.player.yVelocity, 2));
                speedDifference = Math.abs(clientSpeed - otherClientSpeed);
                if(clientSpeed < otherClientSpeed && speedDifference >= DAMAGETHRESHOLD){
                    client.player.health = Math.max(client.player.health - otherClientSpeed, 0);
                    client.player.invincibility = 100;
                } else if(speedDifference <= DAMAGETHRESHOLD){
                    client.player.health = Math.max(client.player.health - 0.5 * otherClientSpeed, 0);
                }

                if(Math.abs(client.player.xVelocity) < Math.abs(otherClient.player.xVelocity)){
                    client.player.newXVelocity = otherClient.player.xVelocity + (SHUNTSPEED * Math.sign(otherClient.player.xVelocity));
                } else if (Math.abs(client.player.xVelocity) == Math.abs(otherClient.player.xVelocity)) {
                    var flip = Math.sign(client.player.xVelocity) * Math.sign(otherClient.player.xVelocity)
                    client.player.newXVelocity = flip * client.player.xVelocity;
                }

                if(Math.abs(client.player.yVelocity) < Math.abs(otherClient.player.yVelocity)){
                    otherClient.player.newYVelocity = - otherClient.player.yVelocity;
                    client.player.newYVelocity = otherClient.player.yVelocity + (SHUNTSPEED * Math.sign(otherClient.player.yVelocity));
                } else if (Math.abs(client.player.yVelocity) == Math.abs(otherClient.player.yVelocity)) {
                    var flip = Math.sign(client.player.yVelocity) * Math.sign(otherClient.player.yVelocity)
                    client.player.newYVelocity = flip * client.player.yVelocity;
                }
            }
        })
    });
    allClients.filter(c => c.player.alive).forEach(client => {
        if(client.player.newXVelocity){
            client.player.xVelocity = client.player.newXVelocity;
            client.player.newXVelocity = null;
        }
        if(client.player.newYVelocity){
            client.player.yVelocity = client.player.newYVelocity;
            client.player.newYVelocity = null;
        }
    })
    allClients.filter(c => c.player.alive && c.player.invincibility > 0).forEach((client, i) => {
        client.player.invincibility -= 25;
    });
    return wasCollision;
}

calculateEnd = () => {
    alivePlayers = allClients.filter(c => c.player.alive);
    alive = alivePlayers.length;
    if(alive > 1 || allClients.length < 2){
        return;
    }
    if(alive == 1){
        alivePlayers[0].player.score += 1;
    }
    reset();
}

reset = () => {
    allClients.forEach((client, i)=> {
        client.player = {
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
            right: client.player.right
        }
    });
}

removeDisconnectedPlayers = () => {
    allClients = allClients.filter(client => !client.player.disconnected);
}

moveAi = () => {
    allClients.filter(client => client.player.ai && client.player.alive).forEach((client, i) => {
        playersOnLeft = 0;
        playersOnRight = 0;
        playersAbove = 0;
        playersBelow = 0;
        allClients.filter(client => client.player.alive).forEach(otherClient => {
            if(otherClient.player.x > client.player.x){
                playersOnRight ++;
            }
            if(otherClient.player.x < client.player.x){
                playersOnLeft ++;
            }
        });
        if(playersOnLeft > playersOnRight){
            client.player.left = Math.random() < 0.9;
            client.player.right = Math.random() > 0.9;
        } else {
            client.player.left = Math.random() > 0.9;
            client.player.right = Math.random() < 0.9;
        }

        allClients.filter(x => x != client && x.player.alive).forEach(otherClient => {
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
        }
    });
}

calculateDeadPlayers = () => {
    allClients.filter(c => c.player.alive).forEach(client => {
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
}, 1000 / 60);

http.listen(process.env.PORT || 3001, () => {
  console.log('listening on *:3001');
});

var randomColor = () => "#000000".replace(/0/g,function(){return (~~(Math.random()*16)).toString(16);});

function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}
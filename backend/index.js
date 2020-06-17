var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

const ACCELERATION = 2;
const VERTICALACCELERATION = 1;
const TERMINAL = 20;
const JUMPSPEED = 20;
const PLATFORMHEIGHT = 400;
const PLAYERSIZE = 50;
const SHUNTSPEED = 10;
const WIDTH = 960;
const HEIGHT = 540;
const WALLDAMPING = 0.75;
var COLLISIONCOOLDOWN = 0;

var allClients = [];
io.on('connection', (socket) => {
    console.log('Got connect.')
    socket.on('play', () => {
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
    });

    socket.on('right', pressed => {
        socket.player.right = pressed;
    });
    socket.on('left', pressed => {
        socket.player.left = pressed;
    });
    socket.on('space', pressed => {
        if(pressed){
            socket.player.yVelocity = -JUMPSPEED;
        }
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
                if(Math.abs(client.player.xVelocity) < Math.abs(otherClient.player.xVelocity)){
                    client.player.newXVelocity = otherClient.player.xVelocity + (SHUNTSPEED * Math.sign(otherClient.player.xVelocity));
                    client.player.health = Math.max(client.player.health - Math.abs(otherClient.player.xVelocity), 0);
                    client.player.invincibility = 100;
                } else if (Math.abs(client.player.xVelocity) == Math.abs(otherClient.player.xVelocity)) {
                    client.player.newXVelocity = - client.player.xVelocity;
                    client.player.health = Math.max(client.player.health - 0.5 * Math.abs(client.player.xVelocity), 0);
                }

                if(client.player.y < otherClient.player.y){
                    client.player.newYVelocity = - Math.abs(client.player.yVelocity);
                    otherClient.player.newYVelocity = Math.abs(otherClient.player.yVelocity);
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
    allClients = allClients.filter(client => !client.disconnected);
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
        if(playersAbove > playersBelow || Math.random() > 0.99){
            if(Math.random() < 0.9){
                client.player.yVelocity = -JUMPSPEED;
            }
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
    moveAi();
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
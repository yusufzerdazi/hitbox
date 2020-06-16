var app = require('express')();
var http = require('http').createServer(app);
var io = require('socket.io')(http);

const ACCELERATION = 1;
const VERTICALACCELERATION = 1;
const TERMINAL = 20;
const JUMPSPEED = 20;
const PLATFORMHEIGHT = 270;
const PLAYERSIZE = 50;
const SHUNTSPEED = 10;
var COLLISIONCOOLDOWN = 0;

var allClients = [];
io.on('connection', (socket) => {
    if(allClients >= 2) {
        return;
    }
    allClients.push(socket);
    console.log('Got connect.')

    socket.player = {
        colour: allClients.length == 1 ? "blue" : "red",
        x: allClients.length == 1 ? 200 : 760,
        y: PLATFORMHEIGHT,
        xVelocity: 0,
        yVelocity: 0,
        health: 100
    }
    socket.emit("playerDetails", socket.player);

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
    
    socket.on('disconnect', function() {
       console.log('Got disconnect!');
       var i = allClients.indexOf(socket);
       allClients.splice(i, 1);
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
    allClients.forEach(client => {
        client.player.x += client.player.xVelocity;
        client.player.y = Math.min(client.player.y + client.player.yVelocity, PLATFORMHEIGHT);
    });
}

calculateCollision = () => {
    if(allClients.length == 2 && COLLISIONCOOLDOWN == 0){
        if(Math.abs(allClients[0].player.x - allClients[1].player.x) <= PLAYERSIZE && Math.abs(allClients[0].player.y - allClients[1].player.y) <= PLAYERSIZE) {
            COLLISIONCOOLDOWN = 10;
            if(Math.abs(allClients[0].player.xVelocity) < Math.abs(allClients[1].player.xVelocity)){
                allClients[0].player.xVelocity = allClients[1].player.xVelocity + (SHUNTSPEED * Math.sign(allClients[1].player.xVelocity));
                allClients[0].player.health = Math.max(allClients[0].player.health - Math.abs(allClients[1].player.xVelocity), 0);
            } else if (Math.abs(allClients[0].player.xVelocity) == Math.abs(allClients[1].player.xVelocity)) {
                allClients[0].player.xVelocity = - allClients[0].player.xVelocity;
                allClients[1].player.xVelocity = - allClients[1].player.xVelocity;
                allClients[0].player.health = Math.max(allClients[0].player.health - 0.5 * Math.abs(allClients[0].player.xVelocity), 0);
                allClients[1].player.health = Math.max(allClients[1].player.health - 0.5 * Math.abs(allClients[1].player.xVelocity), 0);
            } else {
                allClients[1].player.xVelocity = allClients[0].player.xVelocity + (SHUNTSPEED * Math.sign(allClients[0].player.xVelocity));
                allClients[1].player.health = Math.max(allClients[1].player.health - Math.abs(allClients[0].player.xVelocity), 0);
            }
        }
    }
    COLLISIONCOOLDOWN = Math.max(0, COLLISIONCOOLDOWN - 1);
}

calculateEnd = () => {
    allClients.forEach(client => {
        if(client.player.health == 0){
            reset();
        }
    });
}

reset = () => {
    allClients.forEach((client, i)=> {
        client.player = {
            colour: i == 1 ? "blue" : "red",
            x: i == 1 ? 200 : 760,
            y: PLATFORMHEIGHT,
            xVelocity: 0,
            yVelocity: 0,
            health: 100
        }
    });
}

setInterval(() => {
    calculateSpeed();
    calculateMovement();
    calculateCollision();
    calculateEnd();
    io.emit("allPlayers", allClients.map(socket => socket.player));
}, 1000 / 60);

http.listen(process.env.PORT || 3001, () => {
  console.log('listening on *:3001');
});
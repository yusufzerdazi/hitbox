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
const WIDTH = 960;
const HEIGHT = 540;
const WALLDAMPING = 0.75;
var COLLISIONCOOLDOWN = 0;

var allClients = [];
io.on('connection', (socket) => {
    if(allClients >= 2) {
        return;
    }
    allClients.push(socket);
    console.log('Got connect.')

    socket.player = {
        colour: randomColor(),
        x: 100 + 100 * allClients.length,
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
       allClients[i].disconnected = true;
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
    allClients.forEach(client => {
        if(client.player.x < 0) {
            client.player.x = 0;
            client.player.xVelocity = -client.player.xVelocity * WALLDAMPING;
        }
        if(client.player.x > (WIDTH - PLAYERSIZE)) {
            client.player.x = WIDTH - PLAYERSIZE;
            client.player.xVelocity = -client.player.xVelocity * WALLDAMPING;;
        }
        if(client.player.y < 0) {
            client.player.y = 0;
            client.player.yVelocity = 0;
        }
    });
}

calculateCollision = () => {
    var wasCollision = false;
    if(COLLISIONCOOLDOWN == 0){
        allClients.forEach((client, i) => {
            allOtherClients = allClients.slice(i + 1, allClients.length);
            allOtherClients.forEach(otherClient => {
                if(Math.abs(client.player.x - otherClient.player.x) <= PLAYERSIZE && Math.abs(client.player.y - otherClient.player.y) <= PLAYERSIZE) {
                    COLLISIONCOOLDOWN = 10;
                    wasCollision = true;
                    if(Math.abs(client.player.xVelocity) < Math.abs(otherClient.player.xVelocity)){
                        client.player.xVelocity = otherClient.player.xVelocity + (SHUNTSPEED * Math.sign(otherClient.player.xVelocity));
                        client.player.health = Math.max(client.player.health - Math.abs(otherClient.player.xVelocity), 0);
                    } else if (Math.abs(client.player.xVelocity) == Math.abs(otherClient.player.xVelocity)) {
                        client.player.xVelocity = - client.player.xVelocity;
                        otherClient.player.xVelocity = - otherClient.player.xVelocity;
                        client.player.health = Math.max(client.player.health - 0.5 * Math.abs(client.player.xVelocity), 0);
                        otherClient.player.health = Math.max(otherClient.player.health - 0.5 * Math.abs(otherClient.player.xVelocity), 0);
                    } else {
                        otherClient.player.xVelocity = client.player.xVelocity + (SHUNTSPEED * Math.sign(client.player.xVelocity));
                        otherClient.player.health = Math.max(otherClient.player.health - Math.abs(client.player.xVelocity), 0);
                    }

                    if(client.player.y < otherClient.player.y){
                        client.player.yVelocity = - Math.abs(client.player.yVelocity);
                        otherClient.player.yVelocity = Math.abs(otherClient.player.yVelocity);
                    } else if(client.player.y > otherClient.player.y) {
                        client.player.yVelocity = Math.abs(client.player.yVelocity);
                        otherClient.player.yVelocity = - Math.abs(otherClient.player.yVelocity);
                    }
                }
            })
        });
    }
    COLLISIONCOOLDOWN = Math.max(0, COLLISIONCOOLDOWN - 1);
    return wasCollision;
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
            colour: client.player.colour,
            x: 100 + 150 * i,
            y: PLATFORMHEIGHT,
            xVelocity: 0,
            yVelocity: 0,
            health: 100
        }
    });
}

removeDisconnectedPlayers = () => {
    allClients = allClients.filter(client => !client.disconnected);
}

setInterval(() => {
    removeDisconnectedPlayers();
    calculateSpeed();
    calculateMovement();
    wasCollision = calculateCollision();
    if(wasCollision){
        io.emit("collision");
    }
    calculateEnd();
    io.emit("allPlayers", allClients.map(socket => socket.player));
}, 1000 / 60);

http.listen(process.env.PORT || 3001, () => {
  console.log('listening on *:3001');
});

var randomColor = () => "#000000".replace(/0/g,function(){return (~~(Math.random()*16)).toString(16);});
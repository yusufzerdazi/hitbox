var Player = require('./players/player');
var SimpleAi = require('./players/simpleAi');
var CleverAi = require('./players/cleverAi');
var Utils = require('./utils');
var BattleRoyale = require('./game/battleRoyale');
var Tag = require('./game/tag');
var FreeForAll = require('./game/freeForAll');
var Square = require('./square');
var Constants = require('./constants');

var GameModes = [FreeForAll, BattleRoyale, Tag];

const state = {
    STARTED: "started",
    STARTING: "starting"
};

class Game {
    constructor(level){
        this.clients = [];
        this.spectators = [];
        this.level = level;
        this.state = state.STARTING;
        this.aiEnabled = true;
        this.maxPlayers = 100;
        this.startingTicks = 0;
        this.ticks = 0;
        this.gameMode = new GameModes[Math.floor(Math.random() * GameModes.length)](this.clients, this.level, this.ticks);

        this.humanPlayers = () => { return this.clients.filter(c => c.player && !c.player.ai) }
        this.aiPlayers = () => { return this.clients.filter(c => c.player.ai) }
        this.livingPlayers = () => { return this.clients.filter(c => c.player.alive); }
        this.movingPlayers = () => { return this.livingPlayers().filter(c => !c.player.ducked); }
        this.vulnerablePlayers = () => { return this.livingPlayers().filter(c => c.player.invincibility == 0); }
        this.invulnerablePlayers = () => { return this.livingPlayers().filter(c => c.player.invincibility > 0); }
    }

    addSpectator(client){
        this.spectators.push(client);
        client.emit("level", this.level);
        this.addClientListeners(client);
    }

    removeSpectator(client){
        var matchingSpectator = this.spectators.filter(c => c == client);
        if(!matchingSpectator){
            return;
        }
        this.removeClientListeners(client);
        this.spectators = this.spectators.filter(c => c != client);
    }

    addClient(player, client){
        client.player = new Player(
            Utils.randomColor(),
            player.name,
            100 + Utils.getRandomInt(Constants.WIDTH - 200 - Constants.PLAYERWIDTH), 
            Constants.PLAYERHEIGHT + Utils.getRandomInt(Constants.HEIGHT / 2 - Constants.PLAYERHEIGHT)
        );
        this.clients.push(client);
        client.emit("level", this.level);
        client.emit("gameMode", {title:this.gameMode.title, subtitle:this.gameMode.subtitle});
        this.addClientListeners(client);
        this.gameMode.updateClients(this.clients);
    }

    removeClientListeners(client){
        client.removeAllListeners('right');
        client.removeAllListeners('boostRight');
        client.removeAllListeners('boostLeft');
        client.removeAllListeners('down');
        client.removeAllListeners('left');
        client.removeAllListeners('space');
        client.removeAllListeners('click');
        client.removeAllListeners('nameChange');
        client.removeAllListeners('quit');
        client.removeAllListeners('disconnect');
        client.removeAllListeners('addAi');
        client.removeAllListeners('addCleverAi');
        client.removeAllListeners('removeAi');
        client.removeAllListeners('toggleAi');
    }

    addClientListeners(client){    
        // Player actions
        client.on('right', pressed => {
            if(client.player) client.player.right = pressed;
        });
    
        client.on('boostRight', pressed => {
            if(this.state == state.STARTED && client.player) client.player.boostRight = true;
        });
    
        client.on('boostLeft', pressed => {
            if(this.state == state.STARTED && client.player) client.player.boostLeft = true;
        });
    
        client.on('down', pressed => {
            if(client.player) client.player.down = pressed;
        });
    
        client.on('left', pressed => {
            if(client.player) client.player.left = pressed;
        });
    
        client.on('space', pressed => {
            if(client.player) client.player.space = pressed;
        });
    
        client.on('click', () => {
            if(this.state == state.STARTED && client.player) client.player.clicked = true;
        });

        client.on('nameChange', (name) => {
            if(client.player) client.player.name = name;
        });

        client.on('quit', function() {
            if(client.player) client.player.disconnected = true;
        });

        client.on('disconnect', function() {
            if(client.player) client.player.disconnected = true;
        });
        
        // Game actions
        client.on('addAi', () =>{
            if(this.clients.filter(c => c.player).length == this.maxPlayers) {
                return;
            }
            if(Math.random() > 0.5){
                this.clients.push({
                    player: new SimpleAi(Utils.randomColor(),
                        Utils.generateName(),
                        100 + Utils.getRandomInt(Constants.WIDTH - 200 - Constants.PLAYERWIDTH), 
                        Constants.PLAYERHEIGHT + Utils.getRandomInt(Constants.HEIGHT / 2 - Constants.PLAYERHEIGHT))
                });
                this.gameMode.updateClients(this.clients);
            } else {
                this.clients.push({
                    player: new CleverAi(Utils.randomColor(),
                        Utils.generateName(),
                        100 + Utils.getRandomInt(Constants.WIDTH - 200 - Constants.PLAYERWIDTH), 
                        Constants.PLAYERHEIGHT + Utils.getRandomInt(Constants.HEIGHT / 2 - Constants.PLAYERHEIGHT))
                });
                this.gameMode.updateClients(this.clients);
            }
        });
    
        client.on('removeAi', () =>{
            var aiClients = this.aiPlayers();
            if(aiClients.length){
                aiClients[0].player.disconnected = true;
            }
        })
    
        client.on('toggleAi', function() {
            this.aiEnabled = !this.aiEnabled;
        });
    }

    emitToAllClients(event, eventData){
        var clients = this.humanPlayers().concat(this.spectators);
        clients.forEach(client => {
            client.emit(event, eventData);
        });
    }

    calculateSpeed() {
        this.clients.forEach(client => {
            if(client.player.boostRight && client.player.boostLeft){
                // do nothing
            } else if(client.player.boostRight && client.player.boostCooldown + Constants.BOOSTCOST <= 100){
                client.player.xVelocity = Constants.BOOSTSPEED;
                client.player.boostCooldown += Constants.BOOSTCOST;
            } else if(client.player.boostLeft && client.player.boostCooldown + Constants.BOOSTCOST <= 100){
                client.player.xVelocity = -Constants.BOOSTSPEED;
                client.player.boostCooldown += Constants.BOOSTCOST;
            } else if(client.player.clicked && client.player.boostRight == 0 && client.player.xVelocity != 0 && client.player.boostCooldown + Constants.BOOSTCOST <= 100){
                client.player.xVelocity = Constants.BOOSTSPEED * Math.sign(client.player.xVelocity);
                client.player.boostCooldown += Constants.BOOSTCOST;
            }

            if(client.player.down && client.player.onSurface.includes(true) && client.player.yVelocity >= 0){
                client.player.ducked = true;
                client.player.yVelocity = 0;
                client.player.boostCooldown = Math.max(client.player.boostCooldown, 20);
            } else {
                client.player.ducked = false;
            }
    
            if(client.player.down && client.player.boostCooldown + Constants.BOOSTCOST <= 100 && !client.player.onSurface.includes(true)){
                client.player.yVelocity = Constants.BOOSTSPEED;
                client.player.boostCooldown += Constants.BOOSTCOST;
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
                client.player.xVelocity = client.player.xVelocity * Constants.FRICTION;
            }
    
            client.player.boostCooldown = Math.max(client.player.boostCooldown - 1, 0);
            client.player.boostRight = false;
            client.player.boostLeft = false;
            client.player.boostDown = false;
            client.player.clicked = false;
    
            if(client.player.space && client.player.onSurface.includes(true)){
                client.player.yVelocity = -Constants.JUMPSPEED;
                client.player.space = false;
            }
            if(client.player.space && client.player.y != Constants.PLATFORMHEIGHT && client.player.boostCooldown + Constants.BOOSTCOST <= 100){
                client.player.yVelocity = -Constants.JUMPSPEED;
                client.player.boostCooldown += Constants.BOOSTCOST;
            }
            if(!client.player.right && !client.player.left){
                var velSign = Math.sign(client.player.xVelocity);
                var magnitude = Math.abs(client.player.xVelocity);
                var newMagnitude = Math.max(0, magnitude - Constants.ACCELERATION);
                client.player.xVelocity = newMagnitude * velSign;
            }
            if(client.player.y != Constants.PLATFORMHEIGHT || client.player.x + Constants.PLAYERHEIGHT < 100 || client.player.x > 860 || client.player.yVelocity < 0) {
                client.player.yVelocity += Constants.VERTICALACCELERATION;
            } else {
                client.player.yVelocity = 0;
            }
        })
    }
    
    calculateMovement() {
        this.movingPlayers().forEach(client => {
            var previouslyOnSurface = client.player.onSurface.includes(true);
            client.player.onSurface = [];
            this.level.forEach(level => {
                if(client.player.x >= level.rightX() &&
                        client.player.x + client.player.xVelocity < level.rightX() && 
                        client.player.y + client.player.yVelocity > level.topY() && 
                        client.player.y + client.player.yVelocity < (level.bottomY() + Constants.PLAYERHEIGHT)) {
                    client.player.x = level.rightX();
                    client.player.xVelocity = -client.player.xVelocity * Constants.WALLDAMPING;
                    this.emitToAllClients('hitWall');
                }

                if(client.player.x <= (level.leftX() - Constants.PLAYERWIDTH) &&
                        client.player.x + client.player.xVelocity > (level.leftX() - Constants.PLAYERWIDTH) && 
                        client.player.y + client.player.yVelocity > level.topY() && 
                        client.player.y + client.player.yVelocity < (level.bottomY() + Constants.PLAYERHEIGHT)) {
                    client.player.x = level.leftX() - Constants.PLAYERWIDTH;
                    client.player.xVelocity = -client.player.xVelocity * Constants.WALLDAMPING;;
                    this.emitToAllClients('hitWall');
                }
                if(client.player.y >= (level.bottomY() + Constants.PLAYERHEIGHT) && // Currently above platform
                        client.player.y + client.player.yVelocity <= (level.bottomY() + Constants.PLAYERHEIGHT) && // Will be below on next time step
                        client.player.x + client.player.xVelocity <= level.rightX() &&
                        client.player.x + client.player.xVelocity >= (level.leftX() - Constants.PLAYERWIDTH)) {
                    client.player.y = (level.bottomY() + Constants.PLAYERHEIGHT);
                    client.player.yVelocity = 0;
                    this.emitToAllClients('hitWall');
                }
                if(client.player.y <= level.topY() && // Currently above platform
                        client.player.y + client.player.yVelocity >= level.topY() && // Will be below on next time step
                        client.player.x + client.player.xVelocity <= level.rightX() &&
                        client.player.x + client.player.xVelocity >= (level.leftX() - Constants.PLAYERWIDTH)) {
                    client.player.y = level.topY();
                    client.player.yVelocity = 0;
                    client.player.onSurface.push(true);
                    if(!previouslyOnSurface){
                        this.emitToAllClients('hitWall');
                    }
                } else {
                    client.player.onSurface.push(false);
                }
            })
        });
        this.movingPlayers().forEach(client => {
            client.player.x += client.player.xVelocity;
            client.player.y = client.player.y+client.player.yVelocity
        });
    }
    
    isDamaged(player1, player2) {
        return !player1.ducked || player2.yVelocity > 0;
    }
    
    calculateCollision() {
        var wasCollision = false;
        var collisions = [];
        this.vulnerablePlayers().forEach(client => {
            this.movingPlayers().filter(c => c != client && c.player.invincibility == 0).forEach(otherClient=> {
                if(client.player.isCollision(otherClient.player) && this.isDamaged(client.player, otherClient.player)) {
                    wasCollision = true;

                    var clientSpeed = client.player.speed();
                    var otherClientSpeed = otherClient.player.speed();
                    var speedDifference = Math.abs(clientSpeed - otherClientSpeed);
                    
                    if(clientSpeed < otherClientSpeed){
                        if(this.gameMode.damageEnabled) client.player.health = Math.max(client.player.health - otherClientSpeed, 0);
                        if(client.player.health == 0){
                            if(!client.player.ai && !otherClient.player.ai) otherClient.emit("kill");
                        }
                        client.player.invincibility = 100;
                    } else if(speedDifference == 0){
                        if(this.gameMode.damageEnabled) client.player.health = Math.max(client.player.health - 0.5 * otherClientSpeed, 0);
                    }
    
                    if(Math.abs(client.player.xVelocity) < Math.abs(otherClient.player.xVelocity)){
                        client.player.newXVelocity = otherClient.player.xVelocity + (Constants.SHUNTSPEED * Math.sign(otherClient.player.xVelocity));
                    } else if (Math.abs(client.player.xVelocity) == Math.abs(otherClient.player.xVelocity)) {
                        var flip = Math.sign(client.player.xVelocity) * Math.sign(otherClient.player.xVelocity)
                        client.player.newXVelocity = flip * client.player.xVelocity;
                    }
    
                    if(client.player.ducked){
                        client.player.newYVelocity = - otherClient.player.yVelocity;
                        otherClient.player.newYVelocity = 0;
                    }else if(Math.abs(client.player.yVelocity) < Math.abs(otherClient.player.yVelocity)){
                        otherClient.player.newYVelocity = - otherClient.player.yVelocity;
                        client.player.newYVelocity = otherClient.player.yVelocity + (Constants.SHUNTSPEED * Math.sign(otherClient.player.yVelocity));
                    } else if (Math.abs(client.player.yVelocity) == Math.abs(otherClient.player.yVelocity)) {
                        var flip = Math.sign(client.player.yVelocity) * Math.sign(otherClient.player.yVelocity)
                        client.player.newYVelocity = flip * client.player.yVelocity;
                    }

                    if(this.clients.indexOf(client) < this.clients.indexOf(otherClient)){
                        collisions.push([client, otherClient]);
                    }
                }
            })
        });
        collisions.forEach(c => {
            this.gameMode.onCollision(c[0], c[1]);
        });
        this.livingPlayers().forEach(client => {
            if(client.player.newXVelocity){
                client.player.xVelocity = client.player.newXVelocity;
                client.player.newXVelocity = null;
            }
            if(client.player.newYVelocity){
                client.player.yVelocity = client.player.newYVelocity;
                client.player.newYVelocity = null;
            }
            if(client.player.y >= Constants.HEIGHT + Constants.PLAYERHEIGHT){
                client.player.health = 0;
            }
        })
        this.invulnerablePlayers().forEach((client, i) => {
            client.player.invincibility -= 20;
        });
        return wasCollision;
    }
    
    calculateEnd() {
        var endStatus = this.gameMode.endCondition(this.ticks);
        if(endStatus.end){
            if(endStatus.winner){
                endStatus.winner.player.score += 1;
                this.emitToAllClients('winner', endStatus.winner.player);
            }
            this.state = state.STARTING;
            this.startingTicks = this.ticks;
            this.reset();
        }
    }
    
    reset() {
        var positions = [];
        this.clients.forEach((client, i)=> {
            var newPosition;
            var anyCollision = true
            var onLand = false;

            while(anyCollision || !onLand){
                anyCollision = false;

                newPosition = {
                    x: -1000 + Utils.getRandomInt(2000 + Constants.WIDTH - Constants.PLAYERWIDTH),
                    y: -1000 + Constants.PLAYERHEIGHT + Utils.getRandomInt(1000 + Constants.PLATFORMHEIGHT - Constants.PLAYERHEIGHT)
                };

                for(var i = 0; i < positions.length; i++){
                    var xCollision = Math.abs((newPosition.x) - (positions[i].x)) <= Constants.PLAYERWIDTH + 20;
                    var yCollision = Math.abs((newPosition.y) - (positions[i].y)) <= Constants.PLAYERHEIGHT + 20;
                    if(xCollision && yCollision){
                        anyCollision = true;
                        break;
                    }
                };

                onLand = false;
                for(var i = 0; i < this.level.length; i++){
                    var xCollision = newPosition.x <= this.level[i].rightX() + 20 && newPosition.x >= (this.level[i].leftX() - Constants.PLAYERWIDTH) - 20;
                    var yCollision = newPosition.y >= this.level[i].topY() - 20 && newPosition.y <= (this.level[i].bottomY() + Constants.PLAYERHEIGHT) + 20;
                    if((xCollision && yCollision) || this.level[i].border && newPosition.y <= this.level[i].topY()){
                        anyCollision = true;
                        break;
                    }
                    if(xCollision && newPosition.y <= this.level[i].topY()){
                        onLand = true;
                    }
                };
            }
            positions.push(newPosition);
            client.player.reset(newPosition.x, newPosition.y);
        });
        this.gameMode = new GameModes[Math.floor(Math.random() * GameModes.length)](this.clients, this.level, this.ticks);
    }
    
    removeDisconnectedPlayers() {
        var disconnectedHumans = this.humanPlayers().filter(client => client.player.disconnected);
        this.clients = this.clients.filter(client => !client.player.disconnected);
        this.spectators = this.spectators.concat(disconnectedHumans);
        this.gameMode.updateClients(this.clients);
    }
    
    moveAi() {
        this.livingPlayers().filter(p => p.player.ai).forEach(ai => {
            var otherPlayers = this.livingPlayers().filter(p => p != ai).map(p => p.player);
            ai.player.move(otherPlayers, this.ticks);
        })
    }
    
    calculateDeadPlayers() {
        this.livingPlayers().forEach(client => {
            if(client.player.health == 0){
                client.player.alive = false;
                this.gameMode.onPlayerDeath(client);
            }
        });
    }

    calculateStartGame() {
        if(this.state == state.STARTING) {
            if(this.ticks - this.startingTicks > 60){
                this.state = state.STARTED;
            } else {
                this.emitToAllClients("gameMode", {title: this.gameMode.title, subtitle: this.gameMode.subtitle});
                this.emitToAllClients("starting", 60 - (this.ticks - this.startingTicks))
            }
        } else {
            this.state = state.STARTING;
            this.startingTicks = this.ticks;
        }
    }
    
    gameLoop() {
        setInterval(() => {
            this.removeDisconnectedPlayers();
            if(this.state == state.STARTED){
                this.calculateSpeed();
                this.calculateMovement();
                var wasCollision = this.calculateCollision();
                if(wasCollision){
                    this.emitToAllClients("collision");
                }
                if(this.aiEnabled){
                    this.moveAi();
                }
                this.calculateDeadPlayers();
                this.calculateEnd();
            } else {
                this.calculateStartGame();
            }
            this.emitToAllClients("allPlayers", this.clients.map(socket => socket.player));
            this.ticks++;
        }, 1000 / 60);
    }
}

module.exports = Game;
var EloRating = require('elo-rating');

var Player = require('./players/player');
var SimpleAi = require('./players/simpleAi');
var CleverAi = require('./players/cleverAi');
var RunningAi = require('./players/runningAi');
var Utils = require('./utils');
var BattleRoyale = require('./game/battleRoyale');
var Tag = require('./game/tag');
var FreeForAll = require('./game/freeForAll');
var DeathWall = require('./game/deathWall');
var CollectTheBoxes = require('./game/collectTheBoxes');
var Football = require('./game/football');
var CaptureTheFlag = require('./game/captureTheFlag');
var Square = require('./square');
var Constants = require('./constants');
var Utils = require('./utils');
var BISON = require('bisonjs');

var GameModes = {
    generic: [CaptureTheFlag, CollectTheBoxes, DeathWall, BattleRoyale, Tag, BattleRoyale, BattleRoyale, Football],
    football: [Football]
};

const state = {
    STARTED: "started",
    STARTING: "starting"
};

class Game {
    constructor(room){
        this.room = room;
        this.clients = [];
        this.spectators = [];
        this.state = state.STARTING;
        this.aiEnabled = true;
        this.maxPlayers = 100;
        this.startingTicks = 0;
        this.ticks = 0;
        
        this.gameMode = new GameModes[GameModes[this.room] ? this.room : "generic"][Math.floor(Math.random() * GameModes[GameModes[this.room] ? this.room : "generic"].length)](this.clients, this.ticks, (v1, v2) =>this.emitToAllClients(v1,v2,this));

        this.players = () => { return this.clients.filter(c => !c.player.orb && !["ball","flag"].includes(c.player.type)) }
        this.humanPlayers = () => { return this.clients.filter(c => c.player && !c.player.ai) }
        this.aiPlayers = () => { return this.clients.filter(c => c.player.ai && !c.player.orb && !["ball","flag"].includes(c.player.type)) }
        this.livingPlayers = () => { return this.clients.filter(c => c.player.alive); }
        this.movingPlayers = () => { return this.livingPlayers().filter(c => !c.player.ducked && !c.player.attachedToPlayer); }
        this.attachedPlayers = () => { return this.livingPlayers().filter(c => c.player.attachedToPlayer); }
        this.vulnerablePlayers = () => { return this.livingPlayers().filter(c => c.player.invincibility == 0 && !c.player.attachedToPlayer); }
        this.invulnerablePlayers = () => { return this.livingPlayers().filter(c => c.player.invincibility > 0); }
    }

    addSpectator(client){
        this.spectators.push(client);
        client.emit("level", this.gameMode.level.platforms);
        this.addClientListeners(client);
    }

    removeSpectator(client){
        var existingClient = this.clients.indexOf(client);
        var existingSpectator = this.spectators.indexOf(client);
        if(existingClient !== -1 || existingSpectator === -1){
            return;
        }
        this.removeClientListeners(client);
        this.spectators = this.spectators.filter(c => c != client);
    }

    addClient(player, client){
        var existingClient = this.clients.filter(c => c.player.name == player.user.name);
        if(existingClient.length !== 0){
            return;
        }
        client.player = new Player(
            Utils.randomColor(),
            player.user.name, null, null, false,
            player.user.id,
            player.rank);
        client.player.respawn(this.clients, this.gameMode.level);
        this.clients.push(client);

        this.addLonelyAiPlayer();

        client.emit("level", this.gameMode.level.platforms);
        client.emit("gameMode", {title:this.gameMode.title, subtitle:this.gameMode.subtitle});
        this.addClientListeners(client);
        this.gameMode.updateClients(this.clients);
    }

    addLonelyAiPlayer(){
        if(this.humanPlayers().length == 1 && this.aiPlayers().length == 0){
            this.addAiPlayer();
        } else if(this.humanPlayers().length > 1 && this.aiPlayers().length > 0){
            this.removeAiPlayer();
        }
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

        client.on('changeAvatar', (avatar) => {
            this.emitToAllClients('changeAvatar', {
                name: avatar.name,
                url: avatar.url
            });
        });

        client.on('quit', function() {
            if(client.player) client.player.disconnected = true;
        });

        client.on('disconnect', function() {
            if(client.player) client.player.disconnected = true;
        });
        
        // Game actions
        client.on('addAi', () =>{
            this.addAiPlayer();
        });
    
        client.on('removeAi', () =>{
            this.removeAiPlayer();
        })
    
        client.on('toggleAi', function() {
            this.aiEnabled = !this.aiEnabled;
        });
    }

    addAiPlayer(){
        if(this.clients.filter(c => c.player).length == this.maxPlayers) {
            return;
        }
        var ai = null;
        if(this.gameMode.title == "Death Wall"){
            ai = new RunningAi(Utils.randomColor(),
            Utils.generateName())
        } else if(Math.random() > 0.5){
            ai = new SimpleAi(Utils.randomColor(),
                Utils.generateName())
        } else {
            ai = new CleverAi(Utils.randomColor(),
                Utils.generateName());
        }
        this.clients.push({
            player: ai
        });
        ai.respawn(this.clients, this.gameMode.level);
        this.gameMode.updateClients(this.clients);
    }

    removeAiPlayer(){
        var aiClients = this.aiPlayers();
        if(aiClients.length){
            aiClients[0].player.disconnected = true;
        }
    }

    emitToAllClients(event, eventData, context = this){
        var clients = context.humanPlayers().concat(context.spectators).filter(c => !c.player || !c.player.ai);
        clients.forEach(client => {
            client.emit(event, eventData);
        });
    }

    calculateSpeed() {
        this.clients.forEach(client => {
            if(client.player.boostRight && client.player.boostLeft){
                // do nothing
            } else if(client.player.boostRight && client.player.boostCooldown + Constants.BOOSTCOST <= 100 && client.player.alive){
                client.player.xVelocity = Constants.BOOSTSPEED;
                client.player.boostCooldown += Constants.BOOSTCOST;
                this.emitToAllClients("boost", {name: client.player.name, direction: 'right'});
            } else if(client.player.boostLeft && client.player.boostCooldown + Constants.BOOSTCOST <= 100 && client.player.alive){
                client.player.xVelocity = -Constants.BOOSTSPEED;
                client.player.boostCooldown += Constants.BOOSTCOST;
                this.emitToAllClients("boost", {name: client.player.name, direction: 'left'});
            } else if(client.player.clicked && client.player.boostRight == 0 && client.player.xVelocity != 0 && client.player.boostCooldown + Constants.BOOSTCOST <= 100 && client.player.alive){
                client.player.xVelocity = Constants.BOOSTSPEED * Math.sign(client.player.xVelocity);
                client.player.boostCooldown += Constants.BOOSTCOST;
                this.emitToAllClients("boost", {name: client.player.name, direction: client.player.xVelocity > 0 ? 'right' : 'left'});
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
                this.emitToAllClients("boost", {name: client.player.name, direction: 'down', timestamp: Utils.millis()});
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
            var inAirBoostCooldown = (!client.player.onSurface.includes(true) ? this.gameMode.level.inAirBoostCooldown || 1 : 1);
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
                client.player.yVelocity += Constants.VERTICALACCELERATION * this.gameMode.level.gravity;
            } else {
                client.player.yVelocity = 0;
            }

            if(client.player.angularVelocity){
                client.player.angularVelocity = client.player.angularVelocity * 0.99;
            }
        })
    }
    
    calculateMovement() {
        this.movingPlayers().forEach(client => client.player.attachedPlayers = 0);
        this.attachedPlayers().forEach(client => {
            var attachedPlayer = this.movingPlayers().filter(p => p.player.name == client.player.attachedToPlayer)[0];
            if(!attachedPlayer) {
                client.player.attachedToPlayer = null;
                client.player.invincibility = 1000;
                return;
            }
            attachedPlayer.player.attachedPlayers = (attachedPlayer.player.attachedPlayers | 0) + 1
            client.player.x = attachedPlayer.player.x;
            client.player.y = attachedPlayer.player.y - 100 * attachedPlayer.player.attachedPlayers;
        });

        this.movingPlayers().forEach(client => {
            var previouslyOnSurface = client.player.onSurface.includes(true);
            var currentSpeed = client.player.speed();
            client.player.onSurface = [];
            this.gameMode.level.platforms.filter(x => x.type != "goal").forEach(platform => {
                if(client.player.x >= platform.rightX() &&
                        client.player.x + client.player.xVelocity < platform.rightX() && 
                        client.player.y + client.player.yVelocity > platform.topY() && 
                        client.player.y + client.player.yVelocity < (platform.bottomY() + client.player.height)) {
                    client.player.x = platform.rightX();
                    client.player.xVelocity = -client.player.xVelocity * Constants.WALLDAMPING;
                    this.emitToAllClients('hitWall', { 
                        hitType: 'leftWall', 
                        location: {x: client.player.x, y: client.player.y}, 
                        speed: currentSpeed,
                        size: {
                            width: client.player.width,
                            height: client.player.height
                        }
                    });
                }

                if(client.player.x <= (platform.leftX() - client.player.width) &&
                        client.player.x + client.player.xVelocity > (platform.leftX() - client.player.width) && 
                        client.player.y + client.player.yVelocity > platform.topY() && 
                        client.player.y + client.player.yVelocity < (platform.bottomY() + client.player.height)) {
                    client.player.x = platform.leftX() - client.player.width;
                    client.player.xVelocity = -client.player.xVelocity * Constants.WALLDAMPING;;
                    this.emitToAllClients('hitWall', { 
                        hitType: 'rightWall', 
                        location: {x: client.player.x, y: client.player.y}, 
                        speed: currentSpeed,
                        size: {
                            width: client.player.width,
                            height: client.player.height
                        }
                    });
                }
                if(client.player.y >= (platform.bottomY() + client.player.height) && // Currently above platform
                        client.player.y + client.player.yVelocity <= (platform.bottomY() + client.player.height) && // Will be below on next time step
                        client.player.x + client.player.xVelocity <= platform.rightX() &&
                        client.player.x + client.player.xVelocity >= (platform.leftX() - client.player.width)) {
                    client.player.y = (platform.bottomY() + client.player.height);
                    client.player.yVelocity = 0;
                    this.emitToAllClients('hitWall', { 
                        hitType: 'ceiling', 
                        location: {x: client.player.x, y: client.player.y}, 
                        speed: currentSpeed,
                        size: {
                            width: client.player.width,
                            height: client.player.height
                        }
                    });
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
                        this.emitToAllClients('hitWall', { 
                            hitType: 'floor', 
                            location: {x: client.player.x, y: client.player.y}, 
                            speed: currentSpeed,
                            size: {
                                width: client.player.width,
                                height: client.player.height
                            }
                        });
                    }
                } else {
                    client.player.onSurface.push(false);
                }

                if(client.player.angularVelocity){
                    client.player.angle += client.player.angularVelocity;
                }
            });
        });
        this.movingPlayers().forEach(client => {
            client.player.x += client.player.xVelocity;
            client.player.y = client.player.y+client.player.yVelocity
        });
    }
    
    isDamaged(player1, player2) {
        return !player1.ducked || player2.yVelocity > 0;
    }

    getCollisionType(collision){
        var collisionType = "player";
        collision.forEach(client => {
            if(client.player.orb || client.player.it || client.player.type == "flag"){
                collisionType = "box";
            }
            if(client.player.type == "ball"){
                collisionType = "football";
            }
        })
        return collisionType;
    }

    getCollisionLocation(collision){
        var ball = collision.filter(c => c.player.type == "ball");
        var notBall = collision.filter(c => c.player.type != "ball");
        if(ball[0]){
            var ballCenter = {
                x: ball[0].player.x + Constants.BALLWIDTH / 2,
                y: ball[0].player.y - Constants.BALLWIDTH / 2,
            };
            var playerCenter = {
                x: notBall[0].player.x + Constants.PLAYERWIDTH / 2,
                y: notBall[0].player.y - Constants.PLAYERHEIGHT / 2,
            };
            var angle = Math.atan2(playerCenter.y - ballCenter.y, playerCenter.x - ballCenter.x);
            return {
                x: ballCenter.x + Math.cos(angle) * Constants.BALLWIDTH / 2,
                y: ballCenter.y + Math.sin(angle) * Constants.BALLWIDTH / 2
            }
        } else {
            return {
                x: (collision[0].player.x + collision[1].player.x + Constants.PLAYERWIDTH) / 2,
                y: (collision[0].player.y + collision[1].player.y - Constants.PLAYERHEIGHT) / 2
            }
        }
    }
    
    calculateCollision() {
        var collisions = [];
        this.vulnerablePlayers().forEach(client => {
            this.movingPlayers().filter(c => c != client && c.player.invincibility == 0).forEach(otherClient=> {
                if(client.player.isCollision(otherClient.player) && this.isDamaged(client.player, otherClient.player)) {
                    var clientSpeed = client.player.speed();
                    var otherClientSpeed = otherClient.player.speed();
                    var speedDifference = Math.abs(clientSpeed - otherClientSpeed);
                    
                    if(clientSpeed < otherClientSpeed){
                        if(this.gameMode.damageEnabled && !["ball","flag"].includes(client.player.type) && !["ball","flag"].includes(otherClient.player.type)) {
                            client.player.health = Math.max(client.player.health - (this.gameMode.playerDamage ? this.gameMode.playerDamage : otherClientSpeed), 0);
                        }
                        if(client.player.health == 0){
                            if(!client.player.ai && !otherClient.player.ai && !client.player.orb && !otherClient.player.orb){
                                client.emit("death");
                                otherClient.emit("kill");
                            }
                            client.player.death();
                            this.emitToAllClients("event", {
                                type: "death",
                                timestamp: Utils.millis(),
                                causeOfDeath: "murder",
                                method: Constants.DEATHMETHODS[Math.floor(Math.random() * Constants.DEATHMETHODS.length)],
                                killed: {
                                    name: client.player.name,
                                    colour: client.player.colour
                                },
                                location: {
                                    x: client.player.x,
                                    y: client.player.y
                                },
                                killer: {
                                    name: otherClient.player.name,
                                    colour: otherClient.player.colour
                                }
                            });
                        }
                        client.player.invincibility = 100;
                    } else if(speedDifference == 0){
                        if(this.gameMode.damageEnabled) client.player.health = Math.max(client.player.health - (this.gameMode.playerDamage ? 0 : 0.5 * otherClientSpeed), 0);
                    }
    
                    if(Math.abs(client.player.xVelocity) < Math.abs(otherClient.player.xVelocity)){
                        client.player.newXVelocity = otherClient.player.xVelocity + (Constants.SHUNTSPEED * Math.sign(otherClient.player.xVelocity));
                    } else if (Math.abs(client.player.xVelocity) == Math.abs(otherClient.player.xVelocity)) {
                        var flip = Math.sign(client.player.xVelocity) * Math.sign(otherClient.player.xVelocity)
                        client.player.newXVelocity = flip * client.player.xVelocity;
                    }
    
                    if(client.player.ducked){
                        client.player.newYVelocity = - Math.min(otherClient.player.yVelocity, Constants.JUMPSPEED);
                        client.player.boostCooldown = Math.min(100, client.player.boostCooldown + 80);
                        //client.player.y = client.player.y - Constants.PLAYERHEIGHT
                        otherClient.player.newYVelocity = 0;
                    }else if(Math.abs(client.player.yVelocity) < Math.abs(otherClient.player.yVelocity)){
                        otherClient.player.newYVelocity = - Math.min(otherClient.player.yVelocity, Constants.JUMPSPEED);
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
            this.emitToAllClients("collision", {
                type: this.getCollisionType(c),
                location: this.getCollisionLocation(c),
                speed: Math.max(c[0].player.speed(), c[1].player.speed())
            });
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
                client.player.death();
                this.emitToAllClients("event", {
                    type: "death",
                    timestamp: Utils.millis(),
                    causeOfDeath: "water",
                    killed: {
                        name: client.player.name,
                        colour: client.player.colour
                    },
                    location: {
                        x: client.player.x,
                        y: client.player.y
                    },
                    method: Constants.SUICIDEMETHODS[Math.floor(Math.random() * Constants.SUICIDEMETHODS.length)]
                });
            }
        })
        this.invulnerablePlayers().forEach((client, i) => {
            client.player.invincibility -= 20;
        });
    }
    
    calculateEnd() {
        var endStatus = this.gameMode.endCondition(this.ticks);
        if(endStatus.end){
            if(endStatus.winner){
                if(this.aiPlayers().length == 0 && this.clients.filter(c => c.player.name == endStatus.winner.player.name).length > 0){
                    var eloRatingChanges = {};
                    var beatenPlayers = this.players().filter(c => c.player.name != endStatus.winner.player.name);
                    endStatus.winner.emit("beaten", beatenPlayers.length);
                    endStatus.winner.emit("win");
                    beatenPlayers.forEach(c => {
                        var newElo = EloRating.calculate(endStatus.winner.player.rank || 1000, c.player.rank || 1000);
                        eloRatingChanges[endStatus.winner.player.name] = (eloRatingChanges[endStatus.winner.player.name] || 0) + (newElo.playerRating - (endStatus.winner.player.rank || 1000));
                        eloRatingChanges[c.player.name] = (newElo.opponentRating - c.player.rank || 1000);
                        c.emit("loss");
                    });
                    for(var key in eloRatingChanges){
                        var client = this.clients.filter(c => c.player.name == key)[0];
                        client.player.rank = (client.player.rank || 1000) + eloRatingChanges[key];
                        client.emit("rank", client.player.rank);
                    }
                }
                endStatus.winner.player.score += 1;
                this.emitToAllClients('winner', endStatus.winner.player);
            }
            else if(endStatus.winners){
                if(this.aiPlayers().length == 0){
                    var eloRatingChanges = {};
                    endStatus.winners.forEach(w => {
                        endStatus.losers.forEach(l => {
                            var newElo = EloRating.calculate(w.player.rank || 1000, l.player.rank || 1000);
                            eloRatingChanges[w.player.name] = (eloRatingChanges[w.player.name] || 0) + (newElo.playerRating - (w.player.rank || 1000));
                            eloRatingChanges[l.player.name] = (eloRatingChanges[l.player.name] || 0) + (newElo.opponentRating - (l.player.rank || 1000));
                        });
                    });
                    endStatus.winners.forEach(w => {
                        w.player.rank = (w.player.rank || 1000) + eloRatingChanges[w.player.name] / endStatus.losers.length;
                        w.emit("rank", w.player.rank);
                        w.emit("win");
                    });
                    endStatus.losers.forEach(l => {
                        l.player.rank = (l.player.rank || 1000) + eloRatingChanges[l.player.name] / endStatus.winners.length;
                        l.emit("rank", l.player.rank);
                        l.emit("loss");
                    });
                }
                endStatus.winners.forEach(w => {
                    w.player.score += 1;
                });
                this.emitToAllClients('winner', {name: endStatus.winningTeam + " team"});
            }
            else {
                this.emitToAllClients('winner', null);
            }
            this.state = state.STARTING;
            this.startingTicks = this.ticks;
            this.reset();
            this.emitToAllClients('newGame', this.clients.map(socket => this.mapSocketToPlayer(socket)));
        }
    }
    
    reset() {
        var positions = [];
        var aiPlayers = this.aiPlayers();
        this.clients = this.humanPlayers().concat(aiPlayers);
        this.gameMode = new GameModes[this.room ? this.room : "generic"][Math.floor(Math.random() * GameModes[this.room ? this.room : "generic"].length)](this.clients, this.ticks, (v1, v2) =>this.emitToAllClients(v1,v2,this));
        this.clients.forEach((client, i)=> {
            if(client.player.type == "flag"){
                return;
            }
            client.player.respawn(this.clients, this.gameMode.level);
            positions.push({x: client.player.x, y: client.player.y});
        });
    }
    
    removeDisconnectedPlayers() {
        var disconnectedHumans = this.humanPlayers().filter(client => client.player.disconnected);
        this.clients = this.clients.filter(client => !client.player.disconnected);
        if(disconnectedHumans.length > 0){
            this.addLonelyAiPlayer();
        }
        this.spectators = this.spectators.concat(disconnectedHumans);
        this.gameMode.updateClients(this.clients);
    }
    
    moveAi() {
        this.livingPlayers().filter(p => p.player.ai).forEach(ai => {
            var otherPlayers = this.livingPlayers().filter(p => p != ai).map(p => p.player);
            ai.player.move(otherPlayers, this.ticks, this.gameMode.level);
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
            if(this.ticks - this.startingTicks > 100){
                this.state = state.STARTED;
            } else {
                this.emitToAllClients("gameMode", {title: this.gameMode.title, subtitle: this.gameMode.subtitle});
                this.emitToAllClients("starting", 100 - (this.ticks - this.startingTicks));
                this.emitToAllClients("level", this.gameMode.level.platforms);
                this.emitToAllClients("scale", this.gameMode.level.scale);
            }
        } else {
            this.state = state.STARTING;
            this.startingTicks = this.ticks;
        }
    }

    mapSocketToPlayer(socket){
        return [
            socket.player.name,
            parseInt(socket.player.x),
            parseInt(socket.player.y),
            parseInt(socket.player.xVelocity),
            parseInt(socket.player.yVelocity),
            socket.player.it,
            socket.player.lives,
            parseInt(socket.player.health),
            parseInt(socket.player.boostCooldown),
            socket.player.alive,
            socket.player.ducked,
            parseInt(socket.player.invincibility),
            socket.player.colour,
            socket.player.score,
            socket.player.orb,
            socket.player.id,
            socket.player.type,
            socket.player.team,
            socket.player.angle,
            socket.player.width,
            socket.player.height
        ]
    }
    
    gameLoop() {
        setInterval(() => {
            this.removeDisconnectedPlayers();
            if(this.state == state.STARTED){
                this.calculateSpeed();
                this.calculateMovement();
                this.calculateCollision();
                if(this.aiEnabled){
                    this.moveAi();
                }
                this.calculateDeadPlayers();
                this.calculateEnd();
            } else {
                this.calculateStartGame();
            }
            var redrawLevel = this.gameMode.onTick();
            if(redrawLevel){
                this.emitToAllClients("level", this.gameMode.level.platforms);
            }
            if(this.gameMode.title == "Tag"){
                this.emitToAllClients("gameCountdown", (this.gameMode.startingTicks + this.gameMode.gameLength) - this.ticks);
            }
            this.ticks++;
        }, 1000 / 60);

        setInterval(() => {
            var runningPlayers = this.movingPlayers().reduce((acc, cur) => {
                return acc + (cur.player.type != "ball" && cur.player.onSurface.includes(true) && cur.player.xVelocity != 0)
            }, 0);
            this.emitToAllClients("allPlayers", [
                runningPlayers,
                this.clients.map(socket => this.mapSocketToPlayer(socket)),
                this.gameMode.title == "Death Wall" ? {
                    deathWallX: this.gameMode.deathWallX,
                    levelMaxDistance: this.gameMode.level.maxDistance,
                    maxDistance: this.gameMode.maxDistance
                } : this.gameMode.title == "Football" ? 
                this.gameMode.scores : 
                {}
            ]);
        }, 1000 / 60);
    }
}

module.exports = Game;
const EloRating = require('elo-rating');

const Player = require('./players/player');
const SimpleAi = require('./players/simpleAi');
const CleverAi = require('./players/cleverAi');
const RunningAi = require('./players/runningAi');
const Utils = require('./utils');
const BattleRoyale = require('./game/battleRoyale');
const Tag = require('./game/tag');
const DeathWall = require('./game/deathWall');
const CollectTheBoxes = require('./game/collectTheBoxes');
const Football = require('./game/football');
const CaptureTheFlag = require('./game/captureTheFlag');
const Physics = require('./physics/physics');
const PlayerTypes = require('./players/playerTypes');

const GameModes = {
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

        this.physics = new Physics();
        
        this.gameMode = new GameModes[GameModes[this.room] ? this.room : "generic"]
            [Math.floor(Math.random() * GameModes[GameModes[this.room] ? this.room : "generic"].length)]
            (this.clients, this.ticks, (v1, v2) =>this.emitToAllClients(v1,v2,this));
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
        if(PlayerTypes.humanPlayers(this.clients).length == 1 && PlayerTypes.aiPlayers(this.clients).length == 0){
            this.addAiPlayer();
        } else if(PlayerTypes.humanPlayers(this.clients).length > 1 && PlayerTypes.aiPlayers(this.clients).length > 0){
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
        var aiClients = PlayerTypes.aiPlayers(this.clients);
        if(aiClients.length){
            aiClients[0].player.disconnected = true;
        }
    }

    emitToAllClients(event, eventData, context = this){
        var clients = PlayerTypes.humanPlayers(context.clients).concat(context.spectators).filter(c => !c.player || !c.player.ai);
        clients.forEach(client => {
            client.emit(event, eventData);
        });
    }

    calculateEnd() {
        var endStatus = this.gameMode.endCondition(this.ticks);
        if(endStatus.end){
            if(endStatus.winner){
                if(PlayerTypes.aiPlayers(this.clients).length == 0 && this.clients.filter(c => c.player.name == endStatus.winner.player.name).length > 0){
                    var eloRatingChanges = {};
                    var beatenPlayers = PlayerTypes.players(this.clients).filter(c => c.player.name != endStatus.winner.player.name);
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
                if(PlayerTypes.aiPlayers(this.clients).length == 0){
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
        var aiPlayers = PlayerTypes.aiPlayers(this.clients);
        this.clients = PlayerTypes.humanPlayers(this.clients).concat(aiPlayers);
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
        var disconnectedHumans = PlayerTypes.humanPlayers(this.clients).filter(client => client.player.disconnected);
        this.clients = this.clients.filter(client => !client.player.disconnected);
        if(disconnectedHumans.length > 0){
            this.addLonelyAiPlayer();
        }
        this.spectators = this.spectators.concat(disconnectedHumans);
        this.gameMode.updateClients(this.clients);
    }
    
    moveAi() {
        PlayerTypes.livingPlayers(this.clients).filter(p => p.player.ai).forEach(ai => {
            var otherPlayers = PlayerTypes.livingPlayers(this.clients).filter(p => p != ai).map(p => p.player);
            ai.player.move(otherPlayers, this.ticks, this.gameMode.level);
        })
    }
    
    calculateDeadPlayers() {
        PlayerTypes.livingPlayers(this.clients).forEach(client => {
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
                var messages = this.physics.calculate(this.clients, this.gameMode);
                messages.forEach(m => this.emitToAllClients(m[0], m[1]));
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
            var runningPlayers = PlayerTypes.movingPlayers(this.clients).reduce((acc, cur) => {
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
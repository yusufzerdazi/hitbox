import io from 'socket.io-client';
import * as THREE from 'three';

import ow1 from '../assets/sounds/ow1.mp3';
import ow2 from '../assets/sounds/ow2.mp3';
import ow4 from '../assets/sounds/ow4.mp3';
import ow5 from '../assets/sounds/ow5.mp3';
import whoosh from '../assets/sounds/whoosh.mp3';
import hit from '../assets/sounds/hit.mp3';
import thwack from '../assets/sounds/thwack.mp3';
import running from '../assets/sounds/running.mp3';
import wall from '../assets/sounds/wall.mp3';
import box from '../assets/sounds/box.mp3';
import football from '../assets/sounds/football.mp3';
import bigFootball from '../assets/sounds/football2.mp3';
import splash from '../assets/sounds/splash.mp3';
import { Client } from "colyseus.js";

import Utils from '../utils';

const OW = [ow1, ow2, ow4, ow5];

class GameService {
    constructor(){
        this.client = new Client(process.env.REACT_APP_SERVER);
        this.listener = new THREE.AudioListener();
        this.players = [];
        this.mounted = false;
        this.soundEnabled = true;
        this.aPressed = false;
        this.ePressed = false;
        this.aMillis = 0;
        this.eMillis = 0;
        this.showGui = true;

        this.wallSound = [new THREE.Audio(this.listener), new THREE.Audio(this.listener), new THREE.Audio(this.listener)];
        this.playerSound = [new THREE.Audio(this.listener), new THREE.Audio(this.listener), new THREE.Audio(this.listener)];
        this.thwackSound = new THREE.Audio(this.listener);
        this.owSound = [new THREE.Audio(this.listener), new THREE.Audio(this.listener), new THREE.Audio(this.listener), new THREE.Audio(this.listener)];
        this.bgMusic = new THREE.Audio(this.listener);
        this.boxSound = new THREE.Audio(this.listener);
        this.footballSound = new THREE.Audio(this.listener);
        this.splashSound = [new THREE.Audio(this.listener), new THREE.Audio(this.listener), new THREE.Audio(this.listener)];
        this.bigFootballSound = new THREE.Audio(this.listener);
        this.whooshSound = [new THREE.Audio(this.listener), new THREE.Audio(this.listener), new THREE.Audio(this.listener)];
        this.runningSound = [new THREE.Audio(this.listener), new THREE.Audio(this.listener), new THREE.Audio(this.listener)];
        this.audioLoader = new THREE.AudioLoader();

        var $this = this;

        this.audioLoader.load(box, function(buffer){
            $this.boxSound.setBuffer(buffer);
            $this.boxSound.setVolume(0.1);
        });
        
        this.audioLoader.load(football, function(buffer){
            $this.footballSound.setBuffer(buffer);
            $this.footballSound.setVolume(0.1);
        });

        this.splashSound.forEach((w, i) => {
            this.audioLoader.load(splash, function(buffer){
                w.setBuffer(buffer);
                w.setVolume(0.1);
                w.playbackRate = 0.9 + i * 0.1;
            });
        });
        
        this.audioLoader.load(bigFootball, function(buffer){
            $this.bigFootballSound.setBuffer(buffer);
            $this.bigFootballSound.setVolume(0.1);
        });

        this.audioLoader.load(thwack, function(buffer){
            $this.thwackSound.setBuffer(buffer);
            $this.thwackSound.setVolume(0.1);
        });

        this.whooshSound.forEach((w, i) => {
            this.audioLoader.load(whoosh, function(buffer){
                w.setBuffer(buffer);
                w.setVolume(0.05);
                w.playbackRate = 0.9 + i * 0.1;
            });
        });

        this.runningSound.forEach((w, i) => {
            this.audioLoader.load(running, function(buffer){
                w.setBuffer(buffer);
                w.setVolume(0.3);
                w.setLoop(true);
                w.playbackRate = 0.9 + i * 0.1;
            });
        });

        this.wallSound.forEach((ws, i) => {
            this.audioLoader.load(wall, function (buffer) {
                ws.setBuffer(buffer);
                ws.duration = 0.1;
                ws.setVolume(0.2);
                ws.playbackRate = 0.9 + i * 0.1;
            });
        });

        this.owSound.forEach((ow, i) => {
            this.audioLoader.load(OW[i], function (buffer) {
                ow.setBuffer(buffer);
                ow.setVolume(0.07);
            });
        });

        this.playerSound.forEach((ps, i) => {
            this.audioLoader.load(hit, function (buffer) {
                ps.setBuffer(buffer);
                ps.duration = 0.1;
                ps.setVolume(1/$this.playerSound.length);
                ps.playbackRate = 0.9 + i * 0.1;
            });
        });

        this.onIsScaledCallback = () => {};

        // Track active listeners for cleanup
        this.keydownListener = null;
        this.keyupListener = null;
        this.roomListeners = new Map();
    }
        

    setMounted(mounted){
        this.mounted = mounted;
        return this;
    }

    setCanvas(canvas){
        this.canvasRef = canvas;
        return this;
    }

    addListeners(){
        // Clean up any existing listeners first
        this.cleanupListeners();

        // Add room message listeners
        this.addRoomListener('collision', (collision) => {
            if (this.soundEnabled && this.mounted) {
                var collisionEvent = {
                    ...collision,
                    type: "collision"
                };
                
                switch(collision.type){
                    case "player":
                        if(collision.speed < 30 ? this.playerHit() : this.playSound(this.thwackSound)){
                            this.canvasRef.current.event(collisionEvent);
                        }
                        break;
                    case "box":
                        if(this.playSound(this.boxSound)){
                            this.canvasRef.current.event(collisionEvent);
                        }
                        break;
                    case "football":
                        if(this.footballHit(collision.speed >= 30)){
                            this.canvasRef.current.event(collisionEvent);
                        }
                        break;
                    default:
                        break;
                }
            }
        });

        this.addRoomListener('hitWall', (hit) => {
            if (this.soundEnabled && this.mounted) {
                this.playSound(this.wallSound);
                var hitEvent = {
                    ...hit,
                    type: "hit"
                };
                this.canvasRef.current.event(hitEvent);
            }
        });

        this.addRoomListener('boost', (boost) => {
            var boostEvent = {
                ...boost,
                type: "boost"
            };
            if (this.soundEnabled && this.mounted) {
                this.playSound(this.whooshSound);
                this.canvasRef.current.event(boostEvent);
            }
        });

        this.addRoomListener('winner', (winner) => {
            if (this.mounted){
                this.lastWinner = winner;
            }
        });

        this.addRoomListener('starting', (timer) => {
            if (this.mounted){
                this.canvasRef.current.setCountdown(timer ? timer : "");
            }
        });

        this.addRoomListener('gameMode', (gameMode) => {
            if(this.mounted){
                this.canvasRef.current.setGameMode(gameMode);
            }
        });
        
        this.addRoomListener('gameCountdown', (gameCountdown) => {
            if(this.mounted){
                this.canvasRef.current.updateGameCountdown(gameCountdown);
            }
        });

        this.addRoomListener('scale', (scale) => {
            if(this.mounted && scale){
                this.canvasRef.current.setScale(scale);
            }
        });

        this.addRoomListener('event', (event) => {
            if(this.mounted){
                this.canvasRef.current.event(event);
                if(event.type === "death" && event.causeOfDeath === "water"){
                    this.playSound(this.splashSound);
                }
            }
        });

        this.addRoomListener('newGame', (players) => {
            if(this.mounted){
                this.canvasRef.current.newGame(players);
            }
        });

        this.addRoomListener('changeAvatar', (avatar) => {
            if(this.mounted){
                this.canvasRef.current.changeAvatar(avatar);
            }
        });

        this.addRoomListener('isScaled', (isScaled) => {
            if (this.mounted) {
                this.onIsScaledCallback(isScaled);
                this.isScaled = isScaled;
                
                if (this.canvasRef && this.canvasRef.current) {
                    this.canvasRef.current.setState({ isScaled });
                }
            }
        });

        // Add keyboard event listeners
        this.keydownListener = (e) => {
            if (e.keyCode === 68 || e.keyCode === 39) {
                if (!this.ePressed) {
                    const currentMillis = Utils.millis();
                    if (currentMillis - this.eMillis < 500) {
                        this.boostRight(true);
                    }
                    this.eMillis = currentMillis;
                }
                this.ePressed = true;
                this.moveRight(true);
            }

            if (e.keyCode === 65 || e.keyCode === 37) {
                if (!this.aPressed) {
                    const currentMillis = Utils.millis();
                    if (currentMillis - this.aMillis < 500) {
                        this.boostLeft(true);
                    }
                    this.aMillis = currentMillis;
                }
                this.aPressed = true;
                this.moveLeft(true);
            }

            if (e.keyCode === 32 || e.keyCode === 87 || e.keyCode === 38) {
                if (e.keyCode === 32) {
                    e.preventDefault();
                }
                this.jump(true);
            }

            if (e.keyCode === 83 || e.keyCode === 40) {
                this.crouch(true);
            }

            if (e.keyCode === 72) {
                this.toggleGui();
            }

            if (e.keyCode === 187) {
                this.addAi();
            }

            if (e.keyCode === 189) {
                this.removeAi();
            }
        };

        this.keyupListener = (e) => {
            if (e.keyCode === 68 || e.keyCode === 39) {
                this.ePressed = false;
                this.moveRight(false);
            }

            if (e.keyCode === 65 || e.keyCode === 37) {
                this.aPressed = false;
                this.moveLeft(false);
            }

            if (e.keyCode === 32 || e.keyCode === 87 || e.keyCode === 38) {
                this.jump(false);
            }
            
            if (e.keyCode === 83 || e.keyCode === 40) {
                this.crouch(false);
            }
        };

        document.addEventListener("keydown", this.keydownListener);
        document.addEventListener("keyup", this.keyupListener);
    }

    toggleGui(){
        this.showGui = !this.showGui;
        this.onToggleGui(this.showGui);
    }

    onToggleGui(callback){
        this.onToggleGui = callback;
        return this;
    }

    jump(enabled = true) {
        this.room.send('space', enabled);
    }

    boostRight(enabled = true) {
        this.room.send('boostRight', enabled);
    }

    boostLeft(enabled = true) {
        this.room.send('boostLeft', enabled);
    }

    moveRight(enabled = true) {
        this.room.send('right', enabled);
    }

    moveLeft(enabled = true) {
        this.room.send('left', enabled);
    }

    crouch(enabled = true) {
        this.room.send('down', enabled);
    }

    addAi() {
        this.room.send('addAi');
    }

    removeAi() {
        this.room.send('removeAi');
    }

    play(user, room, rank) {
        this.room.send('play', { user: user, room: room, rank: rank })
    }

    async spectate(room){
        
        await this.reconnect(room);
            
        setInterval(async () => {
            if (!this.room.connection.isOpen) {
                await this.reconnect(room);
            }
        }, 5000)
    }

    async reconnect(room) {
        // Clean up existing connection if any
        if (this.room) {
            this.cleanupListeners();
        }

        const urlParams = new URLSearchParams(window.location.search);

        this.room = await this.client.joinOrCreate("Game", { 
            gameMode: urlParams.get('gameMode'), 
            map: urlParams.get('map'),
            room: urlParams.get('room')
        });

        this.addListeners();

        this.room.onStateChange((newState) => {
            if (this.mounted && this.canvasRef.current) {
                this.canvasRef.current.draw(newState, this.name, this.lastWinner, this.showGui);
                this.updateRunning(newState.runningPlayers);
            }
        });
    }

    quit() {
        if (this.room) {
            this.cleanupListeners();
            if (this.canvasRef && this.canvasRef.current) {
                // Reset canvas state before leaving
                this.canvasRef.current.resetCamera();
            }
            this.room.leave();
        }
    }

    toggleAi() {
        this.room.send('toggleAi');
    }
    
    toggleSound() {
        this.soundEnabled = !this.soundEnabled;
        if(!this.soundEnabled){
            this.bgMusic.pause();
        } else {
            this.bgMusic.play();
        }
    }

    changeName(name){
        this.name = name;
        if (this.room) {
            this.room.send("nameChange", name);
        }
    }

    changeAvatar(url, name){
        if (this.room) {
            this.room.send("changeAvatar", {url:url, name:name});
        }
    }

    playerHit(){
        var soundToPlay = this.playerSound[Math.floor(Math.random() * this.playerSound.length)];
        var soundToPlay2 = this.owSound[Math.floor(Math.random() * this.owSound.length)];
        var soundPlayed = false;

        if(!soundToPlay.isPlaying){
            soundToPlay.play();
            soundPlayed = true;
        }
        if(!soundToPlay2.isPlaying){
            soundToPlay2.play();
            soundPlayed = true;
        }
        return soundPlayed;
    }

    playSound(sound){
        if(Array.isArray(sound)){
            var nonPlayingSounds = sound.filter(s => !s.isPlaying);
            if(nonPlayingSounds.length === 0){
                return false;
            }
            var soundToPlay = nonPlayingSounds[Math.floor(Math.random() * nonPlayingSounds.length)];
            if(!soundToPlay.isPlaying){
                soundToPlay.play();
                return true
            }
        }
        else if(!sound.isPlaying){
            sound.play();
            return true;
        }
        return false;
    }
    
    footballHit(big = false){
        if(!this.footballSound.isPlaying && !big){
            this.footballSound.play();
            return true;
        }
        else if(!this.bigFootballSound.isPlaying && big){
            this.bigFootballSound.play();
            return true;
        }
        return false;
    }

    updateRunning(count){
        var soundsToPlay = this.runningSound.slice(0, count);
        var soundsToStop = this.runningSound.slice(count, this.runningSound.length);
        soundsToPlay.forEach(s => {
            if(!s.isPlaying){
                s.play();
            }
        });
        soundsToStop.forEach(s => {
            if(s.isPlaying){
                s.pause();
            }
        });
    }

    onIsScaled(callback) {
        this.onIsScaledCallback = callback;
        return this;
    }

    // New method to cleanup existing listeners
    cleanupListeners() {
        // Remove document event listeners
        if (this.keydownListener) {
            document.removeEventListener("keydown", this.keydownListener);
        }
        if (this.keyupListener) {
            document.removeEventListener("keyup", this.keyupListener);
        }

        // Reset camera-related state
        this.aPressed = false;
        this.ePressed = false;
        this.aMillis = 0;
        this.eMillis = 0;

        // Stop all running sounds
        this.runningSound.forEach(sound => {
            if (sound.isPlaying) {
                sound.stop();
            }
        });
    }

    // New method to add a room message listener
    addRoomListener(message, handler) {
        this.roomListeners.set(message, handler);
        this.room.onMessage(message, handler);
    }

    isServerScaled() {
        return this.isScaled;
    }
}

export default GameService;
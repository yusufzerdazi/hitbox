
import io from 'socket.io-client';
import * as THREE from 'three';

import ow1 from '../assets/sounds/ow1.mp3';
import ow2 from '../assets/sounds/ow2.mp3';
import ow3 from '../assets/sounds/ow3.mp3';
import ow4 from '../assets/sounds/ow4.mp3';
import ow5 from '../assets/sounds/ow5.mp3';
import whoosh from '../assets/sounds/whoosh.mp3';
import hit from '../assets/sounds/hit.mp3';
import wall from '../assets/sounds/wall.mp3';
import box from '../assets/sounds/box.mp3';

import hitbox from '../assets/sounds/hitbox.mp3';
import Utils from '../utils';

const OW = [ow1, ow2, ow4, ow5];

class GameService {
    constructor(){
        this.socket = io(process.env.REACT_APP_SERVER);
        this.listener = new THREE.AudioListener();
        this.players = [];
        this.mounted = false;
        this.soundEnabled = true;
        this.aPressed = false;
        this.ePressed = false;
        this.aMillis = 0;
        this.eMillis = 0;
        this.winCallback = function(){};
        this.addListeners();

        this.wallSound = [new THREE.Audio(this.listener), new THREE.Audio(this.listener), new THREE.Audio(this.listener)];
        this.playerSound = [new THREE.Audio(this.listener), new THREE.Audio(this.listener), new THREE.Audio(this.listener)];
        this.owSound = [new THREE.Audio(this.listener), new THREE.Audio(this.listener), new THREE.Audio(this.listener), new THREE.Audio(this.listener)];
        this.bgMusic = new THREE.Audio(this.listener);
        this.boxSound = new THREE.Audio(this.listener);
        this.whoosh = [new THREE.Audio(this.listener), new THREE.Audio(this.listener), new THREE.Audio(this.listener)];
        this.audioLoader = new THREE.AudioLoader();

        var $this = this;

        this.audioLoader.load(box, function(buffer){
            $this.boxSound.setBuffer(buffer);
            $this.boxSound.setVolume(0.1);
        });

        this.whoosh.forEach((w, i) => {
            this.audioLoader.load(whoosh, function(buffer){
                w.setBuffer(buffer);
                w.setVolume(0.05);
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
        this.socket.on('level', level => {
            this.level = level;
        })

        this.socket.on('allPlayers', players => {
            if(this.mounted){
                this.players = players;
            }
        });

        this.socket.on('collision', (type) => {
            if (this.soundEnabled && this.mounted) {
                if(type === "player"){
                    this.playerHit();
                }
                if(type == "box"){
                    this.boxHit();
                }
            }
        });

        this.socket.on('hitWall', () => {
            if (this.soundEnabled && this.mounted) {
                this.wallHit();
            }
        });

        this.socket.on('boost', () => {
            if (this.soundEnabled && this.mounted) {
                this.boost();
            }
        });

        this.socket.on('winner', (winner) => {
            if (this.mounted){
                this.winCallback(winner);
            }
        });

        this.socket.on('starting', (timer) => {
            if (this.mounted){
                this.canvasRef.current.countdown(timer ? timer : "");
            }
        })

        this.socket.on('gameMode', (gameMode) => {
            if(this.mounted){
                this.canvasRef.current.gameMode(gameMode);
            }
        });

        this.socket.on('deathWall', (deathWall) => {
            if(this.mounted){
                this.canvasRef.current.updateDeathWall(deathWall);
            }
        });
        
        this.socket.on('gameCountdown', (gameCountdown) => {
            if(this.mounted){
                this.canvasRef.current.updateGameCountdown(gameCountdown);
            }
        });

        this.socket.on('scale', (scale) => {
            if(this.mounted && scale){
                this.canvasRef.current.setScale(scale);
            }
        })

        this.socket.on('win', () => {
            if (this.mounted) window.PlayFabClientSDK.ExecuteCloudScript({
                FunctionName: "playerWins",
                GeneratePlayStreamEvent: true
            });
        });

        this.socket.on('beaten', beaten => {
            if (this.mounted) window.PlayFabClientSDK.ExecuteCloudScript({
                FunctionName: "playerBeaten",
                FunctionParameter: beaten,
                GeneratePlayStreamEvent: true
            });
        });

        this.socket.on('kill', () => {
            if (this.mounted) window.PlayFabClientSDK.ExecuteCloudScript({
                FunctionName: "playerKills",
                GeneratePlayStreamEvent: true
            });
        })

        this.socket.on('loss', () => {
            if (this.mounted) window.PlayFabClientSDK.ExecuteCloudScript({
                FunctionName: "playerLoses",
                GeneratePlayStreamEvent: true
            });
        });

        this.socket.on('event', (event) => {
            if(this.mounted){
                this.canvasRef.current.event(event);
            }
        });

        document.addEventListener("keydown", e => {
            if (e.keyCode === 68) {
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

            if (e.keyCode === 65) {
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

            if (e.keyCode === 32 || e.keyCode === 87) {
                if (e.keyCode === 32) {
                    e.preventDefault();
                }
                this.jump(true);
            }

            if (e.keyCode === 83) {
                this.crouch(true);
            }
        });

        document.addEventListener("keyup", e => {
            if (e.keyCode === 68) {
                this.ePressed = false;
                this.moveRight(false);
            }

            if (e.keyCode === 65) {
                this.aPressed = false;
                this.moveLeft(false);
            }

            if (e.keyCode === 32 || e.keyCode === 87) {
                this.jump(false)
            }
            
            if (e.keyCode === 83) {
                this.crouch(false)
            }
        });
    }

    jump(enabled = true) {
        this.socket.emit('space', enabled);
    }

    boostRight(enabled = true) {
        this.socket.emit('boostRight', enabled);
    }

    boostLeft(enabled = true) {
        this.socket.emit('boostLeft', enabled);
    }

    moveRight(enabled = true) {
        this.socket.emit('right', enabled);
    }

    moveLeft(enabled = true) {
        this.socket.emit('left', enabled);
    }

    crouch(enabled = true) {
        this.socket.emit('down', enabled);
    }

    addAi() {
        this.socket.emit('addAi');
    }

    removeAi() {
        this.socket.emit('removeAi');
    }

    play(name, room) {
        this.bgMusic.play();
        this.socket.emit('play', { name: name, room: room });
    }

    spectate(room){
        this.socket.emit('spectate', room);
    }

    quit() {
        this.socket.emit('quit');
    }

    toggleAi() {
        this.socket.emit('toggleAi');
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
        this.socket.emit("nameChange", name);
    }

    playerHit(){
        var soundToPlay = this.playerSound[Math.floor(Math.random() * this.playerSound.length)];
        var soundToPlay2 = this.owSound[Math.floor(Math.random() * this.owSound.length)];
        if(!soundToPlay.isPlaying){
            soundToPlay.play();
        }
        if(!soundToPlay2.isPlaying){
            soundToPlay2.play();
        }
    }

    wallHit(){
        var soundToPlay = this.wallSound[Math.floor(Math.random() * this.wallSound.length)];
        if(!soundToPlay.isPlaying){
            soundToPlay.play();
        }
    }

    boxHit(){
        if(!this.boxSound.isPlaying){
            this.boxSound.play();
        }
    }

    boost(){
        var soundToPlay = this.whoosh[Math.floor(Math.random() * this.whoosh.length)];
        if(!soundToPlay.isPlaying){
            soundToPlay.play();
        }
    }

    onWin(callback) {
        this.winCallback = callback;
    }
}

export default GameService;

import React from 'react';
import io from 'socket.io-client';
import styles from './styles.module.css';
import * as THREE from 'three';

class Game extends React.Component {
  constructor(props){
    super(props);
    this.listener = new THREE.AudioListener();
    this.addAi = this.addAi.bind(this);
    this.play = this.play.bind(this);
    this.state = {
      playerSize: 50,
      players: []
    };
  }

  componentDidMount() {
    this.socket = io(process.env.REACT_APP_SERVER);

    this.socket.on('allPlayers', players => {
      this.setState({players: players})
    })

    this.socket.on('collision', () => this.playSound('click.mp3'));

    setInterval(() => {
      this.update();
      this.draw();
    }, 1000 / 60);

    document.addEventListener("keydown", e =>
      e.keyCode === 68 ? this.socket.emit('right', true) : 
      e.keyCode === 65 ? this.socket.emit('left', true) : 
      e.keyCode === 32 ? this.socket.emit('space', true) :
      e.keyCode === 83 ? this.socket.emit('down', true) : null
    );

    document.addEventListener("keyup", e =>
      e.keyCode === 68 ? this.socket.emit('right', false) : 
      e.keyCode === 65 ? this.socket.emit('left', false) : 
      e.keyCode === 32 ? this.socket.emit('space', false) :
      e.keyCode === 83 ? this.socket.emit('down', false) : null
    );
  }

  update = () => {
    
  }

  draw = () => {
    this.drawBackground();
    this.state.players.forEach(player => this.drawPlayer(player));
  }

  clearCanvas(){
    const ctx = this.refs.canvas.getContext("2d");
    ctx.clearRect(0, 0, 960, 540);
  }

  drawBackground(){
    const ctx = this.refs.canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.rect(0, 0, 960, 540);
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = "grey";
    ctx.rect(0, 400, 960, 540);
    ctx.fill();
  }

  drawPlayer(player){
    const ctx = this.refs.canvas.getContext("2d");
    // change this colour to change the colour of your 
    // "pen" in the canvas 

    ctx.fillStyle = "black";
    ctx.beginPath();
    ctx.rect(player.x, player.y - this.state.playerSize, this.state.playerSize, (this.state.playerSize * (100 - player.health) / 100));
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = player.colour;
    ctx.rect(player.x, player.y, this.state.playerSize, -(this.state.playerSize * player.health / 100));
    ctx.fill();
    
    ctx.strokeStyle = player.colour;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.rect(player.x + 3, player.y - 3, this.state.playerSize - 6, - this.state.playerSize + 6);
    ctx.stroke();
  }

  playSound(soundFile){
    var sound = new THREE.Audio( this.listener );
    var audioLoader = new THREE.AudioLoader();
    audioLoader.load(soundFile, function( buffer ) {
      sound.setBuffer( buffer );
      sound.play();
    });
  }

  addAi(){
    this.socket.emit('addAi');
  }

  play(){
    this.socket.emit('play');
  }

  render() {
    const scores = <div className={styles.scores}>{this.state.players.map((d, i) => <span className={styles.score} style={{color: d.colour}} key={i}>{d.score}</span>)}</div>;
    return (
      <>
        <canvas ref="canvas" width={960} height={540} />
        <div  className={styles.addAi}>
          <span onClick={this.addAi} className={styles.addAiButton}>+AI</span>
          <span onClick={this.play} className={styles.addAiButton}>Play</span>
        </div>
        {scores}
      </>
    );
  }
}

export default Game;
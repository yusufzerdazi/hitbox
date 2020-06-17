
import React from 'react';
import io from 'socket.io-client';
import styles from './styles.module.css';
import * as THREE from 'three';
import hitbox from '../../assets/hitbox.svg';

class Game extends React.Component {
  constructor(props){
    super(props);
    this.listener = new THREE.AudioListener();
    this.addAi = this.addAi.bind(this);
    this.removeAi = this.removeAi.bind(this);
    this.play = this.play.bind(this);
    this.quit = this.quit.bind(this);
    this.toggleSound = this.toggleSound.bind(this);
    this.toggleAi = this.toggleAi.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.state = {
      nameClass: styles.name,
      nameInputClass: styles.nameInput,
      playerSize: 50,
      players: [],
      soundEnabled: false,
      eMillis: 0
    };
  }

  componentDidMount() {
    this.socket = io(process.env.REACT_APP_SERVER);

    this.socket.on('allPlayers', players => {
      this.setState({players: players})
    })

    this.socket.on('collision', () => this.state.soundEnabled ? this.playSound('click.mp3') : () => {});

    setInterval(() => {
      this.update();
      this.draw();
    }, 1000 / 60);

    document.addEventListener("keydown", e =>
      e.keyCode === 68 ? this.socket.emit('right', true) : 
      e.keyCode === 65 ? this.socket.emit('left', true) : 
      e.keyCode === 32 ? this.socket.emit('space', true) :
      e.keyCode === 83 ? this.socket.emit('down', true) : null
      //e.keyCode === 69 ? this.socket.emit('boostRight', true) : null
    );

    document.addEventListener("keyup", e =>
      e.keyCode === 68 ? this.socket.emit('right', false) : 
      e.keyCode === 65 ? this.socket.emit('left', false) : 
      e.keyCode === 32 ? this.socket.emit('space', false) :
      e.keyCode === 83 ? this.socket.emit('down', false) :
      e.keyCode === 69 ? this.socket.emit('boostRight', false) : null
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
    if(!player.alive) ctx.globalAlpha = 0.3;
    ctx.fillStyle = "black";
    ctx.beginPath();
    if(player.alive) ctx.rect(player.x, player.y - this.state.playerSize, this.state.playerSize, (this.state.playerSize * (100 - player.health) / 100));
    ctx.fill();
    ctx.beginPath();
    ctx.fillStyle = player.colour;
    ctx.rect(player.x, player.y, this.state.playerSize, -(this.state.playerSize * player.health / 100));
    ctx.fill();
    
    ctx.strokeStyle = player.colour;
    ctx.lineWidth = 6;
    ctx.beginPath();
    if(player.name){
      ctx.fillText(player.name, player.x, player.y - this.state.playerSize - 3);
    }
    ctx.rect(player.x + 3, player.y - 3, this.state.playerSize - 6, - this.state.playerSize + 6);
    ctx.stroke();
    ctx.globalAlpha = 1;
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

  removeAi(){
    this.socket.emit('removeAi');
  }

  play(){
    if(this.state.name){
      this.socket.emit('play', {name: this.state.name});
      this.state.nameClass = styles.name;
      this.state.nameInputClass = styles.nameInput;
    } else {
      this.state.nameClass = styles.name + ' ' + styles.red;
      this.state.nameInputClass = styles.nameInput + ' ' + styles.red;
    }
  }

  quit(){
    this.socket.emit('quit');
  }

  toggleSound(){
    this.setState({soundEnabled: !this.state.soundEnabled})
  }
  
  toggleAi(){
    this.socket.emit('toggleAi');
  }

  handleChange(event) {
    this.setState({name: event.target.value});
  }

  render() {
    const scores = 
    <div className={styles.scores}>
      <p>{this.state.players.map((d, i) => <span className={styles.score} style={{color: d.colour}} key={i}>{d.name + ':\u00A0' + d.score}</span>)}</p>
    </div>;
    return (
      <>
        <div className={styles.titleContainer}>
          <img className={styles.title} src={hitbox}></img>
        </div>
        <canvas ref="canvas" width={960} height={540} />
        <div  className={styles.addAi}>
          <span className={this.state.nameClass}><input onChange={this.handleChange} placeholder="Enter name" className={this.state.nameInputClass} type="text"></input></span>
          <span onClick={this.play} className={styles.addAiButton}>Play</span>
          <span onClick={this.addAi} className={styles.addAiButton}>+AI</span>
          <span onClick={this.removeAi} className={styles.addAiButton}>-AI</span>
          <span onClick={this.quit} className={styles.addAiButton}>Quit</span>
          <span onClick={this.toggleSound} className={styles.addAiButton}>Toggle Sound</span>
          <span onClick={this.toggleAi} className={styles.addAiButton}>Toggle AI</span>
        </div>
        {scores}
      </>
    );
  }
}

export default Game;
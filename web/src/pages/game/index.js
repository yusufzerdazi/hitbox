
import React from 'react';
import Gamepad from 'react-gamepad';
import { connect } from "react-redux";
import { store } from '../../redux/store';
import { isMobile } from "react-device-detect";

import GameCanvas from '../../components/gameCanvas';
import GameService from '../../services/game.service';
import styles from './styles.module.css';
import { USERNAME_UPDATED } from '../../constants/actionTypes';

const mapStateToProps = state => {
    return {
        user: state.logIn.user
    }
};

const mapDispatchToProps = dispatch => ({
    updateName: x => dispatch({
        type: USERNAME_UPDATED,
        name: x
    })
});

class Game extends React.Component {
    constructor(props) {
        super(props);
        this.bindFunctions();
        let search = window.location.search;
        let params = new URLSearchParams(search);
        let room = params.get('room');
        this.state = {
            nameClass: styles.name,
            nameInputClass: styles.nameInput,
            lastWinner: null,
            editingUsername: true,
            soundEnabled: true,
            room: room,
            loggingIn: false,
            leaderboardOpen: false,
            instructionsOpen: false
        };
        this.canvasRef = React.createRef();
        this.gameService = new GameService(this.canvasRef);
    }

    componentWillUnmount() {
        this.gameService.setMounted(false);
        this.gameService.quit();
        this.mounted = false;
    }

    getUsername() {
        var state = store.getState();
        console.log(state);
        if(state.logIn?.user?.name){
            this.gameService.changeName(state.logIn.user.name);
            this.gameService.play(state.logIn.user.name);
        }
    }

    componentDidMount() {
        this.mounted = true;

        store.subscribe(() => {
            this.getUsername();
        });
        
        this.gameService
            .setCanvas(this.current)
            .setMounted(true)
            .onWin(winner => this.setState({lastWinner: winner}));
        
        this.gameService.spectate(this.state.room);

        setInterval(() => {
            if (this.mounted && this.gameService.level){
                this.canvasRef.current.draw(this.gameService.players, this.gameService.level, this.props.user?.name || this.state.name, this.state.lastWinner);
            }
        }, 1000 / 60);

        document.addEventListener("keydown", e => {
            if (this.mounted){
                if (e.keyCode === 27) {
                    this.canvasRef.current.fullScreen(false);
                }
            }
        });
    }

    addAi(){
        this.gameService.addAi();
    }

    removeAi(){
        this.gameService.removeAi();
    }

    buttonUp(buttonName) {
        switch (buttonName) {
            case 'A':
                this.gameService.jump(false);
                break;
            case 'RT':
            case 'RB':
                this.gameService.boostRight(false);
                break;
            case 'LT':
            case 'LB':
                this.gameService.boostLeft(false);
                break;
            case 'X':
                this.gameService.crouch(false);
                break;
            default:
                break;
        }
    }

    jump(enabled){
        this.gameService.jump(enabled);
    }

    boostRight(enabled){
        this.gameService.boostRight(enabled);
    }

    boostLeft(enabled){
        this.gameService.boostLeft(enabled);
    }

    boostRight(enabled){
        this.gameService.boostRight(enabled);
    }

    boostLeft(enabled){
        this.gameService.boostLeft(enabled);
    }

    crouch(enabled){
        this.gameService.crouch(enabled);
    }

    axisChange(axisName, value, previousValue) {
        switch (axisName) {
            case ('LeftStickX'):
                if (value >= 0.75) {
                    this.gameService.moveRight();
                    this.gameService.moveLeft(false);
                }
                else if (value > 0.1) {
                    this.gameService.moveRight(value);
                    this.gameService.moveLeft(false);
                }
                else if (value >= -0.1) {
                    this.gameService.moveRight(false);
                    this.gameService.moveLeft(false);
                }
                else if (value > -0.75) {
                    this.gameService.moveLeft(-value);
                    this.gameService.moveRight(false);
                }
                else {
                    this.gameService.moveLeft();
                    this.gameService.moveRight(false);
                }
                break;
            case ('LeftStickY'): {
                if (value > -0.75 && previousValue <= -0.75) {
                    this.gameService.crouch(false);
                }
                break;
            }
            case ('RightStickY'): {
                if(Math.abs(value) > 0.2){
                    this.current.current.analogScale(value);
                } else {
                    this.current.current.analogScale(0);
                }
                break;
            }
            default:
                break;
        }
    }

    render() {
        return (
            <>
                <GameCanvas ref={this.canvasRef} />
                { !isMobile ?
                <div className={styles.addAi}>
                    {this.props.user?.name == "yusuf" || this.props.user?.name == "intrinsion" ? 
                    <>
                    <span style={{backgroundColor:'lawngreen', color: 'white' }} onClick={this.addAi} className={styles.addAiButton}>
                        +AI
                    </span>
                    <span style={{backgroundColor:'indianred', color: 'white' }} onClick={this.removeAi} className={styles.addAiButton}>
                        -AI
                    </span>
                    </>
                    : <></>}
                </div> : <></>
                }
                <Gamepad
                    onA={this.jump}
                    onRT={this.boostRight}
                    onLT={this.boostLeft}
                    onRB={this.boostRight}
                    onLB={this.boostLeft}
                    onX={this.crouch}
                    onButtonUp={this.buttonUp}
                    onAxisChange={this.axisChange}>
                    <p></p>
                </Gamepad>
            </>
        );
    }

    bindFunctions(){
        this.addAi = this.addAi.bind(this);
        this.removeAi = this.removeAi.bind(this);
        this.getUsername = this.getUsername.bind(this);
        this.buttonUp = this.buttonUp.bind(this);
        this.axisChange = this.axisChange.bind(this);
        this.jump = this.jump.bind(this);
        this.boostRight = this.boostRight.bind(this);
        this.boostLeft = this.boostLeft.bind(this);
        this.boostRight = this.boostRight.bind(this);
        this.boostLeft = this.boostLeft.bind(this);
        this.crouch = this.crouch.bind(this);
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Game);
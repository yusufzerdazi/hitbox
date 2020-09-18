
import React from 'react';
import ReactTooltip from "react-tooltip";
import Gamepad from 'react-gamepad';
import Modal from 'react-overlays/Modal';
import Leaderboard from '../leaderboard';
import Instructions from '../instructions';
import Login from '../../components/login';
import { connect } from "react-redux";
import { store } from '../../redux/store';
import { isMobile } from "react-device-detect";

import Utils from '../../utils';
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
        if (state.logIn.user?.name && this.state.user?.name !== state.logIn.user.name) {
            this.setState({
                user: {
                    name: state.logIn.user.name
                },
                editingUsername: false,
                loggingIn: false
            });
            this.play();
        } else {
            var customId = localStorage.getItem("customId");
            if (customId) {
                window.PlayFabClientSDK.LoginWithCustomID({
                    CreateAccount: true,
                    TitleId: "B15E8",
                    CustomId: customId
                }, (response) => {
                    window.PlayFabClientSDK.GetPlayerProfile({
                        ProfileConstraints:
                        {
                            ShowDisplayName: true
                        },
                        PlayFabId: response.data.PlayFabId
                    }, (response) => {
                        if (response?.data?.PlayerProfile?.DisplayName) {
                            this.props.updateName(response.data.PlayerProfile.DisplayName);
                            this.setState({
                                user: {
                                    name: response.data.PlayerProfile.DisplayName
                                },
                                editingUsername: false
                            });
                        }
                    });
                });
            }
        }
    }

    customIdLogin() {
        if (this.state.name && !this.props.user?.name) {
            var customId = localStorage.getItem("customId");
            if (!customId) {
                customId = Utils.uuidv4();
                localStorage.setItem("customId", customId);
            }
            window.PlayFabClientSDK.LoginWithCustomID({
                CreateAccount: true,
                TitleId: "B15E8",
                CustomId: customId
            }, () => {
                this.setName();
            });
        }
    }

    componentDidMount() {
        this.mounted = true;

        store.subscribe(() => {
            this.getUsername();
        });
        
        this.gameService
            .setCanvas(this.canvasRef)
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

    loggingIn(loggingIn){
        var loggingIn = loggingIn != undefined ? loggingIn : !this.state.loggingIn
        if(loggingIn){
            this.openInstructions(false);
            this.openLeaderboard(false);

            if(this.state.user?.name){
                this.play();
                return;
            } else {
                this.getUsername();
            }
        }
        this.setState({loggingIn: loggingIn});
    }

    play() {
        this.customIdLogin();
        var name = this.props.user?.name || this.state.name || this.state.user?.name;
        if (name) {
            this.gameService.play(name, this.state.room);
            this.setState({nameClass: styles.name,
                playing: true
            });
            this.setState({nameInputClass: styles.nameInput});
        } else {
            this.setState({nameClass: styles.name + ' ' + styles.red});
            this.setState({nameInputClass: styles.nameInput + ' ' + styles.red});
        }
    }

    quit() {
        this.gameService.quit();
        this.setState({
            playing: false
        });
    }

    addAi(){
        this.gameService.addAi();
    }

    removeAi(){
        this.gameService.removeAi();
    }

    handleChange(event) {
        this.setState({ name: event.target.value });
    }

    editName() {
        this.setState({ editingUsername: true });
    }

    cancelNameChange() {
        this.setState({
            name: "",
            editingUsername: false
        });
    }

    setName() {
        if (this.state.name) {
            window.PlayFabClientSDK.UpdateUserTitleDisplayName({
                DisplayName: this.state.name
            }, () => {
                this.setState({ editingUsername: false });
                this.props.updateName(this.state.name);
                this.gameService.changeName(this.state.name);
            });
        }
    }

    goFullscreen() {
        this.canvasRef.current.fullScreen(true);
    }

    toggleSound(){
        this.gameService.toggleSound();
        this.setState({soundEnabled: this.gameService.soundEnabled});
    }

    openLeaderboard(open){
        open = open == undefined ? !this.state.leaderboardOpen : open
        if(open){
            this.openInstructions(false);
            this.loggingIn(false);
        }
        if(this.state.user?.name){
            this.setState({leaderboardOpen: open});
        }
    }

    openInstructions(open){
        open = open == undefined ? !this.state.instructionsOpen : open
        if(open){
            this.openLeaderboard(false);
            this.loggingIn(false);
        }
        this.setState({instructionsOpen: open});
    }

    toggleCamera(){
        this.canvasRef.current.toggleCamera();
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
                    this.canvasRef.current.analogScale(value);
                } else {
                    this.canvasRef.current.analogScale(0);
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
                    {!this.state.playing ? 
                    <span style={{backgroundColor:'mediumseagreen', color: 'white'}} onClick={() => this.loggingIn(true)} className={styles.addAiButton}>
                        Join
                    </span> : <></>}
                    {this.state.playing ? 
                    <span style={{backgroundColor:'darkred', color: 'white'}} onClick={this.quit} className={styles.addAiButton}>
                        Quit
                    </span> : <></>}
                    <span style={{backgroundColor:'turquoise', color: 'white'}}
                        onClick={this.toggleCamera} className={styles.addAiButton}>
                        Camera
                    </span>
                    {this.state.soundEnabled ? <span style={{backgroundColor:'firebrick', color: 'white' }}
                        onClick={this.toggleSound} className={styles.addAiButton}>
                        Mute
                    </span> : <></>}
                    {!this.state.soundEnabled ? <span style={{ backgroundColor:'purple', color: 'white' }}
                        onClick={this.toggleSound} className={styles.addAiButton}>
                        Unmute
                    </span> : <></>}
                    {this.state.user?.name ? 
                    <span style={{backgroundColor:'darkslateblue', color: 'white' }} onClick={() => this.openLeaderboard()} className={styles.addAiButton}>
                        Stats
                    </span> : <></>}
                    <span style={{backgroundColor:'indigo', color: 'white' }} onClick={() => this.openInstructions()} className={styles.addAiButton}>
                        Controls
                    </span>
                    {this.state.user?.name == "yusuf" || this.state.user?.name == "intrinsion" ? 
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
                <Modal show={this.state.leaderboardOpen} 
                    onHide={() => this.openLeaderboard(false)}>
                    <Leaderboard />
                </Modal>
                <Modal show={this.state.instructionsOpen} 
                    onClick={() => this.openInstructions()}
                    onHide={() => this.openInstructions(false)}>
                    <Instructions />
                </Modal>
                <Modal show={this.state.loggingIn} 
                    onHide={() => this.loggingIn(false)}>
                        <div className={styles.loggingInContainer}>
                            <div className={styles.loggingIn}>
                                <h1>Log In</h1>
                                <div className={styles.textLogin}>
                                    <span style={{ display: this.state.editingUsername ? 'inline' : 'none' }} className={this.state.nameClass}>
                                        <input onChange={this.handleChange} placeholder="Enter name" className={this.state.nameInputClass} type="text"></input>
                                    </span>
                                    <span data-tip="Join game" onClick={this.play} className={styles.addAiButton}>
                                        Play
                                    </span>
                                </div>
                                <Login/>
                            </div>
                        </div>
                </Modal>
            </>
        );
    }

    bindFunctions(){
        this.play = this.play.bind(this);
        this.quit = this.quit.bind(this);
        this.addAi = this.addAi.bind(this);
        this.toggleSound = this.toggleSound.bind(this);
        this.removeAi = this.removeAi.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.setName = this.setName.bind(this);
        this.editName = this.editName.bind(this);
        this.cancelNameChange = this.cancelNameChange.bind(this);
        this.getUsername = this.getUsername.bind(this);
        this.goFullscreen = this.goFullscreen.bind(this);
        this.customIdLogin = this.customIdLogin.bind(this);
        this.buttonUp = this.buttonUp.bind(this);
        this.axisChange = this.axisChange.bind(this);
        this.jump = this.jump.bind(this);
        this.boostRight = this.boostRight.bind(this);
        this.boostLeft = this.boostLeft.bind(this);
        this.boostRight = this.boostRight.bind(this);
        this.boostLeft = this.boostLeft.bind(this);
        this.crouch = this.crouch.bind(this);
        this.openLeaderboard = this.openLeaderboard.bind(this);
        this.openInstructions = this.openInstructions.bind(this);
        this.toggleCamera = this.toggleCamera.bind(this);
        this.loggingIn = this.loggingIn.bind(this);
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Game);
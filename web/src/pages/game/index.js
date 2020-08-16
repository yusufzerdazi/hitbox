
import React from 'react';
import ReactTooltip from "react-tooltip";
import Gamepad from 'react-gamepad'
import { connect } from "react-redux";
import { store } from '../../redux/store';

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
            room: room
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
                editingUsername: false
            })
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
        this.getUsername();

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
                this.canvasRef.current.draw(this.gameService.players, this.gameService.level, this.props.user?.name || this.state.name);
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

    play() {
        this.customIdLogin();
        var name = this.props.user?.name || this.state.name;
        if (name) {
            this.gameService.play(name, this.state.room);
            this.setState({nameClass: styles.name});
            this.setState({nameInputClass: styles.nameInput});
        } else {
            this.setState({nameClass: styles.name + ' ' + styles.red});
            this.setState({nameInputClass: styles.nameInput + ' ' + styles.red});
        }
    }

    quit() {
        this.gameService.quit();
    }

    addAi(){
        this.gameService.addAi();
    }

    addCleverAi(){
        this.gameService.addCleverAi();
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
            default:
                break;
        }
    }

    render() {
        const scores =
            <div className={styles.scores}>
                <p className={styles.scoresContainer}>
                    {this.gameService?.players.map((d, i) => 
                        <span className={styles.score} style={{ color: d.colour }} key={i}>{d.name + ':\u00A0' + d.score}</span>
                    )}
                </p>
            </div>;
        return (
            <>
                <GameCanvas ref={this.canvasRef} />
                <div className={styles.addAi}>
                    <span style={{ display: this.props.user?.name ? 'inline-block' : 'none' }} className={styles.playFabName}>
                        <b>Name:</b> {this.props.user?.name}
                    </span>
                    <span style={{ display: this.state.editingUsername ? 'inline-block' : 'none' }} className={this.state.nameClass}>
                        <input onChange={this.handleChange} placeholder="Enter name" className={this.state.nameInputClass} type="text"></input>
                    </span>
                    <span data-tip="Edit username" style={{ display: this.props.user && !this.state.editingUsername ? 'inline-block' : 'none' }} 
                        onClick={this.editName} className={styles.addAiButton}>
                        <i className="fas fa-pencil"></i>
                    </span>
                    <span data-tip="Confirm username" style={{ display: this.props.user && this.state.editingUsername ? 'inline-block' : 'none' }} 
                        onClick={this.setName} className={styles.addAiButton}>
                        <i className="fas fa-check"></i>
                    </span>
                    <span data-tip="Cancel name change" style={{ display: this.props.user && this.state.editingUsername ? 'inline-block' : 'none' }} 
                        onClick={this.cancelNameChange} className={styles.addAiButton}>
                        <i className="fas fa-times"></i
                    ></span>
                    <span data-tip="Join game" onClick={this.play} className={styles.addAiButton}>
                        <i className="fas fa-gamepad-alt"></i>
                    </span>
                    <span data-tip="Quit game" onClick={this.quit} className={styles.addAiButton}>
                        <i style={{ color: 'red' }} className="fas fa-ban"></i>
                    </span>
                    <span style={{ display: this.state.soundEnabled ? 'inline-block' : 'none' }} data-tip="Mute audio" 
                        onClick={this.toggleSound} className={styles.addAiButton}>
                        <i className="fas fa-volume-mute"></i>
                    </span>
                    <span style={{ display: !this.state.soundEnabled ? 'inline-block' : 'none' }} data-tip="Enable audio" 
                        onClick={this.toggleSound} className={styles.addAiButton}>
                        <i className="fas fa-volume"></i>
                    </span>
                    <span data-tip="Add AI" onClick={this.addAi} className={styles.addAiButton}>
                        <i className="fas fa-robot"></i>
                    </span>
                    <span data-tip="Add Clever AI" onClick={this.addCleverAi} className={styles.addAiButton}>
                        <i className="fas fa-head-side-brain"></i>
                    </span>
                    <span data-tip="Delete AI" onClick={this.removeAi} className={styles.addAiButton}>
                        <i style={{ color: 'red' }} className="fas fa-robot"></i>
                    </span>
                    <span data-tip="Fullscreen" onClick={this.goFullscreen} className={styles.addAiButton}>
                        <i className="fas fa-expand"></i>
                    </span>
                </div>
                {this.state.lastWinner ?
                    <div className={styles.winnerContainer}>
                        <span style={{ color: this.state.lastWinner.colour }} className={styles.winner}>
                            {this.state.lastWinner.name + ' won the last game.'}
                        </span>
                    </div> : null
                }
                {scores}
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
                <ReactTooltip />
            </>
        );
    }

    bindFunctions(){
        this.play = this.play.bind(this);
        this.quit = this.quit.bind(this);
        this.addAi = this.addAi.bind(this);
        this.addCleverAi = this.addCleverAi.bind(this);
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
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(Game);
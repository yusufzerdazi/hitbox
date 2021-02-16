
import React from 'react';
import styles from './styles.module.css';
import Utils from '../../utils';
import Modal from 'react-overlays/Modal';
import Leaderboard from '../../pages/leaderboard';
import Instructions from '../../pages/instructions';

import { connect } from "react-redux";
import Collapsible from 'react-collapsible';
import axios from 'axios';

import { LOG_IN, CAMERA, USERNAME_UPDATED, PLAYING, ADDAI, REMOVEAI } from '../../constants/actionTypes';
import { FOLLOWING, DRAG } from '../../constants/cameraTypes';
import Avatars from '../avatars';

const mapStateToProps = state => {
    return {
        user: state.logIn.user,
        cameraType: state.options.cameraType,
        isPlaying: state.options.playing
    }
};

const mapDispatchToProps = dispatch => ({
    logIn: x => dispatch({
      type: LOG_IN,
      payload: x
    }),
    updateName: x => dispatch({
        type: USERNAME_UPDATED,
        name: x
    }),
    camera: x => dispatch({
      type: CAMERA,
      cameraType: x
    }),
    playing: x => dispatch({
      type: PLAYING,
      playing: x
    }),
    addAI: x => dispatch({
      type: ADDAI
    }),
    removeAI: x => dispatch({
      type: REMOVEAI
    })
});

class Options extends React.Component {
  constructor(props){
    super(props);
    this.state = { 
      optionsOpen: false,
      openModal: null
    };
    this.onPlayFabResponse = this.onPlayFabResponse.bind(this);
    this.onGoogleSignIn = this.onGoogleSignIn.bind(this);
    this.playAnonymously = this.playAnonymously.bind(this);
    this.typeUsername = this.typeUsername.bind(this);
    this.setName = this.setName.bind(this);
    this.validateUserName = this.validateUserName.bind(this);
    this.onFileUpload = this.onFileUpload.bind(this);
    this.uploadAvatar = this.uploadAvatar.bind(this);
    this.onAvatarChange = this.onAvatarChange.bind(this);
  }

  componentDidMount(){
    var $this = this;
    setTimeout(function(){ 
      window.gapi.signin2.render('g-signin2', {
        'scope': 'profile email',
        'theme': 'dark',
        'onsuccess': $this.onGoogleSignIn,
        'width': 223
      }, 500);
    });
  }

  onPlayFabResponse(response, error) {
    if (response)
      window.PlayFabClientSDK.GetPlayerProfile({
        ProfileConstraints: { ShowDisplayName: true },
        PlayFabId: response.data.PlayFabId
      }).then((response) => {
        if(!response.data.PlayerProfile.DisplayName){
          this.setName(true);
        }
        this.props.logIn(response.data.PlayerProfile);
        setInterval(() => {
          window.PlayFabClientSDK.GetPlayerStatistics({
            StatisticNames: ["rank"]
          }).then(s => {
            var rank = s.data?.Statistics[0]?.Value || 1000;
            this.setState({score: rank});
          });
        }, 5000);        
      });
      
    if (error)
      console.log("Error: " + JSON.stringify(error));
  }

  onGoogleSignIn(){
    // Retrieve access token
    var user = window.gapi.auth2.getAuthInstance().currentUser.get();
    this.setState({accessToken: user.getAuthResponse(true).access_token});
    
    window.PlayFabClientSDK.LoginWithGoogleAccount({
        AccessToken: this.state.accessToken,
        CreateAccount : true,
        TitleId: "B15E8",
    }, this.onPlayFabResponse);
  }

  typeUsername(event) {
    this.setState({ updatedUsername: event.target.value });
  }
  
  logInWithCustomId() {
    var customId = localStorage.getItem("customId");
    if (!customId) {
      customId = Utils.uuidv4();
      localStorage.setItem("customId", customId);
    }
    window.PlayFabClientSDK.LoginWithCustomID({
      CreateAccount: true,
      TitleId: "B15E8",
      CustomId: customId
    }, this.onPlayFabResponse);
  }

  validateUserName(){
    if (!this.state.updatedUsername || this.state.updatedUsername.length < 3){
      this.setState({usernameError: "Please enter name longer than 3 characters."});
      return false;
    }
    if (this.state.updatedUsername.length > 25){
      this.setState({usernameError: "Please enter name less than 25 characters."});
      return false;
    }
    if (this.state.updatedUsername.includes(" ")){
      this.setState({usernameError: "Please enter name without spaces."});
      return false;
    }
    return true;
  }

  setName(signUp = false) {
    if(!signUp && !this.validateUserName()){
      return;
    }
    var name = this.state.updatedUsername || "Hitboxer" + Math.floor(Math.random() * 10000);
    return window.PlayFabClientSDK.UpdateUserTitleDisplayName({
      DisplayName: name
    }).then(response => {
      this.props.updateName(name);
    }).catch((error) => {
      if(error.error == "NameNotAvailable"){
        this.setState({updatedUsername: null, usernameError: "The name '" + this.state.updatedUsername + "' is already in use."});
      } else {
        if(!this.props.user?.name){
          this.setName();
        }
      }
    });
  }

  playAnonymously(){
    this.logInWithCustomId();
  }

  openModal(modal){
    this.setState(prevState => ({  openModal: prevState.openModal != modal ? modal : null }));
  }

  toggleState(field){
    var newState = {};
    newState[field] = !this.state[field];
    this.setState(newState);
  }

  onFileUpload(event){
    this.setState({file: event.target.files[0]});
  }

  uploadAvatar(){
    const data = new FormData() 
    data.append('file', this.state.file);
    data.append('playerId', this.props.user.id);
    axios.post(`${process.env.REACT_APP_FUNCTION_URL}/api/UploadAvatar?code=CPb1i3KdhSwsewc2mWSM4SbeTdvCTq1Rrn5B3X7PaKjP2hehNEdtDQ==`, data, {})
    .then(res => {
      this.setState({etag: Utils.uuidv4()});
    })
    .catch(err => {

    })
  }

  onAvatarChange(){
    this.setState({etag: Utils.uuidv4()});
  }

  render() {
    return (
      <>
      { this.props.user?.loggedIn ?
      <div className={styles.footerContainer}>
        <div className={styles.profile}>
          <div className={styles.profileImageContainer} style={{float: "left"}}>
            <img className={styles.profileImage} src={`https://hitbox.blob.core.windows.net/avatars/${this.props.user.id}.svg?etag=${this.state.etag}`} onError={(ev) => ev.target.src=`https://hitbox.blob.core.windows.net/avatars/${this.props.user.id}.jpg?etag=${this.state.etag}`}/>
          </div>
          <div style={{float: "left"}} className={styles.profileName}>
            {this.props.user?.name}
          </div>
          <div style={{float: "left"}} className={styles.score}>Rank: {this.state?.score}</div>
          <div style={{float: "left"}} className={styles.options}  onClick={() => this.toggleState("optionsOpen")}>Options</div>
        </div>
        <Collapsible easing="ease-in-out" open={this.state.optionsOpen} >
          <div className={styles.optionsDetails}>
            <div className={styles.option} onClick={() => this.toggleState("updatingUsername")}>Change username</div>
            <Collapsible easing="ease-in-out" open={this.state.updatingUsername} >
              <div className={styles.usernameUpdate}>
                <div className={styles.name}>
                  <input onChange={this.typeUsername} placeholder="Type your name" className={styles.nameInput} type="text"></input>
                </div>
                <div className={styles.updateUsernameButton} onClick={this.setName}>Update</div>
              </div>
              {this.state.usernameError ? 
              <div className={styles.nameErrors}>
                <span>{this.state.usernameError}</span>
              </div> : <></> }
            </Collapsible>
            <div className={styles.option} onClick={() => this.toggleState("uploadingAvatar")}>Choose an avatar</div>
            <Collapsible easing="ease-in-out" open={this.state.uploadingAvatar} >
              <Avatars playerId={this.props.user.id} onChange={this.onAvatarChange}></Avatars>
            </Collapsible>
            <div className={styles.option} onClick={() => this.props.camera(this.props.cameraType == FOLLOWING ? DRAG : FOLLOWING)}>Camera mode: {this.props.cameraType}</div>
            <div className={styles.option} onClick={() => this.openModal("leaderboard")}>Leaderboard</div>
            <div className={styles.option} onClick={() => this.openModal("controls")}>Controls</div>
            {this.props.isPlaying ? <div className={styles.option + " " + styles.quitOption} onClick={() => this.props.playing(false)}>Quit</div> : <></>}
            {!this.props.isPlaying ? <div className={styles.option + " " + styles.playOption} onClick={() => this.props.playing(true)}>Join</div> : <></>}
            {this.props.user?.name == "yusuf" ? <div className={styles.option} onClick={() => this.props.addAI()}>Add AI</div> : <></>}
            {this.props.user?.name == "yusuf" ? <div className={styles.option} onClick={() => this.props.removeAI()}>Remove AI</div> : <></>}
          </div>
        </Collapsible>
      </div> : 
      <div className={styles.footerContainer}>
        <div>
          <div className={styles.play} onClick={() => {this.setState(prevState => ({  optionsOpen: !prevState.optionsOpen }))}}>Play</div>
        </div>
        <Collapsible easing="ease-in-out" open={this.state.optionsOpen} >
          <div className={styles.optionsDetails}>
            <div className={styles.playButton} onClick={this.playAnonymously}>Play anonymously</div>
            <div className={styles.or}>or</div>
            <div className={styles.googleSignIn}>
              <div style={{width: "100%"}} id="g-signin2"></div>
            </div>
          </div>
        </Collapsible>
      </div> } 
        <Modal show={this.state.openModal == 'leaderboard'}>
          <Leaderboard click={() => this.openModal("leaderboard")} />
        </Modal>
        <Modal show={this.state.openModal == 'controls'}>
          <Instructions click={() => this.openModal("controls")} />
        </Modal>
      </>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Options);
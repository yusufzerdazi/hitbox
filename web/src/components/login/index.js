
import React from 'react';
import { connect } from 'react-redux';
import { LOG_IN } from '../../constants/actionTypes';
import styles from './styles.module.css';

const mapDispatchToProps = dispatch => ({
  logIn: x => dispatch({
    type: LOG_IN,
    payload: x
  })
});

const mapStateToProps = state => {
  return {
    user: state.logIn.user
  }
};

class Login extends React.Component {
  constructor(props){
    super(props);
    
    this.onPlayFabResponse = this.onPlayFabResponse.bind(this);
    this.onSignIn = this.onSignIn.bind(this);
  }

  onSignIn(){
    // Retrieve access token
    var user = window.gapi.auth2.getAuthInstance().currentUser.get();
    this.setState({accessToken: user.getAuthResponse(true).access_token});
    
    window.PlayFabClientSDK.LoginWithGoogleAccount({
        AccessToken: this.state.accessToken,
        CreateAccount : true,
        TitleId: "B15E8",
    }, this.onPlayFabResponse);
  }

  onPlayFabResponse(response, error) {
    if (response)
      window.PlayFabClientSDK.GetPlayerProfile({
        ProfileConstraints:
        {
          ShowDisplayName: true
        },
        PlayFabId: response.data.PlayFabId
      }, (response) => {
        this.props.logIn(response.data.PlayerProfile)
      });
      
    if (error)
      console.log("Error: " + JSON.stringify(error));
  }

  componentDidMount(){
    var $this = this;
    setTimeout(function(){ 
      window.gapi.signin2.render('g-signin2', {
        'scope': 'profile email',
        'theme': 'dark',
        'onsuccess': $this.onSignIn,
        'onerror': () => console.log("test")
      }, 500);
    });
  }

  render() {
    return (
      <>
      {!this.props.user ? 
        <div className={styles.loginText}>
          <div className={styles.signInButton} id="g-signin2"></div>
        </div>
        : <></>}
      </>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Login);
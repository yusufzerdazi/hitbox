
import React from 'react';
import styles from './styles.module.css';

class Login extends React.Component {
  render() {
    return (
      <div className={styles.loginText}>
        <div className={styles.logInDescription}>
          <span className={styles.logInDescriptionText}>Log in to be added to the leaderboard.</span>
        </div>
        <div className={styles.signInButton} id="g-signin2"></div>
      </div>
    );
  }
}

export default Login;

import React from 'react';
import styles from './styles.module.css';
import hitbox from '../../assets/hitbox.svg';
import {
  Link
} from "react-router-dom";

class Header extends React.Component {
  render() {
    return (
      <div className={styles.titleContainer}>
        <Link to="/"><img className={styles.title} src={hitbox}></img></Link>
        <div className={styles.navigation}>
          <Link to="/leaderboard"><span className={styles.navigationButton}>Leaderboard</span></Link>
        </div>
      </div>
    );
  }
}

export default Header;
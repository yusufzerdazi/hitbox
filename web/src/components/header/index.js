
import React from 'react';
import styles from './styles.module.css';
import hitbox from '../../assets/hitbox.svg';
import {
  NavLink
} from "react-router-dom";

class Header extends React.Component {
  render() {
    return (
      <div className={styles.titleContainer}>
        <img className={styles.title} src={hitbox}></img>
        <div className={styles.navigation}>
          <NavLink exact={true} activeClassName={styles.isActive} to='/'><span className={styles.navigationButton}>Game</span></NavLink>
          <NavLink activeClassName={styles.isActive} to='/leaderboard'><span className={styles.navigationButton}>Leaderboard</span></NavLink>
          <NavLink activeClassName={styles.isActive} to='/instructions'><span className={styles.navigationButton}>Instructions</span></NavLink>
        </div>
      </div>
    );
  }
}

export default Header;
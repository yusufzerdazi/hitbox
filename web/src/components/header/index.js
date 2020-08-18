
import React from 'react';
import { isMobile } from "react-device-detect";
import styles from './styles.module.css';
import hitbox from '../../assets/hitbox.svg';
import {
  NavLink
} from "react-router-dom";

class Header extends React.Component {
  render() {
    return (<>
        {!isMobile ? <div className={styles.titleContainer}>
          <img alt="Hitbox" className={styles.title} src={hitbox}></img>
        </div> : <></>}
      </>
    );
  }
}

export default Header;
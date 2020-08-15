
import React from 'react';
import styles from './styles.module.css';
import info from '../../assets/images/info.svg'
import controls from '../../assets/images/controls.svg'

class Instructions extends React.Component {
  render() {
    return (
      <div className={styles.controlsContainer}>
        <div className={styles.description}>
          <h1>The Game</h1>
          <p>
            The aim of the game, as usual, is to kill each other. Damage is dealt when players collide, the quicker player hurting the slower player.
            Quicker collisions deal more damage. Players can boost to quickly increase their speed, but must wait for their boost cooldown to
            deplete before boosting again. Crouching makes players invulnerable to horizontal damage, but they can't move and can still be hit from above.
          </p>
        </div>
        <div className={styles.info}>
          <h1>Player Stats</h1>
          <img alt="Info" className={styles.infoImage} src={info}></img>
        </div>
        <div className={styles.controls}>
          <h1>Controls</h1>
          <img alt="Controls" className={styles.controlsImage} src={controls}></img>
        </div>
      </div>
    );
  }
}

export default Instructions;
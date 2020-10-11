
import React from 'react';
import styles from './styles.module.css';
import info from '../../assets/images/info.svg'
import controls from '../../assets/images/controls.svg'

class Instructions extends React.Component {
  render() {
    return (
      <div className={styles.controlsContainer} onClick={this.props.click}>
        <div className={styles.controls}>
          <div className={styles.description}>
            <h1>The Game</h1>
            <p>
              The aim of the game, as usual, is to kill each other. Damage is dealt when players collide, the quicker player hurting the slower player.
              Quicker collisions deal more damage. Players can boost to quickly increase their speed, but must wait for their stamina to
              recover before boosting again. Crouching makes players invulnerable to horizontal damage, but they can't move and can still be hit from above.
            </p>
          </div>
          <div className={styles.info}>
            <h1>Controls (Keyboard)</h1>
            <table>
              <thead>
                <tr>
                  <th>
                    Button
                  </th>
                  <th>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    Space / W
                  </td>
                  <td>
                    Jump
                  </td>
                </tr>
                <tr>
                  <td>
                    A / Double tap
                  </td>
                  <td>
                    Left / Boost left
                  </td>
                </tr>
                <tr>
                  <td>
                    S
                  </td>
                  <td>
                    Pound / Crouch
                  </td>
                </tr>
                <tr>
                  <td>
                    D / Double tap
                  </td>
                  <td>
                    Right / Boost right
                  </td>
                </tr>
                <tr>
                  <td>
                    Scroll
                  </td>
                  <td>
                    Zoom
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className={styles.info}>
            <h1>Controls (Controller)</h1>
            <table>
              <thead>
                <tr>
                  <th>
                    Button
                  </th>
                  <th>
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    Left Analog
                  </td>
                  <td>
                    Move
                  </td>
                </tr>
                <tr>
                  <td>
                    A
                  </td>
                  <td>
                    Jump
                  </td>
                </tr>
                <tr>
                  <td>
                    X
                  </td>
                  <td>
                    Crouch / Pound
                  </td>
                </tr>
                <tr>
                  <td>
                    RB / RT
                  </td>
                  <td>
                    Boost right
                  </td>
                </tr>
                <tr>
                  <td>
                    LT / LB
                  </td>
                  <td>
                    Boost left
                  </td>
                </tr>
                <tr>
                  <td>
                    Right Analog
                  </td>
                  <td>
                    Zoom
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }
}

export default Instructions;
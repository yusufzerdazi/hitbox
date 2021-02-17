
import React from 'react';
import yz from '../../assets/images/yz.svg';
import cashapp from '../../assets/images/cashapp.svg';
import styles from './styles.module.css';
import Tooltip from 'react-bootstrap/Tooltip'
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';

class Footer extends React.Component {
  render() {
    return (
      <div className={styles.footerContainer}>
        <a href="https://yusuf.zerdazi.com">
          <OverlayTrigger placement="top" overlay={<Tooltip id={`website`}>My website</Tooltip> }>
            <img alt="Yusuf Zerdazi" className={styles.footerImage} src={yz}></img>
          </OverlayTrigger>
        </a>
        <a href="https://cash.app/£yusufzerdazi">
          <OverlayTrigger placement="top" overlay={<Tooltip id={`donate`}>Donate</Tooltip> }>
            <img alt="Donate" className={styles.footerImage} src={cashapp}></img>
          </OverlayTrigger>
        </a>
      </div>
    );
  }
}

export default Footer;
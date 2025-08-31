
import React from 'react';
import yz from '../../assets/images/yz.svg';
import beer from '../../assets/images/beer.png';
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
        <a href="https://www.buymeacoffee.com/yusufzerdazi"><img className={styles.footerImage} src={beer} alt="Buy Me A Coffee" /></a>
      </div>
    );
  }
}

export default Footer;
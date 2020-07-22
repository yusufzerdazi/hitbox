
import React from 'react';
import yz from '../../assets/images/yz.svg';
import styles from './styles.module.css';

class Footer extends React.Component {
  constructor(props){
    super(props);
  }

  render() {
    return (
      <div className={styles.footerContainer}>
        <a href="https://yusuf.zerdazi.com">
          <img className={styles.footerImage} src={yz}></img>
        </a>
      </div>
    );
  }
}

export default Footer;
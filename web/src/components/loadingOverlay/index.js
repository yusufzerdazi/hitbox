import React from 'react';
import styles from './styles.module.css';

const LoadingOverlay = ({ isVisible }) => {
    if (!isVisible) return null;
    
    return (
        <div className={styles.overlay}>
            <div className={styles.content}>
                <h2>Loading</h2>
                <div className={styles.spinner}></div>
                <p>Please wait while the server scales up...</p>
            </div>
        </div>
    );
};

export default LoadingOverlay; 
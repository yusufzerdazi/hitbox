import React, { useState } from 'react';
import styles from './mobileControls.module.css';

const JumpButton = ({ onJump, onJumpEnd, size = 80 }) => {
    const [isPressed, setIsPressed] = useState(false);

    const handleStart = () => {
        setIsPressed(true);
        if (onJump) onJump();
    };

    const handleEnd = () => {
        setIsPressed(false);
        if (onJumpEnd) onJumpEnd();
    };

    // Touch events
    const handleTouchStart = (e) => {
        e.preventDefault();
        handleStart();
    };

    const handleTouchEnd = (e) => {
        e.preventDefault();
        handleEnd();
    };

    // Mouse events (for testing)
    const handleMouseDown = (e) => {
        e.preventDefault();
        handleStart();
    };

    const handleMouseUp = (e) => {
        e.preventDefault();
        handleEnd();
    };

    return (
        <div
            className={`${styles.jumpButton} ${isPressed ? styles.pressed : ''}`}
            style={{
                width: size,
                height: size,
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
        >
            <span className={styles.jumpIcon}>↗</span>
            <span className={styles.jumpText}>JUMP</span>
        </div>
    );
};

export default JumpButton;
import React, { useEffect, useRef } from 'react';
import AnalogStick from './AnalogStick';
import JumpButton from './JumpButton';
import SwipeButton from './SwipeButton';
import styles from './mobileControls.module.css';

const MobileControls = ({ gameService, isPlaying }) => {
    const movementRef = useRef({ x: 0, y: 0 });
    const isJumpingRef = useRef(false);

    // Handle analog stick movement
    const handleMove = (movement) => {
        if (!gameService || !isPlaying) return;

        const { x, magnitude } = movement;
        const threshold = 0.1;

        // Store current movement for reference
        movementRef.current = { x, magnitude };

        // Handle left/right movement
        if (Math.abs(x) > threshold) {
            if (x > threshold) {
                // Moving right
                gameService.moveRight(true);
                gameService.moveLeft(false);
            } else if (x < -threshold) {
                // Moving left
                gameService.moveLeft(true);
                gameService.moveRight(false);
            }
        } else {
            // Stop movement
            gameService.moveLeft(false);
            gameService.moveRight(false);
        }
    };

    // Handle jump button
    const handleJump = () => {
        if (!gameService || !isPlaying) return;
        isJumpingRef.current = true;
        gameService.jump(true);
    };

    const handleJumpEnd = () => {
        if (!gameService || !isPlaying) return;
        isJumpingRef.current = false;
        gameService.jump(false);
    };

    // Handle swipe actions for boost and crouch
    const handleSwipe = (action, direction) => {
        if (!gameService || !isPlaying) return;

        switch (action) {
            case 'boostLeft':
                gameService.boostLeft(true);
                setTimeout(() => gameService.boostLeft(false), 100);
                break;
            case 'boostRight':
                gameService.boostRight(true);
                setTimeout(() => gameService.boostRight(false), 100);
                break;
            case 'boostUp':
                // Boost in current movement direction or jump boost
                if (movementRef.current.x > 0.1) {
                    gameService.boostRight(true);
                    setTimeout(() => gameService.boostRight(false), 100);
                } else if (movementRef.current.x < -0.1) {
                    gameService.boostLeft(true);
                    setTimeout(() => gameService.boostLeft(false), 100);
                } else if (isJumpingRef.current) {
                    // Additional jump boost
                    gameService.jump(true);
                    setTimeout(() => gameService.jump(false), 50);
                }
                break;
            case 'crouch':
                gameService.crouch(true);
                setTimeout(() => gameService.crouch(false), 200);
                break;
        }
    };

    const handleSwipePress = () => {
        // Optional: Handle initial press before swipe
    };

    const handleSwipeRelease = () => {
        // Optional: Handle release after swipe
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (gameService) {
                gameService.moveLeft(false);
                gameService.moveRight(false);
                gameService.jump(false);
                gameService.crouch(false);
            }
        };
    }, [gameService]);

    // Don't render controls if not playing
    if (!isPlaying) return null;

    return (
        <div className={styles.mobileControlsContainer}>
            <div className={styles.leftControls}>
                <AnalogStick
                    onMove={handleMove}
                    size={120}
                    knobSize={40}
                />
            </div>

            <div className={styles.rightControls}>
                <JumpButton
                    onJump={handleJump}
                    onJumpEnd={handleJumpEnd}
                    size={80}
                />
                <SwipeButton
                    onSwipe={handleSwipe}
                    onPress={handleSwipePress}
                    onRelease={handleSwipeRelease}
                    size={80}
                />
            </div>
        </div>
    );
};

export default MobileControls;
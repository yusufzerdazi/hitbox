import React, { useState, useRef, useEffect } from 'react';
import styles from './mobileControls.module.css';

const SwipeButton = ({ onSwipe, onPress, onRelease, size = 80 }) => {
    const [isPressed, setIsPressed] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [startPosition, setStartPosition] = useState({ x: 0, y: 0 });
    const [currentDirection, setCurrentDirection] = useState(null);
    const buttonRef = useRef(null);

    const SWIPE_THRESHOLD = 30; // Minimum distance for swipe detection
    const DIRECTIONS = {
        up: { icon: '↑', action: 'boostUp' },
        down: { icon: '↓', action: 'crouch' },
        left: { icon: '←', action: 'boostLeft' },
        right: { icon: '→', action: 'boostRight' }
    };

    const getSwipeDirection = (startX, startY, endX, endY) => {
        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance < SWIPE_THRESHOLD) return null;

        const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
        
        // Convert angle to direction
        if (angle >= -45 && angle <= 45) return 'right';
        if (angle >= 45 && angle <= 135) return 'down';
        if (angle >= 135 || angle <= -135) return 'left';
        if (angle >= -135 && angle <= -45) return 'up';
        
        return null;
    };

    const handleStart = (clientX, clientY) => {
        setIsPressed(true);
        setStartPosition({ x: clientX, y: clientY });
        setCurrentDirection(null);
        if (onPress) onPress();
    };

    const handleMove = (clientX, clientY) => {
        if (!isPressed) return;

        const direction = getSwipeDirection(startPosition.x, startPosition.y, clientX, clientY);
        
        if (direction && direction !== currentDirection) {
            setCurrentDirection(direction);
            setIsDragging(true);
            
            if (onSwipe) {
                onSwipe(DIRECTIONS[direction].action, direction);
            }
        }
    };

    const handleEnd = () => {
        setIsPressed(false);
        setIsDragging(false);
        setCurrentDirection(null);
        if (onRelease) onRelease();
    };

    // Touch events
    const handleTouchStart = (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            handleStart(touch.clientX, touch.clientY);
        }
    };

    const handleTouchMove = (e) => {
        e.preventDefault();
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            handleMove(touch.clientX, touch.clientY);
        }
    };

    const handleTouchEnd = (e) => {
        e.preventDefault();
        handleEnd();
    };

    // Mouse events (for testing)
    const handleMouseDown = (e) => {
        e.preventDefault();
        handleStart(e.clientX, e.clientY);
    };

    const handleMouseMove = (e) => {
        e.preventDefault();
        handleMove(e.clientX, e.clientY);
    };

    const handleMouseUp = (e) => {
        e.preventDefault();
        handleEnd();
    };

    useEffect(() => {
        if (isPressed) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd, { passive: false });
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isPressed]);

    return (
        <div
            ref={buttonRef}
            className={`${styles.swipeButton} ${isPressed ? styles.pressed : ''} ${isDragging ? styles.dragging : ''}`}
            style={{
                width: size,
                height: size,
            }}
            onTouchStart={handleTouchStart}
            onMouseDown={handleMouseDown}
        >
            {currentDirection ? (
                <span className={styles.directionIcon}>
                    {DIRECTIONS[currentDirection].icon}
                </span>
            ) : (
                <div className={styles.swipeInstructions}>
                    <div className={styles.swipeArrows}>
                        <span>↑</span>
                        <div>
                            <span>←</span>
                            <span>→</span>
                        </div>
                        <span>↓</span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SwipeButton;
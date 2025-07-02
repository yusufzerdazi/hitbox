import React, { useState, useRef, useEffect } from 'react';
import Utils from '../../utils';
import styles from './mobileControls.module.css';

const AnalogStick = ({ onMove, size = 120, knobSize = 40 }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const stickRef = useRef(null);
    const animationFrameRef = useRef(null);

    const maxRadius = (size - knobSize) / 2;

    const handleStart = (clientX, clientY) => {
        if (!stickRef.current) return;
        
        setIsDragging(true);
        updatePosition(clientX, clientY);
    };

    const handleMove = (clientX, clientY) => {
        if (!isDragging || !stickRef.current) return;
        
        updatePosition(clientX, clientY);
    };

    const handleEnd = () => {
        setIsDragging(false);
        setPosition({ x: 0, y: 0 });
        if (onMove) onMove({ x: 0, y: 0, magnitude: 0 });
    };

    const updatePosition = (clientX, clientY) => {
        if (!stickRef.current) return;

        const rect = stickRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        let deltaX = clientX - centerX;
        let deltaY = clientY - centerY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

        if (distance > maxRadius) {
            deltaX = (deltaX / distance) * maxRadius;
            deltaY = (deltaY / distance) * maxRadius;
        }

        const magnitude = Math.min(distance / maxRadius, 1);
        const normalizedX = deltaX / maxRadius;
        const normalizedY = deltaY / maxRadius;

        setPosition({ x: deltaX, y: deltaY });
        
        if (onMove) {
            onMove({
                x: normalizedX,
                y: normalizedY,
                magnitude: magnitude
            });
        }
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

    // Mouse events (for testing on desktop)
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
        if (isDragging) {
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
    }, [isDragging]);

    return (
        <div
            ref={stickRef}
            className={styles.analogStick}
            style={{
                width: size,
                height: size,
            }}
            onTouchStart={handleTouchStart}
            onMouseDown={handleMouseDown}
        >
            <div
                className={styles.analogStickKnob}
                style={{
                    width: knobSize,
                    height: knobSize,
                    transform: `translate(${position.x}px, ${position.y}px)`,
                }}
            />
        </div>
    );
};

export default AnalogStick;
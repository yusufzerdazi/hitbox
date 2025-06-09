import React from 'react';
import styles from './styles.module.css';

const GameOverlay = ({ 
    gameMode, 
    scores, 
    countdown, 
    gameCountdown,
    events, 
    player,
    deathWallDistance,
    maxDistance,
    showGui 
}) => {
    if (!showGui) return null;

    const renderGameModeHeader = () => {
        if (!gameMode?.title) return null;

        return (
            <div className={styles.gameModeHeader}>
                <h2 className={styles.gameTitle}>{gameMode.title}</h2>
                {gameMode.subtitle && (
                    <p className={styles.gameSubtitle}>{gameMode.subtitle}</p>
                )}
            </div>
        );
    };

    const renderScores = () => {
        if (!scores || gameMode?.title !== 'Football') return null;

        return (
            <div className={styles.scoreContainer}>
                <div className={styles.teamScore}>
                    <span className={styles.teamLabel}>Team 1</span>
                    <span className={styles.score} style={{ color: '#ff4444' }}>{scores.team1}</span>
                </div>
                <span className={styles.scoreDivider}>-</span>
                <div className={styles.teamScore}>
                    <span className={styles.score} style={{ color: '#6a5acd' }}>{scores.team2}</span>
                    <span className={styles.teamLabel}>Team 2</span>
                </div>
            </div>
        );
    };

    const renderDeathWallDistance = () => {
        if (gameMode?.title !== 'Death Wall' || !maxDistance) return null;

        return (
            <div className={styles.distanceContainer}>
                <div className={styles.currentDistance}>
                    {Math.round((deathWallDistance || 0) / 50)}m
                </div>
                <div className={styles.maxDistance}>
                    Max: {Math.round(maxDistance / 50)}m
                </div>
            </div>
        );
    };

    const renderCountdown = () => {
        if (!countdown || countdown === '') return null;

        return (
            <div className={styles.countdownContainer}>
                <div className={styles.countdown}>{countdown}</div>
            </div>
        );
    };

    const renderGameCountdown = () => {
        if (!gameCountdown || gameMode?.title !== 'Tag') return null;

        return (
            <div className={styles.gameCountdownContainer}>
                <div className={styles.gameCountdown}>{gameCountdown}</div>
            </div>
        );
    };

    const renderPlayerStats = () => {
        if (!player) return null;

        return (
            <div className={styles.playerStats}>
                <div className={styles.statBar}>
                    <span className={styles.statLabel}>Health</span>
                    <div className={styles.barContainer}>
                        <div 
                            className={styles.healthBar} 
                            style={{ width: `${player.health || 100}%` }}
                        />
                    </div>
                    <span className={styles.statValue}>{player.health || 100}%</span>
                </div>
                {player.stamina !== undefined && (
                    <div className={styles.statBar}>
                        <span className={styles.statLabel}>Stamina</span>
                        <div className={styles.barContainer}>
                            <div 
                                className={styles.staminaBar} 
                                style={{ width: `${player.stamina}%` }}
                            />
                        </div>
                        <span className={styles.statValue}>{Math.round(player.stamina)}%</span>
                    </div>
                )}
            </div>
        );
    };

    const renderEvents = () => {
        if (!events || events.length === 0) return null;

        const visibleEvents = events
            .filter(e => !['collision', 'boost', 'hit'].includes(e.type))
            .slice(-5);

        if (visibleEvents.length === 0) return null;

        return (
            <div className={styles.eventsContainer}>
                {visibleEvents.map((event, index) => (
                    <div 
                        key={`${event.type}-${index}`} 
                        className={`${styles.event} ${styles[event.type]}`}
                        style={{ animationDelay: `${index * 0.1}s` }}
                    >
                        {event.message}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className={styles.overlay}>
            <div className={styles.topLeft}>
                {renderScores()}
                {renderDeathWallDistance()}
                {renderGameCountdown()}
            </div>

            <div className={styles.topCenter}>
                {renderGameModeHeader()}
                {renderCountdown()}
            </div>

            <div className={styles.bottomLeft}>
                {renderPlayerStats()}
            </div>

            <div className={styles.bottomRight}>
                {renderEvents()}
            </div>
        </div>
    );
};

export default GameOverlay;
import React from 'react';
import styles from './styles.module.css';
import { isMobile } from 'react-device-detect';

const MobileSpectatorView = ({ gameState, players, scores, gameMode }) => {
    if (!isMobile) return null;

    return (
        <div className={styles.mobileContainer}>
            <div className={styles.header}>
                <h2 className={styles.title}>Spectator Mode</h2>
                <div className={styles.gameInfo}>
                    {gameMode?.title && (
                        <span className={styles.gameMode}>{gameMode.title}</span>
                    )}
                </div>
            </div>

            {scores && gameMode?.title === 'Football' && (
                <div className={styles.scoreBoard}>
                    <div className={styles.team}>
                        <span className={styles.teamName}>Team 1</span>
                        <span className={styles.score} style={{ color: '#ff4444' }}>{scores.team1}</span>
                    </div>
                    <div className={styles.divider}>-</div>
                    <div className={styles.team}>
                        <span className={styles.teamName}>Team 2</span>
                        <span className={styles.score} style={{ color: '#6a5acd' }}>{scores.team2}</span>
                    </div>
                </div>
            )}

            <div className={styles.playerList}>
                <h3 className={styles.sectionTitle}>Active Players</h3>
                {players && players.length > 0 ? (
                    <div className={styles.players}>
                        {players
                            .filter(p => p.name && !p.orb)
                            .sort((a, b) => (b.score || 0) - (a.score || 0))
                            .map((player, index) => (
                                <div key={player.name} className={styles.playerCard}>
                                    <div className={styles.playerRank}>#{index + 1}</div>
                                    <div className={styles.playerInfo}>
                                        <span className={styles.playerName}>{player.name}</span>
                                        <div className={styles.playerStats}>
                                            <span className={styles.stat}>
                                                Health: {player.health || 100}%
                                            </span>
                                            {player.score !== undefined && (
                                                <span className={styles.stat}>
                                                    Score: {player.score}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div 
                                        className={styles.playerColor} 
                                        style={{ backgroundColor: player.colour || '#999' }}
                                    />
                                </div>
                            ))}
                    </div>
                ) : (
                    <p className={styles.noPlayers}>Waiting for players...</p>
                )}
            </div>

            <div className={styles.notice}>
                <p>Join on desktop to play!</p>
            </div>
        </div>
    );
};

export default MobileSpectatorView;
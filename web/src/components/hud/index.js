import React from 'react';
import { connect } from 'react-redux';
import { PlayFabClient } from 'playfab-sdk';
import Utils from '../../utils';
import styles from './styles.module.css';
import { LOG_IN, PLAYING, USERNAME_UPDATED, IMAGE_UPDATED, CAMERA } from '../../constants/actionTypes';
import { FOLLOWING, DRAG } from '../../constants/cameraTypes';
import Avatars from '../avatars';

const mapStateToProps = state => ({
    players: state.stats.players,
    user: state.logIn.user,
    isPlaying: state.options.playing,
    cameraType: state.options.cameraType
});

const mapDispatchToProps = dispatch => ({
    logIn: x => dispatch({ type: LOG_IN, payload: x }),
    updateName: x => dispatch({ type: USERNAME_UPDATED, name: x }),
    updateImage: x => dispatch({ type: IMAGE_UPDATED, image: x }),
    setPlaying: x => dispatch({ type: PLAYING, playing: x }),
    setCamera: x => dispatch({ type: CAMERA, cameraType: x })
});

class GameHUD extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            playerStats: null,
            gameMode: { title: null, subtitle: null },
            scores: { team1: 0, team2: 0 },
            events: [],
            countdown: null,
            gameCountdown: null,
            lastWinner: null,
            showSettingsMenu: false,
            showLeaderboard: false,
            showControls: false,
            showAvatarSelection: false,
            showNameChange: false,
            newUsername: '',
            rank: null,
            leaderboardData: [],
            loadingLeaderboard: false
        };
        
        this.bindMethods();
    }

    updatePlayerStats = (stats) => {
        this.setState({ playerStats: stats });
    }

    updateGameMode = (gameMode) => {
        this.setState({ gameMode });
    }

    updateScores = (scores) => {
        this.setState({ scores });
    }

    updateEvents = (newEvents) => {
        const currentTime = Date.now();
        
        // Ensure newEvents is an array
        const eventsArray = Array.isArray(newEvents) ? newEvents : [newEvents];
        
        const updatedEvents = [...this.state.events, ...eventsArray.map(event => ({
            ...event,
            timestamp: event.timestamp || currentTime
        }))];
        
        // Limit to 10 most recent events (expiration handled by cleanup interval)
        const filteredEvents = updatedEvents.slice(-10);
        
        this.setState({ events: filteredEvents });
    }

    updateCountdown = (countdown) => {
        this.setState({ countdown });
    }

    updateGameCountdown = (gameCountdown) => {
        this.setState({ gameCountdown });
    }

    updateLastWinner = (lastWinner) => {
        this.setState({ lastWinner });
    }

    bindMethods = () => {
        this.handleJoinGame = this.handleJoinGame.bind(this);
        this.handleQuitGame = this.handleQuitGame.bind(this);
        this.handleLogin = this.handleLogin.bind(this);
        this.handlePlayAnonymously = this.handlePlayAnonymously.bind(this);
        this.toggleSettings = this.toggleSettings.bind(this);
        this.toggleCamera = this.toggleCamera.bind(this);
        this.showLeaderboard = this.showLeaderboard.bind(this);
        this.showControls = this.showControls.bind(this);
        this.showAvatarSelection = this.showAvatarSelection.bind(this);
        this.showNameChange = this.showNameChange.bind(this);
        this.hideAllModals = this.hideAllModals.bind(this);
    }

    componentDidMount() {
        // Setup Google Sign-In if user is not logged in
        if (!this.props.user?.loggedIn) {
            setTimeout(() => {
                if (window.gapi?.signin2) {
                    window.gapi.signin2.render('hud-g-signin2', {
                        'scope': 'profile email',
                        'theme': 'dark',
                        'onsuccess': this.handleLogin,
                        'width': 200
                    });
                }
            }, 1000);
        }

        // Get player rank if logged in
        if (this.props.user?.loggedIn) {
            this.updatePlayerRank();
        }

        // Setup event expiration cleanup
        this.eventCleanupInterval = setInterval(() => {
            this.cleanupExpiredEvents();
        }, 1000); // Check every second
    }

    componentWillUnmount() {
        if (this.eventCleanupInterval) {
            clearInterval(this.eventCleanupInterval);
        }
    }

    cleanupExpiredEvents = () => {
        const currentTime = Date.now();
        const filteredEvents = this.state.events.filter(event => 
            currentTime - event.timestamp < 8000 // Expire after 8 seconds
        );
        
        if (filteredEvents.length !== this.state.events.length) {
            this.setState({ events: filteredEvents });
        }
    }

    updatePlayerRank = () => {
        PlayFabClient.GetPlayerStatistics({
            StatisticNames: ["rank"]
        }, (error, response) => {
            if (response) {
                const rank = response.data?.Statistics[0]?.Value || 1000;
                this.setState({ rank });
            }
        });
    }

    handleLogin = () => {
        const user = window.gapi.auth2.getAuthInstance().currentUser.get();
        const accessToken = user.getAuthResponse(true).access_token;
        
        PlayFabClient.LoginWithGoogleAccount({
            AccessToken: accessToken,
            CreateAccount: true,
            TitleId: "5B7C3",
        }, (error, response) => {
            if (response) {
                PlayFabClient.GetPlayerProfile({
                    ProfileConstraints: { ShowDisplayName: true, ShowAvatarUrl: true },
                    PlayFabId: response.data.PlayFabId
                }, (userError, userResponse) => {
                    if (userResponse) {
                        this.props.logIn(userResponse.data.PlayerProfile);
                        this.updatePlayerRank();
                    }
                });
            }
        });
    }

    handlePlayAnonymously = () => {
        let customId = localStorage.getItem("customId");
        if (!customId) {
            customId = Utils.uuidv4();
            localStorage.setItem("customId", customId);
        }
        
        PlayFabClient.LoginWithCustomID({
            CreateAccount: true,
            TitleId: "5B7C3",
            CustomId: customId
        }, (error, response) => {
            if (response) {
                PlayFabClient.GetPlayerProfile({
                    ProfileConstraints: { ShowDisplayName: true, ShowAvatarUrl: true },
                    PlayFabId: response.data.PlayFabId
                }, (userError, userResponse) => {
                    if (userResponse) {
                        this.props.logIn(userResponse.data.PlayerProfile);
                        this.updatePlayerRank();
                    }
                });
            }
        });
    }

    handleJoinGame = () => {
        this.props.setPlaying(true);
    }

    handleQuitGame = () => {
        this.props.setPlaying(false);
    }

    toggleSettings = () => {
        this.setState(prev => ({ showSettingsMenu: !prev.showSettingsMenu }));
    }

    toggleCamera = () => {
        const newCamera = this.props.cameraType === FOLLOWING ? DRAG : FOLLOWING;
        this.props.setCamera(newCamera);
    }

    showLeaderboard = () => {
        this.setState({ showLeaderboard: true, showSettingsMenu: false, loadingLeaderboard: true });
        this.loadLeaderboard();
    }

    showControls = () => {
        this.setState({ showControls: true, showSettingsMenu: false });
    }

    showAvatarSelection = () => {
        this.setState({ showAvatarSelection: true, showSettingsMenu: false });
    }

    showNameChange = () => {
        this.setState({ showNameChange: true, showSettingsMenu: false });
    }

    hideAllModals = () => {
        this.setState({ 
            showLeaderboard: false, 
            showControls: false, 
            showAvatarSelection: false, 
            showNameChange: false 
        });
    }

    loadLeaderboard = () => {
        if (!this.props.user?.loggedIn) {
            this.setState({ loadingLeaderboard: false });
            return;
        }

        const consolidatedLeaderboards = {};
        let completedRequests = 0;
        const totalRequests = 5;

        const processComplete = () => {
            completedRequests++;
            if (completedRequests === totalRequests) {
                const leaderboardArray = Object.values(consolidatedLeaderboards).map(player => ({
                    ...player,
                    killdeath: player.kills && player.deaths ? Math.round((player.kills / player.deaths) * 100) / 100 : 0
                })).sort((a, b) => (b.rank || 0) - (a.rank || 0));
                
                this.setState({ 
                    leaderboardData: leaderboardArray,
                    loadingLeaderboard: false 
                });
            }
        };

        const getLeaderboard = (statName) => {
            PlayFabClient.GetLeaderboard({
                MaxResultsCount: 50,
                StatisticName: statName
            }, (error, result) => {
                if (result?.data?.Leaderboard) {
                    result.data.Leaderboard.forEach(row => {
                        if (!consolidatedLeaderboards[row.PlayFabId]) {
                            consolidatedLeaderboards[row.PlayFabId] = {
                                name: row.DisplayName || row.PlayFabId,
                                wins: 0,
                                losses: 0,
                                kills: 0,
                                deaths: 0,
                                rank: 0
                            };
                        }
                        consolidatedLeaderboards[row.PlayFabId][statName] = row.StatValue;
                    });
                }
                processComplete();
            });
        };

        // Load all leaderboard statistics
        getLeaderboard('wins');
        getLeaderboard('losses');
        getLeaderboard('kills');
        getLeaderboard('deaths');
        getLeaderboard('rank');
    }

    renderHealthBar = (player) => {
        const healthPercent = Math.max(0, player.health);
        return (
            <div className={styles.healthBar}>
                <div className={styles.healthBarLabel}>Health</div>
                <div className={styles.healthBarContainer}>
                    <div 
                        className={styles.healthBarFill}
                        style={{ width: `${healthPercent}%` }}
                    />
                </div>
            </div>
        );
    }

    renderStaminaBar = (player) => {
        const staminaPercent = Math.max(0, 100 - player.boostCooldown);
        return (
            <div className={styles.staminaBar}>
                <div className={styles.staminaBarLabel}>Stamina</div>
                <div className={styles.staminaBarContainer}>
                    <div 
                        className={styles.staminaBarFill}
                        style={{ width: `${staminaPercent}%` }}
                    />
                </div>
            </div>
        );
    }

    renderPlayerAvatar = (player) => {
        return (
            <div className={styles.playerAvatar}>
                <div 
                    className={styles.avatarIcon}
                    style={{ backgroundColor: player.colour }}
                >
                    {player.name?.charAt(0)?.toUpperCase()}
                </div>
            </div>
        );
    }

    renderGameTitle = () => {
        const { gameMode, countdown, lastWinner } = this.state;
        const showWinner = countdown > 60 && lastWinner;
        const showCentered = showWinner; // Only center when showing winner

        // Don't render if no game mode data
        if (!gameMode.title && !showWinner) return null;

        return (
            <div className={showCentered ? styles.gameTitleCentered : styles.gameTitle}>
                {showWinner ? (
                    <div className={styles.winnerText}>{lastWinner.name} won!</div>
                ) : (
                    <>
                        <div className={styles.gameTitleMain}>{gameMode.title || 'Game'}</div>
                        {gameMode.subtitle && <div className={styles.gameTitleSub}>{gameMode.subtitle}</div>}
                    </>
                )}
            </div>
        );
    }

    renderCountdown = () => {
        const { countdown } = this.state;
        if (!countdown) return null;

        const timerText = Math.round(countdown / 20);
        const displayText = timerText === 0 ? "Go!" : timerText;

        return (
            <div className={styles.countdownTimer}>
                {displayText}
            </div>
        );
    }

    renderEvents = () => {
        const { events } = this.state;
        const visibleEvents = events.slice(0, 10);

        return (
            <div className={styles.eventsFeed}>
                {visibleEvents.map((event, index) => {
                    const eventClass = this.getEventClassName(event.type);
                    return (
                        <div key={index} className={`${styles.eventItem} ${eventClass}`}>
                            {this.formatEventText(event)}
                        </div>
                    );
                })}
            </div>
        );
    }

    getEventClassName = (eventType) => {
        switch (eventType) {
            case 'death':
                return styles.eventItemDeath;
            case 'goal':
                return styles.eventItemGoal;
            case 'halo':
                return styles.eventItemHalo;
            case 'box':
                return styles.eventItemBox;
            default:
                return styles.eventItemDefault;
        }
    }

    formatEventText = (event) => {
        switch (event.type) {
            case 'death':
                if (!event.killer) {
                    // Non-player death: <player name> <method>
                    return (
                        <span>
                            <span style={{ color: event.killed.colour }}>{event.killed.name}</span>
                            <span style={{ color: event.colour || 'red' }}> {event.method}</span>
                        </span>
                    );
                }
                // Player kill: <killed> <method> <killer>
                return (
                    <span>
                        <span style={{ color: event.killed.colour }}>{event.killed.name}</span>
                        <span style={{ color: event.colour || 'red' }}> {event.method} </span>
                        <span style={{ color: event.killer.colour }}>{event.killer.name}</span>
                    </span>
                );
            case 'halo':
                return (
                    <span>
                        <span style={{ color: event.from.colour }}>{event.from.name}</span>
                        <span style={{ color: 'yellow' }}> took the halo from </span>
                        <span style={{ color: event.to.colour }}>{event.to.name}</span>
                    </span>
                );
            case 'box':
                return (
                    <span>
                        <span style={{ color: event.player.colour }}>{event.player.name}</span>
                        <span style={{ color: 'yellow' }}> collected a box</span>
                    </span>
                );
            case 'goal':
                return (
                    <span style={{ color: event.colour }}>
                        {event.colour} team conceded a goal.
                    </span>
                );
            default:
                return <span>{event.type}</span>;
        }
    }

    renderScores = () => {
        const { gameMode, scores } = this.state;
        
        if (gameMode.title === "Football") {
            return (
                <div className={styles.footballScores}>
                    <span style={{ color: 'red' }}>{scores.team1}</span>
                    <span>-</span>
                    <span style={{ color: 'slateblue' }}>{scores.team2}</span>
                </div>
            );
        }

        if (gameMode.title === "Death Wall") {
            // This would be handled by the game state
            return null;
        }

        if (gameMode.title === "Tag" && this.state.gameCountdown) {
            return (
                <div className={styles.gameTimer}>
                    {(this.state.gameCountdown / 60).toFixed(2)}
                </div>
            );
        }

        return null;
    }

    renderLoginScreen = () => {
        return (
            <div className={styles.loginOverlay}>
                <div className={styles.loginContainer}>
                    <div className={styles.loginTitle}>Welcome to Hitbox</div>
                    <div className={styles.loginOptions}>
                        <button 
                            className={styles.playAnonymousButton}
                            onClick={this.handlePlayAnonymously}
                        >
                            Play Anonymously
                        </button>
                        <div className={styles.loginOr}>or</div>
                        <div id="hud-g-signin2" className={styles.googleSignIn}></div>
                    </div>
                </div>
            </div>
        );
    }

    renderUserInfo = () => {
        const { user, isPlaying } = this.props;
        const { rank } = this.state;

        if (!user?.loggedIn) return null;

        return (
            <div className={styles.userInfo}>
                <div className={styles.userProfile}>
                    <img 
                        src={user.image} 
                        alt="Avatar" 
                        className={styles.userAvatar}
                    />
                    <div className={styles.userDetails}>
                        <div className={styles.userName}>{user.name}</div>
                        <div className={styles.userRank}>Rank: {rank || '?'}</div>
                    </div>
                </div>
                <div className={styles.userActions}>
                    {isPlaying ? (
                        <button 
                            className={styles.quitButton}
                            onClick={this.handleQuitGame}
                        >
                            Quit Game
                        </button>
                    ) : (
                        <button 
                            className={styles.joinButton}
                            onClick={this.handleJoinGame}
                        >
                            Join Game
                        </button>
                    )}
                    <button 
                        className={styles.settingsButton}
                        onClick={this.toggleSettings}
                    >
                        <i className="fas fa-cog"></i>
                    </button>
                </div>
            </div>
        );
    }

    renderSettingsMenu = () => {
        if (!this.state.showSettingsMenu) return null;

        return (
            <div className={styles.settingsMenu}>
                <div className={styles.settingsTitle}>Settings</div>
                <button 
                    className={styles.settingOption}
                    onClick={this.toggleCamera}
                >
                    Camera: {this.props.cameraType}
                </button>
                <button 
                    className={styles.settingOption}
                    onClick={this.showLeaderboard}
                >
                    Leaderboard
                </button>
                <button 
                    className={styles.settingOption}
                    onClick={this.showControls}
                >
                    Controls
                </button>
                <button 
                    className={styles.settingOption}
                    onClick={this.showAvatarSelection}
                >
                    Change Avatar
                </button>
                <button 
                    className={styles.settingOption}
                    onClick={this.showNameChange}
                >
                    Change Name
                </button>
            </div>
        );
    }

    renderLeaderboardModal = () => {
        if (!this.state.showLeaderboard) return null;
        
        return (
            <div className={styles.modalOverlay} onClick={this.hideAllModals}>
                <div className={styles.modalContainer} onClick={e => e.stopPropagation()}>
                    <div className={styles.modalHeader}>
                        <h2>Leaderboard</h2>
                        <button className={styles.modalClose} onClick={this.hideAllModals}>×</button>
                    </div>
                    <div className={styles.modalContent}>
                        {this.state.loadingLeaderboard ? (
                            <div className={styles.loadingContainer}>
                                <div className={styles.loadingSpinner}></div>
                                <p>Loading leaderboard...</p>
                            </div>
                        ) : (
                            <div className={styles.leaderboardContainer}>
                                <div className={styles.leaderboardHeader}>
                                    <div className={styles.headerCell}>Rank</div>
                                    <div className={styles.headerCell}>Name</div>
                                    <div className={styles.headerCell}>Wins</div>
                                    <div className={styles.headerCell}>Kills</div>
                                    <div className={styles.headerCell}>Deaths</div>
                                    <div className={styles.headerCell}>K/D</div>
                                    <div className={styles.headerCell}>Score</div>
                                </div>
                                <div className={styles.leaderboardBody}>
                                    {this.state.leaderboardData.slice(0, 20).map((player, index) => (
                                        <div key={player.name} className={styles.leaderboardRow}>
                                            <div className={styles.rankCell}>#{index + 1}</div>
                                            <div className={styles.nameCell}>{player.name}</div>
                                            <div className={styles.statCell}>{player.wins || 0}</div>
                                            <div className={styles.statCell}>{player.kills || 0}</div>
                                            <div className={styles.statCell}>{player.deaths || 0}</div>
                                            <div className={styles.statCell}>{player.killdeath || 0}</div>
                                            <div className={styles.statCell}>{player.rank || 0}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    renderControlsModal = () => {
        if (!this.state.showControls) return null;
        
        return (
            <div className={styles.modalOverlay} onClick={this.hideAllModals}>
                <div className={styles.modalContainer} onClick={e => e.stopPropagation()}>
                    <div className={styles.modalHeader}>
                        <h2>Game Controls</h2>
                        <button className={styles.modalClose} onClick={this.hideAllModals}>×</button>
                    </div>
                    <div className={styles.modalContent}>
                        <div className={styles.controlsContainer}>
                            <div className={styles.gameDescription}>
                                <h3>How to Play</h3>
                                <p>
                                    The aim is to eliminate other players by colliding with them at high speed. 
                                    Faster collisions deal more damage. Use boost strategically but watch your stamina. 
                                    Crouching makes you invulnerable to horizontal attacks but you can't move.
                                </p>
                            </div>
                            
                            <div className={styles.controlsGrid}>
                                <div className={styles.controlsSection}>
                                    <h3>Keyboard Controls</h3>
                                    <div className={styles.controlsList}>
                                        <div className={styles.controlItem}>
                                            <span className={styles.controlKey}>Space / W</span>
                                            <span className={styles.controlAction}>Jump</span>
                                        </div>
                                        <div className={styles.controlItem}>
                                            <span className={styles.controlKey}>A / Double tap</span>
                                            <span className={styles.controlAction}>Move Left / Boost Left</span>
                                        </div>
                                        <div className={styles.controlItem}>
                                            <span className={styles.controlKey}>D / Double tap</span>
                                            <span className={styles.controlAction}>Move Right / Boost Right</span>
                                        </div>
                                        <div className={styles.controlItem}>
                                            <span className={styles.controlKey}>S</span>
                                            <span className={styles.controlAction}>Crouch / Pound</span>
                                        </div>
                                        <div className={styles.controlItem}>
                                            <span className={styles.controlKey}>Scroll Wheel</span>
                                            <span className={styles.controlAction}>Zoom Camera</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className={styles.controlsSection}>
                                    <h3>Controller</h3>
                                    <div className={styles.controlsList}>
                                        <div className={styles.controlItem}>
                                            <span className={styles.controlKey}>Left Analog</span>
                                            <span className={styles.controlAction}>Move</span>
                                        </div>
                                        <div className={styles.controlItem}>
                                            <span className={styles.controlKey}>A</span>
                                            <span className={styles.controlAction}>Jump</span>
                                        </div>
                                        <div className={styles.controlItem}>
                                            <span className={styles.controlKey}>X</span>
                                            <span className={styles.controlAction}>Crouch / Pound</span>
                                        </div>
                                        <div className={styles.controlItem}>
                                            <span className={styles.controlKey}>RB / RT</span>
                                            <span className={styles.controlAction}>Boost Right</span>
                                        </div>
                                        <div className={styles.controlItem}>
                                            <span className={styles.controlKey}>LB / LT</span>
                                            <span className={styles.controlAction}>Boost Left</span>
                                        </div>
                                        <div className={styles.controlItem}>
                                            <span className={styles.controlKey}>Right Analog</span>
                                            <span className={styles.controlAction}>Zoom Camera</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    renderAvatarSelectionModal = () => {
        if (!this.state.showAvatarSelection) return null;
        
        return (
            <div className={styles.modalOverlay} onClick={this.hideAllModals}>
                <div className={styles.modalContainer} onClick={e => e.stopPropagation()}>
                    <div className={styles.modalHeader}>
                        <h2>Choose Avatar</h2>
                        <button className={styles.modalClose} onClick={this.hideAllModals}>×</button>
                    </div>
                    <div className={styles.modalContent}>
                        <Avatars onChange={this.handleAvatarChange} />
                    </div>
                </div>
            </div>
        );
    }

    renderNameChangeModal = () => {
        if (!this.state.showNameChange) return null;
        
        return (
            <div className={styles.modalOverlay} onClick={this.hideAllModals}>
                <div className={styles.modalContainer} onClick={e => e.stopPropagation()}>
                    <div className={styles.modalHeader}>
                        <h2>Change Name</h2>
                        <button className={styles.modalClose} onClick={this.hideAllModals}>×</button>
                    </div>
                    <div className={styles.modalContent}>
                        <div className={styles.nameChangeForm}>
                            <input
                                type="text"
                                placeholder="Enter new name"
                                value={this.state.newUsername}
                                onChange={e => this.setState({newUsername: e.target.value})}
                                className={styles.nameInput}
                                maxLength={25}
                            />
                            <button 
                                className={styles.nameSubmitButton}
                                onClick={this.handleNameChange}
                                disabled={!this.state.newUsername.trim()}
                            >
                                Update Name
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    handleAvatarChange = (url) => {
        const etag = Utils.uuidv4();
        this.props.updateImage(`${url}?etag=${etag}`);
        PlayFabClient.UpdateAvatarUrl({
            ImageUrl: `${url}?etag=${etag}`
        });
        this.hideAllModals();
    }

    handleNameChange = () => {
        const newName = this.state.newUsername.trim();
        if (!newName || newName.length < 3) return;
        
        PlayFabClient.UpdateUserTitleDisplayName({
            DisplayName: newName
        }, (error, response) => {
            if (response) {
                this.props.updateName(newName);
                this.setState({newUsername: ''});
                this.hideAllModals();
            }
        });
    }

    render() {
        const { playerStats, gameMode, events, countdown } = this.state;
        const { user, isPlaying } = this.props;
        const currentPlayer = playerStats;

        return (
            <div className={styles.hudContainer}>
                {/* Login Screen for non-logged-in users */}
                {!user?.loggedIn && this.renderLoginScreen()}

                {/* Main Game HUD - only show when logged in */}
                {user?.loggedIn && (
                    <>
                        {/* Top Left - Game Info */}
                        <div className={styles.topLeft}>
                            {this.renderGameTitle()}
                            {this.renderScores()}
                        </div>

                        {/* Top Right - Events Feed */}
                        <div className={styles.topRight}>
                            {this.renderEvents()}
                        </div>

                        {/* Bottom Left - Player Avatar & Stats (only when playing) */}
                        {currentPlayer && isPlaying && (
                            <div className={styles.bottomLeft}>
                                <div className={styles.playerBars}>
                                    {this.renderHealthBar(currentPlayer)}
                                    {this.renderStaminaBar(currentPlayer)}
                                </div>
                            </div>
                        )}

                        {/* Bottom Right - User Info & Controls */}
                        <div className={styles.bottomRight}>
                            {this.renderUserInfo()}
                            {this.renderSettingsMenu()}
                        </div>

                        {/* Center - Countdown */}
                        {this.renderCountdown()}
                    </>
                )}

                {/* Modals */}
                {this.renderLeaderboardModal()}
                {this.renderControlsModal()}
                {this.renderAvatarSelectionModal()}
                {this.renderNameChangeModal()}
            </div>
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps, null, {forwardRef: true})(GameHUD);
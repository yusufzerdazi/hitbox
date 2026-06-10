import React from 'react';
import styles from './styles.module.css';
import { TrainingService } from '../../services/training.service';

const MODES = [
    'Battle Royale',
    'Spleef',
    'Tag',
    'Collect the Boxes',
    'Death Wall',
    'Football',
    'Capture The Flag',
];

// Snapshot replay runs at the original game rate (60 ticks/s); a single
// snapshot is at most ~1500 frames so it loops every ~25s.
const FRAME_INTERVAL_MS = 1000 / 60;

function emptyMode() {
    return {
        history: [],
        snapshot: null,
        // Newest snapshot received while another is still playing — promoted
        // to `snapshot` when the current playback finishes its loop. Lets
        // the viewer see one full match before the canvas swaps.
        pendingSnapshot: null,
        latestStats: null,
        frameIdx: 0,
        justSnapshotted: false,
        flashKey: 0,
    };
}

// The original game space is 960x540 with origin in the top-left of the visible
// area. We render snapshots in the same coordinate system, fitting the level's
// bounding box into the canvas with letterboxing.
function computeBounds(level) {
    if (!level || !level.platforms.length) {
        return { minX: -200, minY: -300, maxX: 1160, maxY: 740 };
    }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of level.platforms) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x + p.width);
        maxY = Math.max(maxY, p.y + p.height);
    }
    // Pad so players don't touch the canvas edges.
    const padX = (maxX - minX) * 0.05;
    const padY = (maxY - minY) * 0.1;
    return {
        minX: minX - padX,
        minY: minY - padY,
        maxX: maxX + padX,
        maxY: maxY + padY,
    };
}

class TrainingPage extends React.Component {
    constructor(props) {
        super(props);
        const byMode = {};
        for (const m of MODES) byMode[m] = emptyMode();
        this.state = {
            selectedMode: MODES[0],
            connected: false,
            byMode,
        };
        this.canvasRef = React.createRef();
        this.chartRef = React.createRef();
        this.service = new TrainingService();
        this.lastFrameAt = 0;
        this.animationFrame = null;
        this.unsubscribe = null;
    }

    componentDidMount() {
        this.service.connect();
        this.unsubscribe = this.service.onMessage((msg) => this.handleMessage(msg));
        this.service.status().then((s) => {
            // /api/status with no ?mode returns a summary across modes; we
            // pre-populate latest stats so the chart isn't blank on first paint.
            if (s && s.summary) {
                this.setState((prev) => {
                    const byMode = { ...prev.byMode };
                    for (const m of MODES) {
                        const entry = s.summary[m];
                        if (entry?.latest) {
                            byMode[m] = { ...byMode[m], latestStats: entry.latest, history: [entry.latest] };
                        }
                    }
                    return { byMode };
                });
            }
        }).catch(() => { /* server might not be up; that's fine */ });
        this.animationFrame = requestAnimationFrame(this.tick);
    }

    componentWillUnmount() {
        if (this.unsubscribe) this.unsubscribe();
        if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
        this.service.disconnect();
    }

    handleMessage = (msg) => {
        switch (msg.type) {
            case 'hello':
                // perMode arrives with full buffers for every mode. Seed each.
                this.setState((prev) => {
                    const byMode = { ...prev.byMode };
                    for (const m of MODES) {
                        const seed = msg.perMode && msg.perMode[m];
                        if (!seed) continue;
                        byMode[m] = {
                            ...byMode[m],
                            history: seed.recentStats || [],
                            latestStats: (seed.recentStats || []).slice(-1)[0] || null,
                            snapshot: seed.latestSnapshot || null,
                            frameIdx: 0,
                        };
                    }
                    return { connected: true, byMode };
                });
                break;
            case 'stats': {
                // Append to the relevant mode's history; other modes untouched.
                const mode = msg.mode;
                if (!MODES.includes(mode)) break;
                this.setState((prev) => {
                    const cur = prev.byMode[mode];
                    return {
                        connected: true,
                        byMode: {
                            ...prev.byMode,
                            [mode]: {
                                ...cur,
                                latestStats: msg.data,
                                history: [...cur.history, msg.data].slice(-500),
                            },
                        },
                    };
                });
                break;
            }
            case 'snapshot': {
                const mode = msg.mode;
                if (!MODES.includes(mode)) break;
                // If this mode is currently being viewed AND already has a
                // playback in flight, queue the new one — we'll swap when
                // the current loop finishes. Otherwise promote immediately.
                const isViewing = mode === this.state.selectedMode;
                const cur = this.state.byMode[mode];
                const playbackInFlight = isViewing && !!cur.snapshot && cur.snapshot.frames?.length > 0;
                if (playbackInFlight) {
                    this.setState((prev) => ({
                        connected: true,
                        byMode: {
                            ...prev.byMode,
                            [mode]: { ...prev.byMode[mode], pendingSnapshot: msg.data },
                        },
                    }));
                } else {
                    this.setState((prev) => ({
                        connected: true,
                        byMode: {
                            ...prev.byMode,
                            [mode]: {
                                ...prev.byMode[mode],
                                snapshot: msg.data,
                                pendingSnapshot: null,
                                frameIdx: 0,
                                flashKey: prev.byMode[mode].flashKey + 1,
                                justSnapshotted: true,
                            },
                        },
                    }));
                    setTimeout(() => {
                        this.setState((prev) => ({
                            byMode: {
                                ...prev.byMode,
                                [mode]: { ...prev.byMode[mode], justSnapshotted: false },
                            },
                        }));
                    }, 1500);
                }
                break;
            }
            case 'disconnect':
                this.setState({ connected: false });
                break;
            default:
                break;
        }
    };

    tick = (t) => {
        // Advance the selected mode's snapshot playback head and redraw both
        // canvases. Switching modes doesn't have to reset anything except the
        // last-frame timer.
        const mode = this.state.selectedMode;
        const cur = this.state.byMode[mode];
        const snap = cur?.snapshot;
        if (snap && snap.frames.length > 0) {
            if (!this.lastFrameAt) this.lastFrameAt = t;
            const elapsed = t - this.lastFrameAt;
            if (elapsed >= FRAME_INTERVAL_MS) {
                const steps = Math.min(8, Math.floor(elapsed / FRAME_INTERVAL_MS));
                const newIdx = cur.frameIdx + steps;
                // If we just rolled past the end of the snapshot AND a newer
                // snapshot is queued, promote it now (the previous match is
                // done playing). Otherwise just loop.
                const wrapped = newIdx >= snap.frames.length;
                const hasPending = wrapped && !!cur.pendingSnapshot;
                this.setState((prev) => {
                    const c = prev.byMode[mode];
                    if (hasPending && c.pendingSnapshot) {
                        return {
                            byMode: {
                                ...prev.byMode,
                                [mode]: {
                                    ...c,
                                    snapshot: c.pendingSnapshot,
                                    pendingSnapshot: null,
                                    frameIdx: 0,
                                    flashKey: c.flashKey + 1,
                                    justSnapshotted: true,
                                },
                            },
                        };
                    }
                    return {
                        byMode: {
                            ...prev.byMode,
                            [mode]: {
                                ...c,
                                frameIdx: newIdx % snap.frames.length,
                            },
                        },
                    };
                });
                if (hasPending) {
                    setTimeout(() => {
                        this.setState((prev) => ({
                            byMode: {
                                ...prev.byMode,
                                [mode]: { ...prev.byMode[mode], justSnapshotted: false },
                            },
                        }));
                    }, 1500);
                }
                this.lastFrameAt = t;
            }
        }
        this.draw();
        this.drawChart();
        this.animationFrame = requestAnimationFrame(this.tick);
    };

    chooseMode = (mode) => {
        // Pure UI switch — training keeps running for every mode. If a
        // pending snapshot was queued for this mode while it was hidden,
        // promote it now so the viewer sees the most recent match
        // immediately instead of an older loop.
        this.lastFrameAt = 0;
        this.setState((prev) => {
            const cur = prev.byMode[mode];
            if (cur?.pendingSnapshot) {
                return {
                    selectedMode: mode,
                    byMode: {
                        ...prev.byMode,
                        [mode]: {
                            ...cur,
                            snapshot: cur.pendingSnapshot,
                            pendingSnapshot: null,
                            frameIdx: 0,
                        },
                    },
                };
            }
            return { selectedMode: mode };
        });
    };

    draw() {
        const canvas = this.canvasRef.current;
        if (!canvas) return;
        const parent = canvas.parentElement;
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);

        const cur = this.state.byMode[this.state.selectedMode];
        const snap = cur?.snapshot;
        if (!snap || !snap.frames || !snap.frames.length) {
            return;
        }

        // Compute level → canvas transform: contain-fit the bounding box.
        const b = computeBounds(snap.level);
        const bw = b.maxX - b.minX;
        const bh = b.maxY - b.minY;
        const scale = Math.min(w / bw, h / bh);
        const offsetX = (w - bw * scale) / 2 - b.minX * scale;
        const offsetY = (h - bh * scale) / 2 - b.minY * scale;
        const toX = (x) => x * scale + offsetX;
        const toY = (y) => y * scale + offsetY;
        const toS = (s) => s * scale;

        if (snap.mode === 'Death Wall') {
            const grad = ctx.createLinearGradient(0, 0, w, 0);
            grad.addColorStop(0, 'rgba(255, 56, 100, 0.2)');
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
        }

        for (const p of snap.level.platforms) {
            const t = p.type;
            if (t === 'goal') {
                ctx.fillStyle = p.colour === 'red' ? 'rgba(255, 56, 100, 0.35)' : 'rgba(34, 211, 238, 0.35)';
                ctx.fillRect(toX(p.x), toY(p.y), toS(p.width), toS(p.height));
                ctx.strokeStyle = p.colour === 'red' ? '#ff3864' : '#22d3ee';
                ctx.lineWidth = 2;
                ctx.strokeRect(toX(p.x), toY(p.y), toS(p.width), toS(p.height));
                continue;
            }
            if (t === 'border') {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
                ctx.fillRect(toX(p.x), toY(p.y), toS(p.width), toS(p.height));
                continue;
            }
            if (t === 'hillfill' || t === 'solidfill') {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
                ctx.fillRect(toX(p.x), toY(p.y), toS(p.width), toS(p.height));
                continue;
            }
            const alpha = p.durability != null ? Math.max(0.2, Math.min(1, p.durability / 100)) : 1;
            ctx.fillStyle = `rgba(255, 255, 255, ${0.08 * alpha})`;
            ctx.fillRect(toX(p.x), toY(p.y), toS(p.width), toS(p.height));
            ctx.strokeStyle = `rgba(34, 211, 238, ${0.45 * alpha})`;
            ctx.lineWidth = 1.5;
            ctx.strokeRect(toX(p.x), toY(p.y), toS(p.width), toS(p.height));
        }

        const frame = snap.frames[Math.min(cur.frameIdx, snap.frames.length - 1)];
        if (!frame) return;

        for (const p of frame.players) {
            if (!p.alive) continue;
            const px = p.x;
            const py = p.y - p.height;
            const w2 = p.width;
            const h2 = p.height;

            if (p.type === 'ball') {
                ctx.beginPath();
                ctx.arc(toX(px + w2 / 2), toY(py + h2 / 2), toS(w2 / 2), 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
                ctx.strokeStyle = '#22d3ee';
                ctx.lineWidth = 2;
                ctx.stroke();
                continue;
            }
            if (p.type === 'flag') {
                ctx.fillStyle = p.colour === 'red' ? '#ff3864' : '#22d3ee';
                ctx.fillRect(toX(px), toY(py), toS(w2), toS(h2));
                ctx.fillStyle = '#fff';
                ctx.font = `${Math.floor(toS(40))}px UnitBlock, monospace`;
                ctx.fillText('F', toX(px) + toS(10), toY(py) + toS(50));
                continue;
            }
            if (p.type === 'orb' || p.orb) {
                ctx.beginPath();
                ctx.arc(toX(px + w2 / 2), toY(py + h2 / 2), toS(w2 / 2 + 8), 0, Math.PI * 2);
                ctx.fillStyle = '#facc15';
                ctx.shadowColor = '#facc15';
                ctx.shadowBlur = 18;
                ctx.fill();
                ctx.shadowBlur = 0;
                continue;
            }

            ctx.fillStyle = p.colour;
            const visualH = p.ducked ? h2 * 0.4 : h2;
            const visualY = p.ducked ? py + h2 - visualH : py;
            ctx.fillRect(toX(px), toY(visualY), toS(w2), toS(visualH));
            if (p.it) {
                ctx.strokeStyle = '#facc15';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(toX(px + w2 / 2), toY(py) - toS(15), toS(20), 0, Math.PI * 2);
                ctx.stroke();
            }
            if (p.health < 100 && p.health > 0) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                ctx.fillRect(toX(px), toY(py) - toS(15), toS(w2), toS(6));
                ctx.fillStyle = p.health < 30 ? '#ff3864' : '#34d399';
                ctx.fillRect(toX(px), toY(py) - toS(15), toS(w2 * p.health / 100), toS(6));
            }
        }
    }

    drawChart() {
        const canvas = this.chartRef.current;
        if (!canvas) return;
        const parent = canvas.parentElement;
        const w = parent.clientWidth;
        const h = parent.clientHeight;
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
        }
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);

        const cur = this.state.byMode[this.state.selectedMode];
        const hist = cur?.history || [];
        if (hist.length < 2) {
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Waiting for first generation...', w / 2, h / 2);
            return;
        }

        let mn = Infinity, mx = -Infinity;
        for (const s of hist) {
            if (s.best > mx) mx = s.best;
            if (s.worst < mn) mn = s.worst;
        }
        if (mn === mx) {
            mn -= 1;
            mx += 1;
        }
        const px = (i) => (i / (hist.length - 1)) * (w - 8) + 4;
        const py = (v) => h - 8 - ((v - mn) / (mx - mn)) * (h - 16);

        if (mn < 0 && mx > 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.beginPath();
            ctx.moveTo(0, py(0));
            ctx.lineTo(w, py(0));
            ctx.stroke();
        }

        const series = [
            { key: 'best', colour: '#34d399' },
            { key: 'mean', colour: '#22d3ee' },
            { key: 'worst', colour: '#ff3864' },
        ];
        for (const s of series) {
            ctx.beginPath();
            for (let i = 0; i < hist.length; i++) {
                const x = px(i);
                const y = py(hist[i][s.key]);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = s.colour;
            ctx.lineWidth = 1.5;
            ctx.shadowColor = s.colour;
            ctx.shadowBlur = 6;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        let lx = 8;
        for (const s of series) {
            ctx.fillStyle = s.colour;
            ctx.fillText(s.key.toUpperCase(), lx, 14);
            lx += 50;
        }
    }

    render() {
        const { selectedMode, connected, byMode } = this.state;
        const cur = byMode[selectedMode];
        const stats = cur?.latestStats || { generation: 0, best: 0, mean: 0, worst: 0, elapsedMs: 0 };
        const snapshot = cur?.snapshot;
        const justSnapshotted = cur?.justSnapshotted;
        const flashKey = cur?.flashKey || 0;
        const fmt = (v) => (v === 0 ? '0' : (v > 0 ? '+' : '') + v.toFixed(2));

        return (
            <div className={styles.container}>
                <div className={styles.topBar}>
                    <div>
                        <div className={styles.title}>Hitbox · Self-Play</div>
                        <div className={styles.subtitle}>
                            <span className={`${styles.statusDot} ${connected ? '' : styles.off}`} />
                            {connected ? 'All modes training in parallel' : 'Disconnected'} · viewing {selectedMode}
                        </div>
                    </div>
                    <div className={styles.modeBar}>
                        {MODES.map((m) => {
                            const gen = byMode[m]?.latestStats?.generation;
                            return (
                                <button
                                    key={m}
                                    className={`${styles.modeButton} ${m === selectedMode ? styles.active : ''}`}
                                    onClick={() => this.chooseMode(m)}
                                >
                                    {m}
                                    {gen != null && <span className={styles.modeGen}> · {gen}</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className={styles.body}>
                    <div className={styles.left}>
                        <div className={styles.canvasFrame}>
                            <canvas ref={this.canvasRef} className={styles.canvas} />
                            {(!snapshot || !snapshot.frames || !snapshot.frames.length) && (
                                <div className={styles.empty}>
                                    <div className={styles.big}>Waiting for showcase match…</div>
                                    <div>A full match is recorded every 1000 generations</div>
                                </div>
                            )}
                            <div className={styles.overlay}>
                                <div className={styles.bigGen}>
                                    {String(stats.generation).padStart(5, '0')}
                                </div>
                                <div className={styles.bigGenLabel}>generation</div>
                            </div>
                            {justSnapshotted && (
                                <div key={flashKey} className={styles.flash} />
                            )}
                            {snapshot && (
                                <>
                                    <div className={styles.snapshotBadge}>
                                        Showcase · gen {snapshot.generation}
                                    </div>
                                    <div className={styles.matchInfo}>
                                        Map: {snapshot.map} · Winner: {snapshot.winner || '—'}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className={styles.right}>
                        <div className={styles.statRow}>
                            <div className={styles.statCell}>
                                <div className={styles.statLabel}>Best fitness</div>
                                <div className={`${styles.statValue} ${stats.best >= 0 ? styles.good : styles.bad}`}>
                                    {fmt(stats.best)}
                                </div>
                            </div>
                            <div className={styles.statCell}>
                                <div className={styles.statLabel}>Mean</div>
                                <div className={styles.statValue}>{fmt(stats.mean)}</div>
                            </div>
                            <div className={styles.statCell}>
                                <div className={styles.statLabel}>Worst</div>
                                <div className={`${styles.statValue} ${styles.bad}`}>
                                    {fmt(stats.worst)}
                                </div>
                            </div>
                        </div>
                        <div className={styles.statRow}>
                            <div className={styles.statCell}>
                                <div className={styles.statLabel}>Gen ms</div>
                                <div className={styles.statValue}>{stats.elapsedMs || 0}</div>
                            </div>
                            <div className={styles.statCell}>
                                <div className={styles.statLabel}>Recent gens</div>
                                <div className={styles.statValue}>{cur?.history.length || 0}</div>
                            </div>
                            <div className={styles.statCell}>
                                <div className={styles.statLabel}>Snapshots</div>
                                <div className={styles.statValue}>
                                    {snapshot ? '✓' : '—'}
                                </div>
                            </div>
                        </div>
                        <div className={styles.chartFrame}>
                            <div className={styles.chartTitle}>Fitness over generations · {selectedMode}</div>
                            <canvas ref={this.chartRef} className={styles.chart} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

export default TrainingPage;

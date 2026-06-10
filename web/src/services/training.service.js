// Thin WebSocket client for the trainer process. The trainer server lives at
// :2568 by default (separate port from the game's Colyseus server at :2567).

const DEFAULT_HOST = (typeof window !== 'undefined' && window.location.hostname) || 'localhost';
const DEFAULT_PORT = 2568;

export class TrainingService {
    constructor(opts = {}) {
        this.host = opts.host || DEFAULT_HOST;
        this.port = opts.port || DEFAULT_PORT;
        this.ws = null;
        this.listeners = new Set();
        this.reconnectTimer = null;
        this.shouldReconnect = true;
    }

    url(path) {
        return `http://${this.host}:${this.port}${path}`;
    }

    wsUrl() {
        return `ws://${this.host}:${this.port}/ws`;
    }

    connect() {
        if (this.ws) return;
        this.shouldReconnect = true;
        const ws = new WebSocket(this.wsUrl());
        this.ws = ws;
        ws.onmessage = (e) => {
            try {
                const msg = JSON.parse(e.data);
                this.listeners.forEach((fn) => fn(msg));
            } catch (err) {
                console.warn('Bad WS payload', err);
            }
        };
        ws.onclose = () => {
            this.ws = null;
            this.listeners.forEach((fn) => fn({ type: 'disconnect' }));
            if (this.shouldReconnect) {
                clearTimeout(this.reconnectTimer);
                this.reconnectTimer = setTimeout(() => this.connect(), 1500);
            }
        };
        ws.onerror = () => {
            try {
                ws.close();
            } catch (_) {}
        };
    }

    disconnect() {
        this.shouldReconnect = false;
        clearTimeout(this.reconnectTimer);
        if (this.ws) {
            try {
                this.ws.close();
            } catch (_) {}
            this.ws = null;
        }
    }

    onMessage(fn) {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    async stop() {
        return fetch(this.url('/api/stop'), { method: 'POST' }).then((r) => r.json());
    }

    async status() {
        const r = await fetch(this.url('/api/status'));
        return r.json();
    }
}

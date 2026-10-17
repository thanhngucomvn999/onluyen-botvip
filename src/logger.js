import { CONFIG } from './constants.js';
export const logger = {
    history: [],
    _log(level, ...args) {
        const msg = `[ONLUYEN ${level}] ${args.join(' ')}`;
        this.history.push({ time: new Date(), level, msg });
        if (this.history.length > 200) this.history.shift();
        if (level === 'ERROR') console.error(msg);
        else if (level === 'WARN') console.warn(msg);
        else console.log(msg);
    },
    info(...args) { this._log('INFO', ...args); },
    warn(...args) { this._log('WARN', ...args); },
    error(...args) { this._log('ERROR', ...args); },
    debug(...args) { if (CONFIG.LOG_LEVEL === 'DEBUG') this._log('DEBUG', ...args); }
};

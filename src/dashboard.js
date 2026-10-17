import { CONFIG } from './constants.js';

export class BasicUI {
    constructor(solver) {
        this.solver = solver;
        this.overlay = null;
        this.statusEl = null;
        this.injectStyles();
        this.createPanel();
    }

    injectStyles() {
        if (document.getElementById('hw-solver-styles')) return;
        const style = document.createElement('style');
        style.id = 'hw-solver-styles';
        style.textContent = `
            #hw-solver-overlay { position: fixed; bottom: 20px; right: 20px; width: 280px; background: #1e293b; color: #f8fafc; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); z-index: 999999; font-family: -apple-system, sans-serif; overflow: hidden; border: 1px solid #334155; }
            #hw-solver-header { padding: 12px 16px; background: #0f172a; font-weight: bold; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; }
            #hw-solver-status { padding: 8px 16px; font-size: 0.85rem; color: #94a3b8; background: #1e293b; border-bottom: 1px solid #334155; }
            #hw-solver-controls { padding: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .hw-btn { padding: 8px 12px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.85rem; }
            .hw-btn-primary { background: #4F46E5; color: white; }
            .hw-btn-danger { background: #ef4444; color: white; }
            .hw-btn-secondary { background: #475569; color: white; }
            .hw-full { grid-column: span 2; }
        `;
        document.head.appendChild(style);
    }

    createPanel() {
        if (document.getElementById('hw-solver-overlay')) return;
        this.overlay = document.createElement('div');
        this.overlay.id = 'hw-solver-overlay';
        this.overlay.innerHTML = `
            <div id="hw-solver-header"><span>🚀 AI Solver</span><span style="cursor:pointer;" id="hw-solver-close">✖</span></div>
            <div id="hw-solver-status">Ready</div>
            <div id="hw-solver-controls">
                <button class="hw-btn hw-btn-primary hw-full" id="hw-btn-start">▶ Start</button>
                <button class="hw-btn hw-btn-secondary" id="hw-btn-stop">⏹ Stop</button>
                <button class="hw-btn hw-btn-secondary" id="hw-btn-solve-once">⚡ Solve Once</button>
                <button class="hw-btn hw-btn-secondary" id="hw-btn-settings">⚙ Settings</button>
                <button class="hw-btn hw-btn-danger hw-full" id="hw-btn-clear">🗑 Clear All</button>
            </div>
        `;
        document.body.appendChild(this.overlay);
        this.statusEl = this.overlay.querySelector('#hw-solver-status');
        
        this.overlay.querySelector('#hw-solver-close').onclick = () => this.overlay.style.display = 'none';
        this.overlay.querySelector('#hw-btn-start').onclick = () => { this.solver.start(); this.updateStatus('Running', '#27ae60'); };
        this.overlay.querySelector('#hw-btn-stop').onclick = () => { this.solver.stop(); this.updateStatus('Stopped', '#c0392b'); };
        this.overlay.querySelector('#hw-btn-solve-once').onclick = async () => { this.updateStatus('Solving...', '#3498db'); await this.solver.solveOnce(); };
        this.overlay.querySelector('#hw-btn-settings').onclick = () => {
            const info = `Gateways: ${CONFIG.GATEWAYS.map(g => g.name).join(', ')}\nDelay: ${CONFIG.LOOP_INTERVAL_MS}ms\nLog Level: ${CONFIG.LOG_LEVEL}`;
            alert(info);
        };
        this.overlay.querySelector('#hw-btn-clear').onclick = () => { this.solver.clearAnswers(); this.updateStatus('Cleared', '#f39c12'); };
    }

    updateStatus(text, color = '#94a3b8') {
        if (this.statusEl) { this.statusEl.innerText = text; this.statusEl.style.color = color; }
    }
}

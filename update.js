const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================
// 1. CẤU HÌNH
// ============================================================
const GIT_NAME = 'thanhngucomvn999';
const GIT_EMAIL = 'thanhngucomvn999@users.noreply.github.com';
const VERSION = '4.1.0';

// ============================================================
// 2. NỘI DUNG CẬP NHẬT
// ============================================================
const FILES = {
    // --- wrapper.user.js: thêm @connect ---
    'wrapper.user.js': `// ==UserScript==
// @name         ONLUYEN Auto Solver VIP (Loader)
// @namespace    https://github.com/${GIT_NAME}/onluyen-botvip
// @version      ${VERSION}
// @description  Loader tải solver VIP từ GitHub qua jsDelivr
// @author       ${GIT_NAME}
// @match        *://*.onluyen.vn/*
// @grant        GM_xmlhttpRequest
// @connect      cdn.jsdelivr.net
// @connect      keylessai.thryx.workers.dev
// @connect      text.pollinations.ai
// @connect      api.kilo.ai
// @connect      oai.endpoints.kepler.ai.cloud.ovh.net
// @connect      hermes.ai.unturf.com
// @connect      *
// @require      https://cdn.jsdelivr.net/gh/${GIT_NAME}/onluyen-botvip@main/dist/solver.js
// ==/UserScript==
`,

    // --- ui-controller.js: thêm logic so khớp MathJax ---
    'src/ui-controller.js': `// src/ui-controller.js
import { CONFIG } from './constants.js';
import { logger } from './logger.js';

export class UIController {
    _simulateClick(el) {
        if (!el) return;
        try { el.scrollIntoView({ block: 'center' }); } catch (e) {}
        ['mouseenter', 'mouseover', 'mousedown', 'pointerdown', 'mouseup', 'pointerup', 'click'].forEach(evt => {
            const isPointer = evt.startsWith('pointer');
            const EventClass = isPointer ? PointerEvent : MouseEvent;
            el.dispatchEvent(new EventClass(evt, { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 }));
        });
        try { el.focus?.(); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); } catch (e) {}
        logger.debug('Simulated robust click on', el);
    }

    async _simulateTyping(element, text) {
        if (!element || !text) return;
        element.focus();
        element.value = '';
        const minDelay = CONFIG.INSTANT_MODE ? 0 : CONFIG.HUMAN_DELAY_MIN;
        const maxDelay = CONFIG.INSTANT_MODE ? 50 : CONFIG.HUMAN_DELAY_MAX;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const code = char.charCodeAt(0);
            element.dispatchEvent(new KeyboardEvent('keydown', { key: char, keyCode: code, bubbles: true }));
            element.value += char;
            element.dispatchEvent(new InputEvent('input', { data: char, inputType: 'insertText', bubbles: true }));
            element.dispatchEvent(new KeyboardEvent('keyup', { key: char, keyCode: code, bubbles: true }));
            if (i < text.length - 1) await new Promise(r => setTimeout(r, minDelay + Math.random() * (maxDelay - minDelay)));
        }
        element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    async fillAnswer(container, answer) {
        const ans = answer.toLowerCase().trim();
        const input = container.querySelector('input[type="text"], textarea');
        if (input) {
            await this._simulateTyping(input, answer);
            return true;
        }

        const opts = Array.from(container.querySelectorAll('.option, .choice, label, [role="radio"], [role="button"], button, div[class*="answer"]'));
        if (opts.length) {
            // 1. So khớp text đã chuẩn hóa
            for (const el of opts) {
                const t = el.innerText?.toLowerCase().replace(/\\s+/g, '') || '';
                if (t && (ans.includes(t) || t.includes(ans))) {
                    this._simulateClick(el);
                    return true;
                }
            }
            // 2. Click theo chữ cái đầu
            const first = ans.charAt(0);
            const map = { 'a': 0, 'b': 1, 'c': 2, 'd': 3 };
            if (map[first] !== undefined && opts[map[first]]) {
                this._simulateClick(opts[map[first]]);
                return true;
            }
            // 3. So khớp MathJax (cho đáp án dạng công thức)
            if (ans.includes('\\\\frac') || ans.includes('^') || ans.includes('_')) {
                for (const el of opts) {
                    const mathJax = el.querySelector('mjx-container');
                    if (mathJax && mathJax.getAttribute('aria-label')?.toLowerCase().includes(ans.substring(0, 10))) {
                        this._simulateClick(el);
                        return true;
                    }
                }
            }
        }
        return false;
    }

    clearAllAnswers() {
        document.querySelectorAll('input[type="text"], textarea').forEach(el => {
            el.value = '';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });
        document.querySelectorAll('.option, .choice, [role="radio"], div[class*="answer"]').forEach(el => {
            el.classList.remove('selected', 'active', 'done');
        });
    }
}
`,

    // --- dashboard.js: thêm nút Settings ---
    'src/dashboard.js': `// src/dashboard.js
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
        style.textContent = \`
            #hw-solver-overlay { position: fixed; bottom: 20px; right: 20px; width: 280px; background: #1e293b; color: #f8fafc; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); z-index: 999999; font-family: -apple-system, sans-serif; overflow: hidden; border: 1px solid #334155; }
            #hw-solver-header { padding: 12px 16px; background: #0f172a; font-weight: bold; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #334155; }
            #hw-solver-status { padding: 8px 16px; font-size: 0.85rem; color: #94a3b8; background: #1e293b; border-bottom: 1px solid #334155; }
            #hw-solver-controls { padding: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .hw-btn { padding: 8px 12px; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 0.85rem; }
            .hw-btn-primary { background: #4F46E5; color: white; }
            .hw-btn-danger { background: #ef4444; color: white; }
            .hw-btn-secondary { background: #475569; color: white; }
            .hw-full { grid-column: span 2; }
        \`;
        document.head.appendChild(style);
    }

    createPanel() {
        if (document.getElementById('hw-solver-overlay')) return;
        this.overlay = document.createElement('div');
        this.overlay.id = 'hw-solver-overlay';
        this.overlay.innerHTML = \`
            <div id="hw-solver-header"><span>🚀 AI Solver</span><span style="cursor:pointer;" id="hw-solver-close">✖</span></div>
            <div id="hw-solver-status">Ready</div>
            <div id="hw-solver-controls">
                <button class="hw-btn hw-btn-primary hw-full" id="hw-btn-start">▶ Start</button>
                <button class="hw-btn hw-btn-secondary" id="hw-btn-stop">⏹ Stop</button>
                <button class="hw-btn hw-btn-secondary" id="hw-btn-solve-once">⚡ Solve Once</button>
                <button class="hw-btn hw-btn-secondary" id="hw-btn-settings">⚙ Settings</button>
                <button class="hw-btn hw-btn-danger hw-full" id="hw-btn-clear">🗑 Clear All</button>
            </div>
        \`;
        document.body.appendChild(this.overlay);
        this.statusEl = this.overlay.querySelector('#hw-solver-status');
        this.overlay.querySelector('#hw-solver-close').onclick = () => this.overlay.style.display = 'none';
        this.overlay.querySelector('#hw-btn-start').onclick = () => { this.solver.start(); this.updateStatus('Running', '#27ae60'); };
        this.overlay.querySelector('#hw-btn-stop').onclick = () => { this.solver.stop(); this.updateStatus('Stopped', '#c0392b'); };
        this.overlay.querySelector('#hw-btn-solve-once').onclick = async () => { this.updateStatus('Solving...', '#3498db'); await this.solver.solveOnce(); };
        this.overlay.querySelector('#hw-btn-settings').onclick = () => {
            const info = \`Gateways: \${CONFIG.GATEWAYS.map(g => g.name).join(', ')}\\nDelay: \${CONFIG.LOOP_INTERVAL_MS}ms\\nLog Level: \${CONFIG.LOG_LEVEL}\`;
            alert(info);
        };
        this.overlay.querySelector('#hw-btn-clear').onclick = () => { this.solver.clearAnswers(); this.updateStatus('Cleared', '#f39c12'); };
    }

    updateStatus(text, color = '#94a3b8') {
        if (this.statusEl) { this.statusEl.innerText = text; this.statusEl.style.color = color; }
    }
}
`
};

// ============================================================
// 3. CHẠY CẬP NHẬT VÀ PUSH
// ============================================================
function createFile(filePath, content) {
    const fullPath = path.join(process.cwd(), filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Đã cập nhật: ${filePath}`);
}

function runCommand(cmd) {
    try {
        console.log(`\n> ${cmd}`);
        execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
    } catch (error) {
        console.error(`❌ Lỗi: ${cmd}`);
        throw error;
    }
}

async function main() {
    console.log('🚀 Bắt đầu cập nhật ONLUYEN Solver VIP...\n');

    for (const [filePath, content] of Object.entries(FILES)) {
        createFile(filePath, content);
    }

    console.log('\n📦 Đang build lại...');
    execSync('npm run build', { stdio: 'inherit' });

    console.log('\n📤 Đang commit và push lên GitHub...');
    runCommand('git add .');
    runCommand('git add -f dist');
    runCommand(`git commit -m "fix: add @connect domains, mathjax matching, settings button"`);
    
    try {
        runCommand('git push origin main');
    } catch (e) {
        console.log('⚠️ Push thất bại, thử lại...');
        runCommand('git push origin main');
    }

    console.log('\n🎉 Cập nhật hoàn tất!');
    console.log(`🔗 Link CDN: https://cdn.jsdelivr.net/gh/${GIT_NAME}/onluyen-botvip@main/dist/solver.js`);
    console.log('👉 Hãy vào Tampermonkey, mở loader và nhấn Ctrl+S để làm mới, sau đó F5 trang web.');
}

main().catch(err => {
    console.error('❌ Lỗi:', err.message);
    process.exit(1);
});
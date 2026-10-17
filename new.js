const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ============================================================
// 1. CẤU HÌNH THÔNG TIN
// ============================================================
const GIT_NAME = 'thanhngucomvn999';
const VERSION = '4.2.0';

// ============================================================
// 2. NỘI DUNG CÁC FILE (ĐÃ ĐƯỢC ĐỒNG BỘ VÀ NÂNG CẤP)
// ============================================================
const FILES = {
    // --- Cấu hình dự án ---
    'package.json': JSON.stringify({
        name: 'onluyen-bot-vip',
        version: VERSION,
        description: 'Advanced AI Homework Solver with Multi-Gateway & Dashboard',
        main: 'dist/solver.js',
        scripts: {
            build: 'vite build'
        },
        devDependencies: {
            vite: '^5.0.0'
        },
        author: GIT_NAME,
        license: 'MIT'
    }, null, 2),

    'vite.config.js': `import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/main.js'),
            name: 'OnLuyenSolver',
            fileName: () => 'solver.js',
            formats: ['iife']
        },
        outDir: 'dist',
        minify: false,
        emptyOutDir: true,
        rollupOptions: {
            output: {
                inlineDynamicImports: true,
                entryFileNames: 'solver.js',
                manualChunks: undefined
            }
        }
    }
});
`,

    // --- Wrapper với ĐA CỔNG @connect ---
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

    // --- CÁC MODULE NGUỒN (src/) ---

    // 1. constants.js (Mở rộng danh sách Gateway)
    'src/constants.js': `export const CONFIG = {
    GATEWAYS: [
        { name: 'KeylessAI', url: 'https://keylessai.thryx.workers.dev/v1/chat/completions', model: 'gpt-4o' },
        { name: 'Pollinations', url: 'https://text.pollinations.ai/openai', model: 'openai' },
        { name: 'UncloseAI', url: 'https://hermes.ai.unturf.com/v1/chat/completions', model: 'turboderp/Qwen3.8-27B-exl3' },
        { name: 'Kilo Gateway', url: 'https://api.kilo.ai/api/gateway/chat/completions', model: 'kilo-auto/free' },
        { name: 'OVHcloud', url: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions', model: 'Meta-Llama-3_3-70B-Instruct' }
    ],
    PROXY_TIMEOUT_MS: 30000,
    RETRIES: 3,
    LOOP_INTERVAL_MS: 4000,
    HUMAN_DELAY_MIN: 200,
    HUMAN_DELAY_MAX: 800,
    INSTANT_MODE: false,
    THINK_BEFORE_ANSWER: true,
    LOG_LEVEL: 'INFO'
};
`,

    // 2. logger.js
    'src/logger.js': `import { CONFIG } from './constants.js';

export const logger = {
    history: [],
    _log(level, ...args) {
        const msg = \`[ONLUYEN \${level}] \${args.join(' ')}\`;
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
`,

    // 3. api-client.js (Tự động fallback)
    'src/api-client.js': `import { CONFIG } from './constants.js';
import { logger } from './logger.js';

export class APIClient {
    async call(prompt, images = []) {
        const userContent = [{ type: 'text', text: prompt }];
        images.forEach(src => userContent.push({ type: 'image_url', image_url: { url: src } }));

        for (const gw of CONFIG.GATEWAYS) {
            try {
                logger.info(\`Trying gateway: \${gw.name}...\`);
                const result = await this._callSingle(gw, userContent);
                logger.info(\`✅ Success from \${gw.name}\`);
                return result;
            } catch (e) {
                logger.warn(\`❌ \${gw.name} failed: \${e.message}\`);
            }
        }
        throw new Error('All gateways failed');
    }

    _callSingle(gw, userContent) {
        return new Promise((resolve, reject) => {
            const payload = {
                model: gw.model,
                messages: [
                    { role: 'system', content: 'You are a precise assistant. Reply concisely with the final answer only.' },
                    { role: 'user', content: userContent }
                ],
                temperature: 0.1,
                max_tokens: 1000
            };
            GM_xmlhttpRequest({
                method: 'POST',
                url: gw.url,
                headers: { 'Content-Type': 'application/json' },
                data: JSON.stringify(payload),
                timeout: CONFIG.PROXY_TIMEOUT_MS,
                onload: (res) => {
                    if (res.status < 200 || res.status >= 300) return reject(new Error(\`HTTP \${res.status}\`));
                    try {
                        const data = JSON.parse(res.responseText);
                        const content = data.choices?.[0]?.message?.content?.trim() || data.response?.trim();
                        if (!content) return reject(new Error('Empty response'));
                        resolve(content);
                    } catch (e) { reject(new Error('Parse error')); }
                },
                onerror: () => reject(new Error('Network error')),
                ontimeout: () => reject(new Error('Timeout'))
            });
        });
    }
}
`,

    // 4. scraper.js
    'src/scraper.js': `export class Scraper {
    _normalize(s) { return (s || '').replace(/[ \\t]+/g, ' ').replace(/[\\r\\n]+/g, '\\n').trim(); }

    _getQuestionContainers() {
        return Array.from(document.querySelectorAll(
            '.question-name, #step, app-question-short-answer, app-question-multiple-choice, .question.fade-indown, .test-school-question-option, app-question-true-false-test, app-test-school-question-option'
        )).filter(el => el.offsetParent !== null);
    }

    _getCleanedText(element) {
        if (!element) return '';
        const clone = element.cloneNode(true);
        clone.querySelectorAll('mjx-container').forEach(mjx => {
            const aria = mjx.getAttribute('aria-label');
            const assistive = mjx.querySelector('mjx-assistive-mml')?.innerText.trim();
            const math = aria || assistive || '';
            if (math) mjx.replaceWith(document.createTextNode(\` [MATH]\${math}[/MATH] \`));
            else mjx.remove();
        });
        const wrapper = document.createElement('div');
        wrapper.style.position = 'absolute';
        wrapper.style.left = '-9999px';
        wrapper.appendChild(clone);
        document.body.appendChild(wrapper);
        const text = this._normalize(clone.innerText);
        document.body.removeChild(wrapper);
        return text;
    }

    _scrapeImages(container) {
        return Array.from(container.querySelectorAll('img'))
            .map(img => img.src)
            .filter(src => src && !src.startsWith('data:'));
    }

    scrape() {
        const containers = this._getQuestionContainers();
        return containers.map(el => ({
            element: el,
            text: this._getCleanedText(el),
            images: this._scrapeImages(el)
        }));
    }
}
`,

    // 5. ui-controller.js
    'src/ui-controller.js': `import { CONFIG } from './constants.js';
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
            for (const el of opts) {
                const t = el.innerText?.toLowerCase().replace(/\\s+/g, '') || '';
                if (t && (ans.includes(t) || t.includes(ans))) {
                    this._simulateClick(el);
                    return true;
                }
            }
            const first = ans.charAt(0);
            const map = { 'a': 0, 'b': 1, 'c': 2, 'd': 3, 'đ': 4 };
            if (map[first] !== undefined && opts[map[first]]) {
                this._simulateClick(opts[map[first]]);
                return true;
            }
            if (ans.includes('\\\\frac') || ans.includes('^') || ans.includes('_')) {
                for (const el of opts) {
                    const mathJax = el.querySelector('mjx-container');
                    if (mathJax && mathJax.getAttribute('aria-label')?.toLowerCase().includes(ans.substring(0, 5))) {
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

    // 6. dashboard.js (Bổ sung nút Settings)
    'src/dashboard.js': `import { CONFIG } from './constants.js';

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
`,

    // 7. homework-solver.js
    'src/homework-solver.js': `import { CONFIG } from './constants.js';
import { logger } from './logger.js';
import { APIClient } from './api-client.js';
import { Scraper } from './scraper.js';
import { UIController } from './ui-controller.js';
import { BasicUI } from './dashboard.js';

export class HomeworkSolver {
    constructor() {
        this.api = new APIClient();
        this.scraper = new Scraper();
        this.ui = new UIController();
        this.overlay = new BasicUI(this);
        this.isRunning = false;
        this.timer = null;
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.overlay.updateStatus('Running', '#27ae60');
        const loop = async () => {
            if (!this.isRunning) return;
            await this.solveOnce();
            if (this.isRunning) this.timer = setTimeout(loop, CONFIG.LOOP_INTERVAL_MS);
        };
        loop();
    }

    stop() {
        this.isRunning = false;
        if (this.timer) clearTimeout(this.timer);
        this.overlay.updateStatus('Stopped', '#c0392b');
    }

    async solveOnce() {
        try {
            this.overlay.updateStatus('Detecting...', '#3498db');
            const questions = this.scraper.scrape();
            if (!questions.length) {
                this.overlay.updateStatus('No questions', '#e74c3c');
                return;
            }
            logger.info(\`Found \${questions.length} questions.\`);

            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                this.overlay.updateStatus(\`Solving \${i + 1}/\${questions.length}...\`, '#f39c12');
                try {
                    const answer = await this.api.call(q.text, q.images);
                    const success = await this.ui.fillAnswer(q.element, answer);
                    if (success) logger.info(\`✅ Q\${i + 1} answered\`);
                    else logger.warn(\`⚠️ Q\${i + 1} could not fill\`);
                } catch (e) {
                    logger.error(\`Q\${i + 1} failed: \${e.message}\`);
                }
                await new Promise(r => setTimeout(r, 1000));
            }
            this.overlay.updateStatus('Done', '#27ae60');
        } catch (e) {
            logger.error('Solve loop error:', e);
            this.overlay.updateStatus('Error', '#e74c3c');
        }
    }

    clearAnswers() {
        this.ui.clearAllAnswers();
        this.overlay.updateStatus('Cleared', '#f39c12');
    }
}
`,

    // 8. main.js
    'src/main.js': `import { HomeworkSolver } from './homework-solver.js';
import { CONFIG } from './constants.js';
import { logger } from './logger.js';

logger.info('Initializing ONLUYEN Solver VIP...');
const solver = new HomeworkSolver();

window.hwSolver = {
    start: () => solver.start(),
    stop: () => solver.stop(),
    solveOnce: () => solver.solveOnce(),
    clearAll: () => solver.clearAnswers(),
    config: CONFIG,
    logger: logger,
    help: () => console.log('Commands: hwSolver.start(), stop(), solveOnce(), clearAll(), help()')
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => solver.overlay.createPanel());
} else {
    solver.overlay.createPanel();
}
`
};

// ============================================================
// 3. CHƯƠNG TRÌNH CHẠY
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
    console.log('🚀 Bắt đầu ghi đè mã nguồn mới nhất (bản Full Features)...\n');

    for (const [filePath, content] of Object.entries(FILES)) {
        createFile(filePath, content);
    }

    console.log('\n📦 Đang build lại mã nguồn bằng Vite...');
    try {
        execSync('npm run build', { stdio: 'inherit' });
    } catch (e) {
        console.error('❌ Build thất bại. Vui lòng kiểm tra lại Node.js hoặc file vite.config.js');
        process.exit(1);
    }

    console.log('\n📤 Đang đẩy mã nguồn và thư mục dist lên GitHub...');
    try {
        runCommand('git add .');
        runCommand('git add -f dist');
        runCommand(`git commit -m "feat: rebuild full template with multi-gateway support and settings menu"`);
        runCommand('git push origin main');
        console.log('\n🎉 HOÀN TẤT! Code đã được đẩy lên GitHub thành công.');
    } catch (err) {
        console.log('\n⚠️ Lỗi Push Git. Bạn hãy tự chạy lệnh: git push origin main');
    }
}

main().catch(err => {
    console.error('❌ Lỗi:', err.message);
    process.exit(1);
});
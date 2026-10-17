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
                const t = el.innerText?.toLowerCase().replace(/\s+/g, '') || '';
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
            if (ans.includes('\\frac') || ans.includes('^') || ans.includes('_')) {
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

(function() {
  "use strict";
  const CONFIG = {
    GATEWAYS: [
      { name: "KeylessAI", url: "https://keylessai.thryx.workers.dev/v1/chat/completions", model: "gpt-4o" },
      { name: "Pollinations", url: "https://text.pollinations.ai/openai", model: "openai" },
      { name: "Kilo Gateway", url: "https://api.kilo.ai/api/gateway/chat/completions", model: "kilo-auto/free" },
      { name: "OVHcloud", url: "https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions", model: "Meta-Llama-3_3-70B-Instruct" }
    ],
    PROXY_TIMEOUT_MS: 3e4,
    LOOP_INTERVAL_MS: 4e3,
    HUMAN_DELAY_MIN: 200,
    HUMAN_DELAY_MAX: 800
  };
  const logger = {
    history: [],
    _log(level, ...args) {
      const msg = `[ONLUYEN ${level}] ${args.join(" ")}`;
      this.history.push({ time: /* @__PURE__ */ new Date(), level, msg });
      if (this.history.length > 200) this.history.shift();
      if (level === "ERROR") console.error(msg);
      else if (level === "WARN") console.warn(msg);
      else console.log(msg);
    },
    info(...args) {
      this._log("INFO", ...args);
    },
    warn(...args) {
      this._log("WARN", ...args);
    },
    error(...args) {
      this._log("ERROR", ...args);
    },
    debug(...args) {
    }
  };
  class APIClient {
    async call(prompt, images = []) {
      const userContent = [{ type: "text", text: prompt }];
      images.forEach((src) => userContent.push({ type: "image_url", image_url: { url: src } }));
      for (const gw of CONFIG.GATEWAYS) {
        try {
          logger.info(`Trying gateway: ${gw.name}...`);
          const result = await this._callSingle(gw, userContent);
          logger.info(`✅ Success from ${gw.name}`);
          return result;
        } catch (e) {
          logger.warn(`❌ ${gw.name} failed: ${e.message}`);
        }
      }
      throw new Error("All gateways failed");
    }
    _callSingle(gw, userContent) {
      return new Promise((resolve, reject) => {
        const payload = {
          model: gw.model,
          messages: [
            { role: "system", content: "You are a precise assistant. Reply concisely." },
            { role: "user", content: userContent }
          ],
          temperature: 0.1,
          max_tokens: 1e3
        };
        GM_xmlhttpRequest({
          method: "POST",
          url: gw.url,
          headers: { "Content-Type": "application/json" },
          data: JSON.stringify(payload),
          timeout: CONFIG.PROXY_TIMEOUT_MS,
          onload: (res) => {
            var _a, _b, _c, _d, _e;
            if (res.status < 200 || res.status >= 300) return reject(new Error(`HTTP ${res.status}`));
            try {
              const data = JSON.parse(res.responseText);
              const content = ((_d = (_c = (_b = (_a = data.choices) == null ? void 0 : _a[0]) == null ? void 0 : _b.message) == null ? void 0 : _c.content) == null ? void 0 : _d.trim()) || ((_e = data.response) == null ? void 0 : _e.trim());
              if (!content) return reject(new Error("Empty response"));
              resolve(content);
            } catch (e) {
              reject(new Error("Parse error"));
            }
          },
          onerror: () => reject(new Error("Network error")),
          ontimeout: () => reject(new Error("Timeout"))
        });
      });
    }
  }
  class Scraper {
    _normalize(s) {
      return (s || "").replace(/[ \t]+/g, " ").replace(/[\r\n]+/g, "\n").trim();
    }
    _getQuestionContainers() {
      return Array.from(document.querySelectorAll(
        ".question-name, #step, app-question-short-answer, app-question-multiple-choice, .question.fade-indown, .test-school-question-option, app-question-true-false-test, app-test-school-question-option"
      )).filter((el) => el.offsetParent !== null);
    }
    _getCleanedText(element) {
      if (!element) return "";
      const clone = element.cloneNode(true);
      clone.querySelectorAll("mjx-container").forEach((mjx) => {
        var _a;
        const aria = mjx.getAttribute("aria-label");
        const assistive = (_a = mjx.querySelector("mjx-assistive-mml")) == null ? void 0 : _a.innerText.trim();
        const math = aria || assistive || "";
        if (math) mjx.replaceWith(document.createTextNode(` [MATH]${math}[/MATH] `));
        else mjx.remove();
      });
      const wrapper = document.createElement("div");
      wrapper.style.position = "absolute";
      wrapper.style.left = "-9999px";
      wrapper.appendChild(clone);
      document.body.appendChild(wrapper);
      const text = this._normalize(clone.innerText);
      document.body.removeChild(wrapper);
      return text;
    }
    _scrapeImages(container) {
      return Array.from(container.querySelectorAll("img")).map((img) => img.src).filter((src) => src && !src.startsWith("data:"));
    }
    scrape() {
      const containers = this._getQuestionContainers();
      return containers.map((el) => ({
        element: el,
        text: this._getCleanedText(el),
        images: this._scrapeImages(el)
      }));
    }
  }
  class UIController {
    _simulateClick(el) {
      var _a;
      if (!el) return;
      try {
        el.scrollIntoView({ block: "center", inline: "center" });
      } catch (e) {
      }
      ["mouseenter", "mouseover", "mousedown", "pointerdown", "mouseup", "pointerup", "click"].forEach((evt) => {
        const isPointer = evt.startsWith("pointer");
        const EventClass = isPointer ? PointerEvent : MouseEvent;
        el.dispatchEvent(new EventClass(evt, { bubbles: true, cancelable: true, view: window, button: 0, buttons: 1 }));
      });
      try {
        (_a = el.focus) == null ? void 0 : _a.call(el);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (e) {
      }
      logger.debug("Simulated robust click on", el);
    }
    async _simulateTyping(element, text) {
      if (!element || !text) return;
      const style = window.getComputedStyle(element);
      const isHidden = style.display === "none" || style.visibility === "hidden" || element.offsetParent === null;
      if (isHidden) {
        element.value = text;
        element.dispatchEvent(new Event("input", { bubbles: true }));
        element.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }
      element.focus();
      element.value = "";
      const minDelay = CONFIG.HUMAN_DELAY_MIN;
      const maxDelay = CONFIG.HUMAN_DELAY_MAX;
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const code = char.charCodeAt(0);
        element.dispatchEvent(new KeyboardEvent("keydown", { key: char, keyCode: code, bubbles: true }));
        element.dispatchEvent(new KeyboardEvent("keypress", { key: char, keyCode: code, bubbles: true }));
        element.value += char;
        element.dispatchEvent(new InputEvent("input", { data: char, inputType: "insertText", bubbles: true }));
        element.dispatchEvent(new KeyboardEvent("keyup", { key: char, keyCode: code, bubbles: true }));
        if (i < text.length - 1) await new Promise((r) => setTimeout(r, minDelay + Math.random() * (maxDelay - minDelay)));
      }
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.blur();
    }
    async fillAnswer(container, answer) {
      var _a, _b;
      const ans = answer.toLowerCase();
      const input = container.querySelector('input[type="text"], textarea');
      if (input) {
        await this._simulateTyping(input, answer);
        return true;
      }
      const opts = Array.from(container.querySelectorAll('.option, .choice, label, [role="radio"], [role="button"], button, div[class*="answer"]'));
      if (opts.length) {
        for (const el of opts) {
          const t = ((_a = el.innerText) == null ? void 0 : _a.toLowerCase().trim()) || "";
          if (t && (ans.includes(t) || t.includes(ans))) {
            this._simulateClick(el);
            return true;
          }
        }
        const first = ans.charAt(0);
        const map = { "a": 0, "b": 1, "c": 2, "d": 3, "đ": 4 };
        if (map[first] !== void 0 && opts[map[first]]) {
          this._simulateClick(opts[map[first]]);
          return true;
        }
        if (ans.includes("đúng") || ans.includes("sai")) {
          const target = ans.includes("đúng") ? "đúng" : "sai";
          for (const el of opts) {
            if ((_b = el.innerText) == null ? void 0 : _b.toLowerCase().includes(target)) {
              this._simulateClick(el);
              return true;
            }
          }
        }
      }
      return false;
    }
    clearAllAnswers() {
      document.querySelectorAll('input[type="text"], textarea').forEach((el) => {
        el.value = "";
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
      document.querySelectorAll('.option, .choice, [role="radio"], div[class*="answer"]').forEach((el) => {
        el.classList.remove("selected", "active", "done");
      });
      document.querySelectorAll('.question-name, #step, [class*="question"]').forEach((el) => {
        el.classList.remove("done");
      });
    }
  }
  class BasicUI {
    constructor(solver2) {
      this.solver = solver2;
      this.overlay = null;
      this.statusEl = null;
      this.injectStyles();
      this.createPanel();
    }
    injectStyles() {
      if (document.getElementById("hw-solver-styles")) return;
      const style = document.createElement("style");
      style.id = "hw-solver-styles";
      style.textContent = `
            #hw-solver-overlay {
                position: fixed; bottom: 20px; right: 20px; width: 280px;
                background: #1e293b; color: #f8fafc; border-radius: 12px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.5); z-index: 999999;
                font-family: -apple-system, sans-serif; overflow: hidden;
                border: 1px solid #334155; transition: all 0.3s;
            }
            #hw-solver-header {
                padding: 12px 16px; background: #0f172a; font-weight: bold;
                display: flex; justify-content: space-between; align-items: center;
                border-bottom: 1px solid #334155; cursor: move;
            }
            #hw-solver-status {
                padding: 8px 16px; font-size: 0.85rem; color: #94a3b8;
                background: #1e293b; border-bottom: 1px solid #334155;
            }
            #hw-solver-controls {
                padding: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
            }
            .hw-btn {
                padding: 8px 12px; border: none; border-radius: 6px;
                font-weight: 600; cursor: pointer; font-size: 0.85rem;
                transition: background 0.2s;
            }
            .hw-btn-primary { background: #4F46E5; color: white; }
            .hw-btn-primary:hover { background: #4338CA; }
            .hw-btn-danger { background: #ef4444; color: white; }
            .hw-btn-danger:hover { background: #dc2626; }
            .hw-btn-secondary { background: #475569; color: white; }
            .hw-btn-secondary:hover { background: #334155; }
            .hw-full { grid-column: span 2; }
        `;
      document.head.appendChild(style);
    }
    createPanel() {
      if (document.getElementById("hw-solver-overlay")) return;
      this.overlay = document.createElement("div");
      this.overlay.id = "hw-solver-overlay";
      this.overlay.innerHTML = `
            <div id="hw-solver-header">
                <span>🚀 AI Solver</span>
                <span style="cursor:pointer;" id="hw-solver-close">✖</span>
            </div>
            <div id="hw-solver-status">Ready</div>
            <div id="hw-solver-controls">
                <button class="hw-btn hw-btn-primary hw-full" id="hw-btn-start">▶ Start</button>
                <button class="hw-btn hw-btn-secondary" id="hw-btn-stop">⏹ Stop</button>
                <button class="hw-btn hw-btn-secondary" id="hw-btn-solve-once">⚡ Solve Once</button>
                <button class="hw-btn hw-btn-danger hw-full" id="hw-btn-clear">🗑 Clear All</button>
            </div>
        `;
      document.body.appendChild(this.overlay);
      this.statusEl = this.overlay.querySelector("#hw-solver-status");
      this.overlay.querySelector("#hw-solver-close").onclick = () => this.overlay.style.display = "none";
      this.overlay.querySelector("#hw-btn-start").onclick = () => {
        this.solver.start();
        this.updateStatus("Running", "#27ae60");
      };
      this.overlay.querySelector("#hw-btn-stop").onclick = () => {
        this.solver.stop();
        this.updateStatus("Stopped", "#c0392b");
      };
      this.overlay.querySelector("#hw-btn-solve-once").onclick = async () => {
        this.updateStatus("Solving...", "#3498db");
        await this.solver.solveOnce();
      };
      this.overlay.querySelector("#hw-btn-clear").onclick = () => {
        this.solver.clearAnswers();
        this.updateStatus("Cleared", "#f39c12");
      };
    }
    updateStatus(text, color = "#94a3b8") {
      if (this.statusEl) {
        this.statusEl.innerText = text;
        this.statusEl.style.color = color;
      }
    }
  }
  class HomeworkSolver {
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
      this.overlay.updateStatus("Running", "#27ae60");
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
      this.overlay.updateStatus("Stopped", "#c0392b");
    }
    async solveOnce() {
      try {
        this.overlay.updateStatus("Detecting...", "#3498db");
        const questions = this.scraper.scrape();
        if (!questions.length) {
          this.overlay.updateStatus("No questions", "#e74c3c");
          return;
        }
        logger.info(`Found ${questions.length} questions.`);
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          this.overlay.updateStatus(`Solving ${i + 1}/${questions.length}...`, "#f39c12");
          try {
            const answer = await this.api.call(q.text, q.images);
            const success = await this.ui.fillAnswer(q.element, answer);
            if (success) logger.info(`✅ Q${i + 1} answered`);
            else logger.warn(`⚠️ Q${i + 1} could not fill`);
          } catch (e) {
            logger.error(`Q${i + 1} failed: ${e.message}`);
          }
          await new Promise((r) => setTimeout(r, 1e3));
        }
        this.overlay.updateStatus("Done", "#27ae60");
      } catch (e) {
        logger.error("Solve loop error:", e);
        this.overlay.updateStatus("Error", "#e74c3c");
      }
    }
    clearAnswers() {
      this.ui.clearAllAnswers();
      this.overlay.updateStatus("Cleared", "#f39c12");
    }
  }
  logger.info("Initializing ONLUYEN Solver VIP...");
  const solver = new HomeworkSolver();
  window.hwSolver = {
    start: () => solver.start(),
    stop: () => solver.stop(),
    solveOnce: () => solver.solveOnce(),
    clearAll: () => solver.clearAnswers(),
    config: solver.config,
    logger,
    help: () => console.log("Commands: hwSolver.start(), stop(), solveOnce(), clearAll(), help()")
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => solver.overlay.createPanel());
  } else {
    solver.overlay.createPanel();
  }
})();

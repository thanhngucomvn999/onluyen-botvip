import { CONFIG } from './constants.js';
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
            logger.info(`Found ${questions.length} questions.`);

            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];
                this.overlay.updateStatus(`Solving ${i + 1}/${questions.length}...`, '#f39c12');
                try {
                    const answer = await this.api.call(q.text, q.images);
                    const success = await this.ui.fillAnswer(q.element, answer);
                    if (success) logger.info(`✅ Q${i + 1} answered`);
                    else logger.warn(`⚠️ Q${i + 1} could not fill`);
                } catch (e) {
                    logger.error(`Q${i + 1} failed: ${e.message}`);
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

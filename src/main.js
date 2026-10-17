import { HomeworkSolver } from './homework-solver.js';
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

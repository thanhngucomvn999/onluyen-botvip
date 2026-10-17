import { HomeworkSolver } from './homework-solver.js';
import { logger } from './logger.js';

logger.info('Initializing ONLUYEN Solver VIP...');
const solver = new HomeworkSolver();

window.hwSolver = {
    start: () => solver.start(),
    stop: () => solver.stop(),
    solveOnce: () => solver.solveOnce(),
    clearAll: () => solver.clearAnswers(),
    config: solver.config,
    logger: logger,
    help: () => console.log('Commands: hwSolver.start(), stop(), solveOnce(), clearAll(), help()')
};

// Tự động tạo UI khi trang tải xong
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => solver.overlay.createPanel());
} else {
    solver.overlay.createPanel();
}

export class Scraper {
    _normalize(s) { return (s || '').replace(/[ \t]+/g, ' ').replace(/[\r\n]+/g, '\n').trim(); }

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
            if (math) mjx.replaceWith(document.createTextNode(` [MATH]${math}[/MATH] `));
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

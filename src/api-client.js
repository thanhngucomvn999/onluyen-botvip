import { CONFIG } from './constants.js';
import { logger } from './logger.js';

export class APIClient {
    async call(prompt, images = []) {
        const userContent = [{ type: 'text', text: prompt }];
        images.forEach(src => userContent.push({ type: 'image_url', image_url: { url: src } }));

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
                    if (res.status < 200 || res.status >= 300) return reject(new Error(`HTTP ${res.status}`));
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

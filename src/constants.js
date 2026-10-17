export const CONFIG = {
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

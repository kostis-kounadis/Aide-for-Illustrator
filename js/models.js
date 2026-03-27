/**
 * Aide — models.js
 * Model discovery, provider switching, and API configuration.
 * Supports: Ollama (local), Google Gemini, OpenAI, Anthropic, Custom (OpenAI-compatible).
 */

const AideModels = (() => {
    // Default model per provider — so switching providers auto-selects a working model
    const DEFAULT_MODELS = {
        ollama: 'qwen2.5-coder:7b',
        google: 'gemini-2.0-flash',
        openai: 'gpt-4o-mini',
        anthropic: 'claude-sonnet-4-20250514',
        custom: ''
    };

    const DEFAULTS = {
        provider: 'ollama',
        ollamaHost: 'http://localhost:11434',
        model: 'qwen2.5-coder:7b',
        temperature: 0.3,
        apiKey: '',
        customEndpoint: '',
        debugLogging: false
    };

    // Recommended Ollama models, ranked by ExtendScript capability
    const RECOMMENDED_MODELS = [
        { name: 'qwen2.5-coder:14b', desc: 'Best balance — recommended if you have 16GB+ RAM', ram: '16GB' },
        { name: 'qwen2.5-coder:7b', desc: 'Good for 8GB RAM systems', ram: '8GB' },
        { name: 'deepseek-coder-v2:16b', desc: 'Strong code generation, needs 16GB+', ram: '16GB' },
        { name: 'codestral:22b', desc: 'Mistral code model, very capable, 32GB+ RAM', ram: '32GB' },
        { name: 'codegemma:7b', desc: 'Google code model, lightweight', ram: '8GB' },
        { name: 'codellama:7b', desc: 'Meta code-focused, good ES3 adherence', ram: '8GB' },
        { name: 'llama3:8b', desc: 'General purpose, decent at code', ram: '8GB' }
    ];

    // Known models for remote providers
    const REMOTE_MODELS = {
        google: [
            { name: 'gemini-2.0-flash', desc: 'Fast, free tier' },
            { name: 'gemini-2.0-flash-lite', desc: 'Ultra-fast, free tier' },
            { name: 'gemini-1.5-flash', desc: 'Fast & capable' },
            { name: 'gemini-1.5-pro', desc: 'Most capable' },
        ],
        openai: [
            { name: 'gpt-4o-mini', desc: 'Fast & cheap' },
            { name: 'gpt-4o', desc: 'Most capable' },
            { name: 'gpt-4-turbo', desc: 'Previous gen' },
        ],
        anthropic: [
            { name: 'claude-sonnet-4-20250514', desc: 'Best value' },
            { name: 'claude-3-5-haiku-20241022', desc: 'Fast & light' },
            { name: 'claude-opus-4-20250514', desc: 'Most capable' },
        ]
    };

    let config = { ...DEFAULTS };

    // ──────────── Debug Logging ────────────
    let debugLog = [];

    function log(type, data) {
        if (!config.debugLogging) return;
        const entry = {
            timestamp: new Date().toISOString(),
            type: type,
            data: data
        };
        debugLog.push(entry);
        console.log(`[Aide Debug] ${type}:`, data);
        // Persist to localStorage (keep last 500 entries)
        try {
            if (debugLog.length > 500) debugLog = debugLog.slice(-500);
            localStorage.setItem('aide_debug_log', JSON.stringify(debugLog));
        } catch (e) { /* ignore storage errors */ }
    }

    function getDebugLog() {
        try {
            const saved = localStorage.getItem('aide_debug_log');
            return saved ? JSON.parse(saved) : debugLog;
        } catch (e) {
            return debugLog;
        }
    }

    function clearDebugLog() {
        debugLog = [];
        try { localStorage.removeItem('aide_debug_log'); } catch (e) {}
    }

    function exportDebugLog() {
        const log = getDebugLog();
        const lines = log.map(e => {
            const data = typeof e.data === 'string' ? e.data : JSON.stringify(e.data, null, 2);
            return `[${e.timestamp}] [${e.type}]\n${data}\n`;
        });
        return `AIDE DEBUG LOG\nExported: ${new Date().toISOString()}\nProvider: ${config.provider}\nModel: ${config.model}\n${'='.repeat(60)}\n\n${lines.join('\n' + '-'.repeat(40) + '\n\n')}`;
    }

    // ──────────── Settings ────────────
    function loadSettings() {
        try {
            const saved = localStorage.getItem('aide_settings');
            if (saved) {
                const parsed = JSON.parse(saved);
                config = { ...DEFAULTS, ...parsed };
            }
        } catch (e) {
            console.warn('Could not load settings:', e);
        }
        return config;
    }

    function saveSettings() {
        try {
            localStorage.setItem('aide_settings', JSON.stringify(config));
        } catch (e) {
            console.warn('Could not save settings:', e);
        }
    }

    function getConfig() {
        return { ...config };
    }

    function setConfig(updates) {
        Object.assign(config, updates);
        saveSettings();
    }

    function getDefaultModel(provider) {
        return DEFAULT_MODELS[provider] || '';
    }

    function getRecommendedModels() {
        return RECOMMENDED_MODELS;
    }

    function getRemoteModels(provider) {
        return REMOTE_MODELS[provider] || [];
    }

    // ──────────── Model Discovery ────────────
    async function fetchOllamaModels() {
        const url = `${config.ollamaHost}/api/tags`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Ollama API error: ${response.status}`);
        const data = await response.json();
        return (data.models || []).map(m => ({
            name: m.name,
            size: m.size,
            family: m.details?.family || 'unknown',
            paramSize: m.details?.parameter_size || '',
            quantization: m.details?.quantization_level || ''
        }));
    }

    async function fetchGoogleModels() {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`;
            const response = await fetch(url);
            if (!response.ok) return REMOTE_MODELS.google;
            const data = await response.json();
            return (data.models || [])
                .filter(m => m.supportedGenerationMethods?.indexOf('generateContent') !== -1)
                .map(m => ({
                    name: m.name.replace('models/', ''),
                    desc: m.displayName || ''
                }));
        } catch (e) {
            return REMOTE_MODELS.google;
        }
    }

    // ──────────── Connection Tests ────────────
    async function checkOllamaConnection() {
        try {
            const models = await fetchOllamaModels();
            return { ok: true, models: models.length };
        } catch (e) {
            return { ok: false, models: 0, error: e.message };
        }
    }

    async function testRemoteConnection() {
        try {
            if (config.provider === 'google') {
                const resp = await fetch(
                    `https://generativelanguage.googleapis.com/v1beta/models?key=${config.apiKey}`
                );
                return { ok: resp.ok, error: resp.ok ? null : `HTTP ${resp.status}` };
            }
            if (config.provider === 'openai') {
                const resp = await fetch('https://api.openai.com/v1/models', {
                    headers: { 'Authorization': `Bearer ${config.apiKey}` }
                });
                return { ok: resp.ok, error: resp.ok ? null : `HTTP ${resp.status}` };
            }
            if (config.provider === 'anthropic') {
                const valid = config.apiKey && config.apiKey.startsWith('sk-ant-');
                return { ok: valid, error: valid ? null : 'Invalid key format (expected sk-ant-...)' };
            }
            if (config.provider === 'custom') {
                if (!config.customEndpoint) return { ok: false, error: 'No endpoint configured' };
                const resp = await fetch(config.customEndpoint.replace(/\/chat\/completions.*$/, '/models'), {
                    headers: config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}
                });
                return { ok: resp.ok, error: resp.ok ? null : `HTTP ${resp.status}` };
            }
            return { ok: false, error: 'Unknown provider' };
        } catch (e) {
            return { ok: false, error: e.message };
        }
    }

    // ──────────── Chat API ────────────
    async function sendChat(messages) {
        log('request', {
            provider: config.provider,
            model: config.model,
            messageCount: messages.length,
            lastUserMsg: messages.filter(m => m.role === 'user').slice(-1)[0]?.content?.substring(0, 200)
        });

        let response;
        if (config.provider === 'ollama') {
            response = await sendOllamaChat(messages);
        } else if (config.provider === 'google') {
            response = await sendGoogleChat(messages);
        } else if (config.provider === 'openai') {
            response = await sendOpenAIChat(messages);
        } else if (config.provider === 'anthropic') {
            response = await sendAnthropicChat(messages);
        } else if (config.provider === 'custom') {
            response = await sendCustomChat(messages);
        } else {
            throw new Error('Unknown provider: ' + config.provider);
        }

        log('response', {
            provider: config.provider,
            model: config.model,
            responseLength: response.length,
            responsePreview: response.substring(0, 300)
        });

        return response;
    }

    async function sendOllamaChat(messages) {
        const url = `${config.ollamaHost}/api/chat`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: config.model,
                messages: messages,
                stream: false,
                options: { temperature: config.temperature, num_ctx: 8192 }
            })
        });
        if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
        const data = await response.json();
        return data.message?.content || '';
    }

    async function sendGoogleChat(messages) {
        const systemInstruction = messages
            .filter(m => m.role === 'system')
            .map(m => m.content)
            .join('\n');

        const contents = messages
            .filter(m => m.role !== 'system')
            .map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
            }));

        const model = config.model || 'gemini-2.0-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                systemInstruction: { parts: [{ text: systemInstruction }] },
                contents: contents,
                generationConfig: { temperature: config.temperature, maxOutputTokens: 8192 }
            })
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `Gemini error: ${response.status}`);
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        if (!candidate) throw new Error('No response from Gemini');
        return candidate.content?.parts?.[0]?.text || '';
    }

    async function sendOpenAIChat(messages) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.apiKey}`
            },
            body: JSON.stringify({
                model: config.model || 'gpt-4o-mini',
                messages: messages,
                temperature: config.temperature
            })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `OpenAI error: ${response.status}`);
        }
        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }

    async function sendAnthropicChat(messages) {
        const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
        const nonSystem = messages.filter(m => m.role !== 'system');

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: config.model || 'claude-sonnet-4-20250514',
                max_tokens: 4096,
                system: system,
                messages: nonSystem,
                temperature: config.temperature
            })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `Anthropic error: ${response.status}`);
        }
        const data = await response.json();
        return data.content?.[0]?.text || '';
    }

    async function sendCustomChat(messages) {
        if (!config.customEndpoint) throw new Error('No custom endpoint configured');

        const headers = { 'Content-Type': 'application/json' };
        if (config.apiKey) headers['Authorization'] = `Bearer ${config.apiKey}`;

        const response = await fetch(config.customEndpoint, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({
                model: config.model || 'default',
                messages: messages,
                temperature: config.temperature
            })
        });
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `Custom API error: ${response.status}`);
        }
        const data = await response.json();
        return data.choices?.[0]?.message?.content || '';
    }

    return {
        loadSettings, saveSettings, getConfig, setConfig,
        getDefaultModel, getRecommendedModels, getRemoteModels,
        fetchOllamaModels, fetchGoogleModels,
        checkOllamaConnection, testRemoteConnection,
        sendChat,
        log, getDebugLog, clearDebugLog, exportDebugLog
    };
})();

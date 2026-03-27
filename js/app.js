/**
 * Aide — app.js
 * Main application: theme detection, tab routing, event wiring,
 * and Illustrator bridge (CSInterface).
 */

document.addEventListener('DOMContentLoaded', () => {
    // ──────────────── DOM Refs ────────────────
    const $id = id => document.getElementById(id);

    const dom = {
        connectionDot:      $id('connection-dot'),
        connectionLabel:    $id('connection-label'),
        tabBar:             $id('tab-bar'),
        chatMessages:       $id('chat-messages'),
        chatWelcome:        $id('chat-welcome'),
        promptInput:        $id('prompt-input'),
        sendBtn:            $id('send-btn'),
        newChatBtn:         $id('new-chat-btn'),
        modelIndicator:     $id('model-indicator'),
        attachBtn:          $id('attach-btn'),
        fileInput:          $id('file-input'),
        attachedFile:       $id('attached-file'),
        attachedFileName:   $id('attached-file-name'),
        removeAttachment:   $id('remove-attachment'),
        scriptsSearch:      $id('scripts-search'),
        scriptsList:        $id('scripts-list'),
        scriptsEmpty:       $id('scripts-empty'),
        providerSelect:     $id('provider-select'),
        ollamaHostRow:      $id('ollama-host-row'),
        ollamaHost:         $id('ollama-host'),
        customEndpointRow:  $id('custom-endpoint-row'),
        customEndpoint:     $id('custom-endpoint'),
        apiKeyRow:          $id('api-key-row'),
        apiKey:             $id('api-key'),
        providerHint:       $id('provider-hint'),
        toggleKeyVis:       $id('toggle-key-vis'),
        modelSelect:        $id('model-select'),
        modelCustom:        $id('model-custom'),
        modelCustomRow:     $id('model-custom-row'),
        clearCustomModel:   $id('clear-custom-model'),
        refreshModels:      $id('refresh-models-btn'),
        recommendedModels:  $id('recommended-models'),
        recommendedGroup:   $id('recommended-models-group'),
        tempSlider:         $id('temperature-slider'),
        tempValue:          $id('temperature-value'),
        debugToggle:        $id('debug-toggle'),
        debugActions:       $id('debug-actions'),
        exportDebugBtn:     $id('export-debug-btn'),
        clearDebugBtn:      $id('clear-debug-btn'),
        testConnBtn:        $id('test-connection-btn'),
        testResult:         $id('test-result'),
        scriptsFolderPath:  $id('scripts-folder-path'),
        changeScriptsFolder:$id('change-scripts-folder'),
        openScriptsFolder:  $id('open-scripts-folder'),
        exportAllScripts:   $id('export-all-scripts'),
    };

    // Current file attachment
    let currentAttachment = null;

    // ──────────────── CSInterface + Theme ────────────────
    let csInterface = null;
    try {
        csInterface = new CSInterface();
        applyIllustratorTheme();
        csInterface.addEventListener('com.adobe.csxs.events.ThemeColorChanged', applyIllustratorTheme);
    } catch (e) {
        console.warn('CSInterface unavailable — running outside Illustrator');
    }

    function applyIllustratorTheme() {
        if (!csInterface) return;
        try {
            const skinInfo = csInterface.getHostEnvironment().appSkinInfo;
            const bg = skinInfo.panelBackgroundColor.color;
            const brightness = (bg.red + bg.green + bg.blue) / 3;

            const bgHex = rgbToHex(bg.red, bg.green, bg.blue);
            document.documentElement.style.setProperty('--bg-primary', bgHex);

            if (brightness < 80) {
                document.body.classList.remove('theme-light');
                document.documentElement.style.setProperty('--bg-secondary', lighten(bg, 12));
                document.documentElement.style.setProperty('--bg-tertiary', darken(bg, 10));
            } else if (brightness < 130) {
                document.body.classList.remove('theme-light');
                document.documentElement.style.setProperty('--bg-secondary', lighten(bg, 8));
                document.documentElement.style.setProperty('--bg-tertiary', darken(bg, 12));
            } else {
                document.body.classList.add('theme-light');
                document.documentElement.style.setProperty('--bg-secondary', darken(bg, 6));
                document.documentElement.style.setProperty('--bg-tertiary', darken(bg, 12));
            }
        } catch (e) {
            console.warn('Could not read theme:', e);
        }
    }

    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(v => {
            const hex = Math.round(Math.max(0, Math.min(255, v))).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }
    function lighten(color, amount) {
        return rgbToHex(color.red + amount, color.green + amount, color.blue + amount);
    }
    function darken(color, amount) {
        return rgbToHex(color.red - amount, color.green - amount, color.blue - amount);
    }

    // ──────────────── Connection Health ────────────────
    async function checkConnection() {
        const cfg = AideModels.getConfig();
        dom.connectionDot.className = 'connection-dot warn';
        dom.connectionLabel.textContent = 'Checking...';

        if (cfg.provider === 'ollama') {
            const result = await AideModels.checkOllamaConnection();
            if (result.ok) {
                dom.connectionDot.className = 'connection-dot ok';
                dom.connectionLabel.textContent = `Ollama (${result.models} model${result.models !== 1 ? 's' : ''})`;
            } else {
                dom.connectionDot.className = 'connection-dot err';
                dom.connectionLabel.textContent = 'Ollama offline';
            }
        } else {
            const providerNames = { google: 'Gemini', openai: 'OpenAI', anthropic: 'Anthropic', custom: 'Custom' };
            const name = providerNames[cfg.provider] || cfg.provider;
            if (cfg.apiKey || cfg.provider === 'custom') {
                dom.connectionDot.className = 'connection-dot ok';
                dom.connectionLabel.textContent = `${name} · ${cfg.model || 'no model'}`;
            } else {
                dom.connectionDot.className = 'connection-dot warn';
                dom.connectionLabel.textContent = `${name} · No API key`;
            }
        }

        if (!csInterface) {
            dom.connectionLabel.textContent += ' · No Illustrator';
        }
    }

    checkConnection();
    setInterval(checkConnection, 30000);

    // ──────────────── Tab Routing ────────────────
    dom.tabBar.addEventListener('click', (e) => {
        const btn = e.target.closest('.tab-btn');
        if (!btn) return;
        const tab = btn.dataset.tab;

        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(v => v.classList.remove('active'));

        btn.classList.add('active');
        const view = $id('view-' + tab);
        if (view) view.classList.add('active');

        if (tab === 'scripts') refreshScriptsList();
    });

    // ──────────────── File Attachment ────────────────
    if (dom.attachBtn) {
        dom.attachBtn.addEventListener('click', () => dom.fileInput.click());
    }

    if (dom.fileInput) {
        dom.fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
                currentAttachment = await AideUtils.readTextFile(file);
                dom.attachedFileName.textContent = currentAttachment.name;
                dom.attachedFile.classList.remove('hidden');
                AideModels.log('attachment', { name: file.name, type: currentAttachment.type, size: file.size });
            } catch (err) {
                currentAttachment = null;
                console.error('Failed to read file:', err);
            }
            dom.fileInput.value = '';
        });
    }

    if (dom.removeAttachment) {
        dom.removeAttachment.addEventListener('click', () => {
            currentAttachment = null;
            dom.attachedFile.classList.add('hidden');
            dom.attachedFileName.textContent = '';
        });
    }

    // ──────────────── Chat ────────────────

    // Track original code for undo feature
    const originalCodeMap = {};

    function renderChatMessages() {
        const msgs = AideChat.getMessages();
        dom.chatMessages.innerHTML = '';

        if (msgs.length === 0) {
            dom.chatMessages.appendChild(dom.chatWelcome);
            dom.chatWelcome.style.display = '';
            return;
        }

        dom.chatWelcome.style.display = 'none';

        msgs.forEach((msg, idx) => {
            const el = document.createElement('div');
            el.className = `chat-msg ${msg.role}`;

            if (msg.role === 'user') {
                el.innerHTML = `
                    <span class="msg-role">You</span>
                    <div class="msg-body">${AideUtils.escapeHtml(msg.content)}</div>
                `;
            } else if (msg.role === 'assistant') {
                const hasCode = msg.content.trim().length > 0;
                const codeId = 'code-' + idx;
                const codeWithLines = AideUtils.addLineNumbers(msg.content);

                // Store original code for undo
                originalCodeMap[codeId] = msg.content;

                el.innerHTML = `
                    <span class="msg-role">Aide</span>
                    ${hasCode ? `
                    <div class="msg-code-block">
                        <div class="msg-code-header">
                            <span class="msg-code-label">ExtendScript</span>
                            <div class="msg-code-actions">
                                <button class="undo-edit-btn" data-action="undo-edit" data-code-id="${codeId}" title="Undo edits">↩ Undo</button>
                                <button class="code-action-btn" data-action="copy" data-code-id="${codeId}">Copy</button>
                                <button class="code-action-btn save-btn" data-action="save" data-code-id="${codeId}">Save</button>
                                <button class="code-action-btn execute-btn" data-action="execute" data-code-id="${codeId}">▶ Execute</button>
                            </div>
                        </div>
                        <pre class="msg-code-pre has-line-numbers" id="${codeId}" contenteditable="true" spellcheck="false">${codeWithLines}</pre>
                    </div>
                    ` : `<div class="msg-body">${AideUtils.escapeHtml(msg.content)}</div>`}
                `;
            }
            dom.chatMessages.appendChild(el);
        });

        dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
    }

    // Detect user edits in code blocks → activate undo button
    dom.chatMessages.addEventListener('input', (e) => {
        const pre = e.target.closest('.msg-code-pre[contenteditable]');
        if (!pre) return;
        const codeId = pre.id;
        const undoBtn = dom.chatMessages.querySelector(`.undo-edit-btn[data-code-id="${codeId}"]`);
        if (undoBtn) undoBtn.classList.add('active');
    });

    function showTypingIndicator() {
        const el = document.createElement('div');
        el.className = 'chat-msg assistant';
        el.id = 'typing-indicator';
        el.innerHTML = `
            <span class="msg-role">Aide</span>
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        `;
        dom.chatMessages.appendChild(el);
        dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
    }

    function removeTypingIndicator() {
        const el = $id('typing-indicator');
        if (el) el.remove();
    }

    async function handleSend() {
        let text = dom.promptInput.value.trim();
        if (!text || AideChat.getIsGenerating()) return;

        // If there's a file attachment, prepend its content
        if (currentAttachment) {
            text = `[Attached file: ${currentAttachment.name}]\n\nFile contents:\n${currentAttachment.content}\n\n---\n\nUser request: ${text}`;
            currentAttachment = null;
            dom.attachedFile.classList.add('hidden');
            dom.attachedFileName.textContent = '';
        }

        dom.promptInput.value = '';
        dom.promptInput.style.height = 'auto';
        dom.sendBtn.disabled = true;

        renderChatMessages();
        const userDiv = document.createElement('div');
        userDiv.className = 'chat-msg user';
        userDiv.innerHTML = `
            <span class="msg-role">You</span>
            <div class="msg-body">${AideUtils.escapeHtml(text)}</div>
        `;
        dom.chatMessages.appendChild(userDiv);
        showTypingIndicator();

        await AideChat.send(text, (update) => {
            if (update.type === 'done' || update.type === 'error') {
                removeTypingIndicator();
                renderChatMessages();

                if (update.type === 'error') {
                    const errDiv = document.createElement('div');
                    errDiv.className = 'msg-exec-result error';
                    errDiv.textContent = '⚠ ' + update.text;
                    dom.chatMessages.appendChild(errDiv);
                    dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
                }

                dom.sendBtn.disabled = false;
                dom.promptInput.focus();
            }
        });
    }

    dom.sendBtn.addEventListener('click', handleSend);

    dom.promptInput.addEventListener('input', () => {
        dom.promptInput.style.height = 'auto';
        dom.promptInput.style.height = Math.min(dom.promptInput.scrollHeight, 100) + 'px';
    });

    dom.promptInput.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            handleSend();
        }
    });

    document.querySelectorAll('.quick-prompt-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            dom.promptInput.value = btn.dataset.prompt;
            dom.promptInput.dispatchEvent(new Event('input'));
            dom.promptInput.focus();
        });
    });

    dom.newChatBtn.addEventListener('click', () => {
        AideChat.newConversation();
        renderChatMessages();
    });

    // Code action buttons (delegated)
    dom.chatMessages.addEventListener('click', (e) => {
        const btn = e.target.closest('.code-action-btn, .undo-edit-btn');
        if (!btn) return;

        const codeId = btn.dataset.codeId;
        const codeEl = $id(codeId);
        if (!codeEl) return;

        const code = getCodeFromElement(codeEl);
        const action = btn.dataset.action;

        if (action === 'copy') {
            copyToClipboard(code);
            btn.textContent = '✓';
            setTimeout(() => btn.textContent = 'Copy', 1500);
        }
        if (action === 'save') {
            const name = prompt('Script name:', 'Untitled Script');
            if (name !== null) {
                AideScripts.save(name, code, '');
                btn.textContent = '✓ Saved';
                setTimeout(() => btn.textContent = 'Save', 1500);
            }
        }
        if (action === 'execute') {
            executeCode(code, btn);
        }
        if (action === 'undo-edit') {
            const original = originalCodeMap[codeId];
            if (original) {
                codeEl.innerHTML = AideUtils.addLineNumbers(original);
                btn.classList.remove('active');
            }
        }
    });

    /**
     * Extract raw code from a code element (strips line numbers).
     */
    function getCodeFromElement(el) {
        const text = el.innerText || el.textContent;
        return text.replace(/^\s*\d+\s?/gm, '');
    }

    /**
     * Clipboard helper — works in both browser and CEP contexts.
     */
    function copyToClipboard(text) {
        // Try modern API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (e) { /* ignore */ }
        document.body.removeChild(ta);
    }

    // ──────────────── Execute ────────────────
    function executeCode(code, triggerBtn) {
        if (!csInterface) {
            showExecResult(triggerBtn, false, 'No Illustrator connection');
            return;
        }

        const scriptCall = `runGeneratedExtendScript(${JSON.stringify(code)})`;

        if (triggerBtn) {
            triggerBtn.textContent = '⏳';
            triggerBtn.disabled = true;
        }

        csInterface.evalScript(scriptCall, (result) => {
            const isError = result && result.indexOf('ExtendScript Error') > -1;
            AideChat.logExecution(code, result, isError);

            if (triggerBtn) {
                triggerBtn.disabled = false;
                triggerBtn.textContent = isError ? '✕ Failed' : '✓ Done';
                setTimeout(() => { triggerBtn.textContent = '▶ Execute'; }, 2000);
            }

            showExecResult(triggerBtn, !isError, result);

            if (isError) {
                offerAutoFix(result);
            }
        });
    }

    function showExecResult(nearEl, success, message) {
        const codeBlock = nearEl ? nearEl.closest('.msg-code-block') : null;
        if (!codeBlock) return;

        const prev = codeBlock.parentElement.querySelector('.msg-exec-result');
        if (prev) prev.remove();

        const resultEl = document.createElement('div');
        resultEl.className = `msg-exec-result ${success ? 'success' : 'error'}`;
        resultEl.textContent = success
            ? '✓ Script executed successfully'
            : `✕ ${message}`;
        codeBlock.parentElement.appendChild(resultEl);
        dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
    }

    function offerAutoFix(errorMsg) {
        const fixDiv = document.createElement('div');
        fixDiv.className = 'chat-msg assistant';
        fixDiv.innerHTML = `
            <div class="msg-body" style="display:flex;align-items:center;gap:6px;">
                <span>Script failed. Want me to try fixing it?</span>
                <button class="code-action-btn" id="auto-fix-btn" style="color:var(--accent);border-color:var(--accent);">Auto-fix</button>
            </div>
        `;
        dom.chatMessages.appendChild(fixDiv);
        dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;

        $id('auto-fix-btn')?.addEventListener('click', async () => {
            fixDiv.remove();
            showTypingIndicator();
            dom.sendBtn.disabled = true;

            await AideChat.sendErrorFeedback(errorMsg, (update) => {
                if (update.type === 'done' || update.type === 'error') {
                    removeTypingIndicator();
                    renderChatMessages();
                    dom.sendBtn.disabled = false;
                }
            });
        });
    }

    // ──────────────── Scripts Tab ────────────────
    function refreshScriptsList() {
        const query = dom.scriptsSearch.value;
        AideScripts.renderList(dom.scriptsList, dom.scriptsEmpty, query);
    }

    dom.scriptsSearch.addEventListener('input', refreshScriptsList);

    dom.scriptsList.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = btn.dataset.id;
        const action = btn.dataset.action;

        if (action === 'run') {
            const script = AideScripts.getById(id);
            if (script) executeCode(script.code, btn);
        }
        if (action === 'view' || action === 'toggle-code') {
            const viewer = $id('code-viewer-' + id);
            if (viewer) {
                viewer.classList.toggle('hidden');
                if (btn.dataset.action === 'view') {
                    btn.textContent = viewer.classList.contains('hidden') ? '{ }' : '{ ✕ }';
                }
            }
        }
        if (action === 'load-chat') {
            const script = AideScripts.getById(id);
            if (script) {
                // Start new chat, pre-fill with context
                AideChat.newConversation();
                // Switch to chat tab
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(v => v.classList.remove('active'));
                $id('tab-chat').classList.add('active');
                $id('view-chat').classList.add('active');
                // Set as attachment context
                dom.promptInput.value = '';
                currentAttachment = {
                    name: script.name + '.jsx',
                    type: 'jsx',
                    content: script.code
                };
                dom.attachedFileName.textContent = currentAttachment.name;
                dom.attachedFile.classList.remove('hidden');
                dom.promptInput.focus();
                renderChatMessages();
            }
        }
        if (action === 'fav') {
            AideScripts.toggleFavorite(id);
            refreshScriptsList();
        }
        if (action === 'delete') {
            if (confirm('Delete this script?')) {
                AideScripts.remove(id);
                refreshScriptsList();
            }
        }
        if (action === 'save-edits') {
            const viewer = $id('code-viewer-' + id);
            if (viewer) {
                const pre = viewer.querySelector('pre');
                if (pre) {
                    AideScripts.update(id, { code: pre.textContent });
                    btn.textContent = '✓ Saved';
                    setTimeout(() => { btn.textContent = 'Save Changes'; }, 1500);
                }
            }
        }
        if (action === 'rename') {
            const script = AideScripts.getById(id);
            if (script) {
                const newName = prompt('New name:', script.name);
                if (newName !== null && newName.trim()) {
                    AideScripts.update(id, { name: newName.trim() });
                    refreshScriptsList();
                }
            }
        }
    });

    // ──────────────── Settings Tab ────────────────
    const PROVIDER_HINTS = {
        ollama: '',
        google: 'Get a free API key at <a href="#" onclick="openUrl(\'https://aistudio.google.com/apikey\')">Google AI Studio</a>',
        openai: 'Get your key at <a href="#" onclick="openUrl(\'https://platform.openai.com/api-keys\')">platform.openai.com</a>',
        anthropic: 'Get your key at <a href="#" onclick="openUrl(\'https://console.anthropic.com/\')">console.anthropic.com</a>',
        custom: 'Any OpenAI-compatible endpoint (LM Studio, text-gen-webui, Together AI, etc.)'
    };

    const PROVIDER_KEY_PLACEHOLDERS = {
        ollama: '',
        google: 'AIza...',
        openai: 'sk-...',
        anthropic: 'sk-ant-...',
        custom: 'API key (optional)'
    };

    window.openUrl = function(url) {
        if (csInterface) {
            csInterface.openURLInDefaultBrowser(url);
        } else {
            window.open(url, '_blank');
        }
    };

    function initSettings() {
        const cfg = AideModels.loadSettings();

        dom.providerSelect.value = cfg.provider;
        dom.ollamaHost.value = cfg.ollamaHost;
        dom.apiKey.value = cfg.apiKey;
        if (dom.customEndpoint) dom.customEndpoint.value = cfg.customEndpoint || '';
        dom.tempSlider.value = Math.round(cfg.temperature * 100);
        dom.tempValue.textContent = cfg.temperature.toFixed(1);
        dom.modelIndicator.textContent = cfg.model || 'No model';

        // Debug toggle
        if (dom.debugToggle) {
            dom.debugToggle.checked = cfg.debugLogging || false;
            toggleDebugUI(cfg.debugLogging);
        }

        // Scripts folder
        if (dom.scriptsFolderPath) {
            dom.scriptsFolderPath.textContent = AideScripts.getScriptsFolder();
        }

        toggleProviderUI(cfg.provider);
        refreshModelList();
        renderRecommendedModels();
    }

    function toggleProviderUI(provider) {
        dom.ollamaHostRow.classList.toggle('hidden', provider !== 'ollama');
        dom.apiKeyRow.classList.toggle('hidden', provider === 'ollama');
        if (dom.customEndpointRow) {
            dom.customEndpointRow.classList.toggle('hidden', provider !== 'custom');
        }
        if (dom.recommendedGroup) {
            dom.recommendedGroup.classList.toggle('hidden', provider !== 'ollama');
        }

        dom.apiKey.placeholder = PROVIDER_KEY_PLACEHOLDERS[provider] || 'API key';

        const hint = PROVIDER_HINTS[provider];
        if (dom.providerHint) {
            if (hint) {
                dom.providerHint.innerHTML = hint;
                dom.providerHint.classList.remove('hidden');
            } else {
                dom.providerHint.classList.add('hidden');
            }
        }
    }

    function toggleDebugUI(enabled) {
        if (dom.debugActions) {
            dom.debugActions.classList.toggle('hidden', !enabled);
        }
    }

    // Provider change → auto-select default model
    dom.providerSelect.addEventListener('change', () => {
        const provider = dom.providerSelect.value;
        const defaultModel = AideModels.getDefaultModel(provider);

        AideModels.setConfig({ provider, model: defaultModel });
        dom.modelIndicator.textContent = defaultModel || 'No model';

        // Clear custom model on provider switch
        dom.modelCustom.value = '';
        dom.modelCustomRow.classList.add('hidden');
        dom.clearCustomModel.disabled = true;

        toggleProviderUI(provider);
        refreshModelList();
        checkConnection();
    });

    dom.ollamaHost.addEventListener('change', () => {
        AideModels.setConfig({ ollamaHost: dom.ollamaHost.value.trim() });
        refreshModelList();
        checkConnection();
    });

    if (dom.customEndpoint) {
        dom.customEndpoint.addEventListener('change', () => {
            AideModels.setConfig({ customEndpoint: dom.customEndpoint.value.trim() });
        });
    }

    dom.apiKey.addEventListener('change', () => {
        AideModels.setConfig({ apiKey: dom.apiKey.value.trim() });
        refreshModelList();
        checkConnection();
    });

    dom.toggleKeyVis.addEventListener('click', () => {
        dom.apiKey.type = dom.apiKey.type === 'password' ? 'text' : 'password';
    });

    dom.tempSlider.addEventListener('input', () => {
        const val = parseInt(dom.tempSlider.value) / 100;
        dom.tempValue.textContent = val.toFixed(1);
        AideModels.setConfig({ temperature: val });
    });

    // Custom model input — enable/disable clear button
    dom.modelCustom.addEventListener('input', () => {
        dom.clearCustomModel.disabled = !dom.modelCustom.value.trim();
    });

    dom.modelCustom.addEventListener('change', () => {
        const model = dom.modelCustom.value.trim();
        if (model) {
            AideModels.setConfig({ model });
            dom.modelIndicator.textContent = model;
            dom.clearCustomModel.disabled = false;
            checkConnection();
        }
    });

    // Clear custom model → revert to dropdown selection
    if (dom.clearCustomModel) {
        dom.clearCustomModel.addEventListener('click', () => {
            dom.modelCustom.value = '';
            dom.clearCustomModel.disabled = true;
            dom.modelCustomRow.classList.add('hidden');

            // Revert to dropdown-selected model
            const selected = dom.modelSelect.value;
            if (selected) {
                AideModels.setConfig({ model: selected });
                dom.modelIndicator.textContent = selected;
            } else {
                const cfg = AideModels.getConfig();
                const defaultModel = AideModels.getDefaultModel(cfg.provider);
                AideModels.setConfig({ model: defaultModel });
                dom.modelIndicator.textContent = defaultModel || 'No model';
            }
            checkConnection();
        });
    }

    // Dropdown model selection
    dom.modelSelect.addEventListener('change', () => {
        const model = dom.modelSelect.value;
        if (model === '__custom__') {
            // Show custom model input
            dom.modelCustomRow.classList.remove('hidden');
            dom.modelCustom.focus();
            return;
        }
        if (model) {
            // Hide custom row, use dropdown selection
            dom.modelCustomRow.classList.add('hidden');
            dom.modelCustom.value = '';
            dom.clearCustomModel.disabled = true;
            AideModels.setConfig({ model });
            dom.modelIndicator.textContent = model;
            checkConnection();
        }
    });

    async function refreshModelList() {
        const cfg = AideModels.getConfig();
        dom.modelSelect.innerHTML = '<option value="">Loading...</option>';

        try {
            let options = '';

            if (cfg.provider === 'ollama') {
                const models = await AideModels.fetchOllamaModels();
                if (models.length === 0) {
                    options = '<option value="">No models found</option>';
                } else {
                    options = models.map(m =>
                        `<option value="${m.name}" ${m.name === cfg.model ? 'selected' : ''}>${m.name} (${m.paramSize})</option>`
                    ).join('');
                }
            } else if (cfg.provider === 'google') {
                const models = cfg.apiKey
                    ? await AideModels.fetchGoogleModels()
                    : AideModels.getRemoteModels('google');
                options = models.map(m =>
                    `<option value="${m.name}" ${m.name === cfg.model ? 'selected' : ''}>${m.name}${m.desc ? ' — ' + m.desc : ''}</option>`
                ).join('');
            } else {
                const models = AideModels.getRemoteModels(cfg.provider);
                if (models.length > 0) {
                    options = models.map(m =>
                        `<option value="${m.name}" ${m.name === cfg.model ? 'selected' : ''}>${m.name}${m.desc ? ' — ' + m.desc : ''}</option>`
                    ).join('');
                } else {
                    options = '<option value="">No preset models</option>';
                }
            }

            // Always add "Custom..." as last option
            options += '<option value="__custom__">Custom model name…</option>';
            dom.modelSelect.innerHTML = options;

        } catch (e) {
            dom.modelSelect.innerHTML = '<option value="">Could not load models</option><option value="__custom__">Custom model name…</option>';
        }
    }

    dom.refreshModels.addEventListener('click', refreshModelList);

    function renderRecommendedModels() {
        if (!dom.recommendedModels) return;
        const models = AideModels.getRecommendedModels();
        dom.recommendedModels.innerHTML = models.map(m => `
            <div class="rec-model-row" data-model="${m.name}">
                <div class="rec-model-info">
                    <span class="rec-model-name">${m.name}</span>
                    <span class="rec-model-desc">${m.desc}</span>
                </div>
                <span class="rec-model-ram">${m.ram}</span>
            </div>
        `).join('');

        dom.recommendedModels.addEventListener('click', (e) => {
            const row = e.target.closest('.rec-model-row');
            if (!row) return;
            const name = row.dataset.model;
            AideModels.setConfig({ model: name });
            dom.modelIndicator.textContent = name;

            dom.recommendedModels.querySelectorAll('.rec-model-row').forEach(r => r.classList.remove('selected'));
            row.classList.add('selected');

            refreshModelList();
            checkConnection();
        });
    }

    // ── Debug Logging ──
    if (dom.debugToggle) {
        dom.debugToggle.addEventListener('change', () => {
            const enabled = dom.debugToggle.checked;
            AideModels.setConfig({ debugLogging: enabled });
            toggleDebugUI(enabled);
        });
    }

    if (dom.exportDebugBtn) {
        dom.exportDebugBtn.addEventListener('click', () => {
            const logText = AideModels.exportDebugLog();
            if (!logText || logText.indexOf('='.repeat(60)) === -1) {
                dom.exportDebugBtn.textContent = 'No logs yet';
                setTimeout(() => { dom.exportDebugBtn.textContent = 'Export Log'; }, 1500);
                return;
            }

            // Download as file (reliable in both browser and CEP)
            const blob = new Blob([logText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'aide_debug_log_' + new Date().toISOString().slice(0, 10) + '.txt';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            dom.exportDebugBtn.textContent = '✓ Downloaded';
            setTimeout(() => { dom.exportDebugBtn.textContent = 'Export Log'; }, 2000);
        });
    }

    if (dom.clearDebugBtn) {
        dom.clearDebugBtn.addEventListener('click', () => {
            if (confirm('Clear all debug log entries?')) {
                AideModels.clearDebugLog();
                dom.clearDebugBtn.textContent = '✓';
                setTimeout(() => { dom.clearDebugBtn.textContent = 'Clear'; }, 1500);
            }
        });
    }

    // ── Scripts Storage ──
    if (dom.changeScriptsFolder) {
        dom.changeScriptsFolder.addEventListener('click', () => {
            if (csInterface) {
                csInterface.evalScript('pickScriptsFolder()', (result) => {
                    if (result && result !== 'undefined') {
                        AideScripts.setScriptsFolder(result);
                        dom.scriptsFolderPath.textContent = result;
                    }
                });
            } else {
                const path = prompt('Enter scripts folder path:', AideScripts.getScriptsFolder());
                if (path) {
                    AideScripts.setScriptsFolder(path);
                    dom.scriptsFolderPath.textContent = path;
                }
            }
        });
    }

    if (dom.openScriptsFolder) {
        dom.openScriptsFolder.addEventListener('click', () => {
            const folder = AideScripts.getScriptsFolder();
            if (csInterface) {
                csInterface.evalScript(`openScriptsFolder(${JSON.stringify(folder)})`, () => { });
            } else {
                alert('Open in Finder only works inside Illustrator.');
            }
        });
    }

    if (dom.exportAllScripts) {
        dom.exportAllScripts.addEventListener('click', () => {
            const scripts = AideScripts.loadAll();
            if (scripts.length === 0) {
                dom.exportAllScripts.textContent = 'No scripts';
                setTimeout(() => { dom.exportAllScripts.textContent = 'Export All'; }, 1500);
                return;
            }

            const folder = AideScripts.getScriptsFolder();
            if (csInterface) {
                const data = JSON.stringify(scripts.map(s => ({ name: s.name, code: s.code })));
                csInterface.evalScript(`exportAllScripts(${JSON.stringify(folder)}, ${JSON.stringify(data)})`, (result) => {
                    dom.exportAllScripts.textContent = '✓ Done';
                    setTimeout(() => { dom.exportAllScripts.textContent = 'Export All'; }, 2000);
                });
            } else {
                // Browser fallback — download each as .jsx
                scripts.forEach(s => {
                    const blob = new Blob([s.code], { type: 'text/javascript' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = s.name.replace(/[/\\:*?"<>|]/g, '_') + '.jsx';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                });
                dom.exportAllScripts.textContent = '✓ Downloaded';
                setTimeout(() => { dom.exportAllScripts.textContent = 'Export All'; }, 2000);
            }
        });
    }

    dom.testConnBtn.addEventListener('click', async () => {
        dom.testResult.textContent = 'Testing...';
        dom.testResult.className = 'test-result';

        const cfg = AideModels.getConfig();
        let result;
        if (cfg.provider === 'ollama') {
            result = await AideModels.checkOllamaConnection();
        } else {
            result = await AideModels.testRemoteConnection();
        }

        dom.testResult.textContent = result.ok ? '✓ Connected' : `✕ ${result.error || 'Failed'}`;
        dom.testResult.className = `test-result ${result.ok ? 'ok' : 'fail'}`;
    });

    // ──────────────── Boot ────────────────
    initSettings();
    renderChatMessages();
});

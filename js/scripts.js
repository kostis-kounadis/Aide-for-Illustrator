/**
 * Aide — scripts.js
 * Script persistence: save, load, search, delete, favorites.
 * Uses localStorage (CEP doesn't support IndexedDB reliably).
 */

const AideScripts = (() => {
    const STORAGE_KEY = 'aide_scripts';
    const FOLDER_KEY = 'aide_scripts_folder';
    const DEFAULT_FOLDER = '~/Documents/Aide Scripts/';

    /**
     * Load all saved scripts
     * @returns {Array<{id:string, name:string, code:string, createdAt:string, prompt:string, favorite:boolean}>}
     */
    function loadAll() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch (e) {
            console.warn('Could not load scripts:', e);
            return [];
        }
    }

    /**
     * Save the full list back to localStorage
     */
    function persist(scripts) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(scripts));
        } catch (e) {
            console.warn('Could not persist scripts:', e);
        }
    }

    /**
     * Add a new script
     */
    function save(name, code, prompt) {
        const scripts = loadAll();
        const entry = {
            id: AideUtils.uid(),
            name: name || 'Untitled',
            code: code,
            prompt: prompt || '',
            createdAt: new Date().toISOString(),
            favorite: false
        };
        scripts.unshift(entry);
        persist(scripts);
        return entry;
    }

    /**
     * Delete a script by ID
     */
    function remove(id) {
        const scripts = loadAll().filter(s => s.id !== id);
        persist(scripts);
    }

    /**
     * Toggle favorite
     */
    function toggleFavorite(id) {
        const scripts = loadAll();
        const idx = scripts.findIndex(s => s.id === id);
        if (idx > -1) {
            scripts[idx].favorite = !scripts[idx].favorite;
            persist(scripts);
            return scripts[idx].favorite;
        }
        return false;
    }

    /**
     * Update script name or code
     */
    function update(id, updates) {
        const scripts = loadAll();
        const idx = scripts.findIndex(s => s.id === id);
        if (idx > -1) {
            Object.assign(scripts[idx], updates);
            persist(scripts);
        }
    }

    /**
     * Get a single script by ID
     */
    function getById(id) {
        return loadAll().find(s => s.id === id) || null;
    }

    /**
     * Search scripts by name or code content
     */
    function search(query) {
        const q = (query || '').toLowerCase().trim();
        if (!q) return loadAll();
        return loadAll().filter(s =>
            s.name.toLowerCase().includes(q) ||
            s.code.toLowerCase().includes(q) ||
            (s.prompt && s.prompt.toLowerCase().includes(q))
        );
    }

    // ──── Folder management ────
    function getScriptsFolder() {
        try {
            return localStorage.getItem(FOLDER_KEY) || DEFAULT_FOLDER;
        } catch (e) {
            return DEFAULT_FOLDER;
        }
    }

    function setScriptsFolder(path) {
        try {
            localStorage.setItem(FOLDER_KEY, path);
        } catch (e) {
            console.warn('Could not save folder path:', e);
        }
    }

    /**
     * Render the script library into the DOM — redesigned with view/edit/load actions.
     */
    function renderList(container, emptyEl, searchQuery) {
        const scripts = search(searchQuery);
        if (scripts.length === 0) {
            container.innerHTML = '';
            container.appendChild(emptyEl);
            emptyEl.classList.remove('hidden');
            return;
        }
        emptyEl.classList.add('hidden');
        container.innerHTML = scripts.map(s => `
            <div class="script-card" data-id="${s.id}">
                <div class="script-card-header">
                    <span class="script-card-name">${AideUtils.escapeHtml(s.name)}</span>
                    <span class="script-card-date">${AideUtils.formatDate(s.createdAt)}</span>
                </div>
                <div class="script-card-actions">
                    <button class="code-action-btn execute-btn" data-action="run" data-id="${s.id}" title="Run">▶ Run</button>
                    <button class="code-action-btn" data-action="view" data-id="${s.id}" title="View/Edit code">{ }</button>
                    <button class="code-action-btn" data-action="load-chat" data-id="${s.id}" title="Load as context in new chat">💬 Load</button>
                    <button class="code-action-btn${s.favorite ? ' starred' : ''}" data-action="fav" data-id="${s.id}" title="Favorite">${s.favorite ? '★' : '☆'}</button>
                    <button class="code-action-btn" data-action="delete" data-id="${s.id}" title="Delete" style="margin-left:auto">✕</button>
                </div>
                <div class="script-code-viewer hidden" id="code-viewer-${s.id}">
                    <pre contenteditable="true" spellcheck="false" data-script-id="${s.id}">${AideUtils.escapeHtml(s.code)}</pre>
                    <div class="script-code-footer">
                        <button data-action="save-edits" data-id="${s.id}">Save Changes</button>
                        <button data-action="rename" data-id="${s.id}">Rename</button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    return { loadAll, save, remove, toggleFavorite, update, getById, search, renderList, getScriptsFolder, setScriptsFolder, DEFAULT_FOLDER };
})();

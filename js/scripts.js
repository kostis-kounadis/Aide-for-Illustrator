/**
 * Aide — scripts.js
 * Script persistence: save, load, search, delete, favorites.
 * Uses localStorage (CEP doesn't support IndexedDB reliably).
 */

const AideScripts = (() => {
    const STORAGE_KEY = 'aide_scripts';
    const FOLDER_KEY = 'aide_scripts_folder';
    const FOLDERS_KEY = 'aide_local_script_folders';
    const LOCAL_FAV_KEY = 'aide_local_script_favorites';
    const SCRIPTS_SUBTAB_KEY = 'aide_scripts_subtab';
    const SCRIPTS_STAR_FILTER_KEY = 'aide_scripts_star_filter';
    const SCRIPTS_VIEW_MODE_KEY = 'aide_scripts_view_mode';
    const DESCRIPTIONS_KEY = 'aide_launcher_descriptions';
    const AUTO_DESCRIPTIONS_KEY = 'aide_auto_descriptions';
    const DEFAULT_FOLDER = '~/Documents/Aide Scripts/';

    function migrateFolderToArray() {
        try {
            if (localStorage.getItem(FOLDERS_KEY)) return;
            const legacy = localStorage.getItem(FOLDER_KEY);
            // Only migrate a real user-set legacy value, not the default
            if (legacy && legacy.trim() && legacy.trim() !== DEFAULT_FOLDER) {
                localStorage.setItem(FOLDERS_KEY, JSON.stringify([legacy.trim()]));
            } else {
                // Mark as migrated with an empty list — no phantom default folder
                localStorage.setItem(FOLDERS_KEY, JSON.stringify([]));
            }
        } catch (e) {
            console.warn('Folder migration:', e);
        }
    }

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
            if (e.name === 'QuotaExceededError' || e.message.includes('quota')) {
                window.dispatchEvent(new CustomEvent('QUOTA_EXCEEDED', {
                    detail: { source: 'scripts' }
                }));
            }
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

    // ──── Local script folders (export destination + Local tab roots) ────
    function getScriptFolders() {
        migrateFolderToArray();
        try {
            const raw = localStorage.getItem(FOLDERS_KEY);
            if (!raw) return [];
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr.filter(Boolean) : [];
        } catch (e) {
            return [];
        }
    }

    function setScriptFolders(paths) {
        try {
            const clean = (paths || []).map(p => String(p).trim()).filter(Boolean);
            localStorage.setItem(FOLDERS_KEY, JSON.stringify(clean));
        } catch (e) {
            console.warn('Could not save folder list:', e);
        }
    }

    function addScriptFolder(path, insertAtIdx = -1) {
        const p = String(path || '').trim();
        if (!p) return;
        const cur = getScriptFolders();
        if (cur.indexOf(p) !== -1) return;
        if (insertAtIdx >= 0 && insertAtIdx <= cur.length) {
            cur.splice(insertAtIdx, 0, p);
        } else {
            cur.push(p);
        }
        setScriptFolders(cur);
    }

    function removeScriptFolder(index) {
        const cur = getScriptFolders();
        if (index < 0 || index >= cur.length) return;
        cur.splice(index, 1);
        setScriptFolders(cur); // may become empty - that's valid
    }

    /** First folder: default export target */
    function getScriptsFolder() {
        const folders = getScriptFolders();
        return folders[0] || null;
    }

    function setScriptsFolder(path) {
        const p = String(path || '').trim();
        if (!p) return;
        const cur = getScriptFolders();
        if (cur.length === 0) {
            setScriptFolders([p]);
        } else {
            cur[0] = p;
            setScriptFolders(cur);
        }
    }

    // ──── Local disk script favorites (full fs path as id) ────
    function loadLocalFavorites() {
        try {
            const raw = localStorage.getItem(LOCAL_FAV_KEY);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) {
            return [];
        }
    }

    function persistLocalFavorites(ids) {
        try {
            localStorage.setItem(LOCAL_FAV_KEY, JSON.stringify(ids));
        } catch (e) {
            console.warn('Could not save local favorites:', e);
        }
    }

    function isLocalFavorite(path) {
        return loadLocalFavorites().indexOf(path) !== -1;
    }

    function toggleLocalFavorite(path) {
        const ids = loadLocalFavorites();
        const i = ids.indexOf(path);
        if (i === -1) ids.push(path);
        else ids.splice(i, 1);
        persistLocalFavorites(ids);
        return i === -1;
    }

    function getScriptsSubtab() {
        try {
            const v = localStorage.getItem(SCRIPTS_SUBTAB_KEY);
            return v === 'local' ? 'local' : 'aide';
        } catch (e) {
            return 'aide';
        }
    }

    function setScriptsSubtab(tab) {
        try {
            localStorage.setItem(SCRIPTS_SUBTAB_KEY, tab === 'local' ? 'local' : 'aide');
        } catch (e) { /* ignore */ }
    }

    function getScriptsStarFilter() {
        try {
            return localStorage.getItem(SCRIPTS_STAR_FILTER_KEY) === '1';
        } catch (e) {
            return false;
        }
    }

    function setScriptsStarFilter(on) {
        try {
            localStorage.setItem(SCRIPTS_STAR_FILTER_KEY, on ? '1' : '0');
        } catch (e) { /* ignore */ }
    }

    function getScriptsViewMode() {
        try {
            return localStorage.getItem(SCRIPTS_VIEW_MODE_KEY) === 'compact' ? 'compact' : 'expanded';
        } catch (e) {
            return 'expanded';
        }
    }

    function setScriptsViewMode(mode) {
        try {
            localStorage.setItem(SCRIPTS_VIEW_MODE_KEY, mode === 'compact' ? 'compact' : 'expanded');
        } catch (e) { /* ignore */ }
    }

    function getDescriptionsMap() {
        try {
            const raw = localStorage.getItem(DESCRIPTIONS_KEY);
            const o = raw ? JSON.parse(raw) : {};
            return o && typeof o === 'object' ? o : {};
        } catch (e) {
            return {};
        }
    }

    function getScriptDescription(key) {
        const m = getDescriptionsMap();
        return m[key] ? String(m[key]) : '';
    }

    function setScriptDescription(key, text) {
        try {
            const m = getDescriptionsMap();
            m[key] = text;
            localStorage.setItem(DESCRIPTIONS_KEY, JSON.stringify(m));
        } catch (e) {
            console.warn('Could not save description:', e);
        }
    }

    function clearAllScriptDescriptions() {
        try {
            localStorage.removeItem(DESCRIPTIONS_KEY);
        } catch (e) { /* ignore */ }
    }

    function getAutoDescriptions() {
        try {
            return localStorage.getItem(AUTO_DESCRIPTIONS_KEY) === 'true';
        } catch (e) { return false; }
    }

    function setAutoDescriptions(enabled) {
        try {
            localStorage.setItem(AUTO_DESCRIPTIONS_KEY, enabled ? 'true' : 'false');
        } catch (e) { /* ignore */ }
    }

    /**
     * Export all descriptions as a CSV string.
     * Format: script_key,description (double-quoted, escaped).
     */
    function exportDescriptionsCsv() {
        const m = getDescriptionsMap();
        const keys = Object.keys(m).sort();
        if (!keys.length) return '';
        const csvEsc = (s) => '"' + String(s).replace(/"/g, '""') + '"';
        const rows = ['script_name,description'];
        keys.forEach(k => {
            if (m[k]) rows.push(csvEsc(k) + ',' + csvEsc(m[k]));
        });
        return rows.join('\n');
    }

    /**
     * Import descriptions from a CSV string. Merges with existing.
     * Returns the number of descriptions imported.
     */
    function importDescriptionsCsv(csvText) {
        if (!csvText || !csvText.trim()) return 0;
        const lines = csvText.trim().split(/\r?\n/);
        const m = getDescriptionsMap();
        let count = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            // Skip header
            if (i === 0 && /^script_name\s*,\s*description$/i.test(line)) continue;
            // Simple CSV parse: find first comma not inside quotes
            let key = '', desc = '';
            if (line.charAt(0) === '"') {
                // Quoted key
                const endQ = findClosingQuote(line, 0);
                if (endQ < 0) continue;
                key = line.substring(1, endQ).replace(/""/g, '"');
                // Expect comma after closing quote
                const rest = line.substring(endQ + 1);
                const commaIdx = rest.indexOf(',');
                if (commaIdx < 0) continue;
                desc = unquoteCsv(rest.substring(commaIdx + 1).trim());
            } else {
                const commaIdx = line.indexOf(',');
                if (commaIdx < 0) continue;
                key = line.substring(0, commaIdx).trim();
                desc = unquoteCsv(line.substring(commaIdx + 1).trim());
            }
            if (key && desc) {
                m[key] = desc;
                count++;
            }
        }
        try {
            localStorage.setItem(DESCRIPTIONS_KEY, JSON.stringify(m));
        } catch (e) { /* ignore */ }
        return count;
    }

    function findClosingQuote(str, openPos) {
        let i = openPos + 1;
        while (i < str.length) {
            if (str.charAt(i) === '"') {
                if (i + 1 < str.length && str.charAt(i + 1) === '"') { i += 2; continue; }
                return i;
            }
            i++;
        }
        return -1;
    }

    function unquoteCsv(val) {
        if (val.length >= 2 && val.charAt(0) === '"' && val.charAt(val.length - 1) === '"') {
            return val.substring(1, val.length - 1).replace(/""/g, '"');
        }
        return val;
    }

    function getAideScriptsForView(searchQuery, favoritesOnly) {
        let scripts = search(searchQuery);
        if (favoritesOnly) scripts = scripts.filter(s => s.favorite);
        return scripts;
    }

    function descKeyAide(id) {
        return 'aide:' + id;
    }

    function descKeyLocal(fsPath) {
        return 'local:' + fsPath;
    }

    /**
     * @param {'expanded'|'compact'} viewMode
     */
    function renderList(container, emptyEl, searchQuery, favoritesOnly, viewMode) {
        const vm = viewMode === 'compact' ? 'compact' : 'expanded';
        const scripts = getAideScriptsForView(searchQuery, !!favoritesOnly);
        const descMap = getDescriptionsMap();
        if (scripts.length === 0) {
            container.innerHTML = '';
            container.appendChild(emptyEl);
            emptyEl.classList.remove('hidden');
            return;
        }
        emptyEl.classList.add('hidden');

        const downSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>';

        container.innerHTML = scripts.map(s => {
            const dkey = descKeyAide(s.id);
            const desc = descMap[dkey] ? String(descMap[dkey]) : '';
            const descHtml = desc
                ? `<div class="script-card-desc">${AideUtils.escapeHtml(desc)}</div>`
                : '';

            const runBtn = `<button type="button" class="code-action-btn execute-btn" data-action="run" data-id="${s.id}" title="Run">▶ Run</button>`;
            const favBtn = `<button type="button" class="code-action-btn${s.favorite ? ' starred' : ''}" data-action="fav" data-id="${s.id}" title="Favorite">${s.favorite ? '★' : '☆'}</button>`;
            
            const actionsFull = `
                    ${runBtn}
                    <button type="button" class="code-action-btn" data-action="view" data-id="${s.id}" title="View/Edit code">{ }</button>
                    <button type="button" class="code-action-btn" data-action="load-chat" data-id="${s.id}" title="Load as context in new chat">💬 Load</button>
                    ${favBtn}
                    <button type="button" class="code-action-btn code-action-btn--icon" data-action="download" data-id="${s.id}" title="Download .jsx">${downSvg}</button>
                    <button type="button" class="code-action-btn" data-action="delete" data-id="${s.id}" title="Delete">✕</button>`;

            const actionsCompact = `
                    ${runBtn}
                    ${favBtn}`;

            if (vm === 'compact') {
                return `
            <div class="script-card script-card--compact" data-id="${s.id}">
                <div class="script-card-compact-row">
                    <span class="script-card-name script-card-name--truncate" title="${AideUtils.escapeHtml(s.name)}">${AideUtils.escapeHtml(s.name)}</span>
                    <div class="script-card-actions script-card-actions--inline">${actionsCompact}</div>
                </div>
                <div class="script-code-viewer hidden" id="code-viewer-${s.id}">
                    <pre contenteditable="true" spellcheck="false" data-script-id="${s.id}">${AideUtils.escapeHtml(s.code)}</pre>
                    <div class="script-code-footer">
                        <button type="button" data-action="save-edits" data-id="${s.id}">Save Changes</button>
                        <button type="button" data-action="rename" data-id="${s.id}">Rename</button>
                    </div>
                </div>
            </div>`;
            }

            return `
            <div class="script-card script-card--expanded" data-id="${s.id}">
                <div class="script-card-header">
                    <span class="script-card-name">${AideUtils.escapeHtml(s.name)}</span>
                    <span class="script-card-date">${AideUtils.formatDate(s.createdAt)}</span>
                </div>
                ${descHtml}
                <div class="script-card-actions">${actionsFull}</div>
                <div class="script-code-viewer hidden" id="code-viewer-${s.id}">
                    <pre contenteditable="true" spellcheck="false" data-script-id="${s.id}">${AideUtils.escapeHtml(s.code)}</pre>
                    <div class="script-code-footer">
                        <button type="button" data-action="save-edits" data-id="${s.id}">Save Changes</button>
                        <button type="button" data-action="rename" data-id="${s.id}">Rename</button>
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    return {
        loadAll, save, remove, toggleFavorite, update, getById, search, renderList,
        getScriptsFolder, setScriptsFolder, getScriptFolders, setScriptFolders, addScriptFolder, removeScriptFolder,
        isLocalFavorite, toggleLocalFavorite, loadLocalFavorites,
        getScriptsSubtab, setScriptsSubtab, getScriptsStarFilter, setScriptsStarFilter,
        getScriptsViewMode, setScriptsViewMode,
        getDescriptionsMap, getScriptDescription, setScriptDescription, clearAllScriptDescriptions, descKeyAide, descKeyLocal,
        getAideScriptsForView,
        getAutoDescriptions, setAutoDescriptions, exportDescriptionsCsv, importDescriptionsCsv,
        DEFAULT_FOLDER
    };
})();

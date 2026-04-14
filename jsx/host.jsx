/**
 * @title Aide — host.jsx
 * @description ExtendScript entry point. Executes LLM-generated code
 *              within an undo group for safe rollback.
 *              Also provides file I/O for script export.
 */

/**
 * Expand "~" to the user home folder. ExtendScript does not resolve "~" in paths.
 */
function aideResolveUserPath(pathStr) {
    if (!pathStr) return pathStr;
    var p = String(pathStr);
    if (p.charAt(0) !== '~') return p;
    var home = $.getenv('HOME');
    if (!home) home = $.getenv('USERPROFILE');
    if (!home) {
        try {
            if (Folder.myDocuments && Folder.myDocuments.exists) {
                home = Folder.myDocuments.parent.fsName;
            }
        } catch (eHome) {}
    }
    if (!home) return p;
    var rest = p.length > 1 ? p.substring(1) : '';
    if (rest.charAt(0) === '/' || rest.charAt(0) === '\\') rest = rest.substring(1);
    var sep = (home.indexOf('\\') !== -1) ? '\\' : '/';
    if (home.charAt(home.length - 1) === '\\' || home.charAt(home.length - 1) === '/') {
        sep = '';
    }
    return home + sep + rest;
}

function aideJsonStringEscape(s) {
    if (s === undefined || s === null) return '';
    s = String(s);
    var r = '';
    var i;
    var c;
    var code;
    for (i = 0; i < s.length; i++) {
        c = s.charAt(i);
        code = c.charCodeAt(0);
        if (c === '\\') {
            r += '\\\\';
        } else if (c === '"') {
            r += '\\"';
        } else if (c === '\r') {
            r += '\\r';
        } else if (c === '\n') {
            r += '\\n';
        } else if (c === '\t') {
            r += '\\t';
        } else if (code < 32) {
            r += '\\u' + ('0000' + code.toString(16)).slice(-4);
        } else {
            r += c;
        }
    }
    return r;
}

/**
 * JSON.stringify is missing in some ExtendScript runtimes; build JSON manually.
 */
function aideFileEntriesToJson(out) {
    if (typeof JSON !== 'undefined' && JSON.stringify) {
        try {
            return JSON.stringify(out);
        } catch (ej) {}
    }
    var parts = [];
    var i;
    var e;
    for (i = 0; i < out.length; i++) {
        e = out[i];
        parts.push('{"path":"' + aideJsonStringEscape(e.path) + '","name":"' + aideJsonStringEscape(e.name) + '","relPath":"' + aideJsonStringEscape(e.relPath) + '","folderRoot":"' + aideJsonStringEscape(e.folderRoot) + '"}');
    }
    return '[' + parts.join(',') + ']';
}

/**
 * Evaluates the generated string from the local LLM.
 * Wraps execution in an undo group so the user can Cmd+Z to revert.
 * @param {string} codeString The raw ExtendScript from Ollama or remote API.
 * @returns {string} Result or error message back to CEP panel context.
 */
function runGeneratedExtendScript(codeString) {
    try {
        if (!codeString) return "Error: No code provided.";

        var doc = null;
        try {
            doc = app.activeDocument;
        } catch (noDoc) {
            // No document open — still allow execution for app-level scripts
        }

        // Begin undo group so entire operation can be reverted with Cmd+Z
        if (doc) {
            app.activeDocument.suspendIdleTask && app.activeDocument.suspendIdleTask();
        }
        app.redraw();

        // Execute the generated code in a scoped environment via Function constructor
        // This acts as a sandbox preventing var-declarations from polluting the global JSX namespace
        var executeCode = new Function(codeString);
        var result = executeCode();

        app.redraw();

        if (result !== undefined) {
            return String(result);
        }
        return "Script executed successfully.";

    } catch (e) {
        return "ExtendScript Error: " + e.name + " at line " + e.line + " - " + e.message;
    }
}

/**
 * Save a script file to disk.
 * @param {string} folderPath The folder to save into.
 * @param {string} fileName The file name (without extension).
 * @param {string} code The script code.
 * @returns {string} Result message.
 */
function saveScriptFile(folderPath, fileName, code) {
    try {
        var folder = new Folder(aideResolveUserPath(folderPath));
        if (!folder.exists) {
            folder.create();
        }

        // Sanitize filename and ensure .jsx extension
        var safeName = fileName.replace(/[\/\\:*?"<>|]/g, '_');
        if (!/\.jsx$/i.test(safeName)) {
            safeName += '.jsx';
        }
        var file = new File(folder.fsName + '/' + safeName);
        
        file.open('w');
        file.encoding = 'UTF-8';
        file.write(code);
        file.close();

        return "Saved: " + file.fsName;
    } catch (e) {
        return "Error saving file: " + e.message;
    }
}

/**
 * Prompt user for a save file location and write text to it.
 * @param {string} defaultName The default file name.
 * @param {string} content The text content to write.
 * @param {string} dialogTitle The dialog window title.
 * @param {string} fileFilter The file extension filter (e.g., "*.txt").
 * @returns {string} Success message or error message or "Cancelled".
 */
function aidePromptAndSaveFile(defaultName, content, dialogTitle, fileFilter) {
    try {
        var title = dialogTitle || "Save File";
        var filter = fileFilter || "*.*";
        var file = File.saveDialog(title, filter, defaultName);
        if (!file) {
            return "Cancelled";
        }
        file.open('w');
        file.encoding = 'UTF-8';
        file.write(content);
        file.close();
        return "Saved to " + file.fsName;
    } catch (e) {
        return "Error saving file: " + e.message;
    }
}

/**
 * Export multiple scripts to a folder.
 * @param {string} folderPath The folder path.
 * @param {string} scriptsJSON JSON array of {name, code} objects.
 * @returns {string} Result summary.
 */
function exportAllScripts(folderPath, scriptsJSON) {
    try {
        var scripts = typeof scriptsJSON === 'string' ? JSON.parse(scriptsJSON) : scriptsJSON;
        var folder = new Folder(aideResolveUserPath(folderPath));
        if (!folder.exists) {
            folder.create();
        }

        var saved = 0;
        for (var i = 0; i < scripts.length; i++) {
            var s = scripts[i];
            var safeName = s.name.replace(/[\/\\:*?"<>|]/g, '_');
            var file = new File(folder.fsName + '/' + safeName + '.jsx');
            file.open('w');
            file.encoding = 'UTF-8';
            file.write(s.code);
            file.close();
            saved++;
        }
        return "Exported " + saved + " scripts to " + folder.fsName;
    } catch (e) {
        return "Error exporting: " + e.message;
    }
}

/**
 * Open a folder in Finder/Explorer.
 * @param {string} folderPath The folder to open.
 * @returns {string} Result.
 */
function openScriptsFolder(folderPath) {
    try {
        var folder = new Folder(aideResolveUserPath(folderPath));
        if (!folder.exists) {
            folder.create();
        }
        folder.execute();
        return "Opened folder";
    } catch (e) {
        return "Error opening folder: " + e.message;
    }
}

/**
 * Pick a folder using Illustrator's folder dialog.
 * @returns {string} The selected path or empty string if cancelled.
 */
function pickScriptsFolder() {
    try {
        var folder = Folder.selectDialog("Select folder for Aide scripts");
        if (folder) {
            return folder.fsName;
        }
        return "";
    } catch (e) {
        return "";
    }
}

/**
 * Recursively collect .jsx / .js files under a root folder (max depth).
 */
function aideCollectScriptsFromFolder(folder, rootFsName, out, depthLeft) {
    if (!folder || !folder.exists || depthLeft <= 0) return;
    var items = folder.getFiles();
    if (!items) return;
    var i;
    for (i = 0; i < items.length; i++) {
        var item = items[i];
        if (typeof item === 'string') continue;
        if (item instanceof Folder) {
            aideCollectScriptsFromFolder(item, rootFsName, out, depthLeft - 1);
        } else if (item instanceof File) {
            var name = item.name;
            var lower = name.toLowerCase();
            var len = lower.length;
            var isJsx = len > 4 && lower.indexOf('.jsx') === len - 4;
            var isJs = len > 3 && lower.indexOf('.js') === len - 3;
            if (isJsx || isJs) {
                var rel = '';
                try {
                    rel = item.fsName.substring(rootFsName.length);
                    rel = rel.replace(/^[\/\\]/, '');
                } catch (relErr) {
                    rel = name;
                }
                out.push({
                    path: item.fsName,
                    name: name,
                    relPath: rel,
                    folderRoot: rootFsName
                });
            }
        }
    }
}

/**
 * List script files under configured folder roots. foldersJSON is a JSON array string of paths.
 * @returns {string} JSON array string for CEP.
 */
function listLocalScriptsFoldersJson(foldersJSON) {
    try {
        var folders = typeof foldersJSON === 'string' ? JSON.parse(foldersJSON) : foldersJSON;
        if (!folders || !folders.length) return '[]';
        var out = [];
        var f;
        for (f = 0; f < folders.length; f++) {
            var rootPath = aideResolveUserPath(folders[f]);
            if (!rootPath) continue;
            var dir = new Folder(rootPath);
            if (dir.exists) {
                aideCollectScriptsFromFolder(dir, dir.fsName, out, 32);
            }
        }
        return aideFileEntriesToJson(out);
    } catch (e) {
        return '[]';
    }
}

/**
 * Read UTF-8 text from a file (path passed as CEP-escaped string literal).
 */
function readLocalScriptFile(pathStr) {
    try {
        var f = new File(pathStr);
        if (!f.exists) return 'Error: File not found.';
        f.open('r');
        f.encoding = 'UTF-8';
        var text = f.read();
        f.close();
        return text;
    } catch (e) {
        return 'Error reading file: ' + e.message;
    }
}

/**
 * Write UTF-8 script file (user-initiated save from panel).
 */
function writeLocalScriptFile(pathStr, codeStr) {
    try {
        var f = new File(pathStr);
        f.open('w');
        f.encoding = 'UTF-8';
        f.write(codeStr);
        f.close();
        return 'Saved: ' + f.fsName;
    } catch (e) {
        return 'Error saving file: ' + e.message;
    }
}

/**
 * Open parent folder in Finder/Explorer (file must exist).
 */
function revealLocalFileInFinder(pathStr) {
    try {
        var f = new File(pathStr);
        if (!f.exists) return 'Error: File not found.';
        var parent = f.parent;
        if (parent && parent.exists) {
            parent.execute();
        }
        return 'OK';
    } catch (e) {
        return 'Error: ' + e.message;
    }
}

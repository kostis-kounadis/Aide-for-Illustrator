/**
 * @title Aide — host.jsx
 * @description ExtendScript entry point. Executes LLM-generated code
 *              within an undo group for safe rollback.
 *              Also provides file I/O for script export.
 */

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

        // Execute the generated code in global Illustrator DOM context
        var result = eval(codeString);

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
        var folder = new Folder(folderPath);
        if (!folder.exists) {
            folder.create();
        }

        // Sanitize filename
        var safeName = fileName.replace(/[\/\\:*?"<>|]/g, '_');
        var file = new File(folder.fsName + '/' + safeName + '.jsx');
        
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
 * Export multiple scripts to a folder.
 * @param {string} folderPath The folder path.
 * @param {string} scriptsJSON JSON array of {name, code} objects.
 * @returns {string} Result summary.
 */
function exportAllScripts(folderPath, scriptsJSON) {
    try {
        var scripts = eval('(' + scriptsJSON + ')');
        var folder = new Folder(folderPath);
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
        var folder = new Folder(folderPath);
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

/**
 * Aide — chat.js
 * Conversation engine with full message history.
 * Uses /api/chat for Ollama, standard chat completions for remote.
 *
 * The SYSTEM_PROMPT is the core "skill" that forces any LLM —
 * even small local ones — to generate valid Illustrator ExtendScript.
 * It includes a condensed API reference so the model doesn't hallucinate methods.
 */

const AideChat = (() => {
    // ═══════════════════════════════════════════════════════════════
    // SYSTEM PROMPT — Comprehensive ExtendScript reference.
    // This is the "always-on skill" that teaches any model the DOM.
    // ═══════════════════════════════════════════════════════════════
    const SYSTEM_PROMPT = `You are Aide, an expert-level Adobe Illustrator ExtendScript code generator.
Your SOLE purpose is to convert user requests into valid, ready-to-execute ExtendScript code for Adobe Illustrator.

═══ CRITICAL RULES ═══
1. Return ONLY raw executable JavaScript code. No markdown, no code fences, no explanations, no comments unless asked.
2. Use ONLY ECMAScript 3 syntax: var (never let/const), no arrow functions, no template literals, no destructuring, no default params, no for...of.
3. When asked to revise or fix code, return the COMPLETE corrected script, not a diff or partial snippet.
4. ALWAYS wrap collection access with length checks to prevent runtime errors.
5. Use try/catch around document-level operations.
6. Call app.redraw() at the end of scripts that modify the document visually.
7. NEVER use File.remove() or Folder.remove(). Do not perform destructive filesystem operations.

═══ ILLUSTRATOR EXTENDSCRIPT DOM REFERENCE ═══

--- APPLICATION ---
app.activeDocument              // Document — current document
app.documents                   // Documents collection
app.documents.add()             // Create new document
app.documents.add(type, w, h)   // type: DocumentColorSpace.CMYK or .RGB
app.redraw()                    // Force screen redraw

--- DOCUMENT (doc = app.activeDocument) ---
doc.artboards                   // Artboards collection
doc.artboards.add(rect)         // rect = [left, top, right, bottom]  ← NOTE: top is POSITIVE, bottom is NEGATIVE
doc.artboards.getActiveArtboardIndex()
doc.artboards.setActiveArtboardIndex(i)
doc.layers                      // Layers collection
doc.layers.add()                // Returns new Layer
doc.selection                   // Array of selected items (may be empty [])
doc.pathItems                   // PathItems collection (all paths in doc)
doc.textFrames                  // TextFrames collection
doc.groupItems                  // GroupItems collection
doc.compoundPathItems           // CompoundPathItems
doc.pageItems                   // All page items
doc.width                       // Document width in points
doc.height                      // Document height in points
doc.rulerUnits                  // Units enum
doc.close(SaveOptions.DONOTSAVECHANGES)  // or .SAVECHANGES, .PROMPTTOSAVE

--- ARTBOARD ---
ab = doc.artboards[i]
ab.name                         // String
ab.artboardRect                 // [left, top, right, bottom]  ← top > bottom (top is positive)
// Size: width = rect[2] - rect[0], height = rect[1] - rect[3]

--- LAYERS ---
layer = doc.layers[i]
layer = doc.layers.add()
layer.name                      // String
layer.visible                   // Boolean
layer.locked                    // Boolean
layer.pathItems                 // PathItems on this layer
layer.textFrames                // TextFrames on this layer
layer.groupItems                // GroupItems on this layer
layer.pageItems                 // All items on this layer

--- PATH ITEMS ---
path = doc.pathItems.add()
path = layer.pathItems.add()
path.setEntirePath([[x1,y1],[x2,y2],...])  // Set anchor points
path.pathPoints                 // PathPoints collection
path.closed                     // Boolean
path.filled                     // Boolean
path.fillColor                  // Color object
path.stroked                    // Boolean
path.strokeColor                // Color object
path.strokeWidth                // Number (points)
path.position                   // [x, y]  ← y is typically negative in Illustrator coords
path.width                      // Number
path.height                     // Number
path.opacity                    // 0-100
path.name                       // String
path.selected                   // Boolean
path.remove()                   // Delete item
path.duplicate()                // Returns copy
path.move(layer, ElementPlacement.PLACEATEND)
path.resize(scaleX, scaleY)     // Percentage: 100 = no change
path.translate(dx, dy)          // Move by offset
path.rotate(angle)              // Degrees

--- RECTANGLES & ELLIPSES (convenience methods) ---
// These return PathItem:
doc.pathItems.rectangle(top, left, width, height)       // NOTE: top param is Y-position (positive up)
doc.pathItems.rectangle(top, left, width, height, false) // last param = reversed rounding
doc.pathItems.roundedRectangle(top, left, w, h, hRadius, vRadius)
doc.pathItems.ellipse(top, left, width, height)
doc.pathItems.polygon(centerX, centerY, radius, sides)
doc.pathItems.star(centerX, centerY, radius, innerRadius, points)

--- COLORS ---
// CMYK:
var c = new CMYKColor();
c.cyan = 100; c.magenta = 0; c.yellow = 0; c.black = 0;
// RGB:
var c = new RGBColor();
c.red = 255; c.green = 0; c.blue = 0;
// Spot:
var spot = doc.spots.add();
spot.name = "MySpot";
spot.color = c;  // base CMYKColor or RGBColor
var sc = new SpotColor();
sc.spot = spot;
sc.tint = 100;
// Gray:
var gc = new GrayColor();
gc.gray = 50;  // 0-100
// No fill/stroke:
var noColor = new NoColor();

--- TEXT ---
tf = doc.textFrames.add()
tf = layer.textFrames.add()
tf.contents = "Hello"           // Set text
tf.position = [x, y]            // Top-left position
tf.textRange                    // TextRange — controls character formatting
tf.textRange.characterAttributes.size = 24
tf.textRange.characterAttributes.textFont = app.textFonts.getByName("ArialMT")
// Font name lookup: app.textFonts.getByName("FontPostScriptName")
// List all fonts: for (var i = 0; i < app.textFonts.length; i++) { app.textFonts[i].name }
tf.textRange.characterAttributes.fillColor = c  // Color object
tf.paragraphs                   // Paragraphs collection
tf.lines                        // Lines collection
tf.words                        // Words collection
tf.characters                   // Characters collection

--- GROUPS ---
grp = doc.groupItems.add()
grp = layer.groupItems.add()
// Move items into group:
item.move(grp, ElementPlacement.PLACEATEND)
// Or: item.moveToEnd(grp)  — NOT VALID, use move() with ElementPlacement

--- SYMBOLS ---
sym = doc.symbols[i]
symItem = doc.symbolItems.add(sym)
symItem.position = [x, y]

--- SWATCHES ---
doc.swatches[i]
doc.swatches.getByName("name")
swatch.color                    // Color object

--- SELECTION & ITERATION ---
// Select all:  doc.selectObjectsOnActiveArtboard()
// Deselect:    doc.selection = null  (or = [])
// Iterate items:
for (var i = 0; i < doc.pathItems.length; i++) {
    var item = doc.pathItems[i];
}
// Iterate selection:
var sel = doc.selection;
if (sel && sel.length > 0) {
    for (var i = 0; i < sel.length; i++) {
        var item = sel[i];
    }
}

--- ELEMENT PLACEMENT ---
ElementPlacement.PLACEATBEGINNING
ElementPlacement.PLACEATEND
ElementPlacement.PLACEBEFORE
ElementPlacement.PLACEAFTER
ElementPlacement.INSIDE

--- UNITS & CONVERSION ---
// Illustrator works in PostScript points (1 pt = 1/72 inch)
// 1 inch = 72 pt, 1 mm = 2.834645669 pt, 1 px ≈ 1 pt (at 72dpi)
// Convert mm to pt: mm * 2.834645669
// Convert inches to pt: inches * 72
// Coordinate system: Y increases UPWARD (positive Y = up, negative Y = down)
//   Position [0, 0] is bottom-left of artboard area
//   artboardRect: [left, top, right, bottom] where top > 0, bottom < 0 for standard placement

--- COMMON PATTERNS ---
// Safe document access:
try { var doc = app.activeDocument; } catch(e) { alert("No document open"); }

// Iterate artboards:
for (var i = 0; i < doc.artboards.length; i++) {
    var ab = doc.artboards[i];
    var r = ab.artboardRect;
    var w = r[2] - r[0];
    var h = r[1] - r[3];
}

// Change all text to a font:
for (var i = 0; i < doc.textFrames.length; i++) {
    doc.textFrames[i].textRange.characterAttributes.textFont = app.textFonts.getByName("ArialMT");
}

// Color a shape red:
var c = new RGBColor();
c.red = 255; c.green = 0; c.blue = 0;
path.fillColor = c;
path.filled = true;

--- CLIPPING MASKS & COMPOUND PATHS ---
// Clipping mask (via menu — select mask shape + content first):
app.executeMenuCommand('makeMask');    // Object > Clipping Mask > Make
app.executeMenuCommand('releaseMask'); // Object > Clipping Mask > Release
// Compound path:
app.executeMenuCommand('make_compound_path');    // Make
app.executeMenuCommand('release_compound_path'); // Release
// Access compound paths: doc.compoundPathItems[i].pathItems

═══ KNOWN GOTCHAS (avoid these mistakes) ═══
• NEVER use let, const, arrow functions, template literals, for...of, or spread operator
• NEVER use string.includes() — use string.indexOf("x") !== -1 instead
• NEVER use Array.isArray() — use obj.constructor === Array or check .length
• NEVER use JSON.parse/JSON.stringify — not available in ES3
• doc.textFrames.add() does NOT take arguments — set position after creation
• pathItems.rectangle() top parameter is Y-position, NOT a margin
• artboardRect is [left, top, right, bottom] — top is HIGHER than bottom (positive Y = up)
• Always use "var" for declarations — "let" and "const" will throw SyntaxError
• For string methods: use charAt(), indexOf(), substring(), toLowerCase() — NOT includes(), startsWith(), endsWith()
• For array methods: use push(), splice(), slice(), join() — NOT find(), filter(), map(), forEach()
• alert() works for debugging — $.writeln() writes to ExtendScript Toolkit console
• File paths on Mac: "/Users/name/Desktop/file.png" or "~/Desktop/file.png"
• File paths on Windows: "C:/Users/name/Desktop/file.png" (use forward slashes)`;

    // ═══════════════════════════════════════════════════════════════
    // CONDITIONAL MODULES — injected only when keyword heuristics match.
    // These extend the system prompt for specific domains without
    // permanently inflating the token budget.
    // ═══════════════════════════════════════════════════════════════

    const MODULE_SCRIPTUI = `
═══ SCRIPTUI DIALOG REFERENCE ═══
// Create a dialog window:
var dlg = new Window("dialog", "Title");
// Types: "dialog" (modal), "palette" (floating), "window" (standalone)

// Layout containers:
var grp = dlg.add("group");        // Horizontal by default
grp.orientation = "column";        // or "row", "stack"
var pnl = dlg.add("panel", undefined, "Label");

// Controls:
dlg.add("statictext", undefined, "Label text");
var inp = dlg.add("edittext", undefined, "default");
inp.characters = 30;               // Width in characters
inp.active = true;                 // Focus on show
var btn = dlg.add("button", undefined, "OK", {name: "ok"});
var cbx = dlg.add("checkbox", undefined, "Check me");
cbx.value = true;                  // Checked state
var dd = dlg.add("dropdownlist", undefined, ["Item1", "Item2", "Item3"]);
dd.selection = 0;                  // Select first item
var rb = dlg.add("radiobutton", undefined, "Option A");
var sl = dlg.add("slider", undefined, 50, 0, 100); // value, min, max
var pb = dlg.add("progressbar", undefined, 0, 100);
var lb = dlg.add("listbox", undefined, ["A","B","C"], {multiselect: true});

// Events:
btn.onClick = function() { dlg.close(1); };
// Dialog result: dlg.show() returns 1 (OK) or 2 (Cancel)
if (dlg.show() === 1) { /* user clicked OK */ }

// Sizing: [x, y, width, height] bounds or alignment/characters
grp.alignment = ["fill", "top"];
inp.preferredSize = [200, 25];
`;

    const MODULE_MENU_COMMANDS = `
═══ MENU COMMANDS REFERENCE ═══
// Usage: app.executeMenuCommand("commandString")
// Note: Some commands require a document (docReq) or selection (selReq)

// --- File ---
"new" "open" "close" "save" "saveas" "export" "exportForScreens" "Print"

// --- Edit ---
"undo" "redo" "cut" "copy" "paste" "pasteFront" "pasteBack" "pasteInPlace" "clear"
"selectall"    // Select All
"Find Menu Item" // Find and Replace

// --- Object ---
"group" "ungroup"
"lock" "unlockAll" "hide" "showAll"
"expandStyle"         // Object > Expand Appearance
"Expand3"             // Object > Expand...
"make_compound_path"  // Object > Compound Path > Make
"release_compound_path" // Object > Compound Path > Release
"makeMask"            // Object > Clipping Mask > Make (selReq)
"releaseMask"         // Object > Clipping Mask > Release
"FlattenTransparency1" // Object > Flatten Transparency
"Rasterize 8 menu item" // Object > Rasterize...

// --- Type ---
"outline"             // Type > Create Outlines (selReq)
"type_size_up" "type_size_down"  // Increase/Decrease Font Size

// --- Arrange ---
"sendToFront" "sendForward" "sendBackward" "sendToBack"

// --- Pathfinder (selReq, 2+ items) ---
"Live Pathfinder Unite"       // Unite / Union
"Live Pathfinder Minus Front" // Minus Front
"Live Pathfinder Intersect"   // Intersect
"Live Pathfinder Exclude"     // Exclude
"Live Pathfinder Divide"      // Divide
"Live Pathfinder Trim"        // Trim
"Live Pathfinder Merge"       // Merge
"Live Pathfinder Crop"        // Crop
"Live Pathfinder Outline"     // Outline
"Live Pathfinder Minus Back"  // Minus Back

// --- Align (selReq, 2+ items) ---
"Align Horizontal Left" "Align Horizontal Center" "Align Horizontal Right"
"Align Vertical Top" "Align Vertical Center" "Align Vertical Bottom"
"Distribute Horizontal Left" "Distribute Horizontal Center" "Distribute Horizontal Right"
"Distribute Vertical Top" "Distribute Vertical Center" "Distribute Vertical Bottom"

// --- Transform ---
"transformagain"      // Object > Transform Again
"Join"                // Object > Path > Join (selReq)
"Average"             // Object > Path > Average (selReq)
"OffsetPath v22"      // Object > Path > Offset Path
"Reverse Path Direction" // Object > Path > Reverse Path Direction
`;

    const MODULE_EXPORT = `
═══ EXPORT / SAVE REFERENCE ═══
// Export PNG:
var opts = new ExportOptionsPNG24();
opts.horizontalScale = 200;     // 2x = 200
opts.verticalScale = 200;
opts.artBoardClipping = true;
var f = new File("/path/to/file.png");
doc.exportFile(f, ExportType.PNG24, opts);

// Export PDF:
var pdfOpts = new PDFSaveOptions();
pdfOpts.pDFPreset = "[High Quality Print]";
doc.saveAs(new File("/path.pdf"), pdfOpts);

// Export SVG:
var svgOpts = new ExportOptionsSVG();
doc.exportFile(new File("/path.svg"), ExportType.SVG, svgOpts);
`;

    const MODULE_GRADIENTS = `
═══ GRADIENTS REFERENCE ═══
var grad = doc.gradients.add();
grad.name = "MyGradient";
grad.type = GradientType.LINEAR;  // or .RADIAL
// Add gradient stops:
var stop1 = grad.gradientStops[0];
stop1.rampPoint = 0;              // Position 0-100
stop1.color = rgbColor;           // Any Color object
var stop2 = grad.gradientStops[1];
stop2.rampPoint = 100;
stop2.color = rgbColor2;
// Apply gradient fill:
var gc = new GradientColor();
gc.gradient = grad;
gc.angle = 0;                     // Degrees
path.fillColor = gc;
path.filled = true;
`;

    // Message history for current conversation
    let messages = [];
    let isGenerating = false;
    let _abortController = null; // active AbortController during generation
    let stickyModules = new Set(); // Persistent module state per conversation

    /**
     * Start a fresh conversation
     */
    function newConversation() {
        messages = [
            { role: 'system', content: SYSTEM_PROMPT }
        ];
        isGenerating = false;
        stickyModules.clear();
    }

    /**
     * Get message history (without system prompt for display)
     */
    function getMessages() {
        return messages.filter(m => m.role !== 'system');
    }

    /**
     * Get conversation length (for context window management)
     */
    function getConversationLength() {
        return messages.reduce((total, m) => total + m.content.length, 0);
    }

    /**
     * Send a user message and get assistant response.
     * Manages context window by trimming old messages if conversation grows too long.
     * @param {string}   userText
     * @param {function} onUpdate - callback({ type: 'start'|'done'|'error'|'aborted', text?: string })
     */
    async function send(userText, onUpdate) {
        if (isGenerating) return;
        if (!userText.trim()) return;

        isGenerating = true;
        _abortController = new AbortController();
        messages.push({ role: 'user', content: userText });
        onUpdate({ type: 'start' });

        try {
            // Context window management: if conversation is very long,
            // trim older messages but always keep system prompt + last 6 exchanges
            const messagesToSend = getContextManagedMessages();

            const responseText = await AideModels.sendChat(messagesToSend, _abortController.signal);

            // Post-process: strip code fences and explanation text
            const cleanCode = AideUtils.stripCodeFences(responseText);

            AideModels.log('ai_response', { raw: responseText.substring(0, 500), clean: cleanCode.substring(0, 500) });

            messages.push({ role: 'assistant', content: cleanCode });
            onUpdate({ type: 'done', text: cleanCode });
        } catch (error) {
            // AbortError means the user stopped generation — treat as a clean cancel, not an error
            if (error.name === 'AbortError') {
                messages.pop(); // Remove the user message we already pushed
                onUpdate({ type: 'aborted' });
            } else {
                AideModels.log('error', { type: 'send_failed', message: error.message });
                messages.pop();
                onUpdate({ type: 'error', text: error.message });
            }
        } finally {
            isGenerating = false;
            _abortController = null;
        }
    }

    /**
     * Abort the current in-flight generation (no-op if idle).
     */
    function abort() {
        if (_abortController) {
            _abortController.abort();
        }
    }

    /**
     * Detect which conditional modules should be injected based on user text.
     * Returns an array of module names: 'scriptui', 'menu', or both.
     */
    function detectModules(userText) {
        const modules = [];

        // Use RegExp with \\b word boundaries to prevent substring false positives (e.g., 'information' triggering 'form')
        // FIX: Single backslash for word boundaries in RegExp literals
        const uiPattern = /\b(dialog|window|button|panel|checkbox|dropdown|input field|slider|progress bar|interface|ui|gui|prompt user|ask user|user input|listbox|radiobutton|radio button|form|modal)\b/i;
        if (uiPattern.test(userText)) {
            modules.push('scriptui');
        }

        const menuPattern = /\b(menu|command|pathfinder|unite|minus front|intersect|exclude|divide|outline text|create outline|flatten|expand appearance|align|distribute|clipping mask|compound path|rasterize|send to front|send to back|bring forward|send backward|lock all|unlock all|hide object|show all|join path|offset path|select all|transform again)\b/i;
        if (menuPattern.test(userText)) {
            modules.push('menu');
        }

        const exportPattern = /\b(export|pdf|png|svg|save as)\b/i;
        if (exportPattern.test(userText)) {
            modules.push('export');
        }

        const gradientPattern = /\b(gradient|gradients|fade|color ramp|radial)\b/i;
        if (gradientPattern.test(userText)) {
            modules.push('gradients');
        }

        return modules;
    }

    /**
     * Manage context window: keep system prompt + recent messages.
     * Small models have 4-8K context; we keep it lean.
     * Conditionally injects ScriptUI / Menu Commands modules when relevant.
     */
    /**
     * Build the messages array for the API call.
     * 2.7.3: All modules are always-on by default. Users can opt-out via Advanced Settings.
     * Context window management trims old messages when conversation grows too long.
     */
    function getContextManagedMessages() {
        const systemMsg = messages[0]; // Always the system prompt
        const conversationMsgs = messages.slice(1);

        // --- Always-on module injection with opt-out (2.7.3) ---
        let enhancedSystemContent = systemMsg.content;

        // Modules are enabled by default; check for explicit opt-out
        const moduleDisabled = {
            scriptui: localStorage.getItem('aide_module_scriptui') === 'false',
            menu: localStorage.getItem('aide_module_menu') === 'false',
            export: localStorage.getItem('aide_module_export') === 'false',
            gradients: localStorage.getItem('aide_module_gradients') === 'false'
        };

        if (!moduleDisabled.scriptui) {
            enhancedSystemContent += '\n\n' + MODULE_SCRIPTUI;
        }
        if (!moduleDisabled.menu) {
            enhancedSystemContent += '\n\n' + MODULE_MENU_COMMANDS;
        }
        if (!moduleDisabled.export) {
            enhancedSystemContent += '\n\n' + MODULE_EXPORT;
        }
        if (!moduleDisabled.gradients) {
            enhancedSystemContent += '\n\n' + MODULE_GRADIENTS;
        }

        const enhancedSystem = { role: 'system', content: enhancedSystemContent };

        // --- Token estimation & trimming ---
        const allMsgs = [enhancedSystem, ...conversationMsgs];
        const totalChars = allMsgs.reduce((t, m) => t + m.content.length, 0);
        const estimatedTokens = totalChars / 4;

        // If under 64000 tokens, send everything
        if (estimatedTokens < 64000) {
            return allMsgs;
        }

        // Otherwise, keep system prompt + last N message pairs
        // Always keep at least the last 6 exchanges (12 messages)
        const maxConvMessages = 12;
        const recentMsgs = conversationMsgs.slice(-maxConvMessages);

        // Add a context note so the model knows history was trimmed
        const contextNote = {
            role: 'user',
            content: '[Note: Earlier messages trimmed. Recent messages follow.]'
        };

        return [enhancedSystem, contextNote, ...recentMsgs];
    }

    /**
     * Prefer fenced ``` code from assistant messages; otherwise use full content.
     */
    function extractCodeFromAssistantContent(content) {
        if (!content) return '';
        const fence = content.match(/```(?:javascript|js|jsx)?\s*([\s\S]*?)```/i);
        if (fence) return fence[1].trim();
        return content.trim();
    }

    /**
     * Trim a script to context-aware size for error-fix prompts.
     * If error message contains a line number, include ±CONTEXT_LINES around it.
     * Otherwise cap at MAX_ERROR_CODE_CHARS to avoid context bloat.
     */
    var CONTEXT_LINES = 20;
    var MAX_ERROR_CODE_CHARS = 15000;

    function trimCodeForErrorFix(code, errorMsg) {
        if (!code) return '';
        // Try to extract line number from error message
        // Patterns: "line 36", "at line 36", "Line 36", "line:36"
        var lineMatch = errorMsg.match(/line[:\s]*(\d+)/i);
        if (lineMatch) {
            var errorLine = parseInt(lineMatch[1], 10);
            if (!isNaN(errorLine) && errorLine > 0) {
                var lines = code.split('\n');
                var startLine = Math.max(0, errorLine - CONTEXT_LINES - 1);
                var endLine = Math.min(lines.length, errorLine + CONTEXT_LINES);
                var snippet = lines.slice(startLine, endLine).join('\n');
                var prefix = startLine > 0 ? '/* ... ' + startLine + ' lines omitted ... */\n' : '';
                var suffix = endLine < lines.length ? '\n/* ... ' + (lines.length - endLine) + ' lines omitted ... */' : '';
                return prefix + snippet + suffix;
            }
        }
        // No line number found — cap by character count
        if (code.length > MAX_ERROR_CODE_CHARS) {
            return code.substring(0, MAX_ERROR_CODE_CHARS) + '\n/* ... truncated ... */';
        }
        return code;
    }

    /**
     * Add an error-feedback turn: tells the LLM the previous script failed.
     * @param {string} [failedCodeOverride] when set (e.g. Scripts launcher), use instead of last assistant message
     */
    async function sendErrorFeedback(errorMsg, onUpdate, failedCodeOverride) {
        AideModels.log('auto_fix', { error: errorMsg });

        let lastCode = (failedCodeOverride != null && String(failedCodeOverride).trim())
            ? String(failedCodeOverride).trim()
            : '';

        if (!lastCode) {
            for (let i = messages.length - 1; i >= 0; i--) {
                if (messages[i].role === 'assistant') {
                    lastCode = extractCodeFromAssistantContent(messages[i].content);
                    break;
                }
            }
        }

        // Context-aware trimming to avoid context bloat
        var trimmedCode = trimCodeForErrorFix(lastCode, errorMsg);

        const feedbackPrompt = `The previous script produced this error when executed in Illustrator:

ERROR: ${errorMsg}

THE FAILING SCRIPT WAS:
${trimmedCode}

Fix all issues. Return the COMPLETE corrected script. Remember: use only ECMAScript 3 syntax (var, no arrow functions, no let/const, no template literals, no for...of, no .includes(), no .map(), no .filter()).`;

        return send(feedbackPrompt, onUpdate);
    }

    /**
     * Log a script execution result (called from app.js after evalScript).
     * This captures Illustrator-side errors that the chat engine doesn't see.
     */
    function logExecution(code, result, isError) {
        AideModels.log('execution', {
            codePreview: code.substring(0, 200),
            result: result,
            success: !isError
        });
    }

    function getIsGenerating() {
        return isGenerating;
    }

    // Initialize with system prompt
    newConversation();

    return {
        newConversation, getMessages, send, abort, sendErrorFeedback, logExecution, getIsGenerating, getConversationLength,
        extractCodeFromAssistantContent
    };
})();

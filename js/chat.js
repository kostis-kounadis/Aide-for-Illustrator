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

--- EXPORT / SAVE ---
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

    // Message history for current conversation
    let messages = [];
    let isGenerating = false;

    /**
     * Start a fresh conversation
     */
    function newConversation() {
        messages = [
            { role: 'system', content: SYSTEM_PROMPT }
        ];
        isGenerating = false;
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
     * @param {string} userText
     * @param {function} onUpdate - callback({ type: 'start'|'done'|'error', text?: string })
     */
    async function send(userText, onUpdate) {
        if (isGenerating) return;
        if (!userText.trim()) return;

        isGenerating = true;
        messages.push({ role: 'user', content: userText });
        onUpdate({ type: 'start' });

        try {
            // Context window management: if conversation is very long,
            // trim older messages but always keep system prompt + last 6 exchanges
            const messagesToSend = getContextManagedMessages();
            
            const responseText = await AideModels.sendChat(messagesToSend);
            
            // Post-process: strip code fences and explanation text
            const cleanCode = AideUtils.stripCodeFences(responseText);
            
            AideModels.log('ai_response', { raw: responseText.substring(0, 500), clean: cleanCode.substring(0, 500) });
            
            messages.push({ role: 'assistant', content: cleanCode });
            onUpdate({ type: 'done', text: cleanCode });
        } catch (error) {
            AideModels.log('error', { type: 'send_failed', message: error.message });
            messages.pop();
            onUpdate({ type: 'error', text: error.message });
        } finally {
            isGenerating = false;
        }
    }

    /**
     * Manage context window: keep system prompt + recent messages.
     * Small models have 4-8K context; we keep it lean.
     */
    function getContextManagedMessages() {
        const systemMsg = messages[0]; // Always the system prompt
        const conversationMsgs = messages.slice(1);
        
        // Estimate token count (~4 chars per token is a rough heuristic)
        const totalChars = messages.reduce((t, m) => t + m.content.length, 0);
        const estimatedTokens = totalChars / 4;
        
        // If under 6000 tokens, send everything
        if (estimatedTokens < 6000) {
            return messages;
        }
        
        // Otherwise, keep system prompt + last N message pairs
        // Always keep at least the last 3 exchanges (6 messages)
        const maxConvMessages = 6;
        const recentMsgs = conversationMsgs.slice(-maxConvMessages);
        
        // Add a context note so the model knows history was trimmed
        const contextNote = {
            role: 'user',
            content: '[Note: Earlier conversation messages were trimmed to fit context window. The most recent messages follow.]'
        };
        
        return [systemMsg, contextNote, ...recentMsgs];
    }

    /**
     * Add an error-feedback turn: tells the LLM the previous script failed.
     * Includes the original script in the error context for better fixes.
     */
    async function sendErrorFeedback(errorMsg, onUpdate) {
        AideModels.log('auto_fix', { error: errorMsg });
        
        let lastCode = '';
        for (let i = messages.length - 1; i >= 0; i--) {
            if (messages[i].role === 'assistant') {
                lastCode = messages[i].content;
                break;
            }
        }
        
        const feedbackPrompt = `The previous script produced this error when executed in Illustrator:

ERROR: ${errorMsg}

THE FAILING SCRIPT WAS:
${lastCode}

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

    return { newConversation, getMessages, send, sendErrorFeedback, logExecution, getIsGenerating, getConversationLength };
})();

/**
 * Aide — utils.js
 * Post-processing, helpers, and shared utilities.
 */

const AideUtils = (() => {
    /**
     * Extract ONLY executable code from LLM responses.
     * LLMs often mix explanations with code despite the system prompt.
     * This aggressively strips everything that isn't code.
     */
    function stripCodeFences(raw) {
        if (!raw) return '';
        let text = raw.trim();

        // Strategy 1: If there's a code fence, extract ONLY the fenced content
        const fenceMatch = text.match(/```(?:javascript|jsx|js|extendscript)?\s*\n([\s\S]*?)\n?```/i);
        if (fenceMatch) {
            // There might be multiple code blocks — extract all of them
            const allBlocks = [];
            const fenceRegex = /```(?:javascript|jsx|js|extendscript)?\s*\n([\s\S]*?)\n?```/gi;
            let match;
            while ((match = fenceRegex.exec(text)) !== null) {
                allBlocks.push(match[1].trim());
            }
            text = allBlocks.join('\n\n');
        } else {
            // Strategy 2: No fences — try to detect and remove preamble/postamble text
            // Remove common LLM preamble patterns
            text = text.replace(/^(?:Here(?:'s| is) (?:the |your |a )?(?:corrected |fixed |updated |revised |complete )?(?:code|script|ExtendScript)[^:\n]*[:\s]*\n?)/im, '');
            text = text.replace(/^(?:Sure[!,.]?\s*(?:Here(?:'s| is)[^:\n]*)?[:\s]*\n?)/im, '');
            text = text.replace(/^(?:I've (?:written|created|generated|fixed|updated|corrected)[^:\n]*[:\s]*\n?)/im, '');
            text = text.replace(/^(?:The following[^:\n]*[:\s]*\n?)/im, '');
            text = text.replace(/^(?:Try this[^:\n]*[:\s]*\n?)/im, '');
            text = text.replace(/^(?:Below is[^:\n]*[:\s]*\n?)/im, '');

            // Remove trailing explanations (lines that start with common explanation patterns)
            const lines = text.split('\n');
            let lastCodeLine = lines.length - 1;
            for (let i = lines.length - 1; i >= 0; i--) {
                const line = lines[i].trim();
                // If line looks like explanation text (not code)
                if (line === '') continue;
                if (isExplanationLine(line)) {
                    lastCodeLine = i - 1;
                } else {
                    break;
                }
            }
            // Remove leading explanation lines
            let firstCodeLine = 0;
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line === '') { firstCodeLine = i + 1; continue; }
                if (isExplanationLine(line)) {
                    firstCodeLine = i + 1;
                } else {
                    break;
                }
            }

            if (firstCodeLine > 0 || lastCodeLine < lines.length - 1) {
                text = lines.slice(firstCodeLine, lastCodeLine + 1).join('\n');
            }
        }

        return text.trim();
    }

    /**
     * Detect if a line is human-readable explanation rather than code.
     */
    function isExplanationLine(line) {
        // Empty or whitespace-only
        if (!line.trim()) return false;
        
        // Lines that are clearly code — skip them
        if (line.match(/^[\s]*(?:var|function|if|else|for|while|try|catch|return|switch|case|break|continue)\b/)) return false;
        if (line.match(/^[\s]*(?:app\.|doc\.|var |\/\/|\/\*|\*\/|\*\s|}|{|\(|\)|\[|\])/)) return false;
        if (line.match(/;[\s]*$/)) return false;  // Ends with semicolon
        if (line.match(/^[\s]*[a-zA-Z_$][\w$]*\s*[\(=\.\[]/)) return false; // assignment or function call
        if (line.match(/^[\s]*\}\s*(?:else|catch|finally)/)) return false;
        if (line.match(/^[\s]*\}/)) return false;

        // Lines that look like natural language
        if (line.match(/^(?:This |The |Note |Please |Make sure |Remember |I |You |Here |Let me |It |In |To |If you |When |Also |However |Additionally )/i)) return true;
        if (line.match(/^(?:Sure|Okay|Alright|Great|Done|Fixed|Updated|Corrected|Modified|Changed)[!,.:]/i)) return true;
        if (line.match(/^(?:\d+\.\s+\w)/)) return true; // Numbered list items
        if (line.match(/^[-•]\s+\w/)) return true; // Bullet points
        if (line.match(/^(?:Explanation|Changes made|What I changed|Key changes|Notes|Output|Result|Summary)[:\s]/i)) return true;

        return false;
    }

    /**
     * Basic brace-matching validation.
     * Returns null if OK, or a string describing the issue.
     */
    function validateSyntax(code) {
        if (!code || !code.trim()) return 'Empty code';
        let braces = 0, parens = 0, brackets = 0;
        const lines = code.split('\n');
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const clean = line.replace(/"[^"]*"|'[^']*'/g, '');
            for (const ch of clean) {
                if (ch === '{') braces++;
                else if (ch === '}') braces--;
                else if (ch === '(') parens++;
                else if (ch === ')') parens--;
                else if (ch === '[') brackets++;
                else if (ch === ']') brackets--;
            }
        }
        if (braces !== 0) return `Unmatched braces (${braces > 0 ? 'missing }' : 'extra }'})`;
        if (parens !== 0) return `Unmatched parentheses (${parens > 0 ? 'missing )' : 'extra )'})`;
        if (brackets !== 0) return `Unmatched brackets (${brackets > 0 ? 'missing ]' : 'extra ]'})`;
        return null;
    }

    /**
     * Format a Date as a short human-readable string.
     */
    function formatDate(date) {
        const d = date instanceof Date ? date : new Date(date);
        const now = new Date();
        const diff = now - d;
        if (diff < 60000) return 'just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    }

    /**
     * Generate a short unique id.
     */
    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    /**
     * Escape HTML for safe rendering.
     */
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Add line numbers to code string (for display).
     */
    function addLineNumbers(code) {
        const lines = code.split('\n');
        const pad = String(lines.length).length;
        return lines.map((line, i) => {
            const num = String(i + 1).padStart(pad, ' ');
            return `<span class="line-num">${num}</span>${escapeHtml(line)}`;
        }).join('\n');
    }

    /**
     * Read a text file and return its contents.
     * Supports: .csv, .txt, .tsv, .json
     * @param {File} file
     * @returns {Promise<{name: string, type: string, content: string}>}
     */
    function readTextFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve({
                    name: file.name,
                    type: file.name.split('.').pop().toLowerCase(),
                    content: reader.result
                });
            };
            reader.onerror = () => reject(new Error('Failed to read file: ' + file.name));
            reader.readAsText(file);
        });
    }

    return { stripCodeFences, validateSyntax, formatDate, uid, escapeHtml, addLineNumbers, readTextFile };
})();

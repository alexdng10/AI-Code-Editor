// Code Mode Implementation
export class CodeModeManager {
    constructor(editor, aiService) {
        this.editor = editor;
        this.aiService = aiService;
        this.enabled = false;
        this.pendingChanges = null;
        this.setupEditorListeners();
    }

    setupEditorListeners() {
        // Listen for content changes when code mode is enabled
        this.editor.onDidChangeModelContent((e) => {
            if (this.enabled) {
                this.handleCodeChange(e);
            }
        });
    }

    enable() {
        this.enabled = true;
        // Add visual indicator that code mode is active
        this.editor.updateOptions({
            glyphMargin: true,
            lineNumbers: "on",
        });
        
        // Listen for code changes event
        window.addEventListener('showCodeChanges', this.handleShowCodeChanges.bind(this));
        
        // Immediately analyze current code
        const currentCode = this.editor.getValue();
        if (currentCode.trim()) {
            this.handleCodeChange();
        }
    }

    disable() {
        this.enabled = false;
        this.pendingChanges = null;
        // Reset editor options
        this.editor.updateOptions({
            glyphMargin: false,
            lineNumbers: "on",
        });
        
        // Remove event listener
        window.removeEventListener('showCodeChanges', this.handleShowCodeChanges.bind(this));
        
        // Reset layout to normal view
        window.dispatchEvent(new CustomEvent('resetCodeLayout', {}));
    }

    handleCodeChange(e) {
        // Debounce the analysis to avoid too many requests
        if (this.analysisTimeout) {
            clearTimeout(this.analysisTimeout);
        }

        this.analysisTimeout = setTimeout(async () => {
            // Get the current code
            const code = this.editor.getValue();
            
            try {
                // Get suggestions from AI
                const response = await this.aiService.getCodeModeAnalysis(code);
                
                // Parse the suggestions
                const suggestions = this.parseSuggestions(response);
                
                if (suggestions && suggestions.lineChanges.length > 0) {
                    // Store pending changes
                    this.pendingChanges = suggestions;
                    
                    // Add decorations for changes
                    const decorations = suggestions.lineChanges.map(change => ({
                        range: new monaco.Range(
                            change.lineNumber,
                            1,
                            change.lineNumber,
                            1
                        ),
                        options: {
                            isWholeLine: true,
                            className: 'line-modified',
                            glyphMarginClassName: 'glyph-modified',
                            hoverMessage: { value: `${change.explanation || ''}\nOld: ${change.oldText}\nNew: ${change.newText}` }
                        }
                    }));
                    
                    this.editor.deltaDecorations([], decorations);

                    // Emit event for UI to show suggestions
                    window.dispatchEvent(new CustomEvent('codeModeUpdate', {
                        detail: {
                            suggestions
                        }
                    }));
                }
            } catch (error) {
                console.error('Error in code mode analysis:', error);
            }
        }, 1000); // Wait 1 second after last change before analyzing
    }

    applyChanges() {
        if (!this.pendingChanges) return;

        const edits = [];
        
        if (this.pendingChanges.lineChanges.length > 0) {
            // Apply specific line changes
            for (const change of this.pendingChanges.lineChanges) {
                const lineContent = this.editor.getModel().getLineContent(change.lineNumber);
                const startIndex = lineContent.indexOf(change.oldText);
                
                if (startIndex !== -1) {
                    edits.push({
                        range: new monaco.Range(
                            change.lineNumber,
                            startIndex + 1,
                            change.lineNumber,
                            startIndex + change.oldText.length + 1
                        ),
                        text: change.newText
                    });
                }
            }
        }

        if (edits.length > 0) {
            this.editor.executeEdits('code-mode', edits);
        }

        // Clear decorations
        this.editor.deltaDecorations([], []);
        this.pendingChanges = null;
    }

    rejectChanges() {
        // Clear decorations
        this.editor.deltaDecorations([], []);
        this.pendingChanges = null;
    }

    async handleCodeChange(e) {
        // Debounce the analysis to avoid too many requests
        if (this.analysisTimeout) {
            clearTimeout(this.analysisTimeout);
        }

        this.analysisTimeout = setTimeout(async () => {
            // Get the current code
            const code = this.editor.getValue();
            
            try {
                // Get suggestions from AI
                const response = await this.aiService.getCodeModeAnalysis(code);
                
                // Parse the suggestions
                const suggestions = this.parseSuggestions(response);
                
                if (suggestions) {
                    // Store pending changes
                    this.pendingChanges = suggestions;
                    
                    // Create diff view
                    const diffView = this.createDiffView(code, suggestions);
                    
                    // Emit event for UI to show suggestions with diff
                    window.dispatchEvent(new CustomEvent('codeModeUpdate', {
                        detail: {
                            suggestions: suggestions,
                            diffView: diffView
                        }
                    }));
                }
            } catch (error) {
                console.error('Error in code mode analysis:', error);
            }
        }, 1000); // Wait 1 second after last change before analyzing
    }

    createDiffView(originalCode, suggestions) {
        // Create separate editors for original and optimized code
        const originalEditor = {
            code: originalCode,
            language: this.detectLanguage(originalCode),
            lineCount: originalCode.split('\n').length
        };

        // Create optimized version by applying suggestions
        let optimizedCode = suggestions.fullCode || originalCode;
        if (!suggestions.fullCode && suggestions.lineChanges.length > 0) {
            const lines = originalCode.split('\n');
            suggestions.lineChanges.forEach(change => {
                if (change.lineNumber <= lines.length) {
                    lines[change.lineNumber - 1] = change.newText;
                }
            });
            optimizedCode = lines.join('\n');
        }

        const optimizedEditor = {
            code: optimizedCode,
            language: this.detectLanguage(optimizedCode),
            lineCount: optimizedCode.split('\n').length
        };

        // Create line-by-line diff mapping
        const diffMapping = [];
        const maxLines = Math.max(originalEditor.lineCount, optimizedEditor.lineCount);
        
        for (let i = 0; i < maxLines; i++) {
            const lineNumber = i + 1;
            const originalLine = originalCode.split('\n')[i] || '';
            const optimizedLine = optimizedCode.split('\n')[i] || '';
            
            const change = suggestions.lineChanges.find(c => c.lineNumber === lineNumber);
            const lineMapping = {
                lineNumber,
                original: {
                    content: originalLine,
                    decorations: change ? 'removed' : 'unchanged'
                },
                optimized: {
                    content: optimizedLine,
                    decorations: change ? 'added' : 'unchanged'
                },
                explanation: change?.explanation || ''
            };
            
            diffMapping.push(lineMapping);
        }

        return {
            original: originalEditor,
            optimized: optimizedEditor,
            diffMapping,
            summary: suggestions.summary || '',
            changes: suggestions.lineChanges.map(change => ({
                lineNumber: change.lineNumber,
                oldText: change.oldText,
                newText: change.newText,
                explanation: change.explanation || ''
            }))
        };
    }

    detectLanguage(code) {
        // Simple language detection based on file extension patterns
        if (code.includes('#include') && /\b(int|void|char|float|double|bool)\b/.test(code)) {
            return 'cpp';
        } else if (/\b(function|const|let|var)\b/.test(code)) {
            return 'javascript';
        } else if (/\b(def|class|import)\b/.test(code)) {
            return 'python';
        } else if (/\b(public|private|class|void)\b/.test(code)) {
            return 'java';
        }
        return 'plaintext';
    }

    parseSuggestions(response) {
        const suggestions = {
            lineChanges: [],
            fullCode: null,
            summary: '',
            explanations: {}
        };

        try {
            const lines = response.split('\n');
            let inCodeBlock = false;
            let currentExplanation = '';
            
            for (const line of lines) {
                if (line.startsWith('```')) {
                    inCodeBlock = !inCodeBlock;
                    continue;
                }
                
                if (inCodeBlock) {
                    if (!suggestions.fullCode) suggestions.fullCode = '';
                    suggestions.fullCode += line + '\n';
                    continue;
                }

                // Parse summary (first non-empty line)
                if (!suggestions.summary && line.trim() && !line.startsWith('Line')) {
                    suggestions.summary = line.trim();
                    continue;
                }

                // Parse line changes and explanations
                const match = line.match(/Line\s+(\d+):\s*Change\s*"([^"]+)"\s*to\s*"([^"]+)"/);
                if (match) {
                    const lineNumber = parseInt(match[1]);
                    suggestions.lineChanges.push({
                        lineNumber: lineNumber,
                        oldText: match[2],
                        newText: match[3],
                        explanation: currentExplanation.trim()
                    });
                    currentExplanation = '';
                } else if (line.startsWith('Explanation:')) {
                    currentExplanation = line.replace('Explanation:', '').trim();
                }
            }

            if (suggestions.fullCode) {
                suggestions.fullCode = suggestions.fullCode.trim();
            }

            return suggestions;
        } catch (error) {
            console.error('Error parsing suggestions:', error);
            return null;
        }
    }

    applyChanges() {
        if (!this.pendingChanges) return;

        const edits = [];
        
        if (this.pendingChanges.lineChanges.length > 0) {
            // Apply specific line changes
            for (const change of this.pendingChanges.lineChanges) {
                const lineContent = this.editor.getModel().getLineContent(change.lineNumber);
                const startIndex = lineContent.indexOf(change.oldText);
                
                if (startIndex !== -1) {
                    edits.push({
                        range: new monaco.Range(
                            change.lineNumber,
                            startIndex + 1,
                            change.lineNumber,
                            startIndex + change.oldText.length + 1
                        ),
                        text: change.newText
                    });
                }
            }
        } else if (this.pendingChanges.fullCode) {
            // Replace entire content
            const model = this.editor.getModel();
            edits.push({
                range: model.getFullModelRange(),
                text: this.pendingChanges.fullCode
            });
        }

        if (edits.length > 0) {
            this.editor.executeEdits('code-mode', edits);
            
            // Trigger a new analysis after applying changes
            setTimeout(() => {
                if (this.enabled) {
                    this.handleCodeChange();
                }
            }, 500); // Wait a bit for the editor to update
        }

        this.pendingChanges = null;
    }

    rejectChanges() {
        this.pendingChanges = null;
    }
}

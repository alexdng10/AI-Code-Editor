// Code Mode Implementation
export class CodeModeManager {
    constructor(editor, aiService) {
        this.editor = editor;
        this.aiService = aiService;
        this.enabled = false;
        this.pendingChanges = null;
        this.originalCode = null;
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
        // Store original code
        this.originalCode = this.editor.getValue();
        
        // Add visual indicator that code mode is active
        this.editor.updateOptions({
            glyphMargin: true,
            lineNumbers: "on",
        });
        
        // Trigger initial analysis
        this.handleCodeChange();
    }

    disable() {
        this.enabled = false;
        this.pendingChanges = null;
        this.originalCode = null;
        
        // Reset editor options
        this.editor.updateOptions({
            glyphMargin: false,
            lineNumbers: "on",
        });
        
        // Reset layout to normal view
        window.dispatchEvent(new CustomEvent('resetCodeLayout', {}));
    }

    handleCodeChange(e) {
        // Check if AI service is initialized
        if (!this.aiService?.apiKey) {
            console.error('API key not set');
            window.dispatchEvent(new CustomEvent('showError', {
                detail: {
                    message: "Please set up your Groq API key first by clicking the API button in the Code Assistant panel."
                }
            }));
            this.disable();
            return;
        }

        // Debounce the analysis to avoid too many requests
        if (this.analysisTimeout) {
            clearTimeout(this.analysisTimeout);
        }

        this.analysisTimeout = setTimeout(async () => {
            try {
                // Get the current code
                const code = this.editor.getValue();
                if (!code.trim()) return;

                // Show loading state
                window.dispatchEvent(new CustomEvent('codeModeLoading', {
                    detail: { loading: true }
                }));
                
                // Get suggestions from AI
                const response = await this.aiService.getCodeModeAnalysis(code);
                if (typeof response === 'string' && (response.includes('API Error') || response.includes('Invalid or missing'))) {
                    throw new Error(response);
                }
                
                // Parse the suggestions
                const suggestions = this.parseSuggestions(response);
                
                if (suggestions) {
                    // Store pending changes
                    this.pendingChanges = suggestions;
                    
                    // Create diff view with full code comparison
                    const diffView = {
                        original: {
                            code: this.originalCode || code,
                            language: this.editor.getModel().getLanguageId()
                        },
                        optimized: {
                            code: suggestions.fullCode || code,
                            language: this.editor.getModel().getLanguageId()
                        },
                        changes: suggestions.lineChanges.map(change => ({
                            lineNumber: change.lineNumber,
                            oldText: change.oldText,
                            newText: change.newText,
                            explanation: change.explanation
                        }))
                    };
                    
                    // Show suggestions in the side-by-side view
                    window.dispatchEvent(new CustomEvent('codeModeUpdate', {
                        detail: {
                            suggestions,
                            diffView
                        }
                    }));
                }
            } catch (error) {
                console.error('Error in code mode analysis:', error);
                window.dispatchEvent(new CustomEvent('showError', {
                    detail: {
                        message: error.message || 'An error occurred while analyzing the code.'
                    }
                }));
                this.disable();
            } finally {
                // Hide loading state
                window.dispatchEvent(new CustomEvent('codeModeLoading', {
                    detail: { loading: false }
                }));
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

        // Store current scroll position and selection
        const scrollState = this.editor.saveViewState();
        
        // Apply the optimized code changes
        if (this.pendingChanges.lineChanges && this.pendingChanges.lineChanges.length > 0) {
            const model = this.editor.getModel();
            const edits = this.pendingChanges.lineChanges.map(change => ({
                range: new monaco.Range(
                    change.lineNumber,
                    1,
                    change.lineNumber,
                    model.getLineMaxColumn(change.lineNumber)
                ),
                text: change.newText
            }));
            
            // Apply changes while preserving cursor position and scroll state
            this.editor.executeEdits('code-mode', edits);
            this.editor.restoreViewState(scrollState);
        } else if (this.pendingChanges.fullCode) {
            // If we have full code replacement, preserve the important parts
            const model = this.editor.getModel();
            this.editor.executeEdits('code-mode', [{
                range: model.getFullModelRange(),
                text: this.pendingChanges.fullCode
            }]);
            this.editor.restoreViewState(scrollState);
        }

        // Clear pending changes
        this.pendingChanges = null;
        
        // Reset to original layout
        window.dispatchEvent(new CustomEvent('resetCodeLayout'));
        
        // Disable code mode
        this.disable();
    }

    rejectChanges() {
        // Restore original code if it exists
        if (this.originalCode) {
            const scrollState = this.editor.saveViewState();
            const model = this.editor.getModel();
            this.editor.executeEdits('code-mode', [{
                range: model.getFullModelRange(),
                text: this.originalCode
            }]);
            this.editor.restoreViewState(scrollState);
        }
        
        // Clear pending changes
        this.pendingChanges = null;
        
        // Reset to original layout
        window.dispatchEvent(new CustomEvent('resetCodeLayout'));
        
        // Disable code mode
        this.disable();
    }
}

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
        const diffLines = [];
        const originalLines = originalCode.split('\n');
        const suggestedLines = suggestions.fullCode ? suggestions.fullCode.split('\n') : [...originalLines];

        // Apply line changes to create suggested version
        if (suggestions.lineChanges.length > 0) {
            suggestions.lineChanges.forEach(change => {
                if (change.lineNumber <= suggestedLines.length) {
                    suggestedLines[change.lineNumber - 1] = change.newText;
                }
            });
        }

        // Create side-by-side diff with syntax highlighting
        const maxLines = Math.max(originalLines.length, suggestedLines.length);
        for (let i = 0; i < maxLines; i++) {
            const originalLine = originalLines[i] || '';
            const suggestedLine = suggestedLines[i] || '';
            const lineNumber = i + 1;

            // Check if this line has changes
            const hasChange = suggestions.lineChanges.some(change => 
                change.lineNumber === lineNumber
            );

            // Get line indentation
            const indentMatch = originalLine.match(/^(\s*)/);
            const indentation = indentMatch ? indentMatch[1] : '';

            // Create diff line with proper formatting
            diffLines.push({
                lineNumber,
                original: {
                    content: originalLine,
                    status: hasChange ? 'removed' : 'unchanged',
                    indentation: indentation
                },
                suggested: {
                    content: suggestedLine,
                    status: hasChange ? 'added' : 'unchanged',
                    indentation: indentation
                },
                // Add explanation if available
                explanation: hasChange ? suggestions.lineChanges.find(
                    change => change.lineNumber === lineNumber
                )?.explanation || '' : ''
            });
        }

        return {
            diffLines,
            summary: suggestions.summary || '',
            changes: suggestions.lineChanges.map(change => ({
                lineNumber: change.lineNumber,
                oldText: change.oldText,
                newText: change.newText,
                explanation: change.explanation || ''
            }))
        };
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

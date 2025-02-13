import { AIService } from './ai-service.js';

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export class ChatInterface {
    constructor() {
        this.aiService = null;
        this.messages = [];
        this.container = null;
        this.messagesContainer = null;
        this.inputContainer = null;
        this.lastError = null;
        this.lastErrorCode = null;
        this.messageCounter = 0; // Add counter for generating unique IDs
        this.editor = null; // Reference to Monaco editor
    }

    initialize(container) {
        this.container = container;
        this.setupUI();
        this.loadApiKey();
    }

    setupUI() {
        this.container.innerHTML = `
            <div class="chat-container">
                <div class="chat-header">
                    Code Assistant
                    <div class="chat-header-buttons">
                        <button class="suggest-fix-button" title="Get AI suggestion to fix error" style="display: none;">
                            Suggest Fix
                        </button>
                        <button class="code-assistant-button" title="Change API Key">
                            API
                        </button>
                    </div>
                </div>
                <div class="chat-messages">
                    <div class="chat-placeholder">
                        Ask questions about your code or get help with programming
                    </div>
                </div>
                <div class="chat-input-container">
                    <textarea class="chat-input" placeholder="Type your question here..."></textarea>
                    <div class="chat-input-actions">
                        <span class="toggle-label">Code Mode</span>
                        <label class="toggle-switch">
                            <input type="checkbox" class="code-mode-toggle">
                            <span class="toggle-slider"></span>
                        </label>
                        <button class="chat-send-button">Send</button>
                    </div>
                </div>
            </div>
        `;

        this.messagesContainer = this.container.querySelector('.chat-messages');
        // Add toggle button handler
        // Add toggle button handler
        const toggleButton = this.container.querySelector('.code-mode-toggle');
        if (toggleButton) {
            toggleButton.addEventListener('change', (e) => {
                this.codeModeEnabled = e.target.checked;
                // Emit event for IDE to handle code mode state
                window.dispatchEvent(new CustomEvent('codeModeStateChange', {
                    detail: {
                        enabled: this.codeModeEnabled
                    }
                }));
                
                // Add visual feedback in chat
                if (this.codeModeEnabled) {
                    this.addMessage('assistant', '## Code Mode Enabled\n\nI will now analyze your code in real-time and suggest improvements. You can discuss changes with me in real-time.');
                }
            });

            // Listen for code mode updates
            window.addEventListener('codeModeUpdate', (e) => {
                this.handleCodeModeUpdate(e.detail);
            });
        }

        // Store last code for conversations
        this.lastCode = '';

        // Add change key button handler
        const changeKeyButton = this.container.querySelector('.code-assistant-button');
        changeKeyButton.addEventListener('click', () => {
            localStorage.removeItem('groq_api_key');
            this.showApiKeyPrompt();
        });

        // Add suggest fix button handler
        const suggestFixButton = this.container.querySelector('.suggest-fix-button');
        suggestFixButton.addEventListener('click', () => {
            this.suggestAiFix();
        });

        // Add input handlers
        const input = this.container.querySelector('.chat-input');
        const sendButton = this.container.querySelector('.chat-send-button');

        input.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const text = input.value.trim();
                if (!text) return;

                input.value = '';

                if (this.codeModeEnabled) {
                    // Handle code mode conversation
                    this.addMessage('user', text);
                    try {
                        // Get current code from editor
                        const currentCode = this.editor.getValue();
                        const response = await this.aiService.getCodeModeAnalysis(
                            currentCode,
                            text // Pass user's question/request
                        );
                        
                        // Parse suggestions and create diff view
                        const suggestions = this.parseSuggestions(response);
                        if (suggestions) {
                            this.handleCodeModeUpdate({
                                suggestions,
                                diffView: this.createDiffView(currentCode, suggestions)
                            });
                        }
                    } catch (error) {
                        console.error('Error in code mode conversation:', error);
                        this.addMessage('assistant', 'Sorry, I encountered an error processing your request.');
                    }
                } else {
                    // Handle regular chat
                    this.sendMessage(text);
                }
            }
        });

        sendButton.addEventListener('click', () => {
            const text = input.value.trim();
            if (!text) return;

            input.value = '';

            if (this.codeModeEnabled) {
                // Handle code mode conversation
                this.addMessage('user', text);
                this.aiService.getCodeModeAnalysis(this.lastCode, text)
                    .then(response => {
                        const suggestions = this.parseSuggestions(response);
                        if (suggestions) {
                            this.handleCodeModeUpdate({
                                suggestions,
                                diffView: this.createDiffView(this.lastCode, suggestions)
                            });
                        }
                    })
                    .catch(error => {
                        console.error('Error in code mode conversation:', error);
                        this.addMessage('assistant', 'Sorry, I encountered an error processing your request.');
                    });
            } else {
                // Handle regular chat
                this.sendMessage(text);
            }
        });
    }

    loadApiKey() {
        const apiKey = localStorage.getItem('groq_api_key');
        if (apiKey) {
            this.aiService = new AIService(apiKey);
            // Emit ready event when API key is loaded
            window.dispatchEvent(new CustomEvent('chatInterfaceReady'));
        } else {
            this.showApiKeyPrompt();
        }
    }

    setupApiKey(key) {
        localStorage.setItem('groq_api_key', key);
        this.aiService = new AIService(key);
        // Emit ready event when API key is set up
        window.dispatchEvent(new CustomEvent('chatInterfaceReady'));
    }

    showApiKeyPrompt() {
        this.container.innerHTML = `
            <div class="api-key-container">
                <h3>Groq API Key Required</h3>
                <p>Please enter your Groq API key to use the Code Assistant</p>
                <input type="password" class="api-key-input" placeholder="Enter your Groq API key">
                <button class="save-key-button">Save Key</button>
                <p class="api-key-help">Get your API key at <a href="https://wow.groq.com" target="_blank">wow.groq.com</a></p>
            </div>
        `;

        const input = this.container.querySelector('.api-key-input');
        const saveButton = this.container.querySelector('.save-key-button');

        saveButton.addEventListener('click', () => {
            const key = input.value.trim();
            if (key) {
                this.setupApiKey(key);
                this.setupUI();
                console.log('API key saved and chat interface ready');
            }
        });
    }

    async sendMessage(text) {
        if (!text.trim() || !this.aiService) return;

        // Add user message
        this.addMessage('user', text);

        try {
            // Get AI response
            const response = await this.aiService.getCodeAnalysis(text);
            this.addMessage('assistant', response);
        } catch (error) {
            console.error('Error getting AI response:', error);
            this.addMessage('assistant', 'Sorry, I encountered an error processing your request.');
        }
    }

    handleCodeModeUpdate(detail) {
        if (!this.codeModeEnabled) return;

        const { suggestions } = detail;
        const messageId = `msg-${++this.messageCounter}`;

        // Create simple message with changes
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message assistant code-mode-suggestion';
        messageDiv.id = messageId;

        // Create message content
        const content = document.createElement('div');
        content.className = 'message-content';
        
        // Add changes overview
        if (suggestions.lineChanges && suggestions.lineChanges.length > 0) {
            const changes = suggestions.lineChanges.map(change => 
                `Line ${change.lineNumber}: ${change.explanation || ''}\n` +
                `Old: ${change.oldText}\n` +
                `New: ${change.newText}`
            ).join('\n\n');
            
            content.textContent = changes;
        }

        // Add buttons
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'code-mode-actions';
        
        const approveButton = document.createElement('button');
        approveButton.textContent = 'Approve Changes';
        approveButton.className = 'approve-button';
        approveButton.onclick = () => {
            window.dispatchEvent(new CustomEvent('codeModeAction', {
                detail: { 
                    action: 'apply',
                    messageId: messageId
                }
            }));
            messageDiv.querySelector('.code-mode-actions').remove();
        };

        const rejectButton = document.createElement('button');
        rejectButton.textContent = 'Reject Changes';
        rejectButton.className = 'reject-button';
        rejectButton.onclick = () => {
            window.dispatchEvent(new CustomEvent('codeModeAction', {
                detail: { 
                    action: 'reject',
                    messageId: messageId
                }
            }));
            messageDiv.querySelector('.code-mode-actions').remove();
        };

        actionsDiv.appendChild(approveButton);
        actionsDiv.appendChild(rejectButton);

        messageDiv.appendChild(content);
        messageDiv.appendChild(actionsDiv);

        // Clear previous messages
        while (this.messagesContainer.firstChild) {
            this.messagesContainer.removeChild(this.messagesContainer.firstChild);
        }

        this.messagesContainer.appendChild(messageDiv);
    }

    formatMessage(content) {
        const messageDiv = document.createElement('div');
        
        // Format the content using the same rules as addMessage
        let formattedContent = this.formatMessageContent(content);
        
        // Return the formatted HTML
        return formattedContent;
    }

    formatMessageContent(content) {
        // Keep the original text in case we need a fallback
        const originalText = content;
    
        // 1) Headings (##, ###) with auto-increment on level-2
        let headingCounter = 0;
        let formattedContent = content.replace(
          /^(#{2,3})\s+(.+)$/gm,
          (match, hashes, text) => {
            const level = hashes.length; // 2 or 3
            if (level === 2) {
              headingCounter++;
              return `<h${level} class="message-heading-${level}">${headingCounter}. ${text}</h${level}>`;
            }
            return `<h${level} class="message-heading-${level}">${text}</h${level}>`;
          }
        );
    
        // Apply all the same formatting rules as in addMessage
        formattedContent = this.applyMessageFormatting(formattedContent, originalText);
        
        return formattedContent;
    }

    applyMessageFormatting(content, originalText) {
        let formattedContent = content;
        
        // 2) Bold text (**something**)
        formattedContent = formattedContent.replace(
          /\*\*([^*]+)\*\*/g,
          (match, text) => `<strong>${text}</strong>`
        );
    
        // 3) Special bullet points (→ ⊙ ▸)
        formattedContent = formattedContent.replace(
          /^(\s*)([→⊙▸])\s+([^]*?)(?=\n\s*[→⊙▸]|\n\s*$|\n\s*##|$)/gm,
          (match, indent, bullet, text) => {
            let level;
            switch (bullet) {
              case '→': level = 0; break;
              case '⊙': level = 1; break;
              case '▸': level = 2; break;
              default: level = 0;
            }
    
            // If there's a colon, split main text vs description
            const parts = text.split(/:\s*(.+)/s);
            const mainText = parts[0].trim().replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
            const description = parts[1]
              ? parts[1].trim().replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
              : '';
    
            let result = `${indent}<li class="bullet-${bullet} indent-${level}">`;
            result += mainText;
            if (description) {
              result += `<span class="description">${description}</span>`;
            }
            return result + '</li>';
          }
        );
    
        // 4) Wrap the bullet items into <ul> or <ol>
        formattedContent = formattedContent.replace(
          /(?:^|\n)(<li class="bullet-([→⊙▸])[^]*?<\/li>\n?)+/g,
          (match, _, bullet) => {
            let level;
            switch (bullet) {
              case '→': level = 0; break;
              case '⊙': level = 1; break;
              case '▸': level = 2; break;
              default: level = 0;
            }
            const indent = '  '.repeat(level);
            const listType = bullet === '⊙' ? 'ol' : 'ul';
            return `\n${indent}<${listType} class="message-list level-${level} bullet-type-${bullet}">\n${match}${indent}</${listType}>\n`;
          }
        );
    
        // 5) Code blocks with ```lang
        formattedContent = formattedContent.replace(
          /```(\w+)?\n([\s\S]*?)```/g,
          (match, lang, code) => {
            const language = lang || '';
            return `
              <div class="code-block ${language}">
                <div class="code-header">${language}</div>
                <pre><code>${code.trim()}</code></pre>
              </div>
            `;
          }
        );
    
        // 6) Inline code (single backticks)
        formattedContent = formattedContent.replace(/`([^`]+)`/g, (match, code) => {
          if (code.includes(' ')) {
            return code.split(' ').map(word =>
              `<code class="inline-code">${word}</code>`
            ).join(' ');
          }
          return `<code class="inline-code">${code}</code>`;
        });
    
        // 7) Standalone numbered lists
        formattedContent = formattedContent.replace(
          /(?:^|\n)(?!\s*[→⊙▸])(\s*\d+\.\s+[^]*?)(?=\n\s*\d+\.|\n\s*##|\n\s*[→⊙▸]|$)/g,
          (match, contentBlock) => {
            const lines = contentBlock.trim().split('\n');
            const liItems = lines.map(line => {
              const mo = line.match(/^\s*(\d+\.)\s+(.+)$/);
              if (mo) {
                return `<li>${mo[2].trim()}</li>`;
              }
              return line;
            }).join('\n');
            return `\n<ol class="message-list level-0">\n${liItems}\n</ol>\n`;
          }
        );
    
        // 8) Section-splitting on "##"
        formattedContent = formattedContent.split(/(?=##\s)/).map(section => {
          if (section.trim()) {
            return `<div class="message-section">${section}</div>`;
          }
          return section;
        }).join('');
    
        // 9) Paragraph-splitting on double newlines
        formattedContent = formattedContent.split(/\n\n+/).map(para => {
          if (!para.includes('code-block') && !para.includes('<li>')) {
            return `<p class="message-paragraph">${para.trim()}</p>`;
          }
          return para;
        }).join('');
    
        // 10) Fallback if everything ended up empty
        if (!formattedContent.trim()) {
          formattedContent = `<p class="message-paragraph">${escapeHtml(originalText)}</p>`;
        }
        
        return formattedContent;
    }

    addMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
    
        // Keep the original text in case we need a fallback
        const originalText = content;
    
        // 1) Headings (##, ###) with auto-increment on level-2
        let headingCounter = 0;
        let formattedContent = content.replace(
          /^(#{2,3})\s+(.+)$/gm,
          (match, hashes, text) => {
            const level = hashes.length; // 2 or 3
            if (level === 2) {
              headingCounter++;
              return `<h${level} class="message-heading-${level}">${headingCounter}. ${text}</h${level}>`;
            }
            return `<h${level} class="message-heading-${level}">${text}</h${level}>`;
          }
        );
    
        // 2) Bold text (**something**)
        formattedContent = formattedContent.replace(
          /\*\*([^*]+)\*\*/g,
          (match, text) => `<strong>${text}</strong>`
        );
    
        // 3) Special bullet points (→ ⊙ ▸)
        formattedContent = formattedContent.replace(
          /^(\s*)([→⊙▸])\s+([^]*?)(?=\n\s*[→⊙▸]|\n\s*$|\n\s*##|$)/gm,
          (match, indent, bullet, text) => {
            let level;
            switch (bullet) {
              case '→': level = 0; break;
              case '⊙': level = 1; break;
              case '▸': level = 2; break;
              default: level = 0;
            }
    
            // If there's a colon, split main text vs description
            const parts = text.split(/:\s*(.+)/s);
            const mainText = parts[0].trim().replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
            const description = parts[1]
              ? parts[1].trim().replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
              : '';
    
            let result = `${indent}<li class="bullet-${bullet} indent-${level}">`;
            result += mainText;
            if (description) {
              result += `<span class="description">${description}</span>`;
            }
            return result + '</li>';
          }
        );
    
        // 4) Wrap the bullet items into <ul> or <ol>
        formattedContent = formattedContent.replace(
          /(?:^|\n)(<li class="bullet-([→⊙▸])[^]*?<\/li>\n?)+/g,
          (match, _, bullet) => {
            let level;
            switch (bullet) {
              case '→': level = 0; break;
              case '⊙': level = 1; break;
              case '▸': level = 2; break;
              default: level = 0;
            }
            const indent = '  '.repeat(level);
            const listType = bullet === '⊙' ? 'ol' : 'ul';
            return `\n${indent}<${listType} class="message-list level-${level} bullet-type-${bullet}">\n${match}${indent}</${listType}>\n`;
          }
        );
    
        // 5) Code blocks with ```lang
        formattedContent = formattedContent.replace(
          /```(\w+)?\n([\s\S]*?)```/g,
          (match, lang, code) => {
            const language = lang || '';
            return `
              <div class="code-block ${language}">
                <div class="code-header">${language}</div>
                <pre><code>${code.trim()}</code></pre>
              </div>
            `;
          }
        );
    
        // 6) Inline code (single backticks)
        // If user’s code has spaces, each word is wrapped
        formattedContent = formattedContent.replace(/`([^`]+)`/g, (match, code) => {
          if (code.includes(' ')) {
            return code.split(' ').map(word =>
              `<code class="inline-code">${word}</code>`
            ).join(' ');
          }
          return `<code class="inline-code">${code}</code>`;
        });
    
        // 7) Standalone numbered lists: "1. something" -> <ol><li>something</li></ol>
        formattedContent = formattedContent.replace(
          /(?:^|\n)(?!\s*[→⊙▸])(\s*\d+\.\s+[^]*?)(?=\n\s*\d+\.|\n\s*##|\n\s*[→⊙▸]|$)/g,
          (match, contentBlock) => {
            const lines = contentBlock.trim().split('\n');
            const liItems = lines.map(line => {
              const mo = line.match(/^\s*(\d+\.)\s+(.+)$/);
              if (mo) {
                return `<li>${mo[2].trim()}</li>`;
              }
              return line; // fallback if line doesn’t match
            }).join('\n');
            return `\n<ol class="message-list level-0">\n${liItems}\n</ol>\n`;
          }
        );
    
        // 8) Section-splitting on "##"
        formattedContent = formattedContent.split(/(?=##\s)/).map(section => {
          if (section.trim()) {
            return `<div class="message-section">${section}</div>`;
          }
          return section;
        }).join('');
    
        // 9) Paragraph-splitting on double newlines
        formattedContent = formattedContent.split(/\n\n+/).map(para => {
          // Only wrap in <p> if it’s not inside a bullet or code block
          if (!para.includes('code-block') && !para.includes('<li>')) {
            return `<p class="message-paragraph">${para.trim()}</p>`;
          }
          return para;
        }).join('');
    
        // 10) Fallback if everything ended up empty
        if (!formattedContent.trim()) {
          // If your transformations produced nothing, just show original text as a paragraph.
          formattedContent = `<p class="message-paragraph">${escapeHtml(originalText)}</p>`;
        }
    
        // Now put the final HTML in the message
        messageDiv.innerHTML = formattedContent;
    
        // Append to DOM & scroll
        this.messagesContainer.appendChild(messageDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    
        // Store in messages array
        this.messages.push({ role, content });
    }
    
    
    

    parseSuggestions(response) {
        try {
            const lines = response.split('\n');
            let inCodeBlock = false;
            let currentExplanation = '';
            let summary = '';
            let lineChanges = [];
            let fullCode = null;
            
            for (const line of lines) {
                if (line.startsWith('```')) {
                    inCodeBlock = !inCodeBlock;
                    continue;
                }
                
                if (inCodeBlock) {
                    if (!fullCode) fullCode = '';
                    fullCode += line + '\n';
                    continue;
                }

                // Parse summary (first non-empty line)
                if (!summary && line.trim() && !line.startsWith('Line')) {
                    summary = line.trim();
                    continue;
                }

                // Parse line changes and explanations
                const match = line.match(/Line\s+(\d+):\s*Change\s*"([^"]+)"\s*to\s*"([^"]+)"/);
                if (match) {
                    lineChanges.push({
                        lineNumber: parseInt(match[1]),
                        oldText: match[2].trim(),
                        newText: match[3].trim(),
                        explanation: currentExplanation.trim()
                    });
                    currentExplanation = '';
                } else if (line.startsWith('Explanation:')) {
                    currentExplanation = line.replace('Explanation:', '').trim();
                }
            }

            if (fullCode) {
                fullCode = fullCode.trim();
            }

            return { lineChanges, fullCode, summary };
        } catch (error) {
            console.error('Error parsing suggestions:', error);
            return null;
        }
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

    async handleCodeSelection(selectedCode) {
        if (!this.aiService) return;

        try {
            const response = await this.aiService.getInlineHelp(selectedCode);
            this.addMessage('assistant', response);
        } catch (error) {
            console.error('Error analyzing code selection:', error);
            this.addMessage('assistant', 'Sorry, I encountered an error analyzing the selected code.');
        }
    }

    // This method is no longer used - edit functionality is now handled directly in the editor
    async handleCodeEdit(selectedCode, selection) {
        return;
    }

    showSuggestFixButton(code, error) {
        if (!this.aiService) return;
        
        // Store the error and code for the suggest fix feature
        this.lastError = error;
        this.lastErrorCode = code;
        
        // Show the suggest fix button
        const suggestFixButton = this.container.querySelector('.suggest-fix-button');
        if (suggestFixButton) {
            suggestFixButton.style.display = 'inline-flex';
        }
    }

    hideCompilationError() {
        // Hide the suggest fix button when there's no error
        const suggestFixButton = this.container.querySelector('.suggest-fix-button');
        if (suggestFixButton) {
            suggestFixButton.style.display = 'none';
        }
        this.lastError = null;
        this.lastErrorCode = null;
    }

    async suggestAiFix() {
        if (!this.aiService || !this.lastError || !this.lastErrorCode) return;

        try {
            // Get AI suggestion for the fix
            const response = await this.aiService.getCodeAnalysis(this.lastErrorCode, this.lastError, 'fix');
            
            // Create a message with the suggested fix and action buttons
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message assistant';
            
            // Extract line changes and code from the response
            const lines = response.split('\n');
            let explanation = '';
            let lineChanges = [];
            let suggestedCode = '';
            
            // Parse the response to extract line changes and code
            let inCodeBlock = false;
            for (const line of lines) {
                if (line.startsWith('```')) {
                    inCodeBlock = !inCodeBlock;
                    continue;
                }
                
                if (inCodeBlock) {
                    suggestedCode += line + '\n';
                    continue;
                }

                // Look for line number references (e.g., "Line 17:" or "On line 17,")
                const lineMatch = line.match(/(?:line|Line)\s+(\d+)[:\s]/);
                if (lineMatch) {
                    const lineNum = parseInt(lineMatch[1]);
                    lineChanges.push({
                        lineNum,
                        description: line
                    });
                } else if (line.trim()) {
                    explanation += line + '\n';
                }
            }

            suggestedCode = suggestedCode.trim();
            explanation = explanation.trim();

            // Create the message content with interactive line changes
            let messageContent = `
                <div class="message-section">
                    <h2 class="message-heading-2">Suggested Fix</h2>
                    <p class="message-paragraph">${explanation}</p>
                    ${lineChanges.map(change => `
                        <div class="line-change">
                            <div class="line-number">Line ${change.lineNum}</div>
                            <div class="line-description">${change.description}</div>
                        </div>
                    `).join('')}
                    <div class="code-block cpp">
                        <div class="code-header">C++</div>
                        <pre><code>${suggestedCode}</code></pre>
                    </div>
                    <div class="fix-actions">
                        <button class="apply-fix-button">Apply Fix</button>
                        <button class="cancel-fix-button">Cancel</button>
                    </div>
                </div>
            `;
            
            messageDiv.innerHTML = messageContent;
            
            // Add event listeners for the action buttons
            if (suggestedCode) {
                const applyButton = messageDiv.querySelector('.apply-fix-button');
                const cancelButton = messageDiv.querySelector('.cancel-fix-button');
                
                applyButton.addEventListener('click', () => {
                    // Parse line changes from the response
                    const lineChanges = [];
                    const allLines = response.split('\n');
                    
                    console.log('Parsing response for changes...');
                    
                    // First, find the line changes section
                    for (const line of allLines) {
                        // Skip empty lines and code blocks
                        if (!line.trim() || line.startsWith('```')) continue;
                        
                        // Look for line changes in the exact format specified
                        const lineMatch = line.match(/Line\s+(\d+):\s*Change\s*"([^"]+)"\s*to\s*"([^"]+)"/);
                        if (lineMatch) {
                            const change = {
                                lineNumber: parseInt(lineMatch[1]),
                                oldText: lineMatch[2].trim(),
                                newText: lineMatch[3].trim()
                            };
                            console.log('Found line change:', change);
                            lineChanges.push(change);
                        }
                    }
                    
                    console.log('Found line changes:', lineChanges);
                    
                    // Emit the event with line changes or fall back to full code
                    const event = new CustomEvent('applyCodeFix', {
                        detail: lineChanges.length > 0 ? {
                            lineChanges: lineChanges,
                            fullCode: suggestedCode // Include as fallback
                        } : {
                            fullCode: suggestedCode
                        }
                    });
                    window.dispatchEvent(event);
                    
                    // Hide the action buttons after applying
                    messageDiv.querySelector('.fix-actions').style.display = 'none';
                });
                
                cancelButton.addEventListener('click', () => {
                    // Just hide the action buttons
                    messageDiv.querySelector('.fix-actions').style.display = 'none';
                });
            }
            
            this.messagesContainer.appendChild(messageDiv);
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
            
        } catch (error) {
            console.error('Error getting AI fix suggestion:', error);
            this.addMessage('assistant', 'Sorry, I encountered an error generating the fix suggestion.');
        }
    }
}

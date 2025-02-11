import { AIService } from './ai-service.js';

export class ChatInterface {
    constructor() {
        this.aiService = null;
        this.messages = [];
        this.container = null;
        this.messagesContainer = null;
        this.inputContainer = null;
        this.lastError = null;
        this.lastErrorCode = null;
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
                    <button class="chat-send-button">Send</button>
                </div>
            </div>
        `;

        this.messagesContainer = this.container.querySelector('.chat-messages');
        
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

        const input = this.container.querySelector('.chat-input');
        const sendButton = this.container.querySelector('.chat-send-button');
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage(input.value);
                input.value = '';
            }
        });

        sendButton.addEventListener('click', () => {
            this.sendMessage(input.value);
            input.value = '';
        });
    }

    loadApiKey() {
        const apiKey = localStorage.getItem('groq_api_key');
        if (apiKey) {
            this.aiService = new AIService(apiKey);
        } else {
            this.showApiKeyPrompt();
        }
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
                localStorage.setItem('groq_api_key', key);
                this.aiService = new AIService(key);
                this.setupUI();
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

    addMessage(role, content) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;

        // Format headers (##, ###) and handle numbered headings
        let headingCounter = 0;
        let formattedContent = content.replace(/^(#{2,3})\s+(.+)$/gm, (match, hashes, text) => {
            const level = hashes.length;
            // Only increment counter for level 2 headings
            if (level === 2) {
                headingCounter++;
                return `<h${level} class="message-heading-${level}">${headingCounter}. ${text}</h${level}>`;
            }
            return `<h${level} class="message-heading-${level}">${text}</h${level}>`;
        });

        // Format bold text (**)
        formattedContent = formattedContent.replace(/\*\*([^*]+)\*\*/g, (match, text) => 
            `<strong>${text}</strong>`
        );

        // Format special bullet points with proper nesting
        formattedContent = formattedContent.replace(/^(\s*)([→⊙▸])\s+([^]*?)(?=\n\s*[→⊙▸]|\n\s*$|\n\s*##|$)/gm, (match, indent, bullet, text) => {
            let level;
            switch (bullet) {
                case '→': level = 0; break;
                case '⊙': level = 1; break;
                case '▸': level = 2; break;
                default: level = 0;
            }
            
            // Split text into main text and description if there's a colon
            const parts = text.split(/:\s*(.+)/s);
            let mainText = parts[0].trim();
            let description = parts[1] ? parts[1].trim() : '';
            
            // Handle inline code in text
            mainText = mainText.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
            if (description) {
                description = description.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
            }
            
            let result = `${indent}<li class="bullet-${bullet} indent-${level}">`;
            result += mainText;
            
            if (description) {
                result += `<span class="description">${description}</span>`;
            }
            
            return result + '</li>';
        });

        // Wrap bullet points in lists with proper nesting
        formattedContent = formattedContent.replace(/(?:^|\n)(<li class="bullet-([→⊙▸])[^]*?<\/li>\n?)+/g, (match, _, bullet) => {
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
        });

        // Format code blocks with language support
        formattedContent = formattedContent.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang || '';
            return `<div class="code-block ${language}"><div class="code-header">${language}</div><pre><code>${code.trim()}</code></pre></div>`;
        });

        // Format inline code - handle code within text
        formattedContent = formattedContent.replace(/`([^`]+)`/g, (match, code) => {
            // If code contains spaces, wrap each word in its own background
            if (code.includes(' ')) {
                return code.split(' ').map(word => 
                    `<code class="inline-code">${word}</code>`
                ).join(' ');
            }
            return `<code class="inline-code">${code}</code>`;
        });

        // Format standalone numbered lists
        formattedContent = formattedContent.replace(/(?:^|\n)(?!\s*[→⊙▸])(\s*\d+\.\s+[^]*?)(?=\n\s*\d+\.|\n\s*##|\n\s*[→⊙▸]|$)/g, (match, content) => {
            const lines = content.trim().split('\n');
            const processedLines = lines.map(line => {
                const match = line.match(/^\s*\d+\.\s+(.+)$/);
                if (match) {
                    return `<li>${match[1].trim()}</li>`;
                }
                return line;
            }).join('\n');
            
            return `\n<ol class="message-list level-0">\n${processedLines}\n</ol>\n`;
        });

        // Format sections
        formattedContent = formattedContent.split(/(?=##\s)/).map(section => {
            if (section.trim()) {
                return `<div class="message-section">${section}</div>`;
            }
            return section;
        }).join('');

        // Add line breaks for paragraphs (but not inside code blocks or lists)
        formattedContent = formattedContent.split(/\n\n+/).map(para => {
            if (!para.includes('code-block') && !para.includes('<li>')) {
                return `<p class="message-paragraph">${para.trim()}</p>`;
            }
            return para;
        }).join('');

        messageDiv.innerHTML = formattedContent;
        this.messagesContainer.appendChild(messageDiv);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        this.messages.push({ role, content });
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

    async handleCodeEdit(selectedCode, selection) {
        if (!this.aiService) return;

        // First, add the user's code as a message
        this.addMessage('user', `Please help me improve this code:\n\n\`\`\`\n${selectedCode}\n\`\`\``);

        try {
            const response = await this.aiService.getCodeEdit(selectedCode, selection);
            
            // Create a message with the suggested edits and action buttons
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

                // Look for line changes in the format "Line X: Change "old" to "new""
                const changeMatch = line.match(/Line\s+(\d+):\s*Change\s*"([^"]+)"\s*to\s*"([^"]+)"/);
                if (changeMatch) {
                    lineChanges.push({
                        lineNumber: parseInt(changeMatch[1]),
                        oldText: changeMatch[2].trim(),
                        newText: changeMatch[3].trim()
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
                    <h2 class="message-heading-2">Suggested Improvements</h2>
                    <p class="message-paragraph">${explanation}</p>
                    ${lineChanges.length > 0 ? `
                        <div class="line-changes-container">
                            <h3 class="message-heading-3">Specific Changes:</h3>
                            ${lineChanges.map(change => `
                                <div class="line-change">
                                    <div class="line-number">Line ${change.lineNumber}</div>
                                    <div class="line-description">
                                        <div class="old-text">- "${change.oldText}"</div>
                                        <div class="new-text">+ "${change.newText}"</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    <div class="code-block">
                        <div class="code-header">Modified Code</div>
                        <pre><code>${suggestedCode}</code></pre>
                    </div>
                    <div class="edit-actions">
                        <button class="apply-edit-button">Apply Changes</button>
                        <button class="cancel-edit-button">Cancel</button>
                    </div>
                </div>
            `;
            
            messageDiv.innerHTML = messageContent;
            
            // Add event listeners for the action buttons
            if (suggestedCode) {
                const applyButton = messageDiv.querySelector('.apply-edit-button');
                const cancelButton = messageDiv.querySelector('.cancel-edit-button');
                
                applyButton.addEventListener('click', () => {
                    // Emit event with line changes and full code
                    const event = new CustomEvent('applyCodeFix', {
                        detail: {
                            lineChanges: lineChanges,
                            fullCode: suggestedCode // Include as fallback
                        }
                    });
                    window.dispatchEvent(event);
                    
                    // Hide the action buttons after applying
                    messageDiv.querySelector('.edit-actions').style.display = 'none';
                    
                    // Add confirmation message
                    this.addMessage('assistant', 'Changes applied successfully. You can continue editing or ask more questions.');
                });
                
                cancelButton.addEventListener('click', () => {
                    // Hide the action buttons
                    messageDiv.querySelector('.edit-actions').style.display = 'none';
                    // Add cancellation message
                    this.addMessage('assistant', 'Changes cancelled. Let me know if you want to try something else.');
                });
            }
            
            this.messagesContainer.appendChild(messageDiv);
            this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
            
        } catch (error) {
            console.error('Error getting code edit suggestion:', error);
            this.addMessage('assistant', 'Sorry, I encountered an error generating the edit suggestion.');
        }
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

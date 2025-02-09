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

        // Format bullet points (*) - ensure they're on new lines
        formattedContent = formattedContent.replace(/^\*\s+(.+)$/gm, (match, text) => {
            // Split text if it contains multiple sentences
            const sentences = text.split(/(?<=\.) /);
            return sentences.map(sentence => `<li>${sentence.trim()}</li>`).join('\n');
        });

        // Wrap bullet points in ul with proper spacing
        formattedContent = formattedContent.replace(/(<li>.*?<\/li>\n?)+/g, match => 
            `<ul class="message-list">\n${match}</ul>\n`
        );

        // Format code blocks with language support
        formattedContent = formattedContent.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
            const language = lang || '';
            return `<div class="code-block ${language}"><div class="code-header">${language}</div><pre><code>${code.trim()}</code></pre></div>`;
        });

        // Format inline code
        formattedContent = formattedContent.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

        // Format numbered lists (1., 2., etc.)
        formattedContent = formattedContent.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
        formattedContent = formattedContent.replace(/(<li>.*?<\/li>\n?)+/g, match => 
            `<ol class="message-list">${match}</ol>`
        );

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
            const response = await this.aiService.getCodeAnalysis(this.lastErrorCode, this.lastError);
            
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

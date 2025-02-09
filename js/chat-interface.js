import { AIService } from './ai-service.js';

export class ChatInterface {
    constructor() {
        this.aiService = null;
        this.messages = [];
        this.container = null;
        this.messagesContainer = null;
        this.inputContainer = null;
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
                    <button class="code-assistant-button" title="Change API Key">
                        API
                    </button>
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

    async handleCompilationError(code, error) {
        if (!this.aiService) return;

        try {
            const response = await this.aiService.getCodeAnalysis(code, error);
            this.addMessage('assistant', response);
        } catch (error) {
            console.error('Error analyzing compilation error:', error);
            this.addMessage('assistant', 'Sorry, I encountered an error analyzing the compilation error.');
        }
    }
}

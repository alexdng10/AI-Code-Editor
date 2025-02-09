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
                <div class="chat-header">Code Assistant</div>
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
        const apiKey = localStorage.getItem('openai_api_key');
        if (apiKey) {
            this.aiService = new AIService(apiKey);
        } else {
            this.showApiKeyPrompt();
        }
    }

    showApiKeyPrompt() {
        this.container.innerHTML = `
            <div class="api-key-container">
                <h3>OpenAI API Key Required</h3>
                <p>Please enter your OpenAI API key to use the Code Assistant</p>
                <input type="password" class="api-key-input" placeholder="Enter your OpenAI API key">
                <button class="save-key-button">Save Key</button>
            </div>
        `;

        const input = this.container.querySelector('.api-key-input');
        const saveButton = this.container.querySelector('.save-key-button');

        saveButton.addEventListener('click', () => {
            const key = input.value.trim();
            if (key) {
                localStorage.setItem('openai_api_key', key);
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
        messageDiv.textContent = content;
        
        // If content contains code blocks, format them
        if (content.includes('```')) {
            const formattedContent = content.replace(/```([\s\S]*?)```/g, (match, code) => {
                return `<div class="code-preview">${code.trim()}</div>`;
            });
            messageDiv.innerHTML = formattedContent;
        }

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

// AI Service Integration
export class AIService {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async getCodeAnalysis(code, error = null) {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: [
                        {
                            role: "system",
                            content: "You are a helpful code assistant that analyzes code and provides explanations."
                        },
                        {
                            role: "user",
                            content: `${error ? 'This code has an error:\n\n' : 'Please analyze this code:\n\n'}${code}${error ? '\n\nError: ' + error : ''}`
                        }
                    ]
                })
            });

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('Error in AI service:', error);
            return 'Sorry, I was unable to analyze the code at this time.';
        }
    }

    async getInlineHelp(selectedCode) {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-3.5-turbo",
                    messages: [
                        {
                            role: "system",
                            content: "You are a helpful code assistant that explains code and answers questions."
                        },
                        {
                            role: "user",
                            content: `Please explain this code:\n\n${selectedCode}`
                        }
                    ]
                })
            });

            const data = await response.json();
            return data.choices[0].message.content;
        } catch (error) {
            console.error('Error in AI service:', error);
            return 'Sorry, I was unable to analyze the code at this time.';
        }
    }
}

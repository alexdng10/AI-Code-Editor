// AI Service Integration
export class AIService {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async getCodeAnalysis(code, error = null) {
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        {
                            role: "system",
                            content: "You are a helpful code assistant that analyzes code and provides explanations."
                        },
                        {
                            role: "user",
                            content: `${error ? 'This code has an error:\n\n' : 'Please analyze this code:\n\n'}${code}${error ? '\n\nError: ' + error : ''}`
                        }
                    ],
                    temperature: 0.5,
                    max_tokens: 1024
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                console.error('Groq API Error:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorData
                });
                if (response.status === 401) {
                    return 'Invalid or missing Groq API key. Please check your API key and try again.';
                } else if (response.status === 429) {
                    return 'Too many requests. Please wait a moment and try again.';
                } else {
                    return `API Error (${response.status}): ${response.statusText}`;
                }
            }
            
            const data = await response.json();
            if (!data.choices?.[0]?.message?.content) {
                console.error('Unexpected Groq API response:', data);
                throw new Error('Invalid response format from Groq API');
            }
            
            return data.choices[0].message.content;
        } catch (error) {
            console.error('Error in Groq AI service:', error);
            if (error.message === 'Invalid response format from Groq API') {
                return 'Received an invalid response from the AI service. Please try again.';
            }
            return 'An error occurred while processing your request. Please try again later.';
        }
    }

    async getInlineHelp(selectedCode) {
        try {
            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [
                        {
                            role: "system",
                            content: "You are a helpful code assistant that explains code and answers questions."
                        },
                        {
                            role: "user",
                            content: `Please explain this code:\n\n${selectedCode}`
                        }
                    ],
                    temperature: 0.5,
                    max_tokens: 1024
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                console.error('Groq API Error:', {
                    status: response.status,
                    statusText: response.statusText,
                    error: errorData
                });
                if (response.status === 401) {
                    return 'Invalid or missing Groq API key. Please check your API key and try again.';
                } else if (response.status === 429) {
                    return 'Too many requests. Please wait a moment and try again.';
                } else {
                    return `API Error (${response.status}): ${response.statusText}`;
                }
            }
            
            const data = await response.json();
            if (!data.choices?.[0]?.message?.content) {
                console.error('Unexpected Groq API response:', data);
                throw new Error('Invalid response format from Groq API');
            }
            
            return data.choices[0].message.content;
        } catch (error) {
            console.error('Error in Groq AI service:', error);
            if (error.message === 'Invalid response format from Groq API') {
                return 'Received an invalid response from the AI service. Please try again.';
            }
            return 'An error occurred while processing your request. Please try again later.';
        }
    }
}

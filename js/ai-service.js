// AI Service Integration
export class AIService {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async getCodeAnalysis(code, error = null, mode = 'analyze') {
        try {
            const messages = mode === 'fix' ? [
                {
                    role: "system",
                    content: "You are a helpful code assistant that fixes compilation errors. Follow this EXACT format in your response:\n\n1. Start with a brief explanation of the error\n2. Then list ONLY the necessary changes, one per line, using EXACTLY this format:\nLine X: Change \"[exact old code]\" to \"[exact new code]\"\n3. Finally show the complete fixed code in a code block starting with ```cpp\n\nExample response:\nThe error is due to a missing const keyword.\n\nLine 17: Change \"Vertex cot start\" to \"Vertex const start\"\n\n```cpp\n[complete fixed code here]\n```\n\nIMPORTANT:\n- Each line change must be on its own line\n- Use exact quotes and format: Line X: Change \"old\" to \"new\"\n- Only include lines that actually need to change\n- The old code must match the exact text in that line\n- Do not suggest unnecessary changes"
                },
                {
                    role: "user",
                    content: `Fix this code that has a compilation error:\n\nCode:\n${code}\n\nError:\n${error}\n\nProvide ONLY the necessary line changes in the exact format specified, then show the complete fixed code.`
                }
            ] : [
                {
                    role: "system",
                    content: `You are a helpful code assistant that analyzes code and provides explanations. Format your response using this EXACT structure and special characters:

## Overview

A clear, concise explanation of what the code does and its main purpose.

## Implementation Details

→ Key Functions:
  ⊙ \`functionName()\`: What this function does
    ▸ Parameters and their types
    ▸ Return values and types
    ▸ Usage examples

→ Data Structures:
  ⊙ Main Components:
    ▸ First data structure
    ▸ Second data structure
    ▸ How they interact

→ Algorithm Steps:
  ⊙ Initialization:
    ▸ First step
    ▸ Second step
  ⊙ Main Process:
    ▸ Process step one
    ▸ Process step two
  ⊙ Completion:
    ▸ Final steps
    ▸ Return values

## Code Analysis

\`\`\`
[Most relevant code snippet]
\`\`\`

→ Key Points:
  ⊙ Important Variables:
    ▸ First variable role
    ▸ Second variable role
  ⊙ Critical Sections:
    ▸ First section purpose
    ▸ Second section purpose

## Technical Details

→ Complexity Analysis:
  ⊙ Time Complexity:
    ▸ Best case: O(n)
    ▸ Worst case: O(n2)
  ⊙ Space Usage:
    ▸ Memory allocation
    ▸ Stack vs Heap





IMPORTANT FORMATTING RULES:
1. Use → for top-level bullet points
2. Use ⊙ for second-level bullet points
3. Use ▸ for third-level bullet points
4. Each bullet point MUST be on its own line with proper indentation (2 spaces per level)
5. Code blocks MUST use \`\`\` for proper formatting
6. Use \`backticks\` for inline code
7. Use ## for section headers`
                },
                {
                    role: "user",
                    content: `${error ? 'This code has an error:\n\n' : 'Please analyze this code:\n\n'}${code}${error ? '\n\nError: ' + error : ''}`
                }
            ];

            const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: messages,
                    temperature: 0.5,
                    max_tokens: 1024
                })
            });
            console.log(response);
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

    async getCodeEdit(selectedCode, selection, request) {
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
                            content: "You are a code editor assistant. When given a code segment and a request, modify the code according to the request. Follow this EXACT format:\n\n1. Brief explanation of the changes\n2. List ONLY the necessary changes, one per line, using EXACTLY this format:\nLine X: Change \"[exact old code]\" to \"[exact new code]\"\n3. Show the complete modified code in a code block\n\nIMPORTANT:\n- Each line change must be on its own line\n- Use exact quotes and format: Line X: Change \"old\" to \"new\"\n- Only include lines that actually need to change\n- The old code must match the exact text in that line\n- Keep changes focused on the user's request"
                        },
                        {
                            role: "user",
                            content: `Please modify this code according to this request: "${request}"\n\nCode:\n${selectedCode}\n\nProvide ONLY the necessary line changes in the exact format specified, then show the complete modified code.`
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
            const response = await fetch('https://api.groq.com/v1/chat/completions', {
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

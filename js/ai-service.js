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
                    content: `You are a helpful code assistant that analyzes code and provides explanations. Format your response using this EXACT structure:

## Overview

A clear, concise explanation of what the code does and its main purpose.

## Implementation Details

* Key Functions:

* \`functionName()\`: What this function does
    1. Parameters and their types
    2. Return values and types
    3. Usage examples

* Data Structures:

* Main Components:
    1. First data structure
    2. Second data structure
    3. How they interact

* Algorithm Steps:

* Initialization:
    1. First step
    2. Second step

* Main Process:
    1. Process step one
    2. Process step two

* Completion:
    1. Final steps
    2. Return values

## Code Analysis

\`\`\`
[Most relevant code snippet]
\`\`\`

* Key Points:

* Important Variables:
    1. First variable role
    2. Second variable role

* Critical Sections:
    1. First section purpose
    2. Second section purpose

## Technical Details

* Complexity Analysis:

* Time Complexity:
    1. Best case: O(n)
    2. Worst case: O(n2)

* Space Usage:
    1. Memory allocation
    2. Stack vs Heap

## Potential Issues

* Edge Cases:

* Critical Scenarios:
    1. First edge case
    2. Second edge case

* Error Handling:
    1. Error type one
    2. Error type two

## Improvements

\`\`\`
// Improved implementation
function betterVersion() {
    // With detailed comments
}
\`\`\`

* Suggested Enhancements:

* Code Quality:
    1. First improvement
    2. Second improvement

* Performance:
    1. Optimization one
    2. Optimization two

IMPORTANT FORMATTING RULES:
1. Each bullet point MUST start with "* " on its own line
2. Each numbered item MUST be on its own line with proper indentation
3. Each section MUST have proper spacing
4. Code blocks MUST use \`\`\` for proper formatting
5. Use \`backticks\` for inline code
6. Use ## for section headers`
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

    async getCodeEdit(selectedCode, selection) {
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
                            content: "You are a code editor assistant. When given a code segment, suggest improvements or modifications. Follow this format:\n\n1. Brief explanation of suggested changes\n2. List specific changes using: Line X: Change \"[old code]\" to \"[new code]\"\n3. Show complete modified code in a code block\n\nKeep changes minimal and focused on improving code quality, readability, or performance."
                        },
                        {
                            role: "user",
                            content: `Please suggest improvements for this code segment:\n\n${selectedCode}\n\nProvide specific line changes and the complete modified code.`
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

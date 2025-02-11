import { AIService } from './ai-service.js';

const apiKey = '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';
const aiService = new AIService(apiKey);

// Test the formatting with a sample request
async function testFormatting() {
    try {
        const response = await aiService.getCodeAnalysis('Show me the implementation details of Dijkstra algorithm');
        console.log('Raw LLM Response:');
        console.log('----------------------------------------');
        console.log(response);
        console.log('----------------------------------------');
    } catch (error) {
        console.error('Error:', error);
    }
}

testFormatting();

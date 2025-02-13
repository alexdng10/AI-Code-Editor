# Code Mode Implementation Plan

## Phase 1: Basic Code Replacement Flow
1. **Toggle Integration**
   - Connect codeModeEnabled state to AI service in chat-interface.js
   - Add code mode specific prompt template to ai-service.js

2. **Core Functionality**
   ```javascript
   // In chat-interface.js
   handleCodeModeSubmit(code) {
       const prompt = `Modify this code:\n${code}\nProvide changes in format:
           Line X: Change "old" to "new"`;
       const response = await AIService.getCodeEdit(code, prompt);
       this.showCodeDiff(parseChanges(response)); 
   }
   ```

3. **Diff Parsing**
   - Reuse existing regex pattern from getCodeAnalysis:
   ```javascript
   const lineChangeRegex = /Line (\d+): Change "([^"]+)" to "([^"]+)"/g;
   ```

## Phase 2: Editor Integration
1. **Monaco Editor Hook**
   - Add code mode listener in ide.js:
   ```javascript
   sourceEditor.onDidChangeModelContent((e) => {
       if (codeModeEnabled) {
           const code = sourceEditor.getValue();
           window.dispatchEvent(new CustomEvent('codeModeUpdate', {detail: code}));
       }
   });
   ```

2. **Approval Flow**
   - Implement simple approve/reject UI using existing chat message components
   - Store pending changes in local_storage.js

## Phase 3: AI Integration
1. **Contextual Prompts**
   - Extend existing getCodeEdit method with code mode specific instructions:
   ```javascript
   // ai-service.js
   const systemPrompt = `You are a code assistant. Respond ONLY with:
       - Line change directives
       - Full updated code block
       - No explanations`;
   ```

2. **Safety Measures**
   - Add code validation using existing ide.js execution engine
   - Implement change limit (max 5 changes per request)

## Phase 4: Iterative Improvements
1. **UI Enhancements**
   - Adapt existing diff visualization from suggest_fix_feature
   - Add line highlight styles from ide.css

2. **Performance**
   - Add debouncing to code mode updates
   - Implement response caching using local_storage.js

## Next Immediate Step
Create basic code replacement POC using existing AI infrastructure:
```javascript
// Temporary test command
<execute_command>
<command>node -e "const {AIService} = require('./js/ai-service.js'); new AIService('API_KEY').getCodeEdit('console.log(\"hello\")', 'Change to TypeScript')"</command>
<requires_approval>false</requires_approval>
</execute_command>

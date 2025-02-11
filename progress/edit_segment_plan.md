# Inline Code Segment Editing Feature Plan

## Overview
Enable users to select code segments in Monaco Editor and interact with Groq AI for automatic code modifications. This feature requires tight integration between editor interactions, AI service, and UI components.

## Key Requirements
1. Code selection detection & decoration
2. Contextual edit button overlay
3. Inline chat interface for AI instructions
4. Secure Groq API integration
5. Code validation & safety checks
6. Undo/redo support for AI edits

## Technical Implementation

### 1. Monaco Editor Integration (ide.js)
```javascript
// Add selection change listener
sourceEditor.onDidChangeCursorSelection((e) => {
    const selection = e.selection;
    if (!selection.isEmpty()) {
        showEditButton(selection);
    }
});

// Edit button decoration
const editButtonWidget = {
    domNode: null,
    getId: () => 'code-edit-button',
    getPosition: () => ({
        position: { lineNumber: selection.startLineNumber, column: 1 },
        preference: [monaco.editor.ContentWidgetPositionPreference.EXACT]
    })
};

function showEditButton(selection) {
    // Add button widget and highlight decoration
}
```

### 2. AI Service Modifications (ai-service.js)
```javascript
async function handleCodeEditRequest({ 
    codeSegment, 
    instruction, 
    context 
}) {
    const prompt = `
    [SYSTEM] You are a code modification assistant. 
    Given this code segment:
    ${codeSegment}
    
    Perform this instruction: ${instruction}
    
    Return ONLY the modified code with NO explanations.
    `;

    return groqClient.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: 'mixtral-8x7b-32768',
        temperature: 0.2
    });
}
```

### 3. Edit Workflow
1. User selects code segment
2. Edit button appears above selection
3. Click opens chat modal with code context
4. User enters natural language instruction
5. AI processes request & returns modified code
6. System validates & applies changes

## Safety Measures
- Code diff analysis before application
- Sandbox execution for critical changes
- Rate limiting on API requests
- Session history tracking

## UI Components
1. Floating edit button widget
2. Context-aware chat modal
3. Code diff preview panel
4. Approval/Rejection controls

## Dependencies
- Monaco Editor Decoration API
- Groq Cloud Client
- CodeMirror diff viewer
- Rate limit middleware

## Testing Strategy
1. Unit tests for code parsing
2. Integration tests for AI responses
3. E2E tests for full workflow
4. Security audit for API interactions

## Milestones
1. Selection Handling & UI (2 days)
2. AI Integration (3 days) 
3. Safety Systems (2 days)
4. Testing & Polish (3 days)

## Risk Mitigation
- Fallback to manual edit if AI fails
- Session timeout for inactive chats
- Content security policy updates
- User education tooltips

# Chat Message Parsing and Styling Documentation

This document provides a detailed explanation of how chat messages are parsed, formatted, and styled in the Judge0 IDE. It covers the interaction between `ai-service.js`, `chat-interface.js`, and `chat.css`, focusing on the logic and styling responsible for creating the final chat message appearance.

## 1. AI Service (`ai-service.js`)

The `AIService` class is responsible for communicating with the Groq API to generate code analysis, fixes, and explanations. The key aspect relevant to message formatting is the system prompt used to instruct the AI on how to structure its responses.

### System Prompts: Guiding the AI Response Format

The `getCodeAnalysis` method uses different system prompts depending on the `mode`. These prompts are carefully crafted to ensure the AI returns responses that can be easily parsed and styled by the `ChatInterface`.

#### `mode = 'fix'`: Compilation Error Fixes

This prompt is used when the AI is asked to fix a compilation error. It instructs the AI to follow a specific format:

1.  **Brief Explanation:** A short explanation of the error.
2.  **Line Changes:** A list of the necessary line changes, with each change on a separate line and using the exact format: `Line X: Change "[exact old code]" to "[exact new code]"`.
3.  **Complete Fixed Code:** The complete, fixed code in a code block, starting with \`\`\`cpp.

**Example Prompt:**

```
You are a helpful code assistant that fixes compilation errors. Follow this EXACT format in your response:

1. Start with a brief explanation of the error
2. Then list ONLY the necessary changes, one per line, using EXACTLY this format:
Line X: Change "[exact old code]" to "[exact new code]"
3. Finally show the complete fixed code in a code block starting with ```cpp

Example response:
The error is due to a missing const keyword.

Line 17: Change "Vertex cot start" to "Vertex const start"

```cpp
[complete fixed code here]
```

IMPORTANT:
- Each line change must be on its own line
- Use exact quotes and format: Line X: Change "old" to "new"
- Only include lines that actually need to change
- The old code must match the exact text in that line
- Do not suggest unnecessary changes
```

**Key Formatting Requirements:**

*   **Exact Line Matching:** The `"[exact old code]"` part of the line change must match the exact text in the original code. This is crucial for the parsing logic in `chat-interface.js` to correctly identify and apply the changes.
*   **Code Block Delimiters:** The \`\`\`cpp delimiters are essential for the parsing logic to identify the complete fixed code.

#### `mode = 'analyze'`: Code Analysis and Explanations

This prompt is used when the AI is asked to analyze code and provide explanations. It instructs the AI to use a specific structure with headings, bullet points, and code blocks:

```
You are a helpful code assistant that analyzes code and provides explanations. Format your response using this EXACT structure and special characters:

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

```
[Most relevant code snippet]
```

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
7. Use ## for section headers
```

**Key Formatting Requirements:**

*   **Headings:** The AI must use `##` for section headers.
*   **Bullet Points:** The AI must use the special characters `→`, `⊙`, and `▸` for bullet points, with specific indentation levels.
*   **Code Blocks:** The AI must use \`\`\` to delimit code blocks.
*   **Inline Code:** The AI must use \`backticks\` for inline code.

These formatting rules are essential for the parsing logic in `chat-interface.js` to correctly identify and style the different elements of the AI response.

## 2. Chat Interface (`chat-interface.js`)

The `ChatInterface` class is responsible for displaying chat messages in the UI. The `addMessage` method is the core of the message formatting logic. It takes the message content and applies a series of regular expressions and string manipulations to transform the plain text into HTML.

### Message Formatting Steps: Detailed Explanation

The `addMessage` method performs the following steps:

1.  **Headings:** Detects headings (##, ###) and converts them to `<h2 class="message-heading-2">` and `<h3 class="message-heading-3">` elements. It also auto-increments the level-2 headings.
    ```javascript
    let headingCounter = 0;
    formattedContent = content.replace(
      /^(#{2,3})\s+(.+)$/gm,
      (match, hashes, text) => {
        const level = hashes.length; // 2 or 3
        if (level === 2) {
          headingCounter++;
          return `<h${level} class="message-heading-${level}">${headingCounter}. ${text}</h${level}>`;
        }
        return `<h${level} class="message-heading-${level}">${text}</h${level}>`;
      }
    );
    ```
    *   **Regex:** `^(#{2,3})\s+(.+)$/gm`
        *   `^`: Matches the beginning of a line.
        *   `(#{2,3})`: Matches two or three `#` characters (heading levels 2 and 3) and captures them in group 1.
        *   `\s+`: Matches one or more whitespace characters.
        *   `(.+)`: Matches any character (except newline) one or more times and captures it in group 2 (the heading text).
        *   `$`: Matches the end of a line.
        *   `g`: Global flag, matches all occurrences in the string.
        *   `m`: Multiline flag, `^` and `$` match the start and end of each line.
    *   **Replacement:**
        *   ``<h${level} class="message-heading-${level}">${headingCounter}. ${text}</h${level}>``: Creates an `<h2>` or `<h3>` element with the appropriate class and heading text. The `headingCounter` variable is used to auto-increment the level-2 headings.

2.  **Bold Text:** Detects bold text (\*\*something\*\*) and converts it to `<strong>${text}</strong>` elements.
    ```javascript
    formattedContent = formattedContent.replace(
      /\*\*([^*]+)\*\*/g,
      (match, text) => `<strong>${text}</strong>`
    );
    ```
    *   **Regex:** `/\*\*([^*]+)\*\*/g`
        *   `\*\*`: Matches two `*` characters.
        *   `([^*]+)`: Matches any character except `*` one or more times and captures it in group 1 (the bold text).
        *   `\*\*`: Matches two `*` characters.
        *   `g`: Global flag, matches all occurrences in the string.
    *   **Replacement:**
        *   `<strong>${text}</strong>`: Creates a `<strong>` element with the bold text.

3.  **Special Bullet Points:** Detects special bullet points (→ ⊙ ▸) and converts them to `<li>` elements with specific classes (`bullet-→`, `bullet-⊙`, `bullet-▸`) and indentation levels.
    ```javascript
    formattedContent = formattedContent.replace(
      /^(\s*)([→⊙▸])\s+([^]*?)(?=\n\s*[→⊙▸]|\n\s*$|\n\s*##|$)/gm,
      (match, indent, bullet, text) => {
        let level;
        switch (bullet) {
          case '→': level = 0; break;
          case '⊙': level = 1; break;
          case '▸': level = 2; break;
          default: level = 0;
        }

        // If there's a colon, split main text vs description
        const parts = text.split(/:\s*(.+)/s);
        const mainText = parts[0].trim().replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
        const description = parts[1]
          ? parts[1].trim().replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
          : '';

        let result = `${indent}<li class="bullet-${bullet} indent-${level}">`;
        result += mainText;
        if (description) {
          result += `<span class="description">${description}</span>`;
        }
        return result + '</li>';
      }
    );
    ```
    *   **Regex:** `/^(\s*)([→⊙▸])\s+([^]*?)(?=\n\s*[→⊙▸]|\n\s*$|\n\s*##|$)/gm`
        *   `^`: Matches the beginning of a line.
        *   `(\s*)`: Matches zero or more whitespace characters and captures them in group 1 (the indentation).
        *   `([→⊙▸])`: Matches one of the special bullet point characters (→, ⊙, ▸) and captures it in group 2.
        *   `\s+`: Matches one or more whitespace characters.
        *   `([^]*?)`: Matches any character (including newline) zero or more times, non-greedily, and captures it in group 3 (the bullet point text).
        *   `(?=\n\s*[→⊙▸]|\n\s*$|\n\s*##|$)`: Positive lookahead assertion that ensures the match is followed by:
            *   `\n\s*[→⊙▸]`: A newline character, zero or more whitespace characters, and one of the special bullet point characters.
            *   `\n\s*$`: A newline character, zero or more whitespace characters, and the end of the string.
            *   `\n\s*##`: A newline character, zero or more whitespace characters, and a `##` heading.
            *   `$`: The end of the string.
        *   `g`: Global flag, matches all occurrences in the string.
        *   `m`: Multiline flag, `^` and `$` match the start and end of each line.
    *   **Replacement:**
        *   ``${indent}<li class="bullet-${bullet} indent-${level}">``: Creates an `<li>` element with the appropriate classes for the bullet point type and indentation level.
        *   The code also splits the bullet point text into a main text and a description, separated by a colon.

4.  **List Wrapping:** Wraps the bullet point `<li>` elements into `<ul>` or `<ol>` elements with specific classes (`message-list`, `level-${level}`, `bullet-type-${bullet}`).
    ```javascript
    formattedContent = formattedContent.replace(
      /(?:^|\n)(<li class="bullet-([→⊙▸])[^]*?<\/li>\n?)+/g,
      (match, _, bullet) => {
        let level;
        switch (bullet) {
          case '→': level = 0; break;
          case '⊙': level = 1; break;
          case '▸': level = 2; break;
          default: level = 0;
        }
        const indent = '  '.repeat(level);
        const listType = bullet === '⊙' ? 'ol' : 'ul';
        return `\n${indent}<${listType} class="message-list level-${level} bullet-type-${bullet}">\n${match}${indent}</${listType}>\n`;
      }
    );
    ```
    *   **Regex:** `/(?:^|\n)(<li class="bullet-([→⊙▸])[^]*?<\/li>\n?)+/g`
        *   `(?:^|\n)`: Matches either the beginning of the string or a newline character (non-capturing group).
        *   ``(<li class="bullet-([→⊙▸])[^]*?<\/li>\n?)``: Matches an `<li>` element with the class `bullet-`, followed by one of the special bullet point characters (→, ⊙, ▸), any characters, and a closing `</li>` tag, followed by an optional newline character. This is captured in group 1.
        *   `+`: Matches the previous group one or more times.
        *   `g`: Global flag, matches all occurrences in the string.
    *   **Replacement:**
        *   ``\n${indent}<${listType} class="message-list level-${level} bullet-type-${bullet}">\n${match}${indent}</${listType}>\n``: Creates a `<ul>` or `<ol>` element with the appropriate classes and wraps the matched `<li>` elements inside it.

5.  **Code Blocks:** Detects code blocks (\`\`\`lang\ncode\n\`\`\`) and converts them to `<div class="code-block lang">` elements with a code header and a `<pre><code>` element for the code.
    ```javascript
    formattedContent = formattedContent.replace(
      /```(\w+)?\n([\s\S]*?)```/g,
      (match, lang, code) => {
        const language = lang || '';
        return `
          <div class="code-block ${language}">
            <div class="code-header">${language}</div>
            <pre><code>${code.trim()}</code></pre>
          </div>
        `;
      }
    );
    ```
    *   **Regex:** `/```(\w+)?\n([\s\S]*?)```/g`
        *   `````: Matches three \` characters.
        *   `(\w+)?`: Matches one or more word characters (letters, numbers, and underscore) zero or one time and captures it in group 1 (the language).
        *   `\n`: Matches a newline character.
        *   `([\s\S]*?)`: Matches any character (including newline) zero or more times, non-greedily, and captures it in group 2 (the code).
        *   `````: Matches three \` characters.
        *   `g`: Global flag, matches all occurrences in the string.
    *   **Replacement:**
        *   ``<div class="code-block ${language}">``: Creates a `<div>` element with the class `code-block` and the language class (if specified).
        *   ``<div class="code-header">${language}</div>``: Creates a `<div>` element with the class `code-header` and the language name.
        *   ``<pre><code>${code.trim()}</code></pre>``: Creates a `<pre>` element with a `<code>` element inside it, containing the code.

6.  **Inline Code:** Detects inline code (\`code\`) and converts it to `<code class="inline-code">` elements.
    ```javascript
    formattedContent = formattedContent.replace(/`([^`]+)`/g, (match, code) => {
      if (code.includes(' ')) {
        return code.split(' ').map(word =>
          `<code class="inline-code">${word}</code>`
        ).join(' ');
      }
      return `<code class="inline-code">${code}</code>`;
    });
    ```
    *   **Regex:** `/`([^`]+)`/g`
        *   ````: Matches a \` character.
        *   `([^`]+)`: Matches any character except \` one or more times and captures it in group 1 (the inline code).
        *   ````: Matches a \` character.
        *   `g`: Global flag, matches all occurrences in the string.
    *   **Replacement:**
        *   ``<code class="inline-code">${code}</code>``: Creates a `<code>` element with the class `inline-code` and the inline code.

7.  **Numbered Lists:** Detects standalone numbered lists (`1. something`) and converts them to `<ol>` elements with `<li>` elements.
    ```javascript
    formattedContent = formattedContent.replace(
      /(?:^|\n)(?!\s*[→⊙▸])(\s*\d+\.\s+[^]*?)(?=\n\s*\d+\.|\n\s*##|\n\s*[→⊙▸]|$)/g,
      (match, contentBlock) => {
        const lines = contentBlock.trim().split('\n');
        const liItems = lines.map(line => {
          const mo = line.match(/^\s*(\d+\.)\s+(.+)$/);
          if (mo) {
            return `<li>${mo[2].trim()}</li>`;
          }
          return line; // fallback if line doesn’t match
        }).join('\n');
        return `\n<ol class="message-list level-0">\n${liItems}\n</ol>\n`;
      }
    );
    ```
    *   **Regex:** `/(?:^|\n)(?!\s*[→⊙▸])(\s*\d+\.\s+[^]*?)(?=\n\s*\d+\.|\n\s*##|\n\s*[→⊙▸]|$)/g`
        *   `(?:^|\n)`: Matches either the beginning of the string or a newline character (non-capturing group).
        *   `(?!\s*[→⊙▸])`: Negative lookahead assertion that ensures the match is not followed by zero or more whitespace characters and one of the special bullet point characters.
        *   `(\s*\d+\.\s+[^]*?)`: Matches zero or more whitespace characters, one or more digits followed by a dot and one or more whitespace characters, and any character (including newline) zero or more times, non-greedily, and captures it in group 1 (the numbered list content).
        *   `(?=\n\s*\d+\.|\n\s*##|\n\s*[→⊙▸]|$)`: Positive lookahead assertion that ensures the match is followed by:
            *   `\n\s*\d+\.`: A newline character, zero or more whitespace characters, one or more digits followed by a dot.
            *   `\n\s*##`: A newline character, zero or more whitespace characters, and a `##` heading.
            *   `\n\s*[→⊙▸]`: A newline character, zero or more whitespace characters, and one of the special bullet point characters.
            *   `$`: The end of the string.
        *   `g`: Global flag, matches all occurrences in the string.
    *   **Replacement:**
        *   ``\n<ol class="message-list level-0">\n${liItems}\n</ol>\n``: Creates an `<ol>` element with the class `message-list level-0` and wraps the matched list items inside it.

8.  **Section Splitting:** Splits the content into sections based on `##` headings and wraps each section in a `<div class="message-section">` element.
    ```javascript
    formattedContent = formattedContent.split(/(?=##\s)/).map(section => {
      if (section.trim()) {
        return `<div class="message-section">${section}</div>`;
      }
      return section;
    }).join('');
    ```
    *   **Regex:** `/(?=##\s)/`
        *   `(?=##\s)`: Positive lookahead assertion that ensures the match is followed by `##` and a whitespace character.
    *   **Replacement:**
        *   ``<div class="message-section">${section}</div>``: Creates a `<div>` element with the class `message-section` and the section content.

9.  **Paragraph Splitting:** Splits the content into paragraphs based on double newlines and wraps each paragraph in a `<p class="message-paragraph">` element, unless it's inside a code block or list item.
    ```javascript
    formattedContent = formattedContent.split(/\n\n+/).map(para => {
      // Only wrap in <p> if it’s not inside a bullet or code block
      if (!para.includes('code-block') && !para.includes('<li>')) {
        return `<p class="message-paragraph">${para.trim()}</p>`;
      }
      return para;
    }).join('');
    ```
    *   **Regex:** `/\n\n+/`
        *   `\n\n`: Matches two newline characters.
        *   `+`: Matches the previous group one or more times.
    *   **Replacement:**
        *   ``<p class="message-paragraph">${para.trim()}</p>``: Creates a `<p>` element with the class `message-paragraph` and the paragraph content.

10. **Fallback:** If the formatting results in empty content, it wraps the original text in a `<p class="message-paragraph">` element.

### Addressing Specific Issues: Deeper Dive

*   **List Indentation:** The indentation of list items is a complex issue that involves both the parsing logic and the CSS styles. The `indent-${level}` classes are intended to control the indentation, but the actual indentation is determined by the `padding-left` property in `chat.css`.
    *   **Solution:**
        1.  **Ensure Consistent AI Responses:** The AI should consistently use the same number of whitespace characters for each indentation level. This will ensure that the `(\s*)` part of the bullet point regex correctly captures the indentation.
        2.  **Review CSS `padding-left` Values:** The `padding-left` values in `chat.css` should be carefully reviewed to ensure they are appropriate for each indentation level. The values should be consistent and visually appealing.
        3.  **Consider Using `margin-left` Instead of `padding-left`:** In some cases, using `margin-left` instead of `padding-left` might provide more consistent results.
*   **Numbering:** The numbering of ordered lists is handled by CSS counters, which can be tricky to style correctly. The `message ol > li::before` selector is used to display the counter value, but the styling of this pseudo-element can be affected by other styles.
    *   **Solution:**
        1.  **Verify Counter Reset:** Ensure that the `counter-reset: item;` property is correctly set on the `message ol` selector. This will reset the counter for each new list.
        2.  **Check for Conflicting Styles:** Use the browser's developer tools to inspect the list items and identify any conflicting styles that might be affecting the counter display.
        3.  **Adjust `font-size`, `vertical-align`, and `line-height`:** The `font-size`, `vertical-align`, and `line-height` properties of the `message ol > li::before` selector should be carefully adjusted to correctly position the number and the dot.
*   **Bullet Points:** The bullet points are styled using the `message li::before` selector. The `content` property is used to display the bullet point character, but the styling of this pseudo-element can be affected by other styles.
    *   **Solution:**
        1.  **Verify `content` Property:** Ensure that the `content` property is correctly set to display the desired bullet point character.
        2.  **Check for Conflicting Styles:** Use the browser's developer tools to inspect the list items and identify any conflicting styles that might be affecting the bullet point display.
        3.  **Adjust `font-size`, `vertical-align`, and `line-height`:** The `font-size`, `vertical-align`, and `line-height` properties of the `message li::before` selector should be carefully adjusted to correctly position the bullet point character.
*   **Color Consistency:** The color of the list numbers and bullet points should be consistent with the overall theme of the IDE.
    *   **Solution:**
        1.  **Verify `color` Property:** Ensure that the `color` property is set to the desired blue accent color (`#4B4BF7`) in the `message ol > li::before` and `message ul li::before` selectors.
        2.  **Check for Conflicting Styles:** Use the browser's developer tools to inspect the list items and identify any conflicting styles that might be overriding the `color` property.
        3.  **Use `!important` Flag:** If necessary, use the `!important` flag to ensure that the `color` property is applied correctly.

## 3. CSS Styling (`chat.css`): Detailed Analysis

The `chat.css` file contains the CSS styles that define the appearance of the chat messages. Understanding how these styles are applied is crucial for troubleshooting formatting issues.

### Key Selectors and Properties

*   `.lm_content .chat-container`: This selector targets the main container for the chat interface. It sets the background color, height, display (flexbox), and border.
    ```css
    .lm_content .chat-container {
        background: #1e1e1e;
        height: 100%;
        display: flex;
        flex-direction: column;
        padding: 0;
        border-left: 1px solid #333;
    }
    ```
*   `.chat-header`: This selector styles the header of the chat interface. It sets the padding, display (flexbox), alignment, background color, border, text color, and font weight.
    ```css
    .chat-header {
        padding: 16px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #252526;
        border-bottom: 1px solid #333;
        color: #ffffff;
        font-weight: 500;
    }
    ```
*   `.chat-messages`: This selector styles the container for the chat messages. It sets the flex property (to allow the messages to fill the available space), overflow-y (to enable scrolling), padding, and background color.
    ```css
    .chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 16px;
        background: #1e1e1e;
    }
    ```
*   `.message`: This selector styles the individual chat messages. It sets the margin, padding, border-radius, background color, text color, box-shadow, line-height, word-wrap, word-break, overflow-wrap, white-space, max-width, and box-sizing.
    ```css
    .message {
        margin-bottom: 16px;
        padding: 12px;
        border-radius: 6px;
        background: #252526;
        color: #ffffff;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        line-height: 1.4;
        word-wrap: break-word;
        word-break: normal;
        overflow-wrap: break-word;
        white-space: normal;
        max-width: 100%;
        box-sizing: border-box;
    }
    ```
*   `.message.user`: This selector styles the user's chat messages. It sets the background color, text color, margin-left, and padding.
    ```css
    .message.user {
        background: #4B4BF7;
        color: #ffffff;
        margin-left: auto;
        padding: 12px 16px; /* preserve user-specific padding */
    }
    ```
*   `.message.assistant`: This selector styles the assistant's chat messages. It sets the background color, text color, margin-right, border, and padding.
    ```css
    .message.assistant {
        background: #252526;
        color: #ffffff;
        margin-right: auto;
        border: 1px solid #333;
        padding: 16px; /* from original .message.assistant block */
    }
    ```
*   `.message-heading-2`: This selector styles the level-2 headings in the chat messages. It sets the color, font-size, font-weight, margin, display (flexbox), alignment, and gap.
    ```css
    .message-heading-2 {
        color: #4B4BF7;
        font-size: 18px;
        font-weight: 600;
        margin: 12px 0 8px;
        display: flex;
        align-items: center;
        gap: 4px;
    }
    ```
*   `.message-heading-3`: This selector styles the level-3 headings in the chat messages. It sets the color, font-size, font-weight, margin, display (flexbox), alignment, and gap.
    ```css
    .message-heading-3 {
        color: #ffffff;
        font-size: 16px;
        font-weight: 600;
        margin: 8px 0 4px;
        display: flex;
        align-items: center;
        gap: 4px;
    }
    ```
*   `.message ol`: This selector styles the ordered lists in the chat messages. It sets the counter-reset property.
    ```css
    .message ol {
        counter-reset: item;
    }
    ```
*   `.message ol > li`: This selector styles the list items in the ordered lists. It sets the counter-increment, list-style, position, display (flexbox), alignment, min-height, padding-left, and margin-bottom.
    ```css
    .message ol > li {
        counter-increment: item;
        list-style: none;
        position: relative;
        display: flex;
        align-items: baseline;
        min-height: 16px;
        padding-left: 4px;
        margin-bottom: 0;
        line-height: 1.2;
    }
    ```
*   `.message ol > li::before`: This selector styles the numbers in the ordered lists. It sets the content (using the `counter()` function), position, left, color, font-size, and top.
    ```css
    .message ol > li::before {
        content: counter(item) ".";
        position: absolute;
        left: -16px;
        color: #4B4BF7;
        font-size: 12px;
        top: 0;
    }
    ```
*   `.message ul`: This selector styles the unordered lists in the chat messages. It sets the list-style and padding-left.
    ```css
    .message ul {
        list-style: none;
        padding-left: 0;
    }
    ```
*   `.message li.bullet-→, .message li.bullet-⊙, .message li.bullet-▸`: This selector styles the list items with special bullet points. It sets the position, padding-left, margin, padding-bottom, line-height, display (flexbox), alignment, and color.
    ```css
    .message li.bullet-→,
    .message li.bullet-⊙,
    .message li.bullet-▸ {
        position: relative;
        padding-left: 12px;
        margin: 0;
        padding-bottom: 2px;
        line-height: 1.4;
        display: flex;
        align-items: baseline;
        color: #ffffff;
        width: auto;
    }
    ```
*   `.message li.bullet-→::before, .message li.bullet-⊙::before, .message li.bullet-▸::before`: This selector styles the bullet points themselves. It sets the position, left, color, font-size, width, text-align, font-family, and font-weight.
    ```css
    .message li.bullet-→::before,
    .message li.bullet-⊙::before,
    .message li.bullet-▸::before {
        position: absolute;
        left: 2px;
        color: #4B4BF7;
        font-size: 14px;
        width: 8px;
        text-align: center;
        font-family: monospace;
        font-weight: bold;
        top: 0;
    }
    ```

### Addressing Specific Issues: CSS Solutions

*   **Small Number "1." with the Dot Below:**
    *   **Solution:** Adjust the `font-size`, `vertical-align`, and `line-height` properties of the `message ol > li::before` selector. For example:
        ```css
        .message ol > li::before {
            content: counter(item) ".";
            position: absolute;
            left: -20px;
            color: #4B4BF7;
            font-size: 14px; /* Increase font-size */
            top: 0;
            line-height: 1.2; /* Adjust line-height */
            vertical-align: baseline; /* Adjust vertical-align */
        }
        ```
    *   Experiment with different values for these properties to find the best visual appearance.
*   **White Color Instead of Blue:**
    *   **Solution:** Ensure that the `color` property is set to `#4B4BF7` in the `message ol > li::before` and `message ul li::before` selectors. If necessary, use the `!important` flag to override any conflicting styles.
        ```css
        .message ol > li::before {
            color: #4B4BF7 !important;
        }

        .message ul li::before {
            color: #4B4BF7 !important;
        }
        ```
*   **Inconsistent Indentation:**
    *   **Solution:** Review the `padding-left` values for the `message ul`, `message ol`, and `message li` selectors. Ensure that the values are consistent and visually appealing. Also, consider using `margin-left` instead of `padding-left` for more consistent results.
        ```css
        .message ul,
        .message ol {
            margin: 4px

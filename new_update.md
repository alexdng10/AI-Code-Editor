# Judge0 IDE Codebase Documentation

This document provides a comprehensive overview of the Judge0 IDE codebase, designed to help new software engineers quickly understand the project's architecture, styling conventions, and implementation details.

## Project Overview

The Judge0 IDE is a free and open-source online code editor and compiler that allows users to write, run, and share code in various programming languages.

## Project Structure

The project structure is as follows:

```
.
├── CODE_OF_CONDUCT.md
├── index.html
├── LICENSE
├── manifest.json
├── PRIVACY.md
├── README.md
├── sw.js
├── TERMS.md
├── css/
│   ├── chat.css
│   ├── ide.css
│   ├── semantic.css
│   └── site.css
├── data/
│   ├── additional_files_zip_base64.txt
│   ├── db.sqlite
│   └── README.md
├── embed/
│   ├── index.html
│   └── README.md
├── favicons/
├── images/
├── js/
│   ├── ai-service.js
│   ├── chat-interface.js
│   ├── electron.js
│   ├── ide.js
│   ├── local_storage.js
│   ├── puter.js
│   ├── query.js
│   ├── style.js
│   └── theme.js
├── vendor/
```

## File and Directory Descriptions

### Root Files

*   **`CODE_OF_CONDUCT.md`**: Contains the Contributor Covenant Code of Conduct.
*   **`index.html`**: The main HTML file that defines the structure of the page.
*   **`LICENSE`**: Contains the MIT License.
*   **`manifest.json`**: A manifest for Progressive Web Apps (PWA).
*   **`PRIVACY.md`**: Contains the privacy policy.
*   **`README.md`**: Provides an overview of the Judge0 IDE.
*   **`sw.js`**: Service worker for PWA functionality.
*   **`TERMS.md`**: Contains the terms of service.

### `css/` Directory

*   **`chat.css`**: Contains the styling for the chat interface.
*   **`ide.css`**: Contains basic styling for the IDE.
*   **`semantic.css`**: Contains styling for Semantic UI components.
*   **`site.css`**: Contains site-wide styling.

### `data/` Directory

*   **`additional_files_zip_base64.txt`**: Contains additional files for SQLite (likely base64 encoded).
*   **`db.sqlite`**: A SQLite database (likely used for storing user data or application-related information).
*   **`README.md`**: A README file for the `data/` directory.

### `embed/` Directory

*   **`index.html`**: An HTML file for embedding the IDE.
*   **`README.md`**: A README file for the `embed/` directory.

### `favicons/` Directory

*   Contains favicon files for different devices and resolutions.

### `images/` Directory

*   Contains image files used in the IDE.

### `js/` Directory

*   **`ai-service.js`**: Handles communication with the AI service (Groq API) for code analysis and inline help.
*   **`chat-interface.js`**: Implements the chat interface, including UI setup, API key management, sending messages, and displaying responses.
*   **`electron.js`**: Determines if the application is running in an Electron environment.
*   **`ide.js`**: The core logic of the IDE, handling Monaco editor initialization, language loading, code execution, and layout management.
*   **`local_storage.js`**: Provides a simple interface for interacting with the browser's local storage.
*   **`puter.js`**: Integrates with the Puter platform.
*   **`query.js`**: Provides a utility for extracting query parameters from the URL.
*   **`style.js`**: Applies different styles to the IDE based on the environment (Electron, Puter, or web).
*   **`theme.js`**: Manages the IDE's theme (light, dark, or system).

### `vendor/` Directory

*   Contains third-party libraries like Monaco Editor and Golden Layout.

## Key Components and Architecture

The Judge0 IDE utilizes several key components to provide its functionality:

*   **Monaco Editor**: A code editor developed by Microsoft, used for the source code, stdin, and stdout editors.
*   **Golden Layout**: A JavaScript layout manager, used for managing the layout of the UI components.
*   **Semantic UI**: A UI component library, used for styling the UI elements.
*   **Judge0 API**: An API for compiling and executing code.
*   **Groq API**: An API for AI-powered code analysis and suggestions.

The core logic of the IDE is implemented in `js/ide.js`. This file handles the initialization of the Monaco editor, loading languages, running code, fetching submission results, opening and saving files, and managing the layout.

The chat interface is implemented in `js/chat-interface.js`. This file handles the UI setup, API key management, sending messages, and displaying responses. It also integrates with the AI service to provide code analysis and inline help.

## CSS Styling Conventions

The CSS styling in the Judge0 IDE follows these conventions:

*   **Dark Theme**: The IDE uses a dark theme with a blue accent color.
*   **Golden Layout Specificity**: Styles need to target the correct parent elements in the Golden Layout DOM structure.
*   **Theme Override Strategy**: Hardcoded dark theme colors are used with `!important` flags to override conflicting styles.
*   **Visual Hierarchy**: Depth is created through background color variations, shadows, and borders.
*   **Color Palette**:
    *   `#1e1e1e`: Main background
    *   `#252526`: Secondary background
    *   `#333333`: Borders
    *   `#4B4BF7`: Accent/Buttons
    *   `#ffffff`: Text

## Chat Interface Implementation Details

The chat interface is implemented as a sidebar or panel within the IDE, positioned alongside the code editor. It includes the following elements:

*   A display area to show the conversation history.
*   An input field for users to type their questions or prompts.
*   A send button to submit the user's input.
*   An API key input field to store the Groq API key.

The `ChatInterface` class in `js/chat-interface.js` handles the UI setup, API key management, sending messages, and displaying responses. It uses the `AIService` class in `js/ai-service.js` to communicate with the Groq API.

## AI Service Integration

The `AIService` class in `js/ai-service.js` handles communication with the Groq API. It has methods for getting code analysis and inline help. The `getCodeAnalysis()` method sends the code and error message (if any) to the Groq API and returns the AI-suggested fix. The `getInlineHelp()` method sends the selected code to the Groq API and returns the AI-generated explanation.

## Important Considerations

*   **API Key Management**: The Groq API key is stored in the browser's local storage. Ensure that the API key is not directly exposed in the client-side code.
*   **CSS Specificity**: Be mindful of CSS specificity when making changes to the styling. Use the `.lm_content .chat-container` selector to target the chat interface elements.
*   **Theme Consistency**: Ensure that any new UI elements are styled consistently with the existing dark theme.

This documentation should provide a solid foundation for understanding the Judge0 IDE codebase. 

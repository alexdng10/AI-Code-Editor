    import { IS_PUTER } from "./puter.js";
import { ChatInterface } from "./chat-interface.js";
import { CodeModeManager } from "./code-mode.js";

const API_KEY = ""; // Get yours at https://platform.sulu.sh/apis/judge0

const AUTH_HEADERS = API_KEY ? {
    "Authorization": `Bearer ${API_KEY}`
} : {};

const CE = "CE";
const EXTRA_CE = "EXTRA_CE";

const AUTHENTICATED_CE_BASE_URL = "https://judge0-ce.p.sulu.sh";
const AUTHENTICATED_EXTRA_CE_BASE_URL = "https://judge0-extra-ce.p.sulu.sh";

var AUTHENTICATED_BASE_URL = {};
AUTHENTICATED_BASE_URL[CE] = AUTHENTICATED_CE_BASE_URL;
AUTHENTICATED_BASE_URL[EXTRA_CE] = AUTHENTICATED_EXTRA_CE_BASE_URL;

const UNAUTHENTICATED_CE_BASE_URL = "https://ce.judge0.com";
const UNAUTHENTICATED_EXTRA_CE_BASE_URL = "https://extra-ce.judge0.com";

var UNAUTHENTICATED_BASE_URL = {};
UNAUTHENTICATED_BASE_URL[CE] = UNAUTHENTICATED_CE_BASE_URL;
UNAUTHENTICATED_BASE_URL[EXTRA_CE] = UNAUTHENTICATED_EXTRA_CE_BASE_URL;

const INITIAL_WAIT_TIME_MS = 0;
const WAIT_TIME_FUNCTION = i => 100;
const MAX_PROBE_REQUESTS = 50;

var fontSize = 13;

var layout;
var chatInterface;
var codeModeManager;

var sourceEditor;
var optimizedEditor;
var stdinEditor;
var stdoutEditor;

var $selectLanguage;
var $compilerOptions;
var $commandLineArguments;
var $runBtn;
var $statusLine;

var timeStart;

var sqliteAdditionalFiles;
var languages = {};

var layoutConfig = {
    settings: {
        showPopoutIcon: false,
        reorderEnabled: true,
        showMaximiseIcon: false
    },
    content: [{
        type: "row",
        content: [{
            type: "column",
            width: 70,
            content: [{
                type: "component",
                componentName: "source",
                id: "source",
                title: "main.cpp",
                isClosable: false,
                componentState: {
                    readOnly: false
                }
            }]
        }, {
            type: "column",
            width: 30,
            content: [{
                type: "row",
                content: [{
                    type: "component",
                    componentName: "stdin",
                    width: 50,
                    id: "stdin",
                    title: "Input",
                    isClosable: false,
                    componentState: {
                        readOnly: false
                    }
                }, {
                    type: "component",
                    componentName: "stdout",
                    width: 50,
                    id: "stdout",
                    title: "Output",
                    isClosable: false,
                    componentState: {
                        readOnly: true
                    }
                }]
            }, {
                type: "component",
                componentName: "chat",
                title: "Code Assistant",
                isClosable: false
            }]
        }]
    }]
};

var gPuterFile;

function encode(str) {
    return btoa(unescape(encodeURIComponent(str || "")));
}

function decode(bytes) {
    var escaped = escape(atob(bytes || ""));
    try {
        return decodeURIComponent(escaped);
    } catch {
        return unescape(escaped);
    }
}

function showError(title, content) {
    $("#judge0-site-modal #title").html(title);
    $("#judge0-site-modal .content").html(content);

    let reportTitle = encodeURIComponent(`Error on ${window.location.href}`);
    let reportBody = encodeURIComponent(
        `**Error Title**: ${title}\n` +
        `**Error Timestamp**: \`${new Date()}\`\n` +
        `**Origin**: ${window.location.href}\n` +
        `**Description**:\n${content}`
    );

    $("#report-problem-btn").attr("href", `https://github.com/judge0/ide/issues/new?title=${reportTitle}&body=${reportBody}`);
    $("#judge0-site-modal").modal("show");
}

function showHttpError(jqXHR) {
    showError(`${jqXHR.statusText} (${jqXHR.status})`, `<pre>${JSON.stringify(jqXHR, null, 4)}</pre>`);
}

function handleRunError(jqXHR) {
    showHttpError(jqXHR);
    $runBtn.removeClass("disabled");

    window.top.postMessage(JSON.parse(JSON.stringify({
        event: "runError",
        data: jqXHR
    })), "*");
}

function handleResult(data) {
    const tat = Math.round(performance.now() - timeStart);
    console.log(`It took ${tat}ms to get submission result.`);

    const status = data.status;
    const stdout = decode(data.stdout);
    const compileOutput = decode(data.compile_output);
    const time = (data.time === null ? "-" : data.time + "s");
    const memory = (data.memory === null ? "-" : data.memory + "KB");

    $statusLine.html(`${status.description}, ${time}, ${memory} (TAT: ${tat}ms)`);

    const output = [compileOutput, stdout].join("\n").trim();

    stdoutEditor.setValue(output);

    // Only show the suggest fix button for compilation errors
    if (status.id === 6) { // Compilation Error
        chatInterface?.showSuggestFixButton(sourceEditor.getValue(), compileOutput);
    }

    $runBtn.removeClass("disabled");

    window.top.postMessage(JSON.parse(JSON.stringify({
        event: "postExecution",
        status: data.status,
        time: data.time,
        memory: data.memory,
        output: output
    })), "*");
}

async function getSelectedLanguage() {
    return getLanguage(getSelectedLanguageFlavor(), getSelectedLanguageId())
}

function getSelectedLanguageId() {
    return parseInt($selectLanguage.val());
}

function getSelectedLanguageFlavor() {
    return $selectLanguage.find(":selected").attr("flavor");
}

function run() {
    if (sourceEditor.getValue().trim() === "") {
        showError("Error", "Source code can't be empty!");
        return;
    } else {
        $runBtn.addClass("disabled");
    }

    stdoutEditor.setValue("");
    $statusLine.html("");

    let x = layout.root.getItemsById("stdout")[0];
    x.parent.header.parent.setActiveContentItem(x);

    let sourceValue = encode(sourceEditor.getValue());
    let stdinValue = encode(stdinEditor.getValue());
    let languageId = getSelectedLanguageId();
    let compilerOptions = $compilerOptions.val();
    let commandLineArguments = $commandLineArguments.val();

    let flavor = getSelectedLanguageFlavor();

    if (languageId === 44) {
        sourceValue = sourceEditor.getValue();
    }

    let data = {
        source_code: sourceValue,
        language_id: languageId,
        stdin: stdinValue,
        compiler_options: compilerOptions,
        command_line_arguments: commandLineArguments,
        redirect_stderr_to_stdout: true
    };

    let sendRequest = function (data) {
        window.top.postMessage(JSON.parse(JSON.stringify({
            event: "preExecution",
            source_code: sourceEditor.getValue(),
            language_id: languageId,
            flavor: flavor,
            stdin: stdinEditor.getValue(),
            compiler_options: compilerOptions,
            command_line_arguments: commandLineArguments
        })), "*");

        timeStart = performance.now();
        $.ajax({
            url: `${AUTHENTICATED_BASE_URL[flavor]}/submissions?base64_encoded=true&wait=false`,
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify(data),
            headers: AUTH_HEADERS,
            success: function (data, textStatus, request) {
                console.log(`Your submission token is: ${data.token}`);
                let region = request.getResponseHeader('X-Judge0-Region');
                setTimeout(fetchSubmission.bind(null, flavor, region, data.token, 1), INITIAL_WAIT_TIME_MS);
            },
            error: handleRunError
        });
    }

    if (languageId === 82) {
        if (!sqliteAdditionalFiles) {
            $.ajax({
                url: `./data/additional_files_zip_base64.txt`,
                contentType: "text/plain",
                success: function (responseData) {
                    sqliteAdditionalFiles = responseData;
                    data["additional_files"] = sqliteAdditionalFiles;
                    sendRequest(data);
                },
                error: handleRunError
            });
        }
        else {
            data["additional_files"] = sqliteAdditionalFiles;
            sendRequest(data);
        }
    } else {
        sendRequest(data);
    }
}

function fetchSubmission(flavor, region, submission_token, iteration) {
    if (iteration >= MAX_PROBE_REQUESTS) {
        handleRunError({
            statusText: "Maximum number of probe requests reached.",
            status: 504
        }, null, null);
        return;
    }

    $.ajax({
        url: `${UNAUTHENTICATED_BASE_URL[flavor]}/submissions/${submission_token}?base64_encoded=true`,
        headers: {
            "X-Judge0-Region": region
        },
        success: function (data) {
            if (data.status.id <= 2) { // In Queue or Processing
                $statusLine.html(data.status.description);
                setTimeout(fetchSubmission.bind(null, flavor, region, submission_token, iteration + 1), WAIT_TIME_FUNCTION(iteration));
            } else {
                handleResult(data);
            }
        },
        error: handleRunError
    });
}

function setSourceCodeName(name) {
    $(".lm_title")[0].innerText = name;
}

function getSourceCodeName() {
    return $(".lm_title")[0].innerText;
}

function openFile(content, filename) {
    clear();
    sourceEditor.setValue(content);
    selectLanguageForExtension(filename.split(".").pop());
    setSourceCodeName(filename);
}

function saveFile(content, filename) {
    const blob = new Blob([content], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}

async function openAction() {
    if (IS_PUTER) {
        gPuterFile = await puter.ui.showOpenFilePicker();
        openFile(await (await gPuterFile.read()).text(), gPuterFile.name);
    } else {
        document.getElementById("open-file-input").click();
    }
}

async function saveAction() {
    if (IS_PUTER) {
        if (gPuterFile) {
            gPuterFile.write(sourceEditor.getValue());
        } else {
            gPuterFile = await puter.ui.showSaveFilePicker(sourceEditor.getValue(), getSourceCodeName());
            setSourceCodeName(gPuterFile.name);
        }
    } else {
        saveFile(sourceEditor.getValue(), getSourceCodeName());
    }
}

function setFontSizeForAllEditors(fontSize) {
    sourceEditor.updateOptions({ fontSize: fontSize });
    optimizedEditor.updateOptions({ fontSize: fontSize });
    stdinEditor.updateOptions({ fontSize: fontSize });
    stdoutEditor.updateOptions({ fontSize: fontSize });
}

async function loadLangauges() {
    return new Promise((resolve, reject) => {
        let options = [];

        $.ajax({
            url: UNAUTHENTICATED_CE_BASE_URL + "/languages",
            success: function (data) {
                for (let i = 0; i < data.length; i++) {
                    let language = data[i];
                    let option = new Option(language.name, language.id);
                    option.setAttribute("flavor", CE);
                    option.setAttribute("langauge_mode", getEditorLanguageMode(language.name));

                    if (language.id !== 89) {
                        options.push(option);
                    }

                    if (language.id === DEFAULT_LANGUAGE_ID) {
                        option.selected = true;
                    }
                }
            },
            error: reject
        }).always(function () {
            $.ajax({
                url: UNAUTHENTICATED_EXTRA_CE_BASE_URL + "/languages",
                success: function (data) {
                    for (let i = 0; i < data.length; i++) {
                        let language = data[i];
                        let option = new Option(language.name, language.id);
                        option.setAttribute("flavor", EXTRA_CE);
                        option.setAttribute("langauge_mode", getEditorLanguageMode(language.name));

                        if (options.findIndex((t) => (t.text === option.text)) === -1 && language.id !== 89) {
                            options.push(option);
                        }
                    }
                },
                error: reject
            }).always(function () {
                options.sort((a, b) => a.text.localeCompare(b.text));
                $selectLanguage.append(options);
                resolve();
            });
        });
    });
};

async function loadSelectedLanguage(skipSetDefaultSourceCodeName = false) {
    const languageMode = $selectLanguage.find(":selected").attr("langauge_mode");
    monaco.editor.setModelLanguage(sourceEditor.getModel(), languageMode);
    monaco.editor.setModelLanguage(optimizedEditor.getModel(), languageMode);

    if (!skipSetDefaultSourceCodeName) {
        setSourceCodeName((await getSelectedLanguage()).source_file);
    }
}

function selectLanguageByFlavorAndId(languageId, flavor) {
    let option = $selectLanguage.find(`[value=${languageId}][flavor=${flavor}]`);
    if (option.length) {
        option.prop("selected", true);
        $selectLanguage.trigger("change", { skipSetDefaultSourceCodeName: true });
    }
}

function selectLanguageForExtension(extension) {
    let language = getLanguageForExtension(extension);
    selectLanguageByFlavorAndId(language.language_id, language.flavor);
}

async function getLanguage(flavor, languageId) {
    return new Promise((resolve, reject) => {
        if (languages[flavor] && languages[flavor][languageId]) {
            resolve(languages[flavor][languageId]);
            return;
        }

        $.ajax({
            url: `${UNAUTHENTICATED_BASE_URL[flavor]}/languages/${languageId}`,
            success: function (data) {
                if (!languages[flavor]) {
                    languages[flavor] = {};
                }

                languages[flavor][languageId] = data;
                resolve(data);
            },
            error: reject
        });
    });
}

function setDefaults() {
    setFontSizeForAllEditors(fontSize);
    
    // Set source code directly without replacing line endings
    sourceEditor.setValue(DEFAULT_SOURCE);
    
    // Set stdin directly without replacing line endings
    stdinEditor.setValue(DEFAULT_STDIN);
    
    $compilerOptions.val(DEFAULT_COMPILER_OPTIONS);
    $commandLineArguments.val(DEFAULT_CMD_ARGUMENTS);

    $statusLine.html("");

    loadSelectedLanguage();
}

function clear() {
    sourceEditor.setValue("");
    optimizedEditor.setValue("");
    stdinEditor.setValue("");
    $compilerOptions.val("");
    $commandLineArguments.val("");

    $statusLine.html("");
}

function refreshSiteContentHeight() {
    const navigationHeight = document.getElementById("judge0-site-navigation").offsetHeight;

    const siteContent = document.getElementById("judge0-site-content");
    siteContent.style.height = `${window.innerHeight}px`;
    siteContent.style.paddingTop = `${navigationHeight}px`;
}

function refreshLayoutSize() {
    refreshSiteContentHeight();
    layout.updateSize();
}

window.addEventListener("resize", refreshLayoutSize);
document.addEventListener("DOMContentLoaded", async function () {
    $("#select-language").dropdown();
    $("[data-content]").popup({
        lastResort: "left center"
    });

    refreshSiteContentHeight();

    console.log("Hey, Judge0 IDE is open-sourced: https://github.com/judge0/ide. Have fun!");

    $selectLanguage = $("#select-language");
    $selectLanguage.change(function (event, data) {
        let skipSetDefaultSourceCodeName = (data && data.skipSetDefaultSourceCodeName) || !!gPuterFile;
        loadSelectedLanguage(skipSetDefaultSourceCodeName);
    });

    await loadLangauges();

    $compilerOptions = $("#compiler-options");
    $commandLineArguments = $("#command-line-arguments");

    $runBtn = $("#run-btn");
    $runBtn.click(run);

    $("#open-file-input").change(function (e) {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            const reader = new FileReader();
            reader.onload = function (e) {
                openFile(e.target.result, selectedFile.name);
            };

            reader.onerror = function (e) {
                showError("Error", "Error reading file: " + e.target.error);
            };

            reader.readAsText(selectedFile);
        }
    });

    $statusLine = $("#judge0-status-line");

    $(document).on("keydown", "body", function (e) {
        if (e.metaKey || e.ctrlKey) {
            switch (e.key) {
                case "Enter": // Ctrl+Enter, Cmd+Enter
                    e.preventDefault();
                    run();
                    break;
                case "s": // Ctrl+S, Cmd+S
                    e.preventDefault();
                    save();
                    break;
                case "o": // Ctrl+O, Cmd+O
                    e.preventDefault();
                    open();
                    break;
                case "+": // Ctrl+Plus
                case "=": // Some layouts use '=' for '+'
                    e.preventDefault();
                    fontSize += 1;
                    setFontSizeForAllEditors(fontSize);
                    break;
                case "-": // Ctrl+Minus
                    e.preventDefault();
                    fontSize -= 1;
                    setFontSizeForAllEditors(fontSize);
                    break;
                case "0": // Ctrl+0
                    e.preventDefault();
                    fontSize = 13;
                    setFontSizeForAllEditors(fontSize);
                    break;
            }
        }
    });

    require(["vs/editor/editor.main"], function (ignorable) {
        layout = new GoldenLayout(layoutConfig, $("#judge0-site-content"));

        // Register components
        layout.registerComponent("source", function (container, state) {
            sourceEditor = monaco.editor.create(container.getElement()[0], {
                automaticLayout: true,
                scrollBeyondLastLine: true,
                readOnly: state.readOnly,
                language: "cpp",
                fontFamily: "JetBrains Mono",
                minimap: {
                    enabled: true
                }
            });

            sourceEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, run);

            // Initialize code mode manager after chat interface is ready
            window.addEventListener('chatInterfaceReady', () => {
                codeModeManager = new CodeModeManager(sourceEditor, chatInterface.aiService);
            });

            // Listen for code mode state changes
            window.addEventListener('codeModeStateChange', (e) => {
                if (!codeModeManager) {
                    console.error('Code mode manager not initialized');
                    return;
                }
                
                if (e.detail.enabled) {
                    codeModeManager.enable();
                    console.log('Code mode enabled');
                } else {
                    codeModeManager.disable();
                    console.log('Code mode disabled');
                }
            });

            // Listen for code mode updates
            window.addEventListener('codeModeUpdate', (e) => {
                const { suggestions, diffView } = e.detail;
                
                if (suggestions && diffView) {
                    // Get the source container and its parent column
                    const sourceContainer = layout.root.getItemsById('source')[0];
                    const sourceColumn = sourceContainer.parent;
                    
                    // Store original content and state
                    const originalContent = sourceEditor.getValue();
                    const originalState = sourceEditor.saveViewState();
                    
                    // Create a new row for side-by-side diff with fixed widths
                    const diffRow = {
                        type: 'row',
                        content: [{
                            type: 'component',
                            componentName: 'source',
                            id: 'source',
                            title: 'Original',
                            width: 50,
                            componentState: {
                                readOnly: false
                            }
                        }, {
                            type: 'component',
                            componentName: 'optimized',
                            id: 'optimized',
                            title: 'Optimized',
                            width: 50,
                            componentState: {
                                readOnly: true
                            }
                        }]
                    };

                    // Replace the source container with the diff row
                    sourceColumn.replaceChild(sourceContainer, diffRow);
                    
                    // Force equal widths by directly setting the item configs
                    const optimizedComponent = layout.root.getItemsById('optimized')[0];
                    const newSourceComponent = layout.root.getItemsById('source')[0];
                    
                    optimizedComponent.config.width = 50;
                    newSourceComponent.config.width = 50;
                    
                    // Update the layout to reflect the new configuration
                    layout.updateSize(true);
                    
                    // Restore original content and state
                    sourceEditor.setValue(originalContent);
                    sourceEditor.restoreViewState(originalState);
                    
                    // Sync scroll positions
                    sourceEditor.onDidScrollChange((e) => {
                        if (optimizedEditor) {
                            optimizedEditor.setScrollPosition({
                                scrollTop: e.scrollTop,
                                scrollLeft: e.scrollLeft
                            });
                        }
                    });
                    
                    optimizedEditor.onDidScrollChange((e) => {
                        if (sourceEditor) {
                            sourceEditor.setScrollPosition({
                                scrollTop: e.scrollTop,
                                scrollLeft: e.scrollLeft
                            });
                        }
                    });
                    
                    // Force layout update
                    layout.updateSize();
                    // Update editor contents
                    sourceEditor.setValue(diffView.original.code);
                    optimizedEditor.setValue(diffView.optimized.code);
                    monaco.editor.setModelLanguage(sourceEditor.getModel(), diffView.original.language);
                    monaco.editor.setModelLanguage(optimizedEditor.getModel(), diffView.optimized.language);
                    
                    // Add decorations for changes
                    const sourceDecorations = [];
                    const optimizedDecorations = [];
                    
                    diffView.changes.forEach(change => {
                        // Add decoration for source (old code)
                        sourceDecorations.push({
                            range: new monaco.Range(
                                change.lineNumber,
                                1,
                                change.lineNumber,
                                1
                            ),
                            options: {
                                isWholeLine: true,
                                className: 'line-removed',
                                glyphMarginClassName: 'glyph-removed',
                                linesDecorationsClassName: 'line-removed-margin'
                            }
                        });
                        
                        // Add decoration for optimized (new code)
                        optimizedDecorations.push({
                            range: new monaco.Range(
                                change.lineNumber,
                                1,
                                change.lineNumber,
                                1
                            ),
                            options: {
                                isWholeLine: true,
                                className: 'line-added',
                                glyphMarginClassName: 'glyph-added',
                                linesDecorationsClassName: 'line-added-margin'
                            }
                        });
                    });
                    
                    // Apply decorations
                    sourceEditor.deltaDecorations([], sourceDecorations);
                    optimizedEditor.deltaDecorations([], optimizedDecorations);
                }
            });

            // Listen for layout reset
            window.addEventListener('resetCodeLayout', () => {
                // Store current content and scroll state
                const currentContent = sourceEditor.getValue();
                const scrollState = sourceEditor.saveViewState();
                
                // Find and remove optimized component if it exists
                const optimizedComponent = layout.root.getItemsById('optimized')[0];
                if (optimizedComponent) {
                    optimizedComponent.parent.remove();
                }
                
                // Get the current source component
                const sourceComponent = layout.root.getItemsById('source')[0];
                const diffRow = sourceComponent.parent;
                const mainColumn = diffRow.parent;
                
                // Create new source component with original layout
                const newSourceComponent = {
                    type: 'component',
                    componentName: 'source',
                    id: 'source',
                    title: 'main.cpp',
                    width: 70,
                    componentState: {
                        readOnly: false
                    }
                };
                
                // Replace the diff row with the single source component
                mainColumn.replaceChild(diffRow, newSourceComponent);
                
                // Force layout update
                layout.updateSize();
                
                // Restore content and scroll state
                sourceEditor.setValue(currentContent);
                sourceEditor.restoreViewState(scrollState);
                
                // Reset decorations
                sourceEditor.deltaDecorations([], []);
                optimizedEditor.setValue('');
                
                // Update layout with original proportions
                mainColumn.setSize(70);
                layout.updateSize(true);
            });

            // Listen for code mode actions (apply/reject)
            window.addEventListener('codeModeAction', (e) => {
                const { action, messageId } = e.detail;
                if (action === 'apply') {
                    codeModeManager.applyChanges();
                    // Remove the message after applying changes
                    const messageDiv = document.getElementById(messageId);
                    if (messageDiv) {
                        messageDiv.querySelector('.code-mode-actions').remove();
                    }
                } else if (action === 'reject') {
                    codeModeManager.rejectChanges();
                    // Remove the message after rejecting changes
                    const messageDiv = document.getElementById(messageId);
                    if (messageDiv) {
                        messageDiv.querySelector('.code-mode-actions').remove();
                    }
                }
            });

            // Add context menu for code selection chat
            // Add edit button and input widgets
            let editButtonWidget = null;
            let editInputWidget = null;
            let chatInputWidget = null;
            let currentSelection = null;

            function createWidget(selection) {
                currentSelection = selection;
                const widget = {
                    domNode: createActionButtons(selection),
                    getId: () => 'code-edit-button',
                    getDomNode: function() { return this.domNode; },
                    getPosition: () => {
                        const startPos = selection.getStartPosition();
                        const endPos = selection.getEndPosition();
                        
                        // For single line selection, position in the middle
                        if (startPos.lineNumber === endPos.lineNumber) {
                            const column = Math.floor((startPos.column + endPos.column) / 2);
                            return {
                                position: { lineNumber: startPos.lineNumber, column: column },
                                preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE]
                            };
                        }
                        
                        // For multi-line selection, position at the start of first line
                        return {
                            position: startPos,
                            preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE]
                        };
                    }
                };
                return widget;
            }

            function createChatInputWidget(selection) {
                return {
                  domNode: createChatInputField(selection),
                  getId: () => 'code-chat-input',
                  getDomNode: function() { return this.domNode; },
                  getPosition: () => ({
                    position: selection.getStartPosition(),
                    preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE]
                  })
                };
              }
              
            // Creates the Edit widget.
            function createEditInputWidget(selection) {
            return {
                domNode: createEditInputField(selection),
                getId: () => 'code-edit-input',
                getDomNode: function() { return this.domNode; },
                getPosition: () => ({
                position: selection.getStartPosition(),
                preference: [monaco.editor.ContentWidgetPositionPreference.ABOVE]
                })
            };
            }

            // Create action buttons container
            const createActionButtons = (selection) => {
                const container = document.createElement('div');
                container.className = 'monaco-action-buttons';
              
                const chatButton = document.createElement('button');
                chatButton.className = 'monaco-action-button';
                chatButton.innerHTML = 'Chat ⌘L';
              
                const editButton = document.createElement('button');
                editButton.className = 'monaco-action-button';
                editButton.innerHTML = 'Edit ⌘K';
              
                container.appendChild(chatButton);
                container.appendChild(editButton);
              
                
                // Chat button handler:
                chatButton.onclick = () => {
                    const selectedCode = sourceEditor.getModel().getValueInRange(selection);
                    if (selectedCode) {
                        if (!chatInterface?.aiService) {
                            showError("Error", "Please set up your Groq API key first by clicking the API button in the Code Assistant panel.");
                            return;
                        }

                        // Clean up all widgets
                        if (editButtonWidget) {
                            sourceEditor.removeContentWidget(editButtonWidget);
                            editButtonWidget = null;
                        }
                        if (editInputWidget) {
                            sourceEditor.removeContentWidget(editInputWidget);
                            editInputWidget = null;
                        }
                        if (chatInputWidget) {
                            sourceEditor.removeContentWidget(chatInputWidget);
                            chatInputWidget = null;
                        }

                        // Create and show chat input
                        chatInputWidget = createChatInputWidget(selection);
                        sourceEditor.addContentWidget(chatInputWidget);
                        
                        // Focus the input field
                        const input = chatInputWidget.getDomNode().querySelector('input');
                        if (input) input.focus();
                    }
                };
              
                // Edit button handler:
                editButton.onclick = () => {
                  const selectedCode = sourceEditor.getModel().getValueInRange(selection);
                  if (selectedCode) {
                    if (!chatInterface?.aiService) {
                      showError("Error", "Please set up your Groq API key first by clicking the API button in the Code Assistant panel.");
                      return;
                    }
                    if (editInputWidget) {
                      sourceEditor.removeContentWidget(editInputWidget);
                      editInputWidget = null;
                    }
                    // Create and add the Edit widget.
                    editInputWidget = createEditInputWidget(selection);
                    sourceEditor.addContentWidget(editInputWidget);
                    const input = editInputWidget.getDomNode().querySelector('input');
                    if (input) input.focus();
                  }
                };
              
                return container;
            };
              

            // Create input field
            // For Chat: Collects a question about the highlighted code.
            const createChatInputField = (selection) => {
                const container = document.createElement('div');
                container.className = 'monaco-edit-input';
            
                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = 'Ask about this snippet...';
            
                input.addEventListener('keypress', async (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const userQuestion = input.value.trim();
                        if (!userQuestion) return;
                        if (chatInputWidget) {
                            sourceEditor.removeContentWidget(chatInputWidget);
                            chatInputWidget = null;
                        }
                        const snippet = sourceEditor.getModel().getValueInRange(selection);
                        chatInterface.addMessage('user', `${userQuestion}\n\nSelected code:\n\`\`\`cpp\n${snippet}\n\`\`\``);
                        try {
                            const response = await chatInterface.aiService.getInlineHelp(snippet, userQuestion);
                            chatInterface.addMessage('assistant', response);
                        } catch (error) {
                            console.error('Error in chat snippet:', error);
                            chatInterface.addMessage('assistant', 'Sorry, an error occurred while processing your request.');
                        }
                } else if (e.key === 'Escape') {
                    if (chatInputWidget) {
                    sourceEditor.removeContentWidget(chatInputWidget);
                    chatInputWidget = null;
                    }
                }
                });
            
                container.appendChild(input);
                return container;
            };
            
            // For Edit: Collects an edit request for the highlighted code.
            const createEditInputField = (selection) => {
                const container = document.createElement('div');
                container.className = 'monaco-edit-input';
            
                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = 'Describe the edit you want...';
            
                input.addEventListener('keypress', async (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        const request = input.value.trim();
                        if (!request) return;
                        
                        // Remove widget
                        if (editInputWidget) {
                            sourceEditor.removeContentWidget(editInputWidget);
                            editInputWidget = null;
                        }
            
                        const snippet = sourceEditor.getModel().getValueInRange(selection);
                        try {
                            const response = await chatInterface.aiService.getCodeEdit(snippet, selection, request);
                            
                            // Parse response and handle code blocks
                            const lines = response.split('\n');
                            let lineChanges = [];
                            let suggestedCode = '';
                            let inCodeBlock = false;
            
                            // Get the entire line's content and indentation
                            const lineNumber = selection.startLineNumber;
                            const lineContent = sourceEditor.getModel().getLineContent(lineNumber);
                            const indentMatch = lineContent.match(/^(\s*)/);
                            const indentation = indentMatch ? indentMatch[1] : '';
            
                            for (const line of lines) {
                                if (line.startsWith('```')) {
                                    inCodeBlock = !inCodeBlock;
                                    continue;
                                }
                                if (inCodeBlock) {
                                    // Preserve indentation for each line
                                    suggestedCode += indentation + line + '\n';
                                    continue;
                                }
                                // Handle line-specific changes with proper indentation
                                const match = line.match(/Line\s+(\d+):\s*Change\s*"([^"]+)"\s*to\s*"([^"]+)"/);
                                if (match) {
                                    lineChanges.push({
                                        lineNumber: parseInt(match[1]),
                                        oldText: match[2].trim(),
                                        newText: indentation + match[3].trim()
                                    });
                                }
                            }
            
                            // Execute the edits with proper context
                            if (lineChanges.length > 0) {
                                const model = sourceEditor.getModel();
                                const edits = lineChanges.map(change => {
                                    // Find the exact position within the line
                                    const lineContent = model.getLineContent(change.lineNumber);
                                    const startColumn = lineContent.indexOf(change.oldText) + 1;
                                    
                                    return {
                                        range: new monaco.Range(
                                            change.lineNumber,
                                            startColumn,
                                            change.lineNumber,
                                            startColumn + change.oldText.length
                                        ),
                                        text: change.newText
                                    };
                                });
                                sourceEditor.executeEdits('ai-edit', edits);
                            } else if (suggestedCode) {
                                // For block insertions, preserve the context
                                const startLineContent = sourceEditor.getModel().getLineContent(selection.startLineNumber);
                                const blockIndentation = startLineContent.match(/^(\s*)/)[1];
                                
                                // Ensure proper indentation for the entire block
                                const indentedCode = suggestedCode.split('\n')
                                    .map(line => line.trim() ? blockIndentation + line : line)
                                    .join('\n');
            
                                sourceEditor.executeEdits('ai-edit', [{
                                    range: selection,
                                    text: indentedCode.trim()
                                }]);
                            }
                        } catch (error) {
                            console.error('Error applying AI edit:', error);
                        }
                    } else if (e.key === 'Escape') {
                        if (editInputWidget) {
                            sourceEditor.removeContentWidget(editInputWidget);
                            editInputWidget = null;
                        }
                    }
                });
            
                container.appendChild(input);
                return container;
            };
  

            // Track decorations
            let currentDecorations = [];

            // Add selection change listener
            sourceEditor.onDidChangeCursorSelection((e) => {
                const selection = e.selection;
                
                // Remove existing widget
                if (editButtonWidget) {
                    sourceEditor.removeContentWidget(editButtonWidget);
                    editButtonWidget = null;
                }

                // Only show buttons if there's a real selection
                if (!selection.isEmpty() && 
                    !(selection.startLineNumber === selection.endLineNumber && 
                      selection.startColumn === selection.endColumn)) {
                    
                    // Create new widget
                    editButtonWidget = createWidget(selection);
                    sourceEditor.addContentWidget(editButtonWidget);


                    // Add selection highlight decoration
                    currentDecorations = sourceEditor.deltaDecorations(currentDecorations, [{
                        range: selection,
                        options: {
                            className: 'monaco-selection-highlight',
                            inlineClassName: 'monaco-selection-highlight-inline',
                            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
                        }
                    }]);
                } else {
                    // Clear decorations when no selection
                    currentDecorations = sourceEditor.deltaDecorations(currentDecorations, []);
                }
            });

            // Add keyboard shortcuts
            // Fix the ⌘L shortcut
            sourceEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL, () => {
                const selection = sourceEditor.getSelection();
                if (!selection.isEmpty()) {
                    if (!chatInterface?.aiService) {
                        showError("Error", "Please set up your Groq API key first by clicking the API button in the Code Assistant panel.");
                        return;
                    }

                    if (editButtonWidget) {
                        sourceEditor.removeContentWidget(editButtonWidget);
                        editButtonWidget = null;
                    }

                    // Use the new createChatInputWidget instead of old createInputWidget
                    chatInputWidget = createChatInputWidget(selection);
                    sourceEditor.addContentWidget(chatInputWidget);
                    const input = chatInputWidget.getDomNode().querySelector('input');
                    if (input) input.focus();
                }
            });

            // Fix the ⌘K shortcut
            sourceEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
                const selection = sourceEditor.getSelection();
                if (!selection.isEmpty()) {
                    if (!chatInterface?.aiService) {
                        showError("Error", "Please set up your Groq API key first by clicking the API button in the Code Assistant panel.");
                        return;
                    }

                    if (editButtonWidget) {
                        sourceEditor.removeContentWidget(editButtonWidget);
                        editButtonWidget = null;
                    }

                    // Use the new createEditInputWidget instead of old createInputWidget
                    editInputWidget = createEditInputWidget(selection);
                    sourceEditor.addContentWidget(editInputWidget);
                    const input = editInputWidget.getDomNode().querySelector('input');
                    if (input) input.focus();
                }
            });
        });
        // Register optimized code component
        layout.registerComponent("optimized", function (container, state) {
            optimizedEditor = monaco.editor.create(container.getElement()[0], {
                automaticLayout: true,
                scrollBeyondLastLine: true,
                readOnly: true,
                language: "cpp",
                fontFamily: "JetBrains Mono",
                minimap: {
                    enabled: true
                }
            });
        });

        layout.registerComponent("chat", function (container, state) {
            chatInterface = new ChatInterface();
            chatInterface.initialize(container.getElement()[0]);
            // Set editor reference after initialization
            chatInterface.editor = sourceEditor;
        });

        layout.registerComponent("stdin", function (container, state) {
            stdinEditor = monaco.editor.create(container.getElement()[0], {
                automaticLayout: true,
                scrollBeyondLastLine: false,
                readOnly: state.readOnly,
                language: "plaintext",
                fontFamily: "JetBrains Mono",
                minimap: {
                    enabled: false
                }
            });
        });

        layout.registerComponent("stdout", function (container, state) {
            stdoutEditor = monaco.editor.create(container.getElement()[0], {
                automaticLayout: true,
                scrollBeyondLastLine: false,
                readOnly: state.readOnly,
                language: "plaintext",
                fontFamily: "JetBrains Mono",
                minimap: {
                    enabled: false
                }
            });
        });

        layout.on("initialised", function () {
            // Set initial content
            sourceEditor.setValue(DEFAULT_SOURCE);
            stdinEditor.setValue(DEFAULT_STDIN);
            
            // Set other defaults
            setFontSizeForAllEditors(fontSize);
            $compilerOptions.val(DEFAULT_COMPILER_OPTIONS);
            $commandLineArguments.val(DEFAULT_CMD_ARGUMENTS);
            $statusLine.html("");
            
            // Load language and refresh layout
            loadSelectedLanguage();
            refreshLayoutSize();
            
            window.top.postMessage({ event: "initialised" }, "*");
        });

        layout.init();
    });

    let superKey = "⌘";
    if (!/(Mac|iPhone|iPod|iPad)/i.test(navigator.platform)) {
        superKey = "Ctrl";
    }

    [$runBtn].forEach(btn => {
        btn.attr("data-content", `${superKey}${btn.attr("data-content")}`);
    });

    document.querySelectorAll(".description").forEach(e => {
        e.innerText = `${superKey}${e.innerText}`;
    });

    if (IS_PUTER) {
        puter.ui.onLaunchedWithItems(async function (items) {
            gPuterFile = items[0];
            openFile(await (await gPuterFile.read()).text(), gPuterFile.name);
        });
    }

    document.getElementById("judge0-open-file-btn").addEventListener("click", openAction);
    document.getElementById("judge0-save-btn").addEventListener("click", saveAction);

    // Listen for code fix events from chat interface
    window.addEventListener('applyCodeFix', (event) => {
        if (event.detail) {
            const { lineChanges, fullCode } = event.detail;
            
            if (lineChanges && lineChanges.length > 0) {
                // Apply specific line changes
                const model = sourceEditor.getModel();
                const edits = [];
                
                for (const change of lineChanges) {
                    const lineNumber = change.lineNumber;
                    const lineContent = model.getLineContent(lineNumber);
                    
                    console.log('Processing line change:', {
                        lineNumber,
                        oldContent: lineContent,
                        oldText: change.oldText,
                        newText: change.newText
                    });
                    
                    // Find the start and end positions of the old text in the line
                    const startIndex = lineContent.indexOf(change.oldText);
                    if (startIndex !== -1) {
                        const range = new monaco.Range(
                            lineNumber,
                            startIndex + 1,
                            lineNumber,
                            startIndex + change.oldText.length + 1
                        );
                        
                        edits.push({
                            range: range,
                            text: change.newText
                        });
                        
                        console.log('Created edit:', {
                            range: range,
                            text: change.newText
                        });
                    }
                }
                
                if (edits.length > 0) {
                    // Apply all edits in a single operation
                    sourceEditor.executeEdits('ai-fix', edits);
                    console.log('Applied edits:', edits);
                } else {
                    // Fallback to full code replacement if no edits were created
                    console.log('No edits created, falling back to full code replacement');
                    sourceEditor.setValue(fullCode);
                }
            } else if (fullCode) {
                // Fallback to full code replacement if line changes parsing failed
                sourceEditor.setValue(fullCode);
            }
            
            // Run the code to check if the fix worked
            run();
            
            // Hide the suggest fix button since we've applied a fix
            chatInterface?.hideCompilationError();
        }
    });

    window.onmessage = function (e) {
        if (!e.data) {
            return;
        }

        if (e.data.action === "get") {
            window.top.postMessage(JSON.parse(JSON.stringify({
                event: "getResponse",
                source_code: sourceEditor.getValue(),
                language_id: getSelectedLanguageId(),
                flavor: getSelectedLanguageFlavor(),
                stdin: stdinEditor.getValue(),
                stdout: stdoutEditor.getValue(),
                compiler_options: $compilerOptions.val(),
                command_line_arguments: $commandLineArguments.val()
            })), "*");
        } else if (e.data.action === "set") {
            if (e.data.source_code) {
                sourceEditor.setValue(e.data.source_code);
            }
            if (e.data.language_id && e.data.flavor) {
                selectLanguageByFlavorAndId(e.data.language_id, e.data.flavor);
            }
            if (e.data.stdin) {
                stdinEditor.setValue(e.data.stdin);
            }
            if (e.data.stdout) {
                stdoutEditor.setValue(e.data.stdout);
            }
            if (e.data.compiler_options) {
                $compilerOptions.val(e.data.compiler_options);
            }
            if (e.data.command_line_arguments) {
                $commandLineArguments.val(e.data.command_line_arguments);
            }
            if (e.data.api_key) {
                AUTH_HEADERS["Authorization"] = `Bearer ${e.data.api_key}`;
            }
        }
    };
});

const DEFAULT_SOURCE = "\
#include <algorithm>\n\
#include <cstdint>\n\
#include <iostream>\n\
#include <limits>\n\
#include <set>\n\
#include <utility>\n\
#include <vector>\n\
\n\
using Vertex    = std::uint16_t;\n\
using Cost      = std::uint16_t;\n\
using Edge      = std::pair< Vertex, Cost >;\n\
using Graph     = std::vector< std::vector< Edge > >;\n\
using CostTable = std::vector< std::uint64_t >;\n\
\n\
constexpr auto kInfiniteCost{ std::numeric_limits< CostTable::value_type >::max() };\n\
\n\
auto dijkstra( Vertex const start, Vertex const end, Graph const & graph, CostTable & costTable )\n\
{\n\
    std::fill( costTable.begin(), costTable.end(), kInfiniteCost );\n\
    costTable[ start ] = 0;\n\
\n\
    std::set< std::pair< CostTable::value_type, Vertex > > minHeap;\n\
    minHeap.emplace( 0, start );\n\
\n\
    while ( !minHeap.empty() )\n\
    {\n\
        auto const vertexCost{ minHeap.begin()->first  };\n\
        auto const vertex    { minHeap.begin()->second };\n\
\n\
        minHeap.erase( minHeap.begin() );\n\
\n\
        if ( vertex == end )\n\
        {\n\
            break;\n\
        }\n\
\n\
        for ( auto const & neighbourEdge : graph[ vertex ] )\n\
        {\n\
            auto const & neighbour{ neighbourEdge.first };\n\
            auto const & cost{ neighbourEdge.second };\n\
\n\
            if ( costTable[ neighbour ] > vertexCost + cost )\n\
            {\n\
                minHeap.erase( { costTable[ neighbour ], neighbour } );\n\
                costTable[ neighbour ] = vertexCost + cost;\n\
                minHeap.emplace( costTable[ neighbour ], neighbour );\n\
            }\n\
        }\n\
    }\n\
\n\
    return costTable[ end ];\n\
}\n\
\n\
int main()\n\
{\n\
    constexpr std::uint16_t maxVertices{ 10000 };\n\
\n\
    Graph     graph    ( maxVertices );\n\
    CostTable costTable( maxVertices );\n\
\n\
    std::uint16_t testCases;\n\
    std::cin >> testCases;\n\
\n\
    while ( testCases-- > 0 )\n\
    {\n\
        for ( auto i{ 0 }; i < maxVertices; ++i )\n\
        {\n\
            graph[ i ].clear();\n\
        }\n\
\n\
        std::uint16_t numberOfVertices;\n\
        std::uint16_t numberOfEdges;\n\
\n\
        std::cin >> numberOfVertices >> numberOfEdges;\n\
\n\
        for ( auto i{ 0 }; i < numberOfEdges; ++i )\n\
        {\n\
            Vertex from;\n\
            Vertex to;\n\
            Cost   cost;\n\
\n\
            std::cin >> from >> to >> cost;\n\
            graph[ from ].emplace_back( to, cost );\n\
        }\n\
\n\
        Vertex start;\n\
        Vertex end;\n\
\n\
        std::cin >> start >> end;\n\
\n\
        auto const result{ dijkstra( start, end, graph, costTable ) };\n\
\n\
        if ( result == kInfiniteCost )\n\
        {\n\
            std::cout << \"NO\\n\";\n\
        }\n\
        else\n\
        {\n\
            std::cout << result << '\\n';\n\
        }\n\
    }\n\
\n\
    return 0;\n\
}\n\
";

const DEFAULT_STDIN = "\
3\n\
3 2\n\
1 2 5\n\
2 3 7\n\
1 3\n\
3 3\n\
1 2 4\n\
1 3 7\n\
2 3 1\n\
1 3\n\
3 1\n\
1 2 4\n\
1 3\n\
";

const DEFAULT_COMPILER_OPTIONS = "";
const DEFAULT_CMD_ARGUMENTS = "";
const DEFAULT_LANGUAGE_ID = 105; // C++ (GCC 14.1.0) (https://ce.judge0.com/languages/105)

function getEditorLanguageMode(languageName) {
    const DEFAULT_EDITOR_LANGUAGE_MODE = "plaintext";
    const LANGUAGE_NAME_TO_LANGUAGE_EDITOR_MODE = {
        "Bash": "shell",
        "C": "c",
        "C3": "c",
        "C#": "csharp",
        "C++": "cpp",
        "Clojure": "clojure",
        "F#": "fsharp",
        "Go": "go",
        "Java": "java",
        "JavaScript": "javascript",
        "Kotlin": "kotlin",
        "Objective-C": "objective-c",
        "Pascal": "pascal",
        "Perl": "perl",
        "PHP": "php",
        "Python": "python",
        "R": "r",
        "Ruby": "ruby",
        "SQL": "sql",
        "Swift": "swift",
        "TypeScript": "typescript",
        "Visual Basic": "vb"
    }

    for (let key in LANGUAGE_NAME_TO_LANGUAGE_EDITOR_MODE) {
        if (languageName.toLowerCase().startsWith(key.toLowerCase())) {
            return LANGUAGE_NAME_TO_LANGUAGE_EDITOR_MODE[key];
        }
    }
    return DEFAULT_EDITOR_LANGUAGE_MODE;
}

const EXTENSIONS_TABLE = {
    "asm": { "flavor": CE, "language_id": 45 }, // Assembly (NASM 2.14.02)
    "c": { "flavor": CE, "language_id": 103 }, // C (GCC 14.1.0)
    "cpp": { "flavor": CE, "language_id": 105 }, // C++ (GCC 14.1.0)
    "cs": { "flavor": EXTRA_CE, "language_id": 29 }, // C# (.NET Core SDK 7.0.400)
    "go": { "flavor": CE, "language_id": 95 }, // Go (1.18.5)
    "java": { "flavor": CE, "language_id": 91 }, // Java (JDK 17.0.6)
    "js": { "flavor": CE, "language_id": 102 }, // JavaScript (Node.js 22.08.0)
    "lua": { "flavor": CE, "language_id": 64 }, // Lua (5.3.5)
    "pas": { "flavor": CE, "language_id": 67 }, // Pascal (FPC 3.0.4)
    "php": { "flavor": CE, "language_id": 98 }, // PHP (8.3.11)
    "py": { "flavor": EXTRA_CE, "language_id": 25 }, // Python for ML (3.11.2)
    "r": { "flavor": CE, "language_id": 99 }, // R (4.4.1)
    "rb": { "flavor": CE, "language_id": 72 }, // Ruby (2.7.0)
    "rs": { "flavor": CE, "language_id": 73 }, // Rust (1.40.0)
    "scala": { "flavor": CE, "language_id": 81 }, // Scala (2.13.2)
    "sh": { "flavor": CE, "language_id": 46 }, // Bash (5.0.0)
    "swift": { "flavor": CE, "language_id": 83 }, // Swift (5.2.3)
    "ts": { "flavor": CE, "language_id": 101 }, // TypeScript (5.6.2)
    "txt": { "flavor": CE, "language_id": 43 }, // Plain Text
};

function getLanguageForExtension(extension) {
    return EXTENSIONS_TABLE[extension] || { "flavor": CE, "language_id": 43 }; // Plain Text (https://ce.judge0.com/languages/43)
}

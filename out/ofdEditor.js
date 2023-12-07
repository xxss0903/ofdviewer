"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OfdEditorProvider = void 0;
const vscode = require("vscode");
const dispose_1 = require("./dispose");
const util_1 = require("./util");
class OfdDocument extends dispose_1.Disposable {
    constructor(uri, initialContent, delegate) {
        super();
        this._onDidDispose = this._register(new vscode.EventEmitter());
        /**
         * Fired when the document is disposed of.
         */
        this.onDidDispose = this._onDidDispose.event;
        this._onDidChangeDocument = this._register(new vscode.EventEmitter());
        /**
         * Fired to notify webviews that the document has changed.
         */
        this.onDidChangeContent = this._onDidChangeDocument.event;
        this._onDidChange = this._register(new vscode.EventEmitter());
        /**
         * Fired to tell VS Code that an edit has occurred in the document.
         *
         * This updates the document's dirty indicator.
         */
        this.onDidChange = this._onDidChange.event;
        this._uri = uri;
        this._documentData = initialContent;
        this._delegate = delegate;
    }
    static async create(uri, backupId, delegate) {
        // If we have a backup, read that. Otherwise read the resource from the workspace
        const dataFile = typeof backupId === "string" ? vscode.Uri.parse(backupId) : uri;
        const fileData = await OfdDocument.readFile(dataFile);
        return new OfdDocument(uri, fileData, delegate);
    }
    static async readFile(uri) {
        if (uri.scheme === "untitled") {
            return new Uint8Array();
        }
        const result = new Uint8Array(await vscode.workspace.fs.readFile(uri))
            .buffer;
        console.log("ofdeditor read file", uri);
        console.log("ofdeditor read file", result);
        return result;
    }
    get uri() {
        return this._uri;
    }
    get documentData() {
        return this._documentData;
    }
    // 再webview对ofd文件进行修改调用
    makeEdit() {
        console.log("ofd editor make edit");
    }
    dispose() {
        this._onDidDispose.fire();
        super.dispose();
    }
}
/**
 * Provider for cat scratch editors.
 *
 * Cat scratch editors are used for `.cscratch` files, which are just json files.
 * To get started, run this extension and open an empty `.cscratch` file in VS Code.
 *
 * This provider demonstrates:
 *
 * - Setting up the initial webview for a custom editor.
 * - Loading scripts and styles in a custom editor.
 * - Synchronizing changes between a text document and a custom editor.
 */
class OfdEditorProvider {
    static register(context) {
        return vscode.window.registerCustomEditorProvider(OfdEditorProvider.viewType, new OfdEditorProvider(context), {
            // For this demo extension, we enable `retainContextWhenHidden` which keeps the
            // webview alive even when it is not visible. You should avoid using this setting
            // unless is absolutely required as it does have memory overhead.
            webviewOptions: {
                retainContextWhenHidden: true,
            },
            supportsMultipleEditorsPerDocument: false,
        });
    }
    constructor(_context) {
        this._context = _context;
        this._onDidChangeCustomDocument = new vscode.EventEmitter();
        this.onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;
        /**
         * Tracks all known webviews
         */
        this.webviews = new WebviewCollection();
        this._requestId = 1;
        this._callbacks = new Map();
    }
    async resolveCustomEditor(document, webviewPanel, _token) {
        // Add the webview to our internal set of active webviews
        this.webviews.add(document.uri, webviewPanel);
        // Setup initial content for the webview
        webviewPanel.webview.options = {
            enableScripts: true,
        };
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);
        webviewPanel.webview.onDidReceiveMessage((e) => this.onMessage(document, e));
        // Wait for the webview to be properly ready before we init
        webviewPanel.webview.onDidReceiveMessage((e) => {
            if (e.type === "ready") {
                if (document.uri.scheme === "untitled") {
                    this.postMessage(webviewPanel, "init", {
                        untitled: true,
                        editable: true,
                    });
                }
                else {
                    const editable = vscode.workspace.fs.isWritableFileSystem(document.uri.scheme);
                    this.postMessage(webviewPanel, "init", {
                        value: document.documentData,
                        editable,
                    });
                }
            }
        });
    }
    /**
     * Get the static HTML used for in our editor's webviews.
     */
    getHtmlForWebview(webview) {
        // Local path to script and css for the webview
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "media", "ofdViewer.js"));
        const scriptOfdUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "media", "ofd.umd.js"));
        const scriptUri3 = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "media", "ofdViewerVue.js"));
        const codeMirrorJsUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "media", "codemirror5/src/codemirror.js"));
        const codeMirrorCssUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "media", "codemirror5/lib/codemirror.css"));
        const codeMirrorXmlUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "media", "codemirror5/mode/xml/xml.js"));
        console.log("package ", scriptOfdUri);
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "media", "reset.css"));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "media", "vscode.css"));
        const styleMainUri = webview.asWebviewUri(vscode.Uri.joinPath(this._context.extensionUri, "media", "ofdViewer.css"));
        // Use a nonce to whitelist which scripts can be run
        const nonce = (0, util_1.getNonce)();
        const nonce2 = (0, util_1.getNonce)();
        console.log("get nonce", nonce, nonce2);
        return /* html */ `
				<!DOCTYPE html>
				<html lang="en">
				<head>
					<meta charset="UTF-8">
	
					<!--
					Use a content security policy to only allow loading images from https or from our extension directory,
					and only allow scripts that have a specific nonce.
					-->
					<meta http-equiv="Content-Security-Policy" content="default-src * 'self' 'unsafe-inline' 'unsafe-eval' data: gap: content: https://xxx.com;media-src * blob: 'self' http://* 'unsafe-inline' 'unsafe-eval';style-src * 'self' 'unsafe-inline';img-src * 'self' data: content:;connect-src * blob:;">

					<meta name="viewport" content="width=device-width, initial-scale=1.0">
	
					<link href="${styleResetUri}" rel="stylesheet" />
					<link href="${styleVSCodeUri}" rel="stylesheet" />
					<link href="${styleMainUri}" rel="stylesheet" />
					<link href="${codeMirrorCssUri}" rel="stylesheet" />
					<link href="${codeMirrorCssUri}" rel="stylesheet" />
					<title>Paw Draw</title>

          <script src="https://cdn.staticfile.org/vue/3.2.36/vue.global.min.js"></script>
          <script type="module" src="${codeMirrorJsUri}"></script>
          <script type="module" src="${codeMirrorXmlUri}"></script>
				</head>
				<body>
					<div id="app">
            <div ref="ofdContainerRef" id="ofd-container"></div>
            <div ref="ofdDataRef" id="ofd-data">
              <textarea ref="codeMirrorRef" id="code-mirror"></textarea>
            </div>
          </div>

          
					<script type="module" src="${scriptOfdUri}"></script>
					<script type="module" src="${scriptUri}"></script>
					<script type="module" src="${scriptUri3}"></script>
				</body>
				</html>`;
    }
    postMessageWithResponse(panel, type, body) {
        const requestId = this._requestId++;
        const p = new Promise((resolve) => this._callbacks.set(requestId, resolve));
        panel.webview.postMessage({ type, requestId, body });
        return p;
    }
    postMessage(panel, type, body) {
        panel.webview.postMessage({ type, body });
    }
    onMessage(document, message) {
        console.log("ofdeditor onMessage", message);
        switch (message.type) {
            case "openOfdError":
                vscode.window.showErrorMessage("打开OFD文件错误：" + message.error);
                return;
        }
    }
    saveCustomDocument(document, cancellation) {
        console.log("ofdeditor saveCustomDocument");
        throw new Error("Method not implemented.");
    }
    saveCustomDocumentAs(document, destination, cancellation) {
        console.log("ofdeditor saveCustomDocumentAs");
        throw new Error("Method not implemented.");
    }
    revertCustomDocument(document, cancellation) {
        console.log("ofdeditor revertCustomDocument");
        throw new Error("Method not implemented.");
    }
    backupCustomDocument(document, context, cancellation) {
        console.log("ofdeditor backupCustomDocument");
        throw new Error("Method not implemented.");
    }
    // 打开文档
    async openCustomDocument(uri, openContext, token) {
        console.log("ofdeditor openCustomDocument");
        const document = await OfdDocument.create(uri, openContext.backupId, {
            getFileData: async () => {
                console.log("ofdeditor getfile data");
                const webviewsForDocument = Array.from(this.webviews.get(document.uri));
                if (!webviewsForDocument.length) {
                    throw new Error("Could not find webview to save for");
                }
                const panel = webviewsForDocument[0];
                const response = await this.postMessageWithResponse(panel, "getFileData", {});
                console.log("open file response", response);
                const ua = new Uint8Array(response);
                const arrayBuffer = ua.buffer;
                console.log("ofdeditor file arraybuffer ", arrayBuffer);
                return arrayBuffer;
            },
        });
        const listeners = [];
        listeners.push(document.onDidChange((e) => {
            // Tell VS Code that the document has been edited by the use.
            this._onDidChangeCustomDocument.fire({
                document,
                ...e,
            });
        }));
        listeners.push(document.onDidChangeContent((e) => {
            // Update all webviews when the document changes
            for (const webviewPanel of this.webviews.get(document.uri)) {
                this.postMessage(webviewPanel, "update", {
                    content: e.content,
                });
            }
        }));
        document.onDidDispose(() => (0, dispose_1.disposeAll)(listeners));
        return document;
    }
}
exports.OfdEditorProvider = OfdEditorProvider;
OfdEditorProvider.viewType = "com.xxss0903.ofdviewer";
/**
 * Tracks all webviews.
 */
class WebviewCollection {
    constructor() {
        this._webviews = new Set();
    }
    /**
     * Get all known webviews for a given uri.
     */
    *get(uri) {
        const key = uri.toString();
        for (const entry of this._webviews) {
            if (entry.resource === key) {
                yield entry.webviewPanel;
            }
        }
    }
    /**
     * Add a new webview to the collection.
     */
    add(uri, webviewPanel) {
        const entry = { resource: uri.toString(), webviewPanel };
        this._webviews.add(entry);
        webviewPanel.onDidDispose(() => {
            this._webviews.delete(entry);
        });
    }
}
//# sourceMappingURL=ofdEditor.js.map
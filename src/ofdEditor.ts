import * as vscode from "vscode";
import { Disposable, disposeAll } from "./dispose";
import { getNonce } from "./util";
import { resolve } from "path";
import { readFileSync } from "fs";

// ofd的文档类型
interface OfdDocumentDelegate {
  getFileData(): Promise<ArrayBuffer>;
}

class OfdDocument extends Disposable implements vscode.CustomDocument {
  private readonly _uri: vscode.Uri;
  private _documentData: ArrayBuffer; // ofd的文件数据
  private readonly _delegate: OfdDocumentDelegate;
  private constructor(
    uri: vscode.Uri,
    initialContent: ArrayBuffer,
    delegate: OfdDocumentDelegate
  ) {
    super();
    this._uri = uri;
    this._documentData = initialContent;
    this._delegate = delegate;
  }

  static async create(
    uri: vscode.Uri,
    backupId: string | undefined,
    delegate: OfdDocumentDelegate
  ): Promise<OfdDocument | PromiseLike<OfdDocument>> {
    // If we have a backup, read that. Otherwise read the resource from the workspace
    const dataFile =
      typeof backupId === "string" ? vscode.Uri.parse(backupId) : uri;
    const fileData = await OfdDocument.readFile(dataFile);
    return new OfdDocument(uri, fileData, delegate);
  }

  private static async readFile(uri: vscode.Uri): Promise<ArrayBuffer> {
    if (uri.scheme === "untitled") {
      return new Uint8Array();
    }
    const result = new Uint8Array(await vscode.workspace.fs.readFile(uri))
      .buffer;
    console.log("ofdeditor read file", uri);
    console.log("ofdeditor read file", result);
    return result;
  }

  public get uri() {
    return this._uri;
  }

  public get documentData(): ArrayBuffer {
    return this._documentData;
  }

  private readonly _onDidDispose = this._register(
    new vscode.EventEmitter<void>()
  );
  /**
   * Fired when the document is disposed of.
   */
  public readonly onDidDispose = this._onDidDispose.event;

  private readonly _onDidChangeDocument = this._register(
    new vscode.EventEmitter<{
      readonly content?: Uint8Array;
    }>()
  );
  /**
   * Fired to notify webviews that the document has changed.
   */
  public readonly onDidChangeContent = this._onDidChangeDocument.event;
  private readonly _onDidChange = this._register(
    new vscode.EventEmitter<{
      readonly label: string;
      undo(): void;
      redo(): void;
    }>()
  );
  /**
   * Fired to tell VS Code that an edit has occurred in the document.
   *
   * This updates the document's dirty indicator.
   */
  public readonly onDidChange = this._onDidChange.event;

  // 再webview对ofd文件进行修改调用
  makeEdit() {
    console.log("ofd editor make edit");
  }

  public dispose() {
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
export class OfdEditorProvider
  implements vscode.CustomEditorProvider<OfdDocument>
{
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<OfdDocument>
  >();
  public readonly onDidChangeCustomDocument =
    this._onDidChangeCustomDocument.event;

  private static readonly viewType = "com.xxss0903.ofdviewer";

  public static register(context: vscode.ExtensionContext): vscode.Disposable {
  
    return vscode.window.registerCustomEditorProvider(
      OfdEditorProvider.viewType,
      new OfdEditorProvider(context),
      {
        // For this demo extension, we enable `retainContextWhenHidden` which keeps the
        // webview alive even when it is not visible. You should avoid using this setting
        // unless is absolutely required as it does have memory overhead.
        webviewOptions: {
          retainContextWhenHidden: true,
        },
        supportsMultipleEditorsPerDocument: false,
      }
    );
  }

  /**
   * Tracks all known webviews
   */
  private readonly webviews = new WebviewCollection();
  constructor(private readonly _context: vscode.ExtensionContext) {}

  async resolveCustomEditor(
    document: OfdDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Add the webview to our internal set of active webviews
    this.webviews.add(document.uri, webviewPanel);

    // Setup initial content for the webview
    webviewPanel.webview.options = {
      enableScripts: true,
    };
    webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

    webviewPanel.webview.onDidReceiveMessage((e) =>
      this.onMessage(document, e)
    );

    // Wait for the webview to be properly ready before we init
    webviewPanel.webview.onDidReceiveMessage((e) => {
      if (e.type === "ready") {
        if (document.uri.scheme === "untitled") {
          this.postMessage(webviewPanel, "init", {
            untitled: true,
            editable: true,
          });
        } else {
          const editable = vscode.workspace.fs.isWritableFileSystem(
            document.uri.scheme
          );

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
  private getHtmlForWebview(webview: vscode.Webview): string {
    // Local path to script and css for the webview
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "ofdViewer.js")
    );  
    const scriptOfdUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "ofd.umd.js")
    );
    const scriptUri3 = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "ofdViewerVue.js")
    ); 
     const codeMirrorJsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "codemirror5/src/codemirror.js")
    );   
      const codeMirrorCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "codemirror5/lib/codemirror.css")
    );    
      const codeMirrorXmlUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "codemirror5/mode/xml/xml.js")
    );
    console.log("package ", scriptOfdUri);
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "reset.css")
    );

    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "vscode.css")
    );

    const styleMainUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, "media", "ofdViewer.css")
    );

    // Use a nonce to whitelist which scripts can be run
    const nonce = getNonce();
    const nonce2 = getNonce();
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

  private _requestId = 1;
  private readonly _callbacks = new Map<number, (response: any) => void>();

  private postMessageWithResponse<R = unknown>(
    panel: vscode.WebviewPanel,
    type: string,
    body: any
  ): Promise<R> {
    const requestId = this._requestId++;
    const p = new Promise<R>((resolve) =>
      this._callbacks.set(requestId, resolve)
    );
    panel.webview.postMessage({ type, requestId, body });
    return p;
  }

  private postMessage(
    panel: vscode.WebviewPanel,
    type: string,
    body: any
  ): void {
    panel.webview.postMessage({ type, body });
  }

  private onMessage(document: OfdDocument, message: any) {
    console.log("ofdeditor onMessage", message);
    switch (message.type) {
      case "openOfdError":
        vscode.window.showErrorMessage("打开OFD文件错误：" + message.error);
        return;
    }
  }

  saveCustomDocument(
    document: OfdDocument,
    cancellation: vscode.CancellationToken
  ): Thenable<void> {
    console.log("ofdeditor saveCustomDocument");
    throw new Error("Method not implemented.");
  }
  saveCustomDocumentAs(
    document: OfdDocument,
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken
  ): Thenable<void> {
    console.log("ofdeditor saveCustomDocumentAs");
    throw new Error("Method not implemented.");
  }
  revertCustomDocument(
    document: OfdDocument,
    cancellation: vscode.CancellationToken
  ): Thenable<void> {
    console.log("ofdeditor revertCustomDocument");
    throw new Error("Method not implemented.");
  }
  backupCustomDocument(
    document: OfdDocument,
    context: vscode.CustomDocumentBackupContext,
    cancellation: vscode.CancellationToken
  ): Thenable<vscode.CustomDocumentBackup> {
    console.log("ofdeditor backupCustomDocument");
    throw new Error("Method not implemented.");
  }

  // 打开文档
  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    token: vscode.CancellationToken
  ): Promise<OfdDocument> {
    console.log("ofdeditor openCustomDocument");
    const document: OfdDocument = await OfdDocument.create(
      uri,
      openContext.backupId,
      {
        getFileData: async () => {
          console.log("ofdeditor getfile data");
          const webviewsForDocument = Array.from(
            this.webviews.get(document.uri)
          );
          if (!webviewsForDocument.length) {
            throw new Error("Could not find webview to save for");
          }
          const panel = webviewsForDocument[0];
          const response = await this.postMessageWithResponse<number[]>(
            panel,
            "getFileData",
            {}
          );
          console.log("open file response", response);
          const ua = new Uint8Array(response);
          const arrayBuffer = ua.buffer;
          console.log("ofdeditor file arraybuffer ", arrayBuffer);
          return arrayBuffer;
        },
      }
    );

    const listeners: vscode.Disposable[] = [];

    listeners.push(
      document.onDidChange((e) => {
        // Tell VS Code that the document has been edited by the use.
        this._onDidChangeCustomDocument.fire({
          document,
          ...e,
        });
      })
    );

    listeners.push(
      document.onDidChangeContent((e) => {
        // Update all webviews when the document changes
        for (const webviewPanel of this.webviews.get(document.uri)) {
          this.postMessage(webviewPanel, "update", {
            content: e.content,
          });
        }
      })
    );

    document.onDidDispose(() => disposeAll(listeners));

    return document;
  }
}

/**
 * Tracks all webviews.
 */
class WebviewCollection {
  private readonly _webviews = new Set<{
    readonly resource: string;
    readonly webviewPanel: vscode.WebviewPanel;
  }>();

  /**
   * Get all known webviews for a given uri.
   */
  public *get(uri: vscode.Uri): Iterable<vscode.WebviewPanel> {
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
  public add(uri: vscode.Uri, webviewPanel: vscode.WebviewPanel) {
    const entry = { resource: uri.toString(), webviewPanel };
    this._webviews.add(entry);

    webviewPanel.onDidDispose(() => {
      this._webviews.delete(entry);
    });
  }
}

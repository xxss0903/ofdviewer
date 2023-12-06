import * as vscode from 'vscode';
import { OfdEditorProvider } from './ofdEditor';

export function activate(context: vscode.ExtensionContext) {
	// 注册ofd预览编辑器
	context.subscriptions.push(OfdEditorProvider.register(context));
}

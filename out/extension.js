"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = void 0;
const ofdEditor_1 = require("./ofdEditor");
function activate(context) {
    // 注册ofd预览编辑器
    context.subscriptions.push(ofdEditor_1.OfdEditorProvider.register(context));
}
exports.activate = activate;
//# sourceMappingURL=extension.js.map
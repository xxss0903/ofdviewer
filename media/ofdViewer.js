// (function () {
//   const vscode = acquireVsCodeApi();
//   const screenWidth = document.body.clientWidth;

//   function displayOfdElementToPage(views) {
//     let ofdContainer = document.querySelector(".ofd-container");
//     ofdContainer.innerHTML = "";
//     for (const div of views) {
//       ofdContainer.appendChild(div);
//     }
//   }

//   window.addEventListener("message", async (e) => {
//     const { type, body, requestId } = e.data;
//     // console.log("ofdeditor listen message", e.data);
//     switch (type) {
//       case "init":
//         // console.log("ofeditor html init");
//       case "update":  
//         // console.log("ofeditor html update");
//       case "getFileData":
//         // console.log("ofeditor html getFileData", body);
//         // var abBody = body.value.buffer;
//         ofd.parseOfdDocument({
//           ofd: body.value,
//           success(res) {
//             // console.log("ofdeditor success", res);
//             // 渲染ofd
//             const ofdView = ofd.renderOfd(screenWidth, res[0]);
//             //将ofd添加到html上面
//             displayOfdElementToPage(ofdView);
//           },
//           fail(error) {
//             // console.log("ofdeditor parse error", error);
//             vscode.postMessage({
//               type: 'openOfdError',
//               error: error.message
//             });
//           },
//         });
//     }
//   });
//   // Signal to VS Code that the webview is initialized.
//   // 先通知vs插件js代码准备好了，然后vscode插件会返回init方法来通知js进行自己的初始化
//   vscode.postMessage({ type: "ready" });
// })();

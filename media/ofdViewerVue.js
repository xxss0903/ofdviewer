const vscode = acquireVsCodeApi();
const screenWidth = document.body.clientWidth;

const App = {
  data() {
    return {
      message: "aabc",
      ofdData: {},
    };
  },
  methods: {
    initOfdFile(path) {
      console.log("init ofd file", path);
    },
    displayOfdElementToPage(context, views) {
      context.$refs.ofdContainerRef.innerHTML = "";
      for (const div of views) {
        context.$refs.ofdContainerRef.appendChild(div);
      }
    },
    initialOfdData(context, data) {
      console.log("ofd data", data);
	  context.$refs.ofdDataRef.innerHTML = data;
    },
    listenPluginMessage() {
      let _this = this;
      window.addEventListener("message", async (e) => {
        console.log("window listener", e);
        const { type, body, requestId } = e.data;
        switch (type) {
          case "init":
          case "update":
          case "getFileData":
            ofd.parseOfdDocument({
              ofd: body.value,
              success(res) {
                _this.ofdData = res;
                _this.initialOfdData(_this, res);
                // 渲染ofd
                const ofdView = ofd.renderOfd(screenWidth, res[0]);
                //将ofd添加到html上面
                _this.displayOfdElementToPage(_this, ofdView);
              },
              fail(error) {
                vscode.postMessage({
                  type: "openOfdError",
                  error: error.message,
                });
              },
            });
        }
      });
    },
  },
  mounted() {
    console.log("vue mounted");
    this.listenPluginMessage();
    vscode.postMessage({ type: "ready" });
  },
};

Vue.createApp(App).mount("#app");

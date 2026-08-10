import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

// Surface uncaught async / effect errors (which React error boundaries do NOT
// catch) as a visible message instead of a silent blank white screen.
function showFatal(msg: string) {
  const el = document.getElementById("root");
  if (el) {
    el.innerHTML = `<pre style="padding:24px;color:#b91c1c;white-space:pre-wrap;font-family:monospace;line-height:1.6">页面运行时出错（请把这段发我）：\n\n${String(
      msg
    )}</pre>`;
  }
}
window.addEventListener("error", (e) => {
  showFatal((e.message || "error") + "\n" + (e.error && e.error.stack ? e.error.stack : ""));
});
window.addEventListener("unhandledrejection", (e) => {
  const r = e.reason;
  showFatal("Promise 未处理: " + (r && r.stack ? r.stack : r));
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);

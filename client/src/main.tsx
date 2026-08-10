import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

// Surface uncaught async / effect errors (which React error boundaries do NOT
// catch) as a visible message instead of a silent blank white screen.
function safeText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (value instanceof Error) return (value.stack || value.message || String(value)) + "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
function showFatal(msg: string) {
  const el = document.getElementById("root");
  if (el) {
    el.innerHTML = `<pre style="padding:24px;color:#b91c1c;white-space:pre-wrap;font-family:monospace;line-height:1.6">页面运行时出错（请把这段发我）：\n\n${String(
      msg
    )}</pre>`;
  }
}
window.addEventListener("error", (e) => {
  showFatal(safeText(e.message) + "\n" + safeText(e.error));
});
window.addEventListener("unhandledrejection", (e) => {
  showFatal("Promise 未处理: " + safeText(e.reason));
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

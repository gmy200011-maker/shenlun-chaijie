import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  componentStack?: string;
}

// Safely coerce anything (including non-Error objects, which some libs throw)
// into a human-readable string. NEVER pass a raw object as a React child —
// that triggers React error #31 ("Objects are not valid as a React child").
function safeText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (value instanceof Error) return value.stack || value.message || String(value);
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// Catches render-time (and effect) exceptions anywhere below it and shows a
// readable message instead of a blank white screen. This is what turns the
// "page is completely blank" symptom into an actual, debuggable error.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    // Normalize whatever was thrown into a real Error so the rest of the
    // code can rely on `.message`/`.stack` being strings.
    const err =
      error instanceof Error
        ? error
        : new Error(safeText(error));
    return { error: err };
  }

  componentDidCatch(error: unknown, errorInfo: { componentStack?: string }) {
    // Surface in the dev console as well
    console.error("App render error:", error, errorInfo);
    this.setState({ componentStack: errorInfo?.componentStack || "" });
  }

  render() {
    if (this.state.error) {
      const message = this.state.error.message || safeText(this.state.error);
      const stack = safeText(this.state.error.stack);
      const componentStack = this.state.componentStack || "";
      return (
        <div
          style={{
            padding: "24px",
            fontFamily: "monospace",
            whiteSpace: "pre-wrap",
            color: "#b91c1c",
            lineHeight: 1.6,
          }}
        >
          <h2 style={{ marginTop: 0 }}>页面出错了（请把下面这段发我）</h2>
          <div style={{ fontWeight: "bold", marginBottom: 12 }}>{String(message)}</div>
          <div style={{ fontSize: 12, color: "#7f1d1d", marginBottom: 12 }}>{String(stack)}</div>
          <div style={{ fontSize: 12, color: "#7f1d1d" }}>
            <div style={{ fontWeight: "bold", marginBottom: 4 }}>组件栈：</div>
            {String(componentStack)}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

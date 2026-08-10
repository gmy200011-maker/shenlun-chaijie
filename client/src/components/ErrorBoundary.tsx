import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
  componentStack?: string;
}

// Catches render-time (and effect) exceptions anywhere below it and shows a
// readable message instead of a blank white screen. This is what turns the
// "page is completely blank" symptom into an actual, debuggable error.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string }) {
    // Surface in the dev console as well
    console.error("App render error:", error, errorInfo);
    this.setState({ componentStack: errorInfo?.componentStack });
  }

  render() {
    if (this.state.error) {
      const { message, stack } = this.state.error;
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
          <div style={{ fontWeight: "bold", marginBottom: 12 }}>{message}</div>
          <div style={{ fontSize: 12, color: "#7f1d1d", marginBottom: 12 }}>{stack}</div>
          <div style={{ fontSize: 12, color: "#7f1d1d" }}>
            <div style={{ fontWeight: "bold", marginBottom: 4 }}>组件栈：</div>
            {componentStack}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

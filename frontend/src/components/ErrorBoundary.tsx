import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render errors and shows a branded fallback instead of a white screen. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error("Unhandled render error:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <img src="/brand/icon-robot-lime.svg" alt="" className="w-20 h-auto mb-6 opacity-90" />
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400 mb-2">
            Something went wrong
          </p>
          <h1 className="text-2xl font-bold text-brand-navy">This page hit an error</h1>
          <p className="text-sm text-gray-500 mt-2 max-w-sm break-words">
            {this.state.error.message}
          </p>
          <button
            onClick={() => {
              this.setState({ error: null });
              window.location.reload();
            }}
            className="mt-6 px-4 py-2 bg-brand-navy text-white rounded-lg text-sm font-medium hover:bg-brand-navy-700"
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

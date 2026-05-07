import { Component } from 'react';

interface Props { children: React.ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) { return { error }; }

  render() {
    if (this.state.error) {
      return (
        <div className="flex-1 flex items-center justify-center bg-[#1e1b2e]">
          <div className="text-center p-8">
            <p className="text-red-400 font-bold mb-2">Something went wrong</p>
            <p className="text-xs text-[#6b6580] mb-4">{this.state.error.message}</p>
            <button
              onClick={() => this.setState({ error: null })}
              className="px-4 py-2 rounded-lg bg-purple-700 text-white text-sm font-bold
                         hover:bg-purple-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

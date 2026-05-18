import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  reset = () => {
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div dir="rtl" className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
          <div className="max-w-md w-full bg-white rounded-lg shadow p-6 text-center">
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">משהו השתבש</h1>
            <p className="text-slate-600 mb-4">אירעה שגיאה לא צפויה. נסה לרענן את הדף.</p>
            <button
              onClick={this.reset}
              className="bg-slate-900 text-white px-6 py-3 rounded-md font-medium hover:bg-slate-800 min-h-[44px]"
            >
              רענן דף
            </button>
            {import.meta.env.DEV && (
              <pre className="mt-4 text-xs text-left bg-slate-100 p-2 rounded overflow-auto text-red-600">
                {this.state.error?.message}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ClassPulse Error Boundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mesh-bg min-screen flex items-center justify-center p-8 text-center text-on-surface">
          <div className="max-w-xs space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 rounded-full bg-error/20 flex items-center justify-center mx-auto border border-error/30 shadow-[0_0_40px_rgba(255,110,132,0.2)]">
              <span className="material-symbols-outlined text-error text-4xl">emergency_home</span>
            </div>
            <div className="space-y-2">
              <h1 className="font-headline font-black text-2xl tracking-tight uppercase">System Hiccup</h1>
              <p className="text-on-surface-variant text-sm font-medium leading-relaxed">
                Something went wrong with the session. We've notified the system.
              </p>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-4 rounded-2xl bg-white text-black font-black uppercase tracking-widest text-xs shadow-xl active:scale-95 transition-all"
            >
              Restart Portal
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

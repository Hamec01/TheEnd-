import React from 'react';

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('App crashed:', error, info);
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          padding: 24,
          background: '#120f0b',
          color: '#f3e4c8',
          fontFamily: 'sans-serif',
        }}>
          <h1>Ошибка интерфейса</h1>
          <p>Игра не должна показывать пустой экран. Ошибка ниже:</p>
          <pre style={{
            whiteSpace: 'pre-wrap',
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid rgba(210,170,102,0.35)',
            padding: 16,
            borderRadius: 8,
          }}>
            {this.state.error.message}
          </pre>
          <button
            type="button"
            onClick={() => window.location.href = '/'}
            style={{
              marginTop: 16,
              padding: '10px 14px',
              borderRadius: 6,
              border: '1px solid #d2aa66',
              background: '#2a2118',
              color: '#f3e4c8',
              cursor: 'pointer',
            }}
          >
            Вернуться в игру
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AdminSectionErrorBoundaryProps {
  sectionName: string;
  onReset?: () => void;
  children: ReactNode;
}

interface AdminSectionErrorBoundaryState {
  error: Error | null;
  details: string;
}

export class AdminSectionErrorBoundary extends Component<AdminSectionErrorBoundaryProps, AdminSectionErrorBoundaryState> {
  state: AdminSectionErrorBoundaryState = { error: null, details: '' };

  static getDerivedStateFromError(error: Error): AdminSectionErrorBoundaryState {
    return { error, details: error?.stack ?? String(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, details: `${error?.stack ?? String(error)}\n\n${info.componentStack ?? ''}`.trim() });
  }

  private reset = () => {
    this.setState({ error: null, details: '' });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="admin-panel error">
        <h3>Ошибка в разделе: {this.props.sectionName}</h3>
        <p>Компонент не смог отобразить выбранную запись. Данные не удалены.</p>
        <p className="muted">Техническая ошибка: {this.state.error.message}</p>
        <div className="admin-row">
          <button type="button" onClick={this.reset}>Сбросить</button>
        </div>
        <details>
          <summary>Технические детали</summary>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.details}</pre>
        </details>
      </div>
    );
  }
}


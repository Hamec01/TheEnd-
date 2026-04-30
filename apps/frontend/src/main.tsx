import React from 'react';
import ReactDOM from 'react-dom/client';
import { RootApp } from './RootApp';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <RootApp />
    </AppErrorBoundary>
  </React.StrictMode>,
);

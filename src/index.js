import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Global unhandled promise rejection handler
// Prevents silent crashes from async errors
window.addEventListener('unhandledrejection', event => {
  console.error('Unhandled promise rejection:', event.reason);
  // Don't show alert to users — just log it
  event.preventDefault();
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);

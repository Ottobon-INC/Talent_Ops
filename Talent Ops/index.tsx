import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

console.log('[index.tsx] Module loading...');

window.onerror = function(message, source, lineno, colno, error) {
    console.error("GLOBAL ERROR:", message, error);
    document.body.innerHTML += `<div style="color:red; z-index:99999; position:relative; background:white; padding:10px;">GLOBAL ERROR: ${message}</div>`;
};
window.onunhandledrejection = function(event) {
    console.error("UNHANDLED PROMISE REJECTION:", event.reason);
    document.body.innerHTML += `<div style="color:red; z-index:99999; position:relative; background:white; padding:10px;">UNHANDLED PROMISE: ${event.reason}</div>`;
};

const rootElement = document.getElementById('root');
if (!rootElement) {
    const msg = "FATAL: #root element not found in DOM!";
    console.error(msg);
    document.body.innerHTML = `<h1 style="color:red; padding:20px;">${msg}</h1>`;
} else {
    try {
        console.log('[index.tsx] Creating root...');
        const root = ReactDOM.createRoot(rootElement);
        console.log('[index.tsx] Rendering App...');
        root.render(<App />);
    } catch (err) {
        console.error('[index.tsx] Render error:', err);
        document.body.innerHTML = `<h1 style="color:red; padding:20px;">RENDER ERROR: ${err.message}</h1>`;
    }
}

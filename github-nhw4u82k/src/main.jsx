import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Request persistent storage so iOS does not silently purge IndexedDB.
// This only takes effect when the app is installed to the home screen as a PWA.
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

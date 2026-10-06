import React from 'react';
import ReactDOM from 'react-dom/client';

import App from '@/App';

// Self-hosted type. Subsets are latin-only so nothing is downloaded that the
// page never renders, and both files ship font-display: swap.
import '@fontsource/geist-sans/latin-400.css';
import '@fontsource/geist-sans/latin-500.css';
import '@fontsource/geist-sans/latin-600.css';
import '@fontsource/geist-sans/latin-700.css';
import '@fontsource-variable/geist-mono/wght.css';

import '@/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
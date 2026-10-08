import React from 'react';
import ReactDOM from 'react-dom/client';

import App from '@/App';

// Self-hosted variable fonts. Inter covers the whole UI weight range in one
// @font-face; JetBrains Mono is reserved for machine output (paths, branches,
// hashes, scores). Both ship font-display: swap and no runtime font request.
import '@fontsource-variable/inter/wght.css';
import '@fontsource-variable/jetbrains-mono/wght.css';

import '@/index.css';

const rootEl = document.getElementById('root')!;

// The `/` route is served from index.html, whose <div id="root"> already
// holds the fully rendered landing (committed in prerender/ and injected at
// build time). That markup exists for crawlers and no-JS readers: it is the
// only version of the page they ever see. We deliberately do NOT hydrate it.
//
// Hydration is impossible for this page: the snapshot captures the maps and
// counters *after* the d3 simulation and count-ups ran, while React 18.3
// treats any hydrated attribute or text mismatch (line x1="0" vs a settled
// coordinate, a useId value, a counted number) as a hard error that discards
// the whole tree anyway. So the SPA mounts normally and replaces the static
// DOM in one pass; visually the page paints instantly from the snapshot, then
// the map re-animates once the bundle is ready, which is the landing's normal
// load behaviour.
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

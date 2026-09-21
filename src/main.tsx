import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

const HorseLab = lazy(() => import('./horse/HorseLab'));
const horse = new URLSearchParams(location.search).get('lab') === 'horse';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {horse ? <Suspense fallback={<p style={{ padding: 32 }}>正在载入马匹实验…</p>}><HorseLab /></Suspense> : <App />}
  </React.StrictMode>,
);

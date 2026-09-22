import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

const HorseLab = lazy(() => import('./horse/HorseLab'));
const RidingLab = lazy(() => import('./riding/RidingLab'));
const lab = new URLSearchParams(location.search).get('lab');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Suspense fallback={<p style={{ padding: 32 }}>正在载入工坊…</p>}>
      {lab === 'riding' ? <RidingLab /> : lab === 'horse' ? <HorseLab /> : <App />}
    </Suspense>
  </React.StrictMode>,
);

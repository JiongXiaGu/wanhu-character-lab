import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

const MountLab = lazy(() => import('./mounts/MountLab'));
const RidingLab = lazy(() => import('./riding/RidingLab'));
const lab = new URLSearchParams(location.search).get('lab');
// 旧?lab=horse仍进入同一坐骑本体页，不保留第二套马专用工作台。
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {lab === 'horse' || lab === 'mount' ? <Suspense fallback={<p style={{ padding: 32 }}>正在载入坐骑工坊…</p>}><MountLab /></Suspense> : lab === 'riding' ? <Suspense fallback={<p style={{ padding: 32 }}>正在载入骑乘试衣…</p>}><RidingLab /></Suspense> : <App />}
  </React.StrictMode>,
);

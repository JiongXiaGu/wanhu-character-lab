import React, { lazy, Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

const MountLab = lazy(() => import('./mounts/MountLab'));
const RidingLab = lazy(() => import('./riding/RidingLab'));
const LivestockLab = lazy(() => import('./livestock/LivestockLab'));
const lab = new URLSearchParams(location.search).get('lab');
// 旧?lab=horse仍进入同一坐骑本体页；家畜独立于坐骑与人物协议。
const workspace = lab === 'horse' || lab === 'mount' ? <MountLab /> : lab === 'riding' ? <RidingLab /> : lab === 'livestock' ? <LivestockLab /> : <App />;
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><Suspense fallback={<p style={{ padding: 32 }}>正在载入工坊…</p>}>{workspace}</Suspense></React.StrictMode>,
);

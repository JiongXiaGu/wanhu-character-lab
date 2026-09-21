import React, { lazy, Suspense, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { createPortal } from 'react-dom';
import App from './App';
import './styles.css';

const HorseLab = lazy(() => import('./horse/HorseLab'));
/** 入口附在原页导航，不让马进入Recipe、换装状态或人物Viewport。 */
function CharacterEntry() {
  const [navigation, setNavigation] = useState<Element | null>(null);
  useEffect(() => { setNavigation(document.querySelector('.header-right')); }, []);
  return <><App />{navigation && createPortal(<a href="?lab=horse" style={{ color: '#c9aa77', fontSize: 12, whiteSpace: 'nowrap', textDecoration: 'none', padding: '8px 4px' }}>马匹实验 ↗</a>, navigation)}</>;
}
const horse = new URLSearchParams(location.search).get('lab') === 'horse';
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {horse ? <Suspense fallback={<p style={{ padding: 32 }}>正在载入马匹实验…</p>}><HorseLab /></Suspense> : <CharacterEntry />}
  </React.StrictMode>,
);

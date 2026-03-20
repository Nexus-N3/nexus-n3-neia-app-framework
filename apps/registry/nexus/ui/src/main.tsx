import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyDisplayProfile } from './utils/displayProfiles';
import './index.css';

type MountFn = (el: HTMLElement) => void;

applyDisplayProfile();
window.addEventListener('resize', applyDisplayProfile);

const mount: MountFn = (el) => {
  const root = ReactDOM.createRoot(el);
  root.render(<App />);
};

if (typeof globalThis !== 'undefined') {
  globalThis.NexusMount = mount;
}

const appMountEl = document.getElementById('app-mount');
const rootEl = document.getElementById('root');
if (!appMountEl && rootEl) {
  mount(rootEl);
}

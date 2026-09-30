import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AdminApp from './AdminApp.jsx';
import '../index.css';
import './admin.css';

// Bewusst ohne Service Worker: die Admin-Seite soll immer frisch vom Server
// kommen und nicht als App installierbar sein.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>
);

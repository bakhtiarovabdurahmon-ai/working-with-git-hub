import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import './index.css';
import App from './App.jsx';
import { StoreProvider } from './store.jsx';
import { AuthProvider } from './auth.jsx';
import { OrdersProvider } from './orders.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <StoreProvider>
          <OrdersProvider>
            <App />
          </OrdersProvider>
        </StoreProvider>
      </AuthProvider>
    </HashRouter>
  </StrictMode>
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { SettingsProvider } from './hooks/useSettings';
import { PriceProvider } from './hooks/usePrices';
import { CoinsProvider } from './hooks/useCoins';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <PriceProvider>
        <CoinsProvider>
          <App />
        </CoinsProvider>
      </PriceProvider>
    </SettingsProvider>
  </StrictMode>,
);

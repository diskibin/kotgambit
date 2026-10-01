import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import '@fontsource/onest/400.css';
import '@fontsource/onest/500.css';
import '@fontsource/onest/600.css';
import '@fontsource/onest/700.css';
import '@fontsource/onest/800.css';
import '@fontsource/unbounded/700.css';
import { App } from './App';
import { store } from './app/store';
import './styles/index.css';
import './shared/i18n';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root not found');

createRoot(root).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
);

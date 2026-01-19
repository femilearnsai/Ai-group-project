import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <ThemeProvider>
      <App />
    </ThemeProvider>
  );
}

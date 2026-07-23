import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { App } from './App';
import { CourseProvider } from './context/CourseContext';
import { Toaster } from './components/ui/toaster';
import { queryClient } from './lib/queryClient';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root 엘리먼트를 찾을 수 없습니다.');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <CourseProvider>
        <App />
        <Toaster />
      </CourseProvider>
    </QueryClientProvider>
  </StrictMode>
);

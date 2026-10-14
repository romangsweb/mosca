import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relativa: el build funciona servido desde cualquier carpeta (GitHub Pages, Vercel, Hall).
export default defineConfig({ plugins: [react()], base: './', server: { port: 5173 } });

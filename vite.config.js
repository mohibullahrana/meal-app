import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// IMPORTANT: change 'meal-app' to YOUR GitHub repository name
export default defineConfig({
  base: '/meal-app/',
  plugins: [react(), tailwindcss()],
});

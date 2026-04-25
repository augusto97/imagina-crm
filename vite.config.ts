import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { v4wp } from '@kucrut/vite-for-wp';
import path from 'node:path';

export default defineConfig({
    plugins: [
        v4wp({
            input: 'app/main.tsx',
            outDir: 'dist',
        }),
        react(),
    ],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './app'),
        },
    },
    build: {
        target: 'es2020',
        sourcemap: true,
        emptyOutDir: true,
    },
    server: {
        port: 5173,
        strictPort: true,
        cors: true,
    },
});

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
        // Garantiza una sola copia de cada dep con CONTEXT (React,
        // React-Query) en el bundle, incluso a través de deps transitivas
        // de @xyflow/react / @tanstack que también las listan como peer.
        //
        // Sin esto, Vite puede bundlear copias locales en chunks lazy:
        // - React → "Invalid hook call (#321)" cuando los hooks de React
        //   Flow corren contra un React distinto del Provider del SPA.
        // - React-Query → "No QueryClient set, use QueryClientProvider"
        //   cuando un useQuery del chunk lazy busca el provider en su
        //   propia copia (que jamás fue inicializado).
        dedupe: ['react', 'react-dom', '@tanstack/react-query'],
    },
    optimizeDeps: {
        // Pre-bundlea estas deps en un solo paquete consistente — evita
        // que cada chunk lazy resuelva su propia copia.
        include: ['react', 'react-dom', 'react/jsx-runtime', '@tanstack/react-query'],
    },
    build: {
        target: 'es2020',
        sourcemap: true,
        emptyOutDir: true,
        rollupOptions: {
            output: {
                // Fuerza a que React, React-DOM y React-Query SIEMPRE
                // queden en el chunk principal, nunca en chunks lazy.
                // Esto es la garantía hard de single-instance que dedupe
                // no puede dar al 100% — sin ella, code-splitting puede
                // duplicar libs con context y romper providers.
                manualChunks(id) {
                    if (
                        id.includes('node_modules/react/') ||
                        id.includes('node_modules/react-dom/') ||
                        id.includes('node_modules/@tanstack/react-query/')
                    ) {
                        return 'main';
                    }
                    return undefined;
                },
            },
        },
    },
    server: {
        port: 5173,
        strictPort: true,
        cors: true,
    },
});

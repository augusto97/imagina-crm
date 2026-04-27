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
        // Garantiza una sola copia de React en el bundle, incluso a través
        // de deps transitivas de @xyflow/react / @tanstack que también
        // listan React como peer. Sin esto, Vite puede bundlear copias
        // locales en chunks lazy → "Invalid hook call (#321)" cuando los
        // hooks de React Flow usan un React distinto del Provider del SPA.
        dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
        // Pre-bundlea estas deps en un solo paquete consistente — evita
        // que cada chunk lazy resuelva su propia copia.
        include: ['react', 'react-dom', 'react/jsx-runtime'],
    },
    build: {
        target: 'es2020',
        sourcemap: true,
        emptyOutDir: true,
        rollupOptions: {
            output: {
                // Fuerza a que React + React-DOM SIEMPRE queden en el
                // chunk principal, nunca en chunks lazy. Esto es la
                // garantía hard de single-instance que dedupe no puede
                // dar al 100%.
                manualChunks(id) {
                    if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
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

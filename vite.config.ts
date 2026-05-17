import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { v4wp } from '@kucrut/vite-for-wp';
import path from 'node:path';

export default defineConfig({
    plugins: [
        // El plugin `v4wp` produce el `dist/manifest.json` que el
        // PHP `AdminAssets` lee para resolver el bundle del admin SPA.
        // Le pasamos AMBOS entry points (admin + público) para que el
        // manifest los liste juntos y el PHP los resuelva por nombre.
        // El bundle público (`app/public.tsx`) se enqueuea aparte
        // desde `PublicAssets` con un path directo, sin pasar por el
        // manifest — pero igual queremos que Vite lo procese en el
        // mismo build pipeline.
        v4wp({
            input: ['app/main.tsx', 'app/public.tsx'],
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
                // React/ReactDOM van a un chunk compartido (`vendor-react`)
                // que tanto el admin SPA como el bundle público importan.
                //
                // Motivo: el bundle público (`app/public.tsx`, Fase 8)
                // debe ser autosuficiente — un visitante del frontend no
                // tiene por qué descargar el bundle del admin completo.
                // Con un chunk vendor común, ambos entries comparten una
                // sola copia de React (single-instance garantizada) y el
                // browser puede cachear `vendor-react.js` entre admin y
                // frontend.
                //
                // TanStack Query va aparte porque solo lo usa el admin
                // (el bundle público hace fetch nativo).
                manualChunks(id) {
                    if (
                        id.includes('node_modules/react/') ||
                        id.includes('node_modules/react-dom/')
                    ) {
                        return 'vendor-react';
                    }
                    if (id.includes('node_modules/@tanstack/react-query/')) {
                        return 'vendor-query';
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

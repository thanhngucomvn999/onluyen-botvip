import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
    build: {
        lib: {
            entry: resolve(__dirname, 'src/main.js'),
            name: 'OnLuyenSolver',
            fileName: () => 'solver.js',
            formats: ['iife']
        },
        outDir: 'dist',
        minify: false,
        emptyOutDir: true
    }
});

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
        emptyOutDir: true,
        // Cấu hình quan trọng để tránh tạo ra các file chunk
        rollupOptions: {
            output: {
                // Gộp tất cả các dynamic import vào một file duy nhất
                inlineDynamicImports: true,
                // Đảm bảo tên file đầu ra là solver.js
                entryFileNames: 'solver.js',
                // Vô hiệu hóa việc tách nhỏ code
                manualChunks: undefined
            }
        }
    }
});

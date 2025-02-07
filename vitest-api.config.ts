import swc from 'unplugin-swc';
import { fileURLToPath, URL } from 'url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // setupFiles: './vitest-setup.ts',
    globals: true,
    // fileParallelism: false,
    environment: 'node',
    // TODO: remove include prop after complete Vitest migration
    include: ['./src/api/**/*.{test,spec}.?(c|m)[jt]s?(x)'],
    coverage: {
      reporter: ['lcov', 'text'],
    },
    outputFile: 'coverage/sonar-report.xml',
  },
  resolve: {
    alias: [{ find: '@/', replacement: fileURLToPath(new URL('./', import.meta.url)) }]
  },
  plugins: [
    swc.vite({
      // Explicitly set the module type to avoid inheriting this value from a `.swcrc` config file
      module: { type: 'es6' },
    }),
  ]
});

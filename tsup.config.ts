import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/**/*.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'node18',
  outDir: 'dist',
  splitting: false,
  bundle: false, // 不打包，保持模块结构
  external: ['@modelcontextprotocol/sdk']
});
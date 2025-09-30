import { defineConfig } from 'tsup';

export default defineConfig([
  // ESM 构建配置
  {
    entry: ['src/**/*.ts', '!src/**/*.test.ts'],
    format: ['esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    target: 'node18',
    outDir: 'dist/esm',
    splitting: false,
    bundle: false, // 不打包，保持模块结构
    external: ['@modelcontextprotocol/sdk', 'ulid', 'fs-extra'],
    outExtension: () => ({ js: '.js' }),
    tsconfig: 'tsconfig.json',
  },
  // CJS 构建配置
  {
    entry: ['src/**/*.ts', '!src/**/*.test.ts'],
    format: ['cjs'],
    dts: false, // 只在 ESM 构建中生成类型定义
    clean: false, // 避免清理 ESM 构建结果
    sourcemap: true,
    target: 'node18',
    outDir: 'dist/cjs',
    splitting: false,
    bundle: false,
    external: ['@modelcontextprotocol/sdk', 'ulid', 'fs-extra'],
    outExtension: () => ({ js: '.cjs' }),
    tsconfig: 'tsconfig.json',
  },
  // 服务器入口点单独构建（用于直接执行）
  {
    entry: ['src/server.ts'],
    format: ['esm'],
    dts: false,
    clean: false,
    sourcemap: true,
    target: 'node18',
    outDir: 'dist',
    splitting: false,
    bundle: true, // 改为 bundle 模式避免路径问题
    external: ['@modelcontextprotocol/sdk', 'ulid', 'fs-extra'],
    outExtension: () => ({ js: '.js' }),
    tsconfig: 'tsconfig.json',
  },
]);

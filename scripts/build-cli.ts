import * as esbuild from 'esbuild'
import * as path from 'node:path'

const rootDir = path.resolve(import.meta.dirname, '..')

const loggerShimPlugin: esbuild.Plugin = {
  name: 'logger-shim',
  setup(build) {
    build.onResolve({ filter: /\/lib\/logger$/ }, () => ({
      path: path.join(rootDir, 'src/cli/logger-shim.ts'),
    }))
  },
}

const sharedOptions: esbuild.BuildOptions = {
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: [],
  alias: { '@': './src' },
  plugins: [loggerShimPlugin],
  logLevel: 'info',
}

// CLI bundle
await esbuild.build({
  ...sharedOptions,
  entryPoints: ['src/cli/index.ts'],
  target: 'node18',
  outfile: 'dist/codesentinel.mjs',
  banner: { js: '#!/usr/bin/env node' },
})

// GitHub Action bundle
await esbuild.build({
  ...sharedOptions,
  entryPoints: ['src/cli/action.ts'],
  target: 'node20',
  outfile: 'dist/action.mjs',
})

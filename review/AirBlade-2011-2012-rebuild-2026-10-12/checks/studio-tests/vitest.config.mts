import { defineConfig } from "vitest/config";

// Match the actual web app's react-jsx TypeScript transform in this isolated
// test snapshot. Runtime dependencies are the pre-existing local cache.
export default defineConfig({ esbuild: { jsx: "automatic" } });

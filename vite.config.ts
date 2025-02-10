import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
      serverModuleFormat: "esm",
    }),
    tsconfigPaths(),
  ],
  build: {
    rollupOptions: {
      external: [
        'recharts',
        '@remix-run/node',
        'react',
        'react-dom',
        'remix-utils/client-only'
      ],
    },
  },
  optimizeDeps: {
    exclude: ['recharts'],
  },
  ssr: {
    noExternal: true,
    external: ['recharts']
  },
});
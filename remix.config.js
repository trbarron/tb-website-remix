import path from "node:path";

const isProduction = process.env.NODE_ENV === "production";

/** @type {import('@remix-run/dev').AppConfig} */
export default {
  cacheDirectory: "./node_modules/.cache/remix",
  ignoredRouteFiles: ["**/.*", "**/*.test.{js,jsx,ts,tsx}"],
  assetsBuildDirectory: "public/build",
  publicPath: "/_static/build/",
  server: "./server.ts",
  serverBuildPath: "server/index.mjs",
  serverModuleFormat: "esm",
  serverMinify: true,
  serverMode: isProduction ? "production" : "development",
  serverDependenciesToBundle: [
    'obliterator/iterator',
    'obliterator/foreach',
    'd3-geo/dist/d3-geo.min.js',
    'topojson-client/dist/topojson-client.min.js'
  ],

  future: {
    v3_fetcherPersist: true,
    v3_lazyRouteDiscovery: true,
    v3_relativeSplatPath: true,
    v3_singleFetch: true,
    v3_throwAbortReason: true,
  },
};
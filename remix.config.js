import path from "node:path";

/** @type {import('@remix-run/dev').AppConfig} */
export default {
  cacheDirectory: "./node_modules/.cache/remix",
  ignoredRouteFiles: ["**/.*", "**/*.test.{js,jsx,ts,tsx}"],
  assetsBuildDirectory: "public/build",
  publicPath: "/build/",
  server: "server.ts",
  serverBuildPath: "server/index.mjs",
  serverModuleFormat: "esm",
  browserNodeBuiltinsPolyfill: { 
    modules: { 
      events: true,
      querystring: true,
      util: true,
      punycode: true,
    } 
  },
  serverDependenciesToBundle: ['chessground'],
  routes: (defineRoutes) =>
    defineRoutes((route) => {
      if (process.env.NODE_ENV === "production") return;
      console.log("Test routes enabled.");
      const appDir = path.join(process.cwd(), "app");
    }),
  future: {
    unstable_dev: {
    }
  }
};
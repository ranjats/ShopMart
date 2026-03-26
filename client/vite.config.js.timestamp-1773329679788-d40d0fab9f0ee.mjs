// client/vite.config.js
import { defineConfig } from "file:///app/applet/node_modules/vite/dist/node/index.js";
import react from "file:///app/applet/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///app/applet/node_modules/tailwindcss/lib/index.js";
import autoprefixer from "file:///app/applet/node_modules/autoprefixer/lib/autoprefixer.js";
import path from "path";
import { fileURLToPath } from "url";
var __vite_injected_original_import_meta_url = "file:///app/applet/client/vite.config.js";
var __dirname = path.dirname(fileURLToPath(__vite_injected_original_import_meta_url));
var vite_config_default = defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [
        tailwindcss({ config: path.resolve(__dirname, "./tailwind.config.js") }),
        autoprefixer()
      ]
    }
  },
  server: {
    fs: {
      allow: [".."]
    },
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiY2xpZW50L3ZpdGUuY29uZmlnLmpzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiL2FwcC9hcHBsZXQvY2xpZW50XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvYXBwL2FwcGxldC9jbGllbnQvdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2FwcC9hcHBsZXQvY2xpZW50L3ZpdGUuY29uZmlnLmpzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcbmltcG9ydCB0YWlsd2luZGNzcyBmcm9tICd0YWlsd2luZGNzcydcbmltcG9ydCBhdXRvcHJlZml4ZXIgZnJvbSAnYXV0b3ByZWZpeGVyJ1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGggfSBmcm9tICd1cmwnXG5cbmNvbnN0IF9fZGlybmFtZSA9IHBhdGguZGlybmFtZShmaWxlVVJMVG9QYXRoKGltcG9ydC5tZXRhLnVybCkpXG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKV0sXG4gIGNzczoge1xuICAgIHBvc3Rjc3M6IHtcbiAgICAgIHBsdWdpbnM6IFtcbiAgICAgICAgdGFpbHdpbmRjc3MoeyBjb25maWc6IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICcuL3RhaWx3aW5kLmNvbmZpZy5qcycpIH0pLFxuICAgICAgICBhdXRvcHJlZml4ZXIoKSxcbiAgICAgIF0sXG4gICAgfSxcbiAgfSxcbiAgc2VydmVyOiB7XG4gICAgZnM6IHtcbiAgICAgIGFsbG93OiBbJy4uJ11cbiAgICB9LFxuICAgIHByb3h5OiB7XG4gICAgICAnL2FwaSc6IHtcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDozMDAwJyxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlXG4gICAgICB9XG4gICAgfVxuICB9XG59KVxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUF3TyxTQUFTLG9CQUFvQjtBQUNyUSxPQUFPLFdBQVc7QUFDbEIsT0FBTyxpQkFBaUI7QUFDeEIsT0FBTyxrQkFBa0I7QUFDekIsT0FBTyxVQUFVO0FBQ2pCLFNBQVMscUJBQXFCO0FBTDhHLElBQU0sMkNBQTJDO0FBTzdMLElBQU0sWUFBWSxLQUFLLFFBQVEsY0FBYyx3Q0FBZSxDQUFDO0FBRzdELElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLENBQUM7QUFBQSxFQUNqQixLQUFLO0FBQUEsSUFDSCxTQUFTO0FBQUEsTUFDUCxTQUFTO0FBQUEsUUFDUCxZQUFZLEVBQUUsUUFBUSxLQUFLLFFBQVEsV0FBVyxzQkFBc0IsRUFBRSxDQUFDO0FBQUEsUUFDdkUsYUFBYTtBQUFBLE1BQ2Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sSUFBSTtBQUFBLE1BQ0YsT0FBTyxDQUFDLElBQUk7QUFBQSxJQUNkO0FBQUEsSUFDQSxPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsUUFDTixRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsTUFDaEI7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 백엔드는 uvicorn 8000. /api 는 그대로 절대 URL(http://localhost:8000)로 호출하며
// CORS가 열려 있어 프록시 없이도 되지만, 개발 편의를 위해 프록시도 열어둔다.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});

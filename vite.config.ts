import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { circuitAi } from "./server/circuitAi";
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    circuitAi(loadEnv(mode, process.cwd(), "OPENAI_").OPENAI_API_KEY?.trim()),
  ],
}));

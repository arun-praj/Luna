import vinext from "vinext";
import { defineConfig } from "vite";
import { sites } from "./build/sites-vite-plugin.ts";

export default defineConfig(async () => {
  const { cloudflare } = await import("@cloudflare/vite-plugin");
  return {
    server: {
      allowedHosts: ["luna-dev.arunprajapati.com"],
    },
    environments: {
      client: {
        optimizeDeps: {
          exclude: ["lucide-react"],
        },
      },
    },
    plugins: [vinext(), sites(), cloudflare({ viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] } })],
  };
});

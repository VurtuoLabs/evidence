import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import salesforce from "@salesforce/vite-plugin-ui-bundle";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
    base: "./",
    plugins: [react(), salesforce()],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    build: {
        outDir: "dist",
        assetsDir: "assets",
        sourcemap: false,
    },
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./src/test/setup.ts"],
        css: true,
    },
});

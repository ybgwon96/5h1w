import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: ["dist/**", "coverage/**", "node_modules/**", "*.config.js", "public/sw.js"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        localStorage: "readonly",
        requestAnimationFrame: "readonly",
        performance: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        setTimeout: "readonly",
        AudioContext: "readonly",
        HTMLCanvasElement: "readonly",
        HTMLElement: "readonly",
        CanvasRenderingContext2D: "readonly",
        GainNode: "readonly",
        OscillatorType: "readonly",
        PointerEvent: "readonly",
        Node: "readonly",
        Event: "readonly",
        EventListener: "readonly",
        ServiceWorkerGlobalScope: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  }
);

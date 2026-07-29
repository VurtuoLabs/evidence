module.exports = {
  root: true,
  env: { browser: true, es2021: true, node: true },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  plugins: ["@typescript-eslint", "react-hooks", "react-refresh"],
  settings: { react: { version: "18.3" } },
  ignorePatterns: ["dist", "coverage", "node_modules", ".eslintrc.cjs"],
  rules: {
    ...require("eslint-plugin-react-hooks").configs.recommended.rules,
    "react-refresh/only-export-components": [
      "warn",
      { allowConstantExport: true },
    ],
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/no-explicit-any": "warn",
  },
};

import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Cloud Functions(src/backend)のLint設定。
 * docs/TECH_STACK.md 8章の「ESLint + Prettier(フロントエンドと同等の構成)」のうち
 * ESLint部分にあたる。フロントエンドと違いNext.js固有のルールは不要なため、
 * typescript-eslintのrecommendedを土台にする。
 */
export default tseslint.config(
  { ignores: ["lib/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    name: "fire-fire/backend",
    rules: {
      // CODING_STANDARDS.md 1章と揃える(フロントエンドと同じ判断基準にする)
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-definitions": ["error", "type"],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "prefer-const": "error",
      "prefer-template": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
);

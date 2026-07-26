import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier/flat";

/**
 * ベースは eslint-config-next。その上に docs/CODING_STANDARDS.md が明記している
 * Airbnb系ルールのみを個別に上乗せする(公式 eslint-config-airbnb は ESLint 9 の
 * flat config に未対応のため、設定パッケージごと入れる方式は採らない)。
 * ルールが競合した場合は CODING_STANDARDS.md 7章のとおり Next.js 側を優先する。
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  {
    name: "fire-fire/coding-standards",
    settings: {
      "import/resolver": {
        typescript: {
          alwaysTryTypes: true,
          project: "./tsconfig.json",
        },
      },
    },
    rules: {
      // --- CODING_STANDARDS.md 4章: import順序 ---
      "import/order": [
        "error",
        {
          groups: [
            ["builtin", "external"], // 1. 外部パッケージ
            ["internal"], // 2. 内部の絶対パス(@/...)
            ["parent", "sibling", "index"], // 3. 相対パス
            "type", // 4. 型のみのimport
          ],
          pathGroups: [{ pattern: "@/**", group: "internal", position: "before" }],
          pathGroupsExcludedImportTypes: ["builtin"],
          "newlines-between": "always",
          alphabetize: { order: "asc", caseInsensitive: true },
          // 型importブロック内も 外部 → 内部絶対 → 相対 の順に並べる。
          // eslint-plugin-import は「各グループ内で型importを後ろに置く」を表現できないため、
          // 型importはまとめて末尾グループに置く形で CODING_STANDARDS.md 4章を近似する。
          sortTypesGroup: true,
          "newlines-between-types": "always",
        },
      ],
      "import/first": "error",
      "import/newline-after-import": "error",
      "import/no-duplicates": "error",
      // CODING_STANDARDS.md 2章: 共通コンポーネント・hooksはnamed export
      "import/prefer-default-export": "off",
      "import/no-extraneous-dependencies": [
        "error",
        {
          devDependencies: [
            "**/*.test.ts",
            "**/*.test.tsx",
            "**/*.spec.ts",
            "**/*.spec.tsx",
            "**/vitest.config.ts",
            "**/vitest.setup.ts",
            "**/*.config.{ts,mts,mjs,js}",
          ],
        },
      ],

      // --- CODING_STANDARDS.md 1章: TypeScript ---
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
      "@typescript-eslint/consistent-type-definitions": ["error", "interface"],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "separate-type-imports" },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "warn",
      // enumは使わずユニオン型のリテラルを使う
      "no-restricted-syntax": [
        "error",
        {
          selector: "TSEnumDeclaration",
          message: "enumは使わずユニオン型のリテラルを使ってください(CODING_STANDARDS.md 1章)。",
        },
      ],

      // --- CODING_STANDARDS.md 2章: React / Next.js ---
      // `count && <Badge />` は count が 0 のとき 0 が描画されるため禁止
      "react/jsx-no-leaked-render": ["error", { validStrategies: ["ternary"] }],
      "react-hooks/exhaustive-deps": "error",

      // --- Airbnb系の一般ルール ---
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "prefer-const": "error",
      "object-shorthand": ["error", "always"],
      "prefer-template": "error",
      "no-nested-ternary": "error",
      "no-param-reassign": ["error", { props: true }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  {
    // shadcn/ui のCLIが生成するコンポーネントはベンダーコード扱いとし、
    // 自前で書くコード向けの規約(import順序・戻り値型の明示など)は適用しない。
    name: "fire-fire/shadcn-generated",
    files: ["src/components/ui/**"],
    rules: {
      "import/order": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/consistent-type-definitions": "off",
      "react/jsx-no-leaked-render": "off",
    },
  },

  // Prettierと競合するフォーマット系ルールを無効化する(必ず最後に置く)
  prettierConfig,

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // 追加:
    "coverage/**",
  ]),
]);

export default eslintConfig;

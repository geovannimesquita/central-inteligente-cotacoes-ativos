import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts"],
  },
  // Sem este bloco o flat config do ESLint 9 percorre apenas arquivos .js —
  // os arquivos .ts/.tsx do projeto ficariam de fora da verificacao.
  {
    files: ["**/*.{js,mjs,cjs,jsx,ts,tsx}"],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Segredos e detalhes internos nunca devem ir para o console em producao.
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-eval": "error",
      "no-implied-eval": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    // Scripts de linha de comando: a saida para o terminal E a interface deles,
    // entao `console.log` aqui e o uso correto, nao um vazamento acidental.
    files: ["scripts/**/*.{js,mjs,ts}"],
    rules: {
      "no-console": "off",
    },
  },
];

export default eslintConfig;

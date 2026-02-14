import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "ROUTE_TS_FIXED.ts",
    "FIXED_ROUTE_TS.txt",
    "VIN_FIX.patch",
    "src/app/page 2.tsx",
    "src/app/page 3.tsx",
  ]),
]);

export default eslintConfig;

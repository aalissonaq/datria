import baseConfig from "@datria/eslint-config";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
  },
  ...baseConfig,
];

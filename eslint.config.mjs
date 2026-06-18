import baseConfig from "@dash/config/eslint";

export default [
  {
    ignores: [
      "**/.next/**",
      "**/dist/**",
      "**/node_modules/**",
      "**/src/generated/**",
      "package-lock.json"
    ]
  },
  ...baseConfig
];

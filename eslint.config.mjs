import baseConfig from "@dash/config/eslint";

export default [
  {
    ignores: [
      "**/.next/**",
      "**/dist/**",
      "**/node_modules/**",
      "package-lock.json"
    ]
  },
  ...baseConfig
];

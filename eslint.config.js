const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  { ignores: ["references/**"] },
  expoConfig,
  {
    ignores: ["dist/*", "references/*", "muse-ai-mobile-app-clone-reference/**", "supabase/functions/*"],
    rules: {
      // These ESM-only packages expose their entry points through `exports`
      // conditions that eslint-plugin-import's Node resolver does not read.
      // TypeScript validates their declarations during `npm run typecheck`.
      "import/no-unresolved": ["error", { ignore: ["^@browserbasehq/stagehand$", "^@composio/core$"] }],
      // Expo Router's async screen loaders intentionally flip loading state;
      // React Compiler's new rules misclassify this established effect pattern.
      "react-hooks/set-state-in-effect": "off",
      // React Native Animated.Value is stable and must be passed to Animated styles.
      "react-hooks/refs": "off",
    },
  },
]);

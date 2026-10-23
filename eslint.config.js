const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", "references/*", "supabase/functions/*"],
    rules: {
      // Expo Router's async screen loaders intentionally flip loading state;
      // React Compiler's new rules misclassify this established effect pattern.
      "react-hooks/set-state-in-effect": "off",
      // React Native Animated.Value is stable and must be passed to Animated styles.
      "react-hooks/refs": "off",
    },
  },
]);

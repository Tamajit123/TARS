const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Guard against accidentally restoring an archived reference checkout inside
// the app. Its independent dependencies must never enter Metro's watch graph.
config.resolver.blockList.push(/[\\/]muse-ai-mobile-app-clone-reference[\\/].*/);
config.resolver.blockList.push(/[\\/]references[\\/].*/);

module.exports = config;

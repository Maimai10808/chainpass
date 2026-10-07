const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("node:path");

module.exports = withNativeWind(getDefaultConfig(__dirname), {
  input: path.join(__dirname, "src/global.css"),
  configPath: path.join(__dirname, "tailwind.config.ts"),
  typescriptEnvPath: path.join(__dirname, "nativewind-env.d.ts"),
});

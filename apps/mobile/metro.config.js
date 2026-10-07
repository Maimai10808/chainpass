const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("node:path");

const config = getDefaultConfig(__dirname);
// Reown controllers must share one Valtio proxy registry. pnpm's hoisted
// workspace also contains Web's Valtio, so resolving per importer creates
// different registries even when the native SDK versions match.
const walletModulePath = path.dirname(
  require.resolve("@reown/appkit-react-native"),
);
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "valtio" || moduleName.startsWith("valtio/")) {
    return {
      type: "sourceFile",
      filePath: require.resolve(moduleName, { paths: [walletModulePath] }),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, {
  input: path.join(__dirname, "src/global.css"),
  configPath: path.join(__dirname, "tailwind.config.ts"),
  typescriptEnvPath: path.join(__dirname, "nativewind-env.d.ts"),
});

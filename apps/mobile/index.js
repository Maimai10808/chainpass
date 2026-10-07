// WalletConnect's native polyfills must run before Expo Router imports the app.
import "@walletconnect/react-native-compat";
import "expo-router/entry";

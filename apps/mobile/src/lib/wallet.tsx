import { type PropsWithChildren } from "react";
import { Platform, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createAppKit,
  AppKitProvider,
  AppKit,
  type Storage,
} from "@reown/appkit-react-native";
import { EthersAdapter } from "@reown/appkit-ethers-react-native";
import { chainPassSepolia } from "@chainpass/web3";
import { colors } from "@/design";

const prefix = "chainpass-wallet:";
const storage: Storage = {
  getKeys: async () =>
    (await AsyncStorage.getAllKeys())
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length)),
  getEntries: async <T,>() => {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) =>
      key.startsWith(prefix),
    );
    const entries = await AsyncStorage.multiGet(keys);
    return entries
      .filter((entry): entry is [string, string] => entry[1] !== null)
      .map(([key, value]) => [
        key.slice(prefix.length),
        JSON.parse(value) as T,
      ]);
  },
  getItem: async <T,>(key: string) => {
    const value = await AsyncStorage.getItem(prefix + key);
    return value === null ? undefined : (JSON.parse(value) as T);
  },
  setItem: async <T,>(key: string, value: T) =>
    AsyncStorage.setItem(prefix + key, JSON.stringify(value)),
  removeItem: (key) => AsyncStorage.removeItem(prefix + key),
};
// Only wallet connection metadata lives here. Better Auth stays in SecureStore.
const projectId = process.env.EXPO_PUBLIC_REOWN_PROJECT_ID;
export const walletKit =
  projectId && (Platform.OS !== "web" || typeof window !== "undefined")
    ? createAppKit({
        projectId,
        adapters: [new EthersAdapter()],
        networks: [chainPassSepolia],
        defaultNetwork: chainPassSepolia,
        storage,
        metadata: {
          name: "ChainPass",
          description: "Digital event passes",
          url:
            process.env.EXPO_PUBLIC_APP_URL ??
            process.env.EXPO_PUBLIC_API_URL ??
            "chainpass://",
          icons: [],
          redirect: { native: "chainpass://" },
        },
        features: { socials: false, swaps: false, onramp: false },
        enableAnalytics: false,
        debug: false,
        logger: "silent",
        themeMode: "dark",
        themeVariables: { accent: colors.primary },
      })
    : null;
export function WalletProvider({ children }: PropsWithChildren) {
  if (!walletKit) return children;
  return (
    <AppKitProvider instance={walletKit}>
      {children}
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", width: "100%", height: "100%" }}
      >
        <AppKit />
      </View>
    </AppKitProvider>
  );
}

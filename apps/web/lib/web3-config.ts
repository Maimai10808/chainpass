"use client";

import { createAppKit, type AppKit } from "@reown/appkit/react";
import { sepolia } from "@reown/appkit/networks";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID?.trim();
const networks = [sepolia] as const;
const metadata = {
  name: "ChainPass",
  description: "Verify and mint ChainPass event passes",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  icons: [],
};

const wagmiAdapter = projectId
  ? new WagmiAdapter({ networks: [...networks], projectId, ssr: true })
  : null;

export const wagmiConfig =
  wagmiAdapter?.wagmiConfig ??
  createConfig({
    chains: networks,
    connectors: [injected()],
    transports: { [sepolia.id]: http() },
    ssr: true,
  });

let appKit: AppKit | null = null;

export const isWalletConnectConfigured = Boolean(projectId);

export async function openWalletConnect(): Promise<void> {
  // Open wallet UI only after an explicit user action, never while browsing or signing in.
  if (!appKit && projectId && wagmiAdapter) {
    appKit = createAppKit({
      adapters: [wagmiAdapter],
      networks: [...networks],
      projectId,
      metadata,
      features: { email: false, socials: false },
    });
  }
  if (!appKit) throw new Error("Reown AppKit is not configured");
  await appKit.open({ view: "Connect" });
}

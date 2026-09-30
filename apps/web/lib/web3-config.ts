"use client";

import { createAppKit, type AppKit } from "@reown/appkit/react";
import { baseSepolia } from "@reown/appkit/networks";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";

const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID?.trim();
const networks = [baseSepolia] as const;
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
    transports: { [baseSepolia.id]: http() },
    ssr: true,
  });

let appKit: AppKit | null = null;

if (projectId && wagmiAdapter) {
  appKit = createAppKit({
    adapters: [wagmiAdapter],
    networks: [...networks],
    projectId,
    metadata,
    features: {
      email: false,
      socials: false,
    },
  });
}

export const isWalletConnectConfigured = Boolean(projectId);

export async function openWalletConnect(): Promise<void> {
  if (!appKit) throw new Error("Reown AppKit is not configured");
  await appKit.open({ view: "Connect" });
}

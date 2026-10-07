import { useState } from "react";
import { Text } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount, useAppKit, useProvider } from "@reown/appkit-react-native";
import { BrowserProvider, type Eip1193Provider } from "ethers";
import {
  canonicalizeEvmAddress,
  CHAINPASS_SEPOLIA_CHAIN_ID,
  type Hex,
} from "@chainpass/web3";
import { useSession } from "@/lib/auth-client";
import { apiClient } from "@/lib/api-client";
import { keys, shortAddress, walletCanBind } from "@/lib/product";
import { errorMessage } from "@/lib/errors";
import { walletKit } from "@/lib/wallet";
import { triggerHaptic } from "@/design";
import { Card, ActionButton, Fact, Feedback, StatusPill, text } from "./ui";

export function WalletPanel() {
  const { data: session } = useSession();
  const uid = session?.user.id ?? "";
  const wallet = useQuery({
    queryKey: keys.wallet(uid),
    queryFn: () => apiClient.getMyWallet(),
    enabled: Boolean(uid),
  });
  if (!session) return null;
  return (
    <Card>
      <Text style={text.subheading}>Your wallet</Text>
      <Text style={text.body}>
        A verified wallet is linked to your account, not used to sign in.
        Off-chain passes work without one.
      </Text>
      {wallet.isPending ? (
        <Text style={text.body}>Checking wallet…</Text>
      ) : wallet.isError ? (
        <>
          <Feedback message={errorMessage(wallet.error)} />
          <ActionButton
            label="Retry wallet"
            tone="secondary"
            onPress={() => void wallet.refetch()}
          />
        </>
      ) : wallet.data ? (
        <>
          <StatusPill label="VERIFIED WALLET" tone="info" />
          <Fact label="Ethereum Sepolia" value={wallet.data.address} mono />
        </>
      ) : walletKit ? (
        <WalletBinding />
      ) : (
        <Feedback
          tone="warning"
          message="Wallet connection is not configured in this build. Add EXPO_PUBLIC_REOWN_PROJECT_ID and restart the app. Your QR pass still works."
        />
      )}
    </Card>
  );
}
function WalletBinding() {
  const { data: session } = useSession();
  const client = useQueryClient();
  const { address, chainId, isConnected } = useAccount();
  const { provider } = useProvider();
  const { open, disconnect, switchNetwork } = useAppKit();
  const [connectionError, setConnectionError] = useState("");
  const bind = useMutation({
    mutationFn: async (currentUser: string) => {
      if (session?.user.id !== currentUser || !provider || !walletCanBind(address, chainId))
        throw new Error("Wrong network");
      const normalized = canonicalizeEvmAddress(address!);
      const challenge = await apiClient.createWalletChallenge({
        address: normalized,
        chainId: CHAINPASS_SEPOLIA_CHAIN_ID,
      });
      const ethersProvider = new BrowserProvider(provider as Eip1193Provider);
      const signer = await ethersProvider.getSigner(normalized);
      const signature = await signer.signMessage(challenge.message);
      const fresh = await import("@/lib/auth-client").then(({ authClient }) =>
        authClient.getSession(),
      );
      if (fresh.data?.user.id !== currentUser)
        throw new Error("Session changed");
      return apiClient.verifyWallet({
        challengeId: challenge.id,
        address: normalized,
        signature: signature as Hex,
      });
    },
    onSuccess: (result, currentUser) => {
      const key = keys.wallet(currentUser);
      if (client.getQueryData(key) !== undefined)
        client.setQueryData(key, result);
      void triggerHaptic("success");
    },
    onError: () => {
      void triggerHaptic("error");
    },
  });
  async function changeNetwork() {
    try {
      setConnectionError("");
      await switchNetwork("eip155:11155111");
    } catch {
      setConnectionError(
        "Network switch declined. Select Ethereum Sepolia in your wallet.",
      );
    }
  }
  async function disconnectWallet() {
    try {
      setConnectionError("");
      await disconnect();
    } catch {
      setConnectionError("Could not disconnect your wallet. Try again.");
    }
  }
  return (
    <>
      {isConnected && address ? (
        <>
          <Fact
            label="Connected (not yet bound)"
            value={shortAddress(address)}
            mono
          />
          {walletCanBind(address, chainId) ? (
            <ActionButton
              label="Sign & verify wallet"
              loading={bind.isPending}
              onPress={() => {
                if (session) bind.mutate(session.user.id);
              }}
            />
          ) : (
            <ActionButton
              label="Switch to Ethereum Sepolia"
              onPress={() => void changeNetwork()}
            />
          )}
          <ActionButton
            label="Disconnect wallet"
            tone="secondary"
            disabled={bind.isPending}
            onPress={() => void disconnectWallet()}
          />
        </>
      ) : (
        <ActionButton
          label="Connect wallet"
          onPress={() => open({ view: "Connect" })}
        />
      )}
      {bind.isError && (
        <Feedback message="Wallet verification failed or signing was declined. Check the account and network, then try again." />
      )}
      {Boolean(connectionError) && <Feedback message={connectionError} />}
    </>
  );
}

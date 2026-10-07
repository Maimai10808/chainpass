"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useAccount,
  useDisconnect,
  useSignMessage,
  useSwitchChain,
} from "wagmi";
import { toast } from "sonner";
import { CHAINPASS_SEPOLIA_CHAIN_ID } from "@chainpass/web3";
import { Wallet, ShieldCheck } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";
import {
  openWalletConnect,
  isWalletConnectConfigured,
} from "@/lib/web3-config";
import { errorMessage, shorten } from "@/lib/presentation";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { WalletView } from "@chainpass/api-client";

export function WalletPanel({ wallet }: { wallet: WalletView | null }) {
  const { data: session } = useSession();
  const { address, chainId, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync, isPending: switching } = useSwitchChain();
  const cache = useQueryClient();
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const mismatch = Boolean(
    wallet && address && wallet.address.toLowerCase() !== address.toLowerCase(),
  );
  const bind = useMutation({
    mutationFn: async () => {
      if (!address || chainId !== CHAINPASS_SEPOLIA_CHAIN_ID)
        throw new Error("Connect to Ethereum Sepolia first.");
      const challenge = await apiClient.createWalletChallenge({
        address,
        chainId,
      });
      const signature = await signMessageAsync({
        account: address,
        message: challenge.message,
      });
      return apiClient.verifyWallet({
        challengeId: challenge.id,
        address,
        signature,
      });
    },
    onSuccess: (result) => {
      cache.setQueryData(["wallet", session?.user.id], result);
      toast.success("Wallet ownership verified and bound");
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
  async function connect() {
    setConnectionError(null);
    try {
      await openWalletConnect();
    } catch {
      setConnectionError("Unable to open your wallet. Please try again.");
    }
  }
  async function switchNetwork() {
    setConnectionError(null);
    try {
      await switchChainAsync({ chainId: CHAINPASS_SEPOLIA_CHAIN_ID });
    } catch {
      setConnectionError(
        "Network switch declined. Select Ethereum Sepolia in your wallet.",
      );
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="size-5 text-primary" />
          Wallet ownership
        </CardTitle>
        <CardDescription>
          A connection is not a binding. Sign a one-time message to prove this
          wallet is yours.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {wallet ? (
          <div className="rounded-lg border border-info/20 bg-info/5 p-4">
            <p className="flex items-center gap-2 text-body-sm text-info">
              <ShieldCheck className="size-4" />
              Verified wallet
            </p>
            <p className="mt-2 break-all font-mono text-body-sm">
              {wallet.address}
            </p>
            <p className="mt-2 text-caption text-muted-foreground">
              {wallet.chainId === CHAINPASS_SEPOLIA_CHAIN_ID
                ? "Ethereum Sepolia"
                : "Chain " + wallet.chainId}{" "}
              · One primary wallet per account
            </p>
          </div>
        ) : (
          <p className="text-body-sm text-muted-foreground">
            No verified wallet yet. You can still use your QR without one.
          </p>
        )}
        {isConnected && address && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-body-sm">
              {shorten(address)} ·{" "}
              {chainId === CHAINPASS_SEPOLIA_CHAIN_ID
                ? "Sepolia"
                : "Chain " + chainId}
            </span>
            <Button variant="ghost" onClick={() => disconnect()}>
              Disconnect
            </Button>
          </div>
        )}
        {mismatch && (
          <Alert>
            <AlertTitle>
              Connected wallet does not match your binding
            </AlertTitle>
            <AlertDescription>
              Switch to your verified wallet. The primary wallet binding will
              not be replaced.
            </AlertDescription>
          </Alert>
        )}
        {!isWalletConnectConfigured && (
          <Alert>
            <AlertTitle>Wallet connection unavailable</AlertTitle>
            <AlertDescription>
              This environment needs a Reown Project ID. QR admission remains
              available.
            </AlertDescription>
          </Alert>
        )}
        {!isConnected ? (
          <Button
            variant="outline"
            className="h-10"
            disabled={!isWalletConnectConfigured}
            onClick={() => void connect()}
          >
            <Wallet data-icon="inline-start" />
            Connect wallet
          </Button>
        ) : !wallet && chainId !== CHAINPASS_SEPOLIA_CHAIN_ID ? (
          <Button
            variant="outline"
            disabled={switching}
            onClick={() => void switchNetwork()}
          >
            Switch to Ethereum Sepolia
          </Button>
        ) : !wallet ? (
          <Button
            className="h-10"
            disabled={bind.isPending}
            onClick={() => bind.mutate()}
          >
            {bind.isPending && <Spinner data-icon="inline-start" />}
            {bind.isPending ? "Waiting for signature…" : "Sign & bind wallet"}
          </Button>
        ) : (
          <p className="flex items-center gap-2 text-body-sm text-info">
            <ShieldCheck className="size-4" /> Wallet ownership verified
          </p>
        )}
        {(connectionError || bind.isError) && (
          <Alert variant="destructive">
            <AlertTitle>Wallet action failed</AlertTitle>
            <AlertDescription>
              {connectionError ?? errorMessage(bind.error)}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

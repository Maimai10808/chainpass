"use client";

import { ApiClientError, type WalletView } from "@chainpass/api-client";
import { CHAINPASS_SEPOLIA_CHAIN_ID } from "@chainpass/web3";
import { useState } from "react";
import {
  useAccount,
  useDisconnect,
  useSignMessage,
  useSwitchChain,
} from "wagmi";

import { apiClient } from "@/lib/api-client";
import {
  isWalletConnectConfigured,
  openWalletConnect,
} from "@/lib/web3-config";

export function WalletPanel({
  wallet,
  onVerified,
}: {
  wallet: WalletView | null;
  onVerified: (wallet: WalletView) => void;
}) {
  const { address, chainId, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();
  const [isBinding, setIsBinding] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const walletMismatch = Boolean(
    wallet && address && wallet.address.toLowerCase() !== address.toLowerCase(),
  );

  async function verifyAndBind() {
    if (!address || !chainId || isBinding) return;
    setIsBinding(true);
    setMessage(null);
    setError(null);

    try {
      const challenge = await apiClient.createWalletChallenge({
        address,
        chainId,
      });
      const signature = await signMessageAsync({
        account: address,
        message: challenge.message,
      });
      const verified = await apiClient.verifyWallet({
        challengeId: challenge.id,
        address,
        signature,
      });
      onVerified(verified);
      setMessage("Wallet verified and bound successfully.");
    } catch (caught) {
      setError(
        caught instanceof ApiClientError || caught instanceof Error
          ? caught.message
          : "Unable to verify this wallet.",
      );
    } finally {
      setIsBinding(false);
    }
  }

  async function switchToSepolia() {
    setError(null);
    try {
      await switchChainAsync({ chainId: CHAINPASS_SEPOLIA_CHAIN_ID });
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to switch wallet network.",
      );
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-blue-700">Wallet</p>
          <h2 className="mt-1 text-xl font-semibold">
            {wallet ? shortenAddress(wallet.address) : "No verified wallet"}
          </h2>
          <p className="mt-2 text-sm text-zinc-600">
            {wallet
              ? `Verified on chain ${wallet.chainId}`
              : "Connect a wallet and sign a one-time challenge to bind it."}
          </p>
        </div>

        {isConnected ? (
          <button
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium"
            onClick={() => disconnect()}
            type="button"
          >
            Disconnect
          </button>
        ) : (
          <button
            className="rounded-lg bg-zinc-950 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!isWalletConnectConfigured}
            onClick={() => void openWalletConnect()}
            type="button"
          >
            Connect Wallet
          </button>
        )}
      </div>

      {!isWalletConnectConfigured ? (
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Wallet connection is unavailable. Configure
          NEXT_PUBLIC_REOWN_PROJECT_ID for this environment.
        </p>
      ) : null}

      {isConnected && address ? (
        <div className="mt-5 rounded-xl bg-zinc-50 p-4 text-sm">
          <p className="font-medium">Connected wallet</p>
          <p className="mt-1 break-all text-zinc-600">{address}</p>
          <p className="mt-1 text-zinc-600">Chain {chainId}</p>

          {walletMismatch ? (
            <p
              className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-red-700"
              role="alert"
            >
              Connected wallet does not match your verified bound wallet. The
              binding will not be replaced.
            </p>
          ) : null}

          {!wallet && chainId !== CHAINPASS_SEPOLIA_CHAIN_ID ? (
            <button
              className="mt-4 rounded-lg border border-zinc-300 bg-white px-4 py-2 font-medium"
              onClick={() => void switchToSepolia()}
              type="button"
            >
              Switch to Ethereum Sepolia
            </button>
          ) : null}

          {!wallet && chainId === CHAINPASS_SEPOLIA_CHAIN_ID ? (
            <button
              className="mt-4 rounded-lg bg-blue-700 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isBinding}
              onClick={() => void verifyAndBind()}
              type="button"
            >
              {isBinding ? "Waiting for signature…" : "Verify & Bind Wallet"}
            </button>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

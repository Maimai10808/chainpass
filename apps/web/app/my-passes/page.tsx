"use client";

import {
  ApiClientError,
  type PassView,
  type WalletView,
} from "@chainpass/api-client";
import { getTransactionExplorerUrl, type Hash } from "@chainpass/web3";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";
import { WalletPanel } from "./wallet-panel";

export default function MyPassesPage() {
  const { data: session, isPending: isSessionPending } = useSession();
  const [passes, setPasses] = useState<PassView[]>([]);
  const [wallet, setWallet] = useState<WalletView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mintingPassId, setMintingPassId] = useState<string | null>(null);
  const [mintErrors, setMintErrors] = useState<Record<string, string>>({});
  const { address: connectedAddress } = useAccount();

  useEffect(() => {
    if (isSessionPending || !session) return;

    let active = true;

    Promise.all([apiClient.getMyPasses(), apiClient.getMyWallet()])
      .then(([passResult, walletResult]) => {
        if (active) {
          setPasses(passResult);
          setWallet(walletResult);
        }
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof ApiClientError
            ? caught.message
            : "Unable to load your passes.",
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isSessionPending, session]);

  async function mintPass(passId: string) {
    if (mintingPassId) return;
    setMintingPassId(passId);
    setMintErrors((current) => {
      const next = { ...current };
      delete next[passId];
      return next;
    });

    try {
      const result = await apiClient.mintPass(passId);
      setPasses((current) =>
        current.map((pass) => (pass.id === passId ? result.pass : pass)),
      );
    } catch (caught) {
      setMintErrors((current) => ({
        ...current,
        [passId]:
          caught instanceof ApiClientError
            ? caught.message
            : "Unable to mint this pass.",
      }));
    } finally {
      setMintingPassId(null);
    }
  }

  if (isSessionPending) {
    return <PageState title="Loading your passes…" />;
  }

  if (!session) {
    return (
      <PageState
        title="Sign in required"
        description="Sign in to see the passes owned by your account."
      >
        <Link className="font-medium text-blue-700 underline" href="/auth-test">
          Open sign in
        </Link>
      </PageState>
    );
  }

  if (isLoading) {
    return <PageState title="Loading your passes…" />;
  }

  if (error) {
    return <PageState title="Unable to load passes" description={error} />;
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-6 py-12 text-zinc-950">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-blue-700">ChainPass</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              My Passes
            </h1>
            <p className="mt-3 text-zinc-600">
              Passes owned by {session.user.name ?? session.user.email}.
            </p>
          </div>
          <Link className="font-medium text-blue-700 underline" href="/events">
            Browse events
          </Link>
        </header>

        <WalletPanel wallet={wallet} onVerified={setWallet} />

        {passes.length === 0 ? (
          <section className="mt-10 rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
            <h2 className="text-xl font-semibold">No passes yet</h2>
            <p className="mt-2 text-zinc-600">
              Browse a published event and claim an available pass.
            </p>
            <Link
              className="mt-5 inline-flex rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white"
              href="/events"
            >
              Discover events
            </Link>
          </section>
        ) : (
          <section className="mt-10 grid gap-5 sm:grid-cols-2">
            {passes.map((pass) => (
              <article
                className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"
                key={pass.id}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-blue-700">
                      {pass.ticketType.name}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold">
                      {pass.event.name}
                    </h2>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                    {pass.status}
                  </span>
                </div>

                <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                  <Fact label="Date" value={formatDate(pass.event.startsAt)} />
                  <Fact
                    label="Location"
                    value={pass.event.location ?? "To be announced"}
                  />
                  <Fact
                    label="Price"
                    value={formatPrice(pass.ticketType.price)}
                  />
                </dl>

                <p className="mt-5 border-t border-zinc-200 pt-4 text-sm text-zinc-500">
                  {pass.onChainStatus === "ON_CHAIN_VERIFIED"
                    ? "ON-CHAIN VERIFIED"
                    : "Off-chain Pass · On-chain mint pending"}
                </p>

                {pass.onChainStatus === "ON_CHAIN_VERIFIED" &&
                pass.tokenId &&
                pass.mintTxHash &&
                pass.contractAddress &&
                pass.chainId ? (
                  <OnChainDetails pass={pass} />
                ) : (
                  <div className="mt-4">
                    <button
                      className="w-full rounded-lg bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={
                        mintingPassId !== null ||
                        !wallet ||
                        Boolean(
                          connectedAddress &&
                          wallet.address.toLowerCase() !==
                            connectedAddress.toLowerCase(),
                        )
                      }
                      onClick={() => void mintPass(pass.id)}
                      type="button"
                    >
                      {mintingPassId === pass.id
                        ? "Minting… Waiting for confirmation…"
                        : "Mint On-chain"}
                    </button>
                    {!wallet ? (
                      <p className="mt-2 text-sm text-amber-700">
                        Bind a verified wallet before minting.
                      </p>
                    ) : null}
                    {mintErrors[pass.id] ? (
                      <p className="mt-2 text-sm text-red-700" role="alert">
                        {mintErrors[pass.id]}
                      </p>
                    ) : null}
                  </div>
                )}
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function OnChainDetails({ pass }: { pass: PassView }) {
  if (
    !pass.tokenId ||
    !pass.mintTxHash ||
    !pass.contractAddress ||
    !pass.chainId
  ) {
    return null;
  }

  const explorerUrl = getTransactionExplorerUrl(
    pass.chainId,
    pass.mintTxHash as Hash,
  );

  return (
    <dl className="mt-4 space-y-3 text-sm">
      <Fact label="Token" value={`#${pass.tokenId}`} />
      <Fact label="Contract" value={shortenHex(pass.contractAddress)} />
      <Fact label="Transaction" value={shortenHex(pass.mintTxHash)} />
      {explorerUrl ? (
        <div>
          <a
            className="font-medium text-blue-700 underline"
            href={explorerUrl}
            rel="noreferrer"
            target="_blank"
          >
            View Transaction
          </a>
        </div>
      ) : null}
    </dl>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="mt-1 font-medium text-zinc-950">{value}</dd>
    </div>
  );
}

function PageState({
  children,
  description,
  title,
}: {
  children?: React.ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <main className="grid min-h-screen place-items-center bg-zinc-50 px-6 text-zinc-950">
      <section className="max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description ? (
          <p className="mt-3 text-zinc-600">{description}</p>
        ) : null}
        {children ? <div className="mt-5">{children}</div> : null}
      </section>
    </main>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatPrice(price: string) {
  return price === "0" ? "Free" : `${price} minor units`;
}

function shortenHex(value: string) {
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { useAccount } from "wagmi";
import { toast } from "sonner";
import {
  CHAINPASS_SEPOLIA_CHAIN_ID,
  getAddressExplorerUrl,
  getTransactionExplorerUrl,
  type Address,
  type Hash,
} from "@chainpass/web3";
import {
  ArrowLeft,
  ExternalLink,
  Fingerprint,
  ShieldCheck,
  Ticket,
  CheckCircle2,
} from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";
import { passesQuery, walletQuery } from "@/lib/queries";
import { formatDate, errorMessage } from "@/lib/presentation";
import { getMotionTransition } from "@/lib/design/motion";
import {
  LoadingCards,
  ErrorState,
  EmptyState,
  StatusBadge,
  Detail,
} from "@/components/chainpass/page-kit";
import { DynamicQr } from "@/components/passes/dynamic-qr";
import { WalletPanel } from "../wallet-panel";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";

export function PassDetail({ passId }: { passId: string }) {
  const { data: session } = useSession();
  const { address } = useAccount();
  const cache = useQueryClient();
  const reduced = useReducedMotion();
  const passes = useQuery({
    ...passesQuery(session?.user.id),
    refetchInterval: 5_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
  });
  const wallet = useQuery(walletQuery(session?.user.id));
  const pass = passes.data?.find((item) => item.id === passId);
  const mismatch = Boolean(
    address &&
    wallet.data &&
    address.toLowerCase() !== wallet.data.address.toLowerCase(),
  );
  const mint = useMutation({
    mutationFn: () => apiClient.mintPass(passId),
    onSuccess: (result) => {
      cache.setQueryData(
        passesQuery(session?.user.id).queryKey,
        (previous: typeof passes.data) =>
          previous?.map((item) => (item.id === passId ? result.pass : item)),
      );
      void cache.invalidateQueries({
        queryKey: ["my-passes", session?.user.id],
      });
      toast.success(
        result.recovered
          ? "Your on-chain pass was recovered"
          : "Mint confirmed. Your pass is on-chain.",
      );
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      void cache.invalidateQueries({
        queryKey: ["my-passes", session?.user.id],
      });
    },
  });
  if (passes.isPending || !session) return <LoadingCards count={2} />;
  if (passes.isError)
    return (
      <ErrorState error={passes.error} retry={() => void passes.refetch()} />
    );
  if (!pass)
    return (
      <EmptyState
        title="Pass not found"
        description="This pass is not in your account."
        href="/my-passes"
        action="My passes"
      />
    );
  const onChain = pass.onChainStatus === "ON_CHAIN_VERIFIED";
  const txUrl =
    pass.chainId && pass.mintTxHash
      ? getTransactionExplorerUrl(pass.chainId, pass.mintTxHash as Hash)
      : null;
  const contractUrl =
    pass.chainId && pass.contractAddress
      ? getAddressExplorerUrl(pass.chainId, pass.contractAddress as Address)
      : null;
  return (
    <>
      <Button
        variant="ghost"
        className="mb-6"
        render={<Link href="/my-passes" />}
        nativeButton={false}
      >
        <ArrowLeft data-icon="inline-start" />
        My passes
      </Button>
      <div className="grid items-start gap-8 xl:grid-cols-[1.4fr_1fr]">
        <div style={{ perspective: "1200px" }}>
          <motion.article
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={reduced ? undefined : { rotateY: 1, rotateX: -1 }}
            transition={getMotionTransition(Boolean(reduced), "smooth")}
            className="relative overflow-hidden rounded-2xl border border-border-strong bg-card shadow-md"
          >
            <div className="brand-gradient h-1" />
            <div className="p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <p className="flex items-center gap-2 font-mono text-caption uppercase tracking-widest text-muted-foreground">
                  <Ticket className="size-4 text-primary" />
                  ChainPass / Digital boarding pass
                </p>
                <StatusBadge status={pass.status} />
              </div>
              <h1 className="mt-10 text-h1 font-semibold tracking-tight sm:text-display">
                {pass.event.name}
              </h1>
              <p className="mt-3 text-lg text-primary">
                {pass.ticketType.name}
              </p>
              <dl className="mt-8 grid gap-6 sm:grid-cols-2">
                <Detail label="Holder">{session.user.name}</Detail>
                <Detail label="Date">{formatDate(pass.event.startsAt)}</Detail>
                <Detail label="Until">{formatDate(pass.event.endsAt)}</Detail>
                <Detail label="Location">
                  {pass.event.location ?? "Location TBA"}
                </Detail>
              </dl>
            </div>
            <div className="grid gap-6 border-t border-dashed border-border-strong bg-surface-2/50 p-6 sm:p-8 md:grid-cols-[1fr_auto]">
              <div className="flex flex-col justify-between gap-8">
                <div>
                  <p className="mb-3 font-mono text-caption uppercase tracking-widest text-muted-foreground">
                    Entry credential
                  </p>
                  <h2 className="text-h3 font-semibold">
                    {pass.status === "ACTIVE"
                      ? "Ready when you are."
                      : pass.status === "CHECKED_IN"
                        ? "You're in."
                        : "Entry unavailable."}
                  </h2>
                  <p className="mt-3 max-w-xs text-body-sm text-muted-foreground">
                    Your dynamic QR is for onsite verification. Admission works
                    without a wallet or on-chain mint.
                  </p>
                </div>
                <dl className="flex flex-col gap-4">
                  <Detail label="Pass serial" mono>
                    {pass.id}
                  </Detail>
                  <Detail label="Issued">{formatDate(pass.createdAt)}</Detail>
                </dl>
              </div>
              <DynamicQr
                key={pass.id}
                passId={pass.id}
                ownerId={session.user.id}
                status={pass.status}
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-6 py-5 sm:px-8">
              <span className="flex items-center gap-2 text-caption text-info">
                <Fingerprint className="size-4" />
                {onChain
                  ? "On-chain verified · Token #" + pass.tokenId
                  : pass.status === "ACTIVE"
                    ? "Off-chain / Valid digital pass"
                    : "Off-chain / Digital pass"}
              </span>
              <span className="font-mono text-caption text-muted-foreground">
                {pass.chainId ?? CHAINPASS_SEPOLIA_CHAIN_ID} /{" "}
                {pass.chainId == null ||
                pass.chainId === CHAINPASS_SEPOLIA_CHAIN_ID
                  ? "SEPOLIA"
                  : "CHAIN"}
              </span>
            </div>
          </motion.article>
        </div>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {onChain ? (
                  <ShieldCheck className="size-5 text-info" />
                ) : (
                  <Fingerprint className="size-5 text-primary" />
                )}
                {onChain ? "On-chain verified" : "Make your pass verifiable"}
              </CardTitle>
              <CardDescription>
                {onChain
                  ? pass.chainId === CHAINPASS_SEPOLIA_CHAIN_ID
                    ? "A unique ERC-721 identity, confirmed on Ethereum Sepolia."
                    : `A unique ERC-721 identity, recorded on chain ${pass.chainId}.`
                  : "Mint to your verified wallet. The platform issuer pays testnet gas."}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {onChain ? (
                <>
                  <div className="rounded-xl border border-info/20 bg-info/5 p-5">
                    <p className="flex items-center gap-2 text-info">
                      <CheckCircle2 className="size-5" />
                      ON-CHAIN VERIFIED
                    </p>
                    <p className="mt-3 font-mono text-h2">
                      Token #{pass.tokenId}
                    </p>
                  </div>
                  <dl className="flex flex-col gap-4">
                    <Detail label="Network" mono>
                      {pass.chainId === CHAINPASS_SEPOLIA_CHAIN_ID
                        ? "Ethereum Sepolia / " + pass.chainId
                        : "Chain " + pass.chainId}
                    </Detail>
                    <Detail label="Contract" mono>
                      {pass.contractAddress}
                    </Detail>
                    <Detail label="Mint transaction" mono>
                      {pass.mintTxHash}
                    </Detail>
                  </dl>
                  <div className="flex flex-wrap gap-2">
                    {txUrl && (
                      <Button
                        variant="outline"
                        nativeButton={false}
                        render={
                          <a
                            href={txUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        }
                      >
                        Transaction
                        <ExternalLink data-icon="inline-end" />
                      </Button>
                    )}
                    {contractUrl && (
                      <Button
                        variant="ghost"
                        nativeButton={false}
                        render={
                          <a
                            href={contractUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        }
                      >
                        Contract
                        <ExternalLink data-icon="inline-end" />
                      </Button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <p className="text-body-sm text-muted-foreground">
                    {wallet.data
                      ? "Recipient: " + wallet.data.address
                      : "Bind your wallet below to enable minting."}
                  </p>
                  <Button
                    className="h-11 w-full"
                    disabled={
                      mint.isPending ||
                      pass.status !== "ACTIVE" ||
                      !wallet.data ||
                      mismatch ||
                      wallet.data.chainId !== CHAINPASS_SEPOLIA_CHAIN_ID
                    }
                    onClick={() => {
                      toast.info(
                        "Mint requested. Waiting for the issuer and transaction confirmation.",
                      );
                      mint.mutate();
                    }}
                  >
                    {mint.isPending && <Spinner data-icon="inline-start" />}
                    {mint.isPending
                      ? "Confirming on Ethereum Sepolia…"
                      : pass.status !== "ACTIVE"
                        ? "Only active passes can be minted"
                        : !wallet.data
                          ? "Bind a wallet to mint"
                          : "Mint on-chain"}
                  </Button>
                  <p className="text-caption text-muted-foreground">
                    No wallet transaction is required. A retry recovers the same
                    token if confirmation succeeded.
                  </p>
                  {mint.isPending && (
                    <Alert>
                      <AlertTitle>Keep this page open</AlertTitle>
                      <AlertDescription>
                        Confirmation can take a moment. Your QR remains
                        independent of minting.
                      </AlertDescription>
                    </Alert>
                  )}
                  {mint.isError && (
                    <ErrorState
                      title="Mint could not be confirmed"
                      error={mint.error}
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
          {wallet.isPending ? (
            <LoadingCards count={1} />
          ) : wallet.isError ? (
            <ErrorState
              title="Unable to load wallet"
              error={wallet.error}
              retry={() => void wallet.refetch()}
            />
          ) : (
            <WalletPanel wallet={wallet.data} />
          )}
        </div>
      </div>
    </>
  );
}

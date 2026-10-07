"use client";

import { useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiClientError } from "@chainpass/api-client";
import { QRCodeSVG } from "qrcode.react";
import { RefreshCw, ScanLine } from "lucide-react";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { errorMessage } from "@/lib/presentation";

function subscribeClock(callback: () => void) {
  const timer = window.setInterval(callback, 1_000);
  return () => window.clearInterval(timer);
}
const nowSeconds = () => Math.floor(Date.now() / 1_000);

export function DynamicQr({
  passId,
  ownerId,
  status,
}: {
  passId: string;
  ownerId: string;
  status: string;
}) {
  const cache = useQueryClient();
  const now = useSyncExternalStore(subscribeClock, nowSeconds, () => 0);
  const token = useQuery({
    queryKey: ["pass-qr", ownerId, passId],
    enabled: status === "ACTIVE",
    staleTime: 0,
    gcTime: 0,
    retry: false,
    queryFn: async () => {
      try {
        return await apiClient.createPassVerificationToken(passId);
      } catch (error) {
        if (error instanceof ApiClientError && error.code === "PASS_NOT_ACTIVE")
          void cache.invalidateQueries({ queryKey: ["my-passes", ownerId] });
        throw error;
      }
    },
    refetchInterval: (query) =>
      query.state.status === "error"
        ? false
        : Math.max(
            1_000,
            new Date(query.state.data?.expiresAt ?? 0).getTime() -
              Date.now() -
              10_000,
          ),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: "always",
  });
  const remaining =
    token.data && now
      ? Math.max(
          0,
          Math.ceil(new Date(token.data.expiresAt).getTime() / 1_000 - now),
        )
      : 0;
  if (status !== "ACTIVE")
    return (
      <div className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
        <ScanLine className="size-10 text-muted-foreground" />
        <h3 className="text-h3 font-semibold">{status.replaceAll("_", " ")}</h3>
        <p className="max-w-60 text-body-sm text-muted-foreground">
          {status === "CHECKED_IN"
            ? "You're checked in. This pass cannot be used again."
            : "This pass is no longer valid for entry."}
        </p>
      </div>
    );
  return (
    <div className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
      {remaining > 0 && token.data ? (
        <>
          <div className="w-full max-w-60 rounded-lg bg-foreground p-2">
            <QRCodeSVG
              aria-label="Short-lived ChainPass verification QR"
              value={token.data.token}
              size={220}
              level="M"
              marginSize={4}
              bgColor="var(--foreground)"
              fgColor="var(--background)"
              className="h-auto w-full"
            />
          </div>
          <p className="font-mono text-body-sm text-info">
            Expires in {remaining}s
          </p>
          <p className="max-w-64 text-caption text-muted-foreground">
            {token.isFetching
              ? "Refreshing secure code…"
              : "Show this at the gate. Renews automatically before expiry."}
          </p>
        </>
      ) : token.isFetching ? (
        <>
          <Spinner className="size-8" />
          <p className="text-body-sm text-muted-foreground">
            Preparing your entry code…
          </p>
        </>
      ) : (
        <>
          <ScanLine className="size-10 text-muted-foreground" />
          <p className="text-body-sm">
            {token.isError ? "QR unavailable" : "QR expired"}
          </p>
          <p className="max-w-64 text-caption text-muted-foreground">
            {token.isError
              ? errorMessage(token.error)
              : "Refresh to get a new entry code."}
          </p>
        </>
      )}
      {!token.isFetching && (
        <Button size="sm" variant="ghost" onClick={() => void token.refetch()}>
          <RefreshCw data-icon="inline-start" />
          Refresh QR
        </Button>
      )}
    </div>
  );
}

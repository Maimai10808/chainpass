import { useState } from "react";
import { Linking, Text } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAddressExplorerUrl,
  getTransactionExplorerUrl,
  type Address,
  type Hash,
} from "@chainpass/web3";
import { apiClient } from "@/lib/api-client";
import { useSession } from "@/lib/auth-client";
import { keys } from "@/lib/product";
import { errorMessage } from "@/lib/errors";
import { useScreenActive } from "@/hooks/use-screen-active";
import {
  colors,
  duration,
  spacing,
  triggerHaptic,
  useReducedMotionPreference,
} from "@/design";
import Animated, { FadeIn } from "react-native-reanimated";
import { ShieldCheck } from "lucide-react-native";
import { RoleGate } from "@/components/chainpass/session";
import { WalletPanel } from "@/components/chainpass/wallet-panel";
import { HolographicPass } from "@/components/chainpass/pass-visual";
import { QrPanel } from "@/components/chainpass/qr-panel";
import {
  Screen,
  Card,
  Fact,
  ActionButton,
  Feedback,
  SkeletonList,
  ScreenState,
  Sheet,
  text,
} from "@/components/chainpass/ui";
export default function PassDetail() {
  return (
    <RoleGate roles={["user", "admin"]}>
      <PassContent />
    </RoleGate>
  );
}
function PassContent() {
  const { passId } = useLocalSearchParams<{ passId: string }>();
  const { data: session } = useSession();
  const uid = session!.user.id;
  const active = useScreenActive();
  const reduced = useReducedMotionPreference();
  const client = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const passes = useQuery({
    queryKey: keys.passes(uid),
    queryFn: () => apiClient.getMyPasses(),
    enabled: active,
    refetchInterval: active ? 5000 : false,
  });
  const wallet = useQuery({
    queryKey: keys.wallet(uid),
    queryFn: () => apiClient.getMyWallet(),
  });
  const mint = useMutation({
    mutationFn: (request: { userId: string; passId: string }) =>
      apiClient.mintPass(request.passId),
    onSuccess: (result, request) => {
      const key = keys.passes(request.userId);
      client.setQueryData<Awaited<ReturnType<typeof apiClient.getMyPasses>>>(
        key,
        (cached) => cached?.map((pass) =>
          pass.id === request.passId ? result.pass : pass,
        ),
      );
      void client.invalidateQueries({ queryKey: key });
      setConfirm(false);
      void triggerHaptic("success");
    },
    onError: () => {
      void triggerHaptic("error");
    },
  });
  if (passes.isPending) return <SkeletonList />;
  if (passes.isError && !passes.data)
    return (
      <ScreenState
        title="Pass unavailable"
        description={errorMessage(passes.error)}
        action={
          <ActionButton label="Retry" onPress={() => void passes.refetch()} />
        }
      />
    );
  const pass = passes.data?.find((pass) => pass.id === passId);
  if (!pass)
    return (
      <ScreenState
        title="Pass not found"
        description="This pass is not available to your account."
      />
    );
  const tx =
    pass.chainId && pass.mintTxHash
      ? getTransactionExplorerUrl(pass.chainId, pass.mintTxHash as Hash)
      : null;
  const contract =
    pass.chainId && pass.contractAddress
      ? getAddressExplorerUrl(pass.chainId, pass.contractAddress as Address)
      : null;
  return (
    <Screen>
      <HolographicPass pass={pass} holder={session!.user.name} interactive>
        <QrPanel passId={passId} userId={uid} status={pass.status} />
      </HolographicPass>
      <Card>
        <Text style={text.subheading}>On-chain proof</Text>
        <Fact label="Network" value="Ethereum Sepolia · 11155111" />
        {pass.onChainStatus === "ON_CHAIN_VERIFIED" ? (
          <Animated.View
            entering={reduced ? undefined : FadeIn.duration(duration.normal)}
            style={{ gap: spacing[16] }}
          >
            <ShieldCheck
              size={32}
              color={colors.brand.cyan}
              accessibilityLabel="Confirmed on-chain proof"
            />
            <Feedback
              tone="info"
              message="ON-CHAIN VERIFIED — your unique ERC-721 pass has been confirmed."
            />
            <Fact label="Token ID" value={`#${pass.tokenId}`} mono />
            <Fact label="Transaction" value={pass.mintTxHash!} mono />
            <Fact label="Contract" value={pass.contractAddress!} mono />
            {tx && (
              <ActionButton
                tone="secondary"
                label="View transaction"
                onPress={() => void Linking.openURL(tx).catch(() => {})}
              />
            )}
            {contract && (
              <ActionButton
                tone="secondary"
                label="View contract"
                onPress={() => void Linking.openURL(contract).catch(() => {})}
              />
            )}
          </Animated.View>
        ) : (
          <>
            <Text style={text.body}>
              Mint a unique, non-transferable pass to your verified wallet. Your
              entry QR works without minting.
            </Text>
            <ActionButton
              label={
                wallet.data ? "Mint on-chain" : "Bind a wallet below to mint"
              }
              disabled={!wallet.data || pass.status !== "ACTIVE"}
              loading={mint.isPending}
              onPress={() => setConfirm(true)}
            />
            {mint.isPending && (
              <Feedback
                tone="violet"
                message="MINTING — waiting for the network receipt. You can safely refresh to recover the result."
              />
            )}
            {mint.isError && <Feedback message={errorMessage(mint.error)} />}
          </>
        )}
      </Card>
      <WalletPanel />
      <Sheet
        visible={confirm}
        title="Mint your pass?"
        onClose={() => {
          if (!mint.isPending) setConfirm(false);
        }}
      >
        <Text style={text.body}>
          ChainPass will issue this pass on Ethereum Sepolia to your verified
          wallet. It cannot be transferred. No payment or wallet transaction
          signature is requested.
        </Text>
        {wallet.data && (
          <Fact label="Recipient" value={wallet.data.address} mono />
        )}
        <ActionButton
          label="Confirm mint"
          loading={mint.isPending}
          onPress={() => mint.mutate({ userId: uid, passId })}
        />
        {mint.isError && <Feedback message={errorMessage(mint.error)} />}
      </Sheet>
    </Screen>
  );
}

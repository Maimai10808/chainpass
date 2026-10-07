"use client";
import { ErrorState } from "@/components/chainpass/page-kit";
export default function ErrorBoundary({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <ErrorState retry={retry} />;
}

"use client";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "@/lib/auth-client";
import { passesQuery } from "@/lib/queries";
import {
  PageHeading,
  LoadingCards,
  ErrorState,
  EmptyState,
} from "@/components/chainpass/page-kit";
import { PassCard } from "@/components/passes/pass-card";

export default function MyPassesPage() {
  const { data: session } = useSession();
  const query = useQuery(passesQuery(session?.user.id));
  return (
    <>
      <PageHeading
        eyebrow="Collection / digital passes"
        title="Your moments. All here."
        description="From the first claim to the final check-in. Your passes stay with you."
      />
      {query.isPending ? (
        <LoadingCards />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : query.data.length ? (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {query.data.map((pass) => (
            <PassCard pass={pass} key={pass.id} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Your collection starts with an experience"
          description="Claim a pass from a published event. No wallet needed to get started."
          href="/events"
        />
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  Ticket,
  Fingerprint,
  ScanLine,
  Globe2,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EventCard } from "@/components/events/event-card";
import {
  EmptyState,
  ErrorState,
  LoadingCards,
} from "@/components/chainpass/page-kit";
import { eventsQuery } from "@/lib/queries";
import { useSession } from "@/lib/auth-client";
import { roleHome } from "@/lib/navigation";
import { getMotionTransition } from "@/lib/design/motion";

export function HomeExperience() {
  const { data: session } = useSession();
  const events = useQuery(eventsQuery);
  const reduced = useReducedMotion();
  return (
    <>
      <section className="grid items-center gap-14 pb-16 pt-6 lg:grid-cols-[1.2fr_1fr] lg:pb-24 lg:pt-12">
        <div>
          <Badge variant="outline">
            <span className="mr-1 size-1.5 rounded-full bg-info" />
            Built for real experiences
          </Badge>
          <h1 className="mt-7 max-w-2xl text-5xl font-semibold leading-[1.05] tracking-tighter sm:text-6xl lg:text-7xl">
            Be there.
            <br />
            Make it <span className="text-gradient">yours.</span>
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
            Not just a ticket. Your place in the moment.
            <br className="hidden sm:block" />
            Claim a pass, prove ownership, and walk right in.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button
              size="lg"
              className="h-12 px-6"
              nativeButton={false}
              render={<Link href="/events" />}
            >
              Explore experiences
              <ArrowUpRight data-icon="inline-end" />
            </Button>
            <Button
              size="lg"
              className="h-12 px-6"
              variant="outline"
              nativeButton={false}
              render={
                <Link
                  href={session ? roleHome(session.user.role) : "/register"}
                />
              }
            >
              {session ? "Open my workspace" : "Get started"}
            </Button>
          </div>
          <p className="mt-7 flex items-center gap-2 font-mono text-caption text-muted-foreground">
            <Fingerprint className="size-4 text-info" />
            One identity. Verifiable ownership. Seamless entry.
          </p>
        </div>
        <motion.div
          initial={reduced ? false : { opacity: 0, y: 20, rotate: -3 }}
          animate={{ opacity: 1, y: 0, rotate: -3 }}
          whileHover={reduced ? undefined : { rotate: 0, y: -4 }}
          transition={getMotionTransition(Boolean(reduced), "smooth")}
          className="relative mx-auto w-full max-w-md"
        >
          <div
            aria-hidden="true"
            className="absolute -inset-6 rounded-2xl bg-brand-violet/5 blur-2xl"
          />
          <div className="relative overflow-hidden rounded-2xl border border-border-strong bg-card shadow-md">
            <div className="brand-gradient h-1" />
            <div className="p-8">
              <div className="flex items-start justify-between">
                <span className="font-mono text-caption uppercase tracking-widest text-muted-foreground">
                  ChainPass / Digital entry
                </span>
                <Ticket className="size-6 text-primary" />
              </div>
              <p className="mt-14 text-4xl font-semibold leading-tight tracking-tight">
                A moment
                <br />
                worth keeping.
              </p>
              <p className="mt-4 text-body-sm text-muted-foreground">
                Your experience. Your pass. Your proof.
              </p>
              <div className="mt-10 grid grid-cols-2 gap-6">
                <div>
                  <p className="font-mono text-caption text-muted-foreground">
                    NETWORK
                  </p>
                  <p className="mt-2 text-body-sm">Ethereum Sepolia</p>
                </div>
                <div>
                  <p className="font-mono text-caption text-muted-foreground">
                    IDENTITY
                  </p>
                  <p className="mt-2 text-body-sm text-info">Yours to verify</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-dashed border-border-strong px-8 py-6">
              <span className="font-mono text-caption text-muted-foreground">
                VISUAL PREVIEW · NOT AN ISSUED PASS
              </span>
              <ArrowUpRight className="size-5 text-primary" />
            </div>
          </div>
        </motion.div>
      </section>
      <Separator />
      <section className="grid gap-8 py-14 sm:grid-cols-3">
        {[
          {
            icon: Ticket,
            step: "01",
            title: "Find your experience",
            copy: "Browse published events and claim the pass that gets you there.",
          },
          {
            icon: Fingerprint,
            step: "02",
            title: "Make it yours",
            copy: "Keep your pass off-chain or bind your wallet and mint a unique token.",
          },
          {
            icon: ScanLine,
            step: "03",
            title: "Walk right in",
            copy: "Show your short-lived QR at the door. Verify first, check in once.",
          },
        ].map(({ icon: Icon, step, title, copy }) => (
          <div key={step}>
            <div className="mb-5 flex items-center justify-between">
              <Icon className="size-6 text-primary" />
              <span className="font-mono text-caption text-muted-foreground">
                / {step}
              </span>
            </div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-3 text-body-sm leading-relaxed text-muted-foreground">
              {copy}
            </p>
          </div>
        ))}
      </section>
      <section className="py-8">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-2 font-mono text-caption uppercase tracking-widest text-primary">
              Discover / Live
            </p>
            <h2 className="text-h2 font-semibold tracking-tight">
              Your next experience
            </h2>
          </div>
          <Button
            variant="ghost"
            nativeButton={false}
            render={<Link href="/events" />}
          >
            All events
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
        {events.isPending ? (
          <LoadingCards />
        ) : events.isError ? (
          <ErrorState
            error={events.error}
            retry={() => void events.refetch()}
          />
        ) : events.data.length ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {events.data.slice(0, 3).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="New experiences are on the way"
            description="As soon as organizers publish, you'll find their events here."
          />
        )}
      </section>
      <section className="mt-12 flex flex-col justify-between gap-6 rounded-xl border border-border-subtle bg-surface-1 p-8 md:flex-row md:items-center">
        <div>
          <h2 className="flex items-center gap-3 text-h3 font-semibold">
            <Globe2 className="size-5 text-info" />A little more proof. A lot
            less friction.
          </h2>
          <p className="mt-3 max-w-2xl text-body-sm text-muted-foreground">
            Wallet ownership is verified by signature. Minting runs on Ethereum
            Sepolia. Your QR and entry work even without a wallet.
          </p>
        </div>
        <span className="shrink-0 font-mono text-caption text-info">
          SEPOLIA / 11155111
        </span>
      </section>
    </>
  );
}

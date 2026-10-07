"use client";
import Link from "next/link";
import type { PassView } from "@chainpass/api-client";
import {
  CalendarDays,
  MapPin,
  ArrowUpRight,
  Ticket,
  ShieldCheck,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/chainpass/page-kit";
import { formatDate, shorten } from "@/lib/presentation";

export function PassCard({ pass }: { pass: PassView }) {
  return (
    <Card className="relative overflow-hidden">
      <div className="brand-gradient absolute inset-x-0 top-0 h-0.5" />
      <CardHeader>
        <div className="mb-4 flex items-center justify-between gap-3">
          <Ticket className="size-5 text-primary" />
          <StatusBadge status={pass.status} />
        </div>
        <CardTitle className="text-xl">{pass.event.name}</CardTitle>
        <CardDescription>{pass.ticketType.name}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-body-sm text-muted-foreground">
        <p className="flex items-center gap-2">
          <CalendarDays className="size-4 shrink-0" />
          {formatDate(pass.event.startsAt)}
        </p>
        <p className="flex items-center gap-2">
          <MapPin className="size-4 shrink-0" />
          {pass.event.location ?? "Location TBA"}
        </p>
        <p className="mt-1 flex items-center gap-2 text-info">
          <ShieldCheck className="size-4" />
          {pass.onChainStatus === "ON_CHAIN_VERIFIED"
            ? "On-chain · Token #" + pass.tokenId
            : "Off-chain pass"}
        </p>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-dashed border-border pt-5">
        <span className="font-mono text-caption text-muted-foreground">
          {shorten(pass.id)}
        </span>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link href={"/my-passes/" + pass.id} />}
        >
          Open pass
          <ArrowUpRight data-icon="inline-end" />
        </Button>
      </CardFooter>
    </Card>
  );
}

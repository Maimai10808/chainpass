"use client";

import Link from "next/link";
import { cn } from "cn";
import { ArrowRight, CircleAlert, Ticket } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyMedia,
  EmptyContent,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { getStatusClasses } from "@/lib/design/status";
import { errorMessage } from "@/lib/presentation";

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="mb-3 font-mono text-caption uppercase tracking-widest text-primary">
            {eyebrow}
          </p>
        )}
        <h1 className="text-h1 font-semibold tracking-tight sm:text-display">
          {title}
        </h1>
        {description && (
          <p className="mt-3 text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </header>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge variant="outline" className={cn(getStatusClasses(status))}>
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

export function LoadingCards({ count = 3 }: { count?: number }) {
  return (
    <div
      className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
      aria-label="Loading content"
      aria-busy="true"
    >
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="mt-2 h-6 w-3/4" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mt-3 h-4 w-1/2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ErrorState({
  error,
  retry,
  title = "Something went wrong",
}: {
  error?: unknown;
  retry?: () => void;
  title?: string;
}) {
  return (
    <Alert variant="destructive">
      <CircleAlert />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        <p>{errorMessage(error)}</p>
        {retry && (
          <Button className="mt-3" variant="outline" onClick={retry}>
            Try again
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

export function EmptyState({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <Empty className="rounded-xl border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Ticket />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {href && (
        <EmptyContent>
          <Button render={<Link href={href} />} nativeButton={false}>
            {action ?? "Browse events"}
            <ArrowRight data-icon="inline-end" />
          </Button>
        </EmptyContent>
      )}
    </Empty>
  );
}

export function Detail({
  label,
  children,
  mono = false,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-1 break-words text-body-sm",
          mono && "break-all font-mono",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

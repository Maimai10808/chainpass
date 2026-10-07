"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { cn } from "cn";
import {
  Ticket,
  LogOut,
  ArrowUpRight,
  Menu,
  Wallet,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { useSession, signOut } from "@/lib/auth-client";
import { getRole, roleHome } from "@/lib/navigation";
import { walletQuery } from "@/lib/queries";
import { shorten } from "@/lib/presentation";

export function AppHeader() {
  const { data: session, isPending } = useSession();
  const path = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const wallet = useQuery(walletQuery(session?.user.id));
  const role = getRole(session?.user.role);
  const links = session
    ? role === "admin"
      ? [
          ["/admin", "Admin"],
          ["/admin/users", "Users"],
          ["/admin/events", "Events"],
        ]
      : role === "merchant"
        ? [
            ["/merchant", "Merchant"],
            ["/merchant/events", "Events"],
            ["/merchant/check-in", "Check-in"],
          ]
        : [
            ["/events", "Discover"],
            ["/my-passes", "My passes"],
          ]
    : [["/events", "Events"]];
  async function logout() {
    setSigningOut(true);
    try {
      const result = await signOut();
      if (result.error) throw new Error(result.error.message);
      queryClient.clear();
      toast.success("Signed out");
      router.replace("/");
      router.refresh();
    } catch {
      toast.error("Unable to sign out. Please retry.");
    } finally {
      setSigningOut(false);
    }
  }
  const nav = (
    <>
      {links.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          onClick={() => setMobileOpen(false)}
          aria-current={path === href ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-2 text-body-sm transition-colors hover:bg-accent hover:text-foreground",
            path === href
              ? "bg-accent text-foreground"
              : "text-muted-foreground",
          )}
        >
          {label}
        </Link>
      ))}
    </>
  );
  return (
    <header className="sticky top-0 z-sticky border-b border-border-subtle bg-background/90 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label="ChainPass home"
        >
          <span className="flex size-9 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
            <Ticket className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            ChainPass<span className="ml-1 text-primary">/</span>
          </span>
        </Link>
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-1 md:flex"
        >
          {nav}
        </nav>
        <div className="flex items-center gap-3">
          {!isPending && session ? (
            <>
              {wallet.data && (
                <Link
                  href="/my-passes"
                  className="hidden items-center gap-2 font-mono text-caption text-muted-foreground lg:flex"
                >
                  <Wallet className="size-4 text-info" />
                  {shorten(wallet.data.address)}
                </Link>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger
                  aria-label={`User menu: ${session.user.name}`}
                  render={<Button variant="ghost" className="gap-2" />}
                >
                  <Avatar className="size-7">
                    <AvatarFallback>
                      {session.user.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:block">{session.user.name}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{session.user.email}</DropdownMenuLabel>
                    <DropdownMenuItem render={<Link href={roleHome(role)} />}>
                      <ShieldCheck />
                      {role === "user"
                        ? "Discover events"
                        : `${role} workspace`}
                    </DropdownMenuItem>
                    <DropdownMenuItem render={<Link href="/my-passes" />}>
                      <Ticket />
                      My passes
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      disabled={signingOut}
                      onClick={() => void logout()}
                    >
                      <LogOut />
                      {signingOut ? "Signing out…" : "Sign out"}
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : !isPending ? (
            <>
              <Button
                variant="ghost"
                render={<Link href="/login" />}
                nativeButton={false}
              >
                Sign in
              </Button>
              <Button
                className="hidden sm:inline-flex"
                render={<Link href="/register" />}
                nativeButton={false}
              >
                Get started
                <ArrowUpRight data-icon="inline-end" />
              </Button>
            </>
          ) : (
            <span className="text-caption text-muted-foreground">
              Connecting…
            </span>
          )}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="md:hidden"
                  aria-label="Open navigation"
                />
              }
            >
              <Menu />
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>ChainPass</SheetTitle>
                <SheetDescription>
                  Your ticket to what comes next.
                </SheetDescription>
              </SheetHeader>
              <nav
                className="flex flex-col gap-2 p-6"
                aria-label="Mobile navigation"
              >
                {nav}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-border-subtle">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-caption text-muted-foreground sm:px-8">
        <span>ChainPass · Holographic Ticket System</span>
        <span className="font-mono">Ethereum Sepolia / testnet</span>
        <Link className="hover:text-foreground" href="/events">
          Find your next experience ↗
        </Link>
      </div>
    </footer>
  );
}

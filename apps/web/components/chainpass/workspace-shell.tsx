"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { RouteGate } from "@/components/auth/route-gate";
import {
  LayoutDashboard,
  CalendarDays,
  Plus,
  ScanLine,
  Users,
  ShieldCheck,
  Store,
} from "lucide-react";

export function WorkspaceShell({
  kind,
  children,
}: {
  kind: "merchant" | "admin";
  children: React.ReactNode;
}) {
  const path = usePathname();
  const items =
    kind === "admin"
      ? [
          { href: "/admin", label: "Overview", icon: LayoutDashboard },
          { href: "/admin/users", label: "Users", icon: Users },
          { href: "/admin/events", label: "Events", icon: CalendarDays },
        ]
      : [
          { href: "/merchant", label: "Overview", icon: LayoutDashboard },
          { href: "/merchant/events", label: "Events", icon: CalendarDays },
          { href: "/merchant/events/new", label: "Create event", icon: Plus },
          { href: "/merchant/check-in", label: "Check-in", icon: ScanLine },
        ];
  const Icon = kind === "admin" ? ShieldCheck : Store;
  return (
    <RouteGate roles={kind === "admin" ? ["admin"] : ["merchant", "admin"]}>
      <div className="flex flex-col gap-8 lg:flex-row">
        <aside className="shrink-0 lg:w-48">
          <p className="mb-5 flex items-center gap-2 text-label capitalize">
            <Icon className="size-4 text-primary" />
            {kind} workspace
          </p>
          <nav
            className="flex gap-1 overflow-x-auto lg:sticky lg:top-28 lg:flex-col"
            aria-label={`${kind} navigation`}
          >
            {items.map(({ href, label, icon: NavIcon }) => (
              <Link
                key={href}
                href={href}
                aria-current={path === href ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-3 rounded-lg px-3 py-3 text-body-sm",
                  path === href
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <NavIcon className="size-4" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </RouteGate>
  );
}

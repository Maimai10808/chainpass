"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listUsers, promoteMerchant } from "@/lib/admin-api";
import { useSession } from "@/lib/auth-client";
import {
  PageHeading,
  LoadingCards,
  ErrorState,
  EmptyState,
  StatusBadge,
} from "@/components/chainpass/page-kit";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";

const PAGE_SIZE = 20;
export default function AdminUsersPage() {
  const { data: session } = useSession();
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ search: "", role: "", offset: 0 });
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(
    null,
  );
  const cache = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-users", filters],
    queryFn: () => listUsers({ ...filters, limit: PAGE_SIZE }),
  });
  const promote = useMutation({
    mutationFn: promoteMerchant,
    onSuccess: () => {
      setSelected(null);
      void cache.invalidateQueries({ queryKey: ["admin-users"] });
      void cache.invalidateQueries({ queryKey: ["admin-user-counts"] });
      toast.success("Merchant access granted");
    },
    onError: () =>
      toast.error("Unable to grant merchant access. Please retry."),
  });
  return (
    <>
      <PageHeading
        eyebrow="Admin / identities"
        title="People make it happen."
        description="Registration always creates attendees. Grant organizer access here, through Better Auth."
      />
      <form
        className="mb-6"
        onSubmit={(event) => {
          event.preventDefault();
          setFilters((value) => ({
            ...value,
            search: search.trim(),
            offset: 0,
          }));
        }}
      >
        <FieldGroup className="items-end sm:flex-row">
          <Field className="sm:max-w-xs">
            <FieldLabel htmlFor="user-search">Email search</FieldLabel>
            <Input
              id="user-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
          <Field className="sm:max-w-44">
            <FieldLabel htmlFor="role-filter">Role</FieldLabel>
            <NativeSelect
              id="role-filter"
              value={filters.role}
              onChange={(event) =>
                setFilters((value) => ({
                  ...value,
                  role: event.target.value,
                  offset: 0,
                }))
              }
            >
              <NativeSelectOption value="">All roles</NativeSelectOption>
              <NativeSelectOption value="user">User</NativeSelectOption>
              <NativeSelectOption value="merchant">Merchant</NativeSelectOption>
              <NativeSelectOption value="admin">Admin</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Button type="submit" variant="outline" className="h-9">
            Search
          </Button>
        </FieldGroup>
      </form>
      {query.isPending ? (
        <LoadingCards count={2} />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : !query.data.users.length ? (
        <EmptyState
          title="No matching users"
          description="Try a different email or role filter."
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.data.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {user.name}
                      {user.id === session?.user.id && (
                        <span className="ml-2 text-caption text-muted-foreground">
                          (you)
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                      <StatusBadge
                        status={(user.role ?? "user").toUpperCase()}
                      />
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={user.banned ? "REVOKED" : "ACTIVE"}
                      />
                    </TableCell>
                    <TableCell>
                      {(user.role ?? "user") === "user" &&
                      user.id !== session?.user.id &&
                      !user.banned ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={promote.isPending}
                          onClick={() => {
                            promote.reset();
                            setSelected({ id: user.id, name: user.name });
                          }}
                        >
                          Grant merchant
                        </Button>
                      ) : (
                        <span className="text-caption text-muted-foreground">
                          No role action
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="mt-5 flex items-center justify-between gap-3">
            <p
              className="text-body-sm text-muted-foreground"
              aria-live="polite"
            >
              {filters.offset + 1}–
              {Math.min(filters.offset + PAGE_SIZE, query.data.total)} of{" "}
              {query.data.total}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={filters.offset === 0}
                onClick={() =>
                  setFilters((value) => ({
                    ...value,
                    offset: Math.max(0, value.offset - PAGE_SIZE),
                  }))
                }
              >
                Previous
              </Button>
              <Button
                variant="outline"
                disabled={filters.offset + PAGE_SIZE >= query.data.total}
                onClick={() =>
                  setFilters((value) => ({
                    ...value,
                    offset: value.offset + PAGE_SIZE,
                  }))
                }
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open && !promote.isPending) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant merchant access?</DialogTitle>
            <DialogDescription>
              {selected?.name} will be able to create events, issue ticket types
              and check in their attendees. This screen only promotes users; it
              cannot demote administrators.
            </DialogDescription>
          </DialogHeader>
          {promote.isError && (
            <ErrorState title="Role change failed" error={promote.error} />
          )}
          <DialogFooter>
            <Button
              variant="outline"
              disabled={promote.isPending}
              onClick={() => setSelected(null)}
            >
              Cancel
            </Button>
            <Button
              disabled={promote.isPending || !selected}
              onClick={() => selected && promote.mutate(selected.id)}
            >
              {promote.isPending && <Spinner data-icon="inline-start" />}Confirm
              merchant access
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

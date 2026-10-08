import { invitationTokenSchema } from "@chainpass/schemas";

// Pending auth handoff is deliberately shorter-lived than an organizer's link.
export const PENDING_INVITATION_RETENTION_MS = 30 * 60 * 1000;
export type PendingInvitation = {
  token: string;
  storedAt: number;
  expiresAt?: string;
};
export type InvitationReason =
  "missing" | "invalid" | "expired" | "revoked" | "exhausted" | "unavailable";
type Snapshot = {
  ready: boolean;
  revision: number;
  value: PendingInvitation | null;
  reason: InvitationReason;
  persistent: boolean;
};
type Storage = {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  remove(): Promise<void>;
};

export function readPendingInvitation(
  raw: string | null,
  now = Date.now(),
): PendingInvitation | null {
  try {
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (
      !invitationTokenSchema.safeParse(value?.token).success ||
      !Number.isFinite(value.storedAt) ||
      value.storedAt > now ||
      now - value.storedAt >= PENDING_INVITATION_RETENTION_MS
    )
      return null;
    if (
      value.expiresAt !== undefined &&
      (!Number.isFinite(Date.parse(value.expiresAt)) ||
        Date.parse(value.expiresAt) <= now)
    )
      return null;
    return {
      token: value.token,
      storedAt: value.storedAt,
      ...(value.expiresAt ? { expiresAt: value.expiresAt } : {}),
    };
  } catch {
    return null;
  }
}

/** Serialized storage plus revision checks prevent old reads/writes restoring a replaced link. */
export function createPendingInvitationStore(storage: Storage, now = Date.now) {
  let state: Snapshot = {
    ready: false,
    revision: 0,
    value: null,
    reason: "missing",
    persistent: true,
  };
  const listeners = new Set<() => void>();
  let queue = Promise.resolve();
  let hydration: Promise<void> | undefined;
  function publish(next: Snapshot) {
    state = next;
    listeners.forEach((listener) => listener());
  }
  function enqueue(action: () => Promise<void>) {
    queue = queue.then(action).catch(() => {
      // Never expose storage/provider errors, which may contain credentials.
      publish({ ...state, persistent: false });
    });
    return queue;
  }
  function clear(reason: InvitationReason = "missing") {
    publish({
      ...state,
      ready: true,
      revision: state.revision + 1,
      value: null,
      reason,
    });
    return enqueue(() => storage.remove());
  }
  return {
    getSnapshot: () => state,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    hydrate() {
      if (!hydration) {
        const revision = state.revision;
        hydration = enqueue(async () => {
          const raw = await storage.read();
          if (state.revision !== revision) return;
          const value = readPendingInvitation(raw, now());
          publish({ ...state, ready: true, value });
          if (raw && !value) await storage.remove();
        }).then(() => {
          if (!state.ready) publish({ ...state, ready: true });
        });
      }
      return hydration;
    },
    accept(token: string | null) {
      if (!invitationTokenSchema.safeParse(token).success)
        return clear("invalid");
      const value = { token: token!, storedAt: now() };
      publish({
        ...state,
        ready: true,
        revision: state.revision + 1,
        value,
        reason: "missing",
      });
      return enqueue(() => storage.write(JSON.stringify(value)));
    },
    setExpiry(token: string, expiresAt: string) {
      if (state.value?.token !== token) return Promise.resolve();
      if (
        !Number.isFinite(Date.parse(expiresAt)) ||
        Date.parse(expiresAt) <= now()
      )
        return clear("expired");
      if (state.value.expiresAt === expiresAt) return Promise.resolve();
      const value = { ...state.value, expiresAt };
      publish({ ...state, value });
      return enqueue(() => storage.write(JSON.stringify(value)));
    },
    clear,
  };
}

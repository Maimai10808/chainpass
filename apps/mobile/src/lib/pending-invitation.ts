import { useEffect, useSyncExternalStore } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { createPendingInvitationStore } from "./pending-invitation-store";

const key = "chainpass.pending-invitation";
export const pendingInvitation = createPendingInvitationStore({
  async read() {
    return Platform.OS === "web"
      ? typeof window === "undefined"
        ? null
        : window.sessionStorage.getItem(key)
      : SecureStore.getItemAsync(key);
  },
  async write(value) {
    if (Platform.OS === "web") window.sessionStorage.setItem(key, value);
    else await SecureStore.setItemAsync(key, value);
  },
  async remove() {
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") window.sessionStorage.removeItem(key);
    } else await SecureStore.deleteItemAsync(key);
  },
});

export function usePendingInvitation() {
  const state = useSyncExternalStore(
    pendingInvitation.subscribe,
    pendingInvitation.getSnapshot,
    pendingInvitation.getSnapshot,
  );
  useEffect(() => {
    void pendingInvitation.hydrate();
  }, []);
  return state;
}

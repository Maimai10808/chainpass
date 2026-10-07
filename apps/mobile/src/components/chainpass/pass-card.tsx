import { Link } from "expo-router";
import { memo } from "react";
import { Pressable } from "react-native";
import type { PassView } from "@chainpass/schemas";
import { HolographicPass } from "./pass-visual";
export const PassCard = memo(function PassCard({ pass }: { pass: PassView }) {
  return (
    <Link
      href={{ pathname: "/my-passes/[passId]", params: { passId: pass.id } }}
      asChild
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${pass.event.name}, ${pass.status}`}
        style={({ pressed }) => ({ opacity: pressed ? 0.88 : 1 })}
      >
        <HolographicPass pass={pass} />
      </Pressable>
    </Link>
  );
});

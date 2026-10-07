import * as Haptics from "expo-haptics";
import { AppState, Platform } from "react-native";

export type HapticFeedback =
  "selection" | "light" | "medium" | "success" | "warning" | "error";
const androidFeedback = {
  selection: Haptics.AndroidHaptics.Segment_Tick,
  light: Haptics.AndroidHaptics.Context_Click,
  medium: Haptics.AndroidHaptics.Long_Press,
  success: Haptics.AndroidHaptics.Confirm,
  warning: Haptics.AndroidHaptics.Context_Click,
  error: Haptics.AndroidHaptics.Reject,
} as const;
/** Meaningful user actions only. Never required for business success; safe to void. */
export async function triggerHaptic(
  feedback: HapticFeedback,
  options: { enabled?: boolean } = {},
): Promise<boolean> {
  if (
    options.enabled === false ||
    Platform.OS === "web" ||
    AppState.currentState !== "active"
  )
    return false;
  try {
    if (Platform.OS === "android")
      await Haptics.performAndroidHapticsAsync(androidFeedback[feedback]);
    else if (feedback === "selection") await Haptics.selectionAsync();
    else if (feedback === "light" || feedback === "medium")
      await Haptics.impactAsync(
        feedback === "light"
          ? Haptics.ImpactFeedbackStyle.Light
          : Haptics.ImpactFeedbackStyle.Medium,
      );
    else
      await Haptics.notificationAsync(
        feedback === "success"
          ? Haptics.NotificationFeedbackType.Success
          : feedback === "warning"
            ? Haptics.NotificationFeedbackType.Warning
            : Haptics.NotificationFeedbackType.Error,
      );
    return true;
  } catch {
    // Missing hardware, restricted environments and OS settings are normal fallbacks.
    return false;
  }
}

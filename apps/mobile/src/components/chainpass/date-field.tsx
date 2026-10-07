import { useState } from "react";
import { Platform, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { ActionButton, Field, text, layoutStyles } from "./ui";
import { formatEventDate } from "@/lib/format";
export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
}) {
  const [mode, setMode] = useState<"date" | "time" | null>(null);
  if (Platform.OS === "web")
    return (
      <WebDateField
        key={value.toISOString()}
        label={label}
        value={value}
        onChange={onChange}
      />
    );
  return (
    <View style={layoutStyles.section}>
      <Text style={text.label}>{label}</Text>
      <Text style={text.body}>{formatEventDate(value.toISOString())}</Text>
      <View style={layoutStyles.row}>
        <ActionButton
          tone="secondary"
          label="Choose date"
          onPress={() => setMode("date")}
        />
        <ActionButton
          tone="secondary"
          label="Choose time"
          onPress={() => setMode("time")}
        />
      </View>
      {mode && (
        <>
          <DateTimePicker
            themeVariant="dark"
            value={value}
            mode={mode}
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(event, next) => {
              if (Platform.OS === "android") setMode(null);
              if (event.type === "set" && next) onChange(next);
            }}
          />
          {Platform.OS === "ios" && (
            <ActionButton
              label="Done"
              tone="secondary"
              onPress={() => setMode(null)}
            />
          )}
        </>
      )}
    </View>
  );
}

// The native app uses the platform picker; this input only serves Expo Web previews.
function WebDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Date;
  onChange: (date: Date) => void;
}) {
  const [draft, setDraft] = useState(value.toISOString());
  const [invalid, setInvalid] = useState(false);
  return (
    <Field
      label={`${label} (ISO date/time with timezone)`}
      value={draft}
      onChangeText={setDraft}
      error={invalid ? "Enter a valid date including timezone." : undefined}
      onBlur={() => {
        const next = new Date(draft);
        const valid = Number.isFinite(next.getTime());
        setInvalid(!valid);
        if (valid) onChange(next);
      }}
    />
  );
}

import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams, useNavigation } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FontFamily, type AppTheme } from "@/constants/theme";
import {
  clampWalkMinutes,
  type CommuteProfile,
  DESTINATION_LABEL_MAX,
  describeStation,
  findProfile,
  normaliseDestinationLabel,
  normaliseProfileName,
  PROFILE_NAME_MAX,
  removeProfile,
  switchProfile,
  updateProfile,
  WALK_MINUTES_MAX,
  WALK_MINUTES_MIN,
} from "@/features/settings/domain/settings";
import {
  updateSettings,
  useSettings,
} from "@/features/settings/store/settings-store";
import {
  Button,
  controlStyles,
  Note,
  Section,
  TextField,
} from "@/features/settings/ui/controls";
import {
  hasUsableKey,
  useApiKeyState,
} from "@/features/train-tracker/api/api-key";
import { useSky } from "@/hooks/use-sky";

type Change = (profile: CommuteProfile) => CommuteProfile;

/**
 * Edit one commute profile. Changes save as you make them, like the rest of
 * Settings. A new profile (`new=1`) is already in the list but not in use:
 * "Add" switches to it, and leaving any other way removes it again.
 */
export function ProfileEditorScreen() {
  const { theme: t } = useSky();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ id: string; new?: string }>();
  const id = params.id;
  const isNew = params.new === "1";
  const settingsState = useSettings();
  const keyState = useApiKeyState();

  const settings =
    settingsState.status === "ready" ? settingsState.settings : null;
  const profile = settings && id ? findProfile(settings, id) : null;

  const change = (fn: Change) => {
    if (id) updateSettings((s) => updateProfile(s, id, fn));
  };

  // Text fields are edited locally so each keystroke doesn't write to
  // storage. They save when the field is left or the screen closes.
  const [name, setName] = useDraft(profile?.name ?? "");
  const [destination, setDestination] = useDraft(
    profile?.destinationLabel ?? "",
  );
  const commitText = () => {
    if (!profile) return;
    // An empty name goes back to the saved one.
    const nextName = normaliseProfileName(name) || profile.name;
    const nextDestination = normaliseDestinationLabel(destination);
    setName(nextName);
    setDestination(nextDestination);
    if (nextName !== profile.name) {
      change((p) => ({ ...p, name: nextName }));
    }
    if (nextDestination !== profile.destinationLabel) {
      change((p) => ({ ...p, destinationLabel: nextDestination }));
    }
  };

  // However the screen closes (a button, swipe down, Android back), keep
  // the text edits, or discard a new profile that wasn't added.
  const added = useRef(false);
  useEffect(() =>
    navigation.addListener("beforeRemove", () => {
      if (isNew && !added.current) {
        if (id) updateSettings((s) => removeProfile(s, id));
      } else {
        commitText();
      }
    }),
  );

  const close = () =>
    router.canGoBack() ? router.back() : router.replace("/settings");

  const add = () => {
    added.current = true;
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    if (id) updateSettings((s) => switchProfile(s, id));
    close();
  };

  const confirmRemove = () => {
    if (!profile) return;
    Alert.alert(
      `Remove “${profile.name}”?`,
      "Its station, destination and walk time will be forgotten.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            close();
            updateSettings((s) => removeProfile(s, profile.id));
          },
        },
      ],
    );
  };

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: t.card,
          // iOS shows this as a sheet below the status bar; Android goes full screen.
          paddingTop: Platform.OS === "ios" ? 20 : insets.top + 12,
        },
      ]}
    >
      <View style={styles.header}>
        {isNew ? (
          <HeaderAction theme={t} label="Cancel" onPress={close} />
        ) : (
          <View />
        )}
        <HeaderAction
          theme={t}
          label={isNew ? "Add" : "Done"}
          onPress={isNew ? add : close}
          disabled={isNew && !profile}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
      >
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: t.cardInk }]}
        >
          {isNew ? "New profile" : "Edit profile"}
        </Text>

        {profile && settings ? (
          <>
            <NameSection
              theme={t}
              value={name}
              onChangeText={setName}
              onCommit={commitText}
              autoFocus={isNew}
            />
            <StationSection
              theme={t}
              profile={profile}
              hasKey={hasUsableKey(keyState)}
            />
            <DestinationSection
              theme={t}
              value={destination}
              onChangeText={setDestination}
              onCommit={commitText}
              hasStation={profile.station != null}
            />
            <WalkSection
              theme={t}
              minutes={profile.walkMinutes}
              onChange={change}
            />
            {!isNew &&
              (settings.profiles.length > 1 ? (
                <View style={controlStyles.row}>
                  <Button
                    theme={t}
                    label="Remove profile"
                    variant="danger"
                    onPress={confirmRemove}
                  />
                </View>
              ) : (
                <Note theme={t}>
                  This is your only profile, so it can’t be removed.
                </Note>
              ))}
          </>
        ) : (
          settings && <Note theme={t}>This profile no longer exists.</Note>
        )}
      </ScrollView>
    </View>
  );
}

function HeaderAction({
  theme: t,
  label,
  onPress,
  disabled = false,
}: {
  theme: AppTheme;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      hitSlop={12}
      style={({ pressed }) => [
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.headerAction, { color: t.cardInk }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Local state for a text field that follows the saved value: when the
 * saved value changes (e.g. a new station sets the destination), so does
 * the draft.
 */
function useDraft(saved: string) {
  const [draft, setDraft] = useState(saved);
  const [lastSaved, setLastSaved] = useState(saved);
  if (lastSaved !== saved) {
    setLastSaved(saved);
    setDraft(saved);
  }
  return [draft, setDraft] as const;
}

type TextSectionProps = {
  theme: AppTheme;
  value: string;
  onChangeText: (text: string) => void;
  onCommit: () => void;
};

function NameSection({
  theme: t,
  value,
  onChangeText,
  onCommit,
  autoFocus,
}: TextSectionProps & { autoFocus: boolean }) {
  return (
    <Section title="Name" theme={t}>
      <TextField
        theme={t}
        value={value}
        onChangeText={onChangeText}
        onEndEditing={onCommit}
        onSubmitEditing={onCommit}
        placeholder="e.g. To work"
        accessibilityLabel="Profile name"
        maxLength={PROFILE_NAME_MAX}
        autoCapitalize="sentences"
        returnKeyType="done"
        autoFocus={autoFocus}
        selectTextOnFocus={autoFocus}
      />
    </Section>
  );
}

function StationSection({
  theme: t,
  profile,
  hasKey,
}: {
  theme: AppTheme;
  profile: CommuteProfile;
  hasKey: boolean;
}) {
  const { station } = profile;
  return (
    <Section title="Station" theme={t}>
      {station && (
        <View>
          <Text style={[controlStyles.value, { color: t.cardInk }]}>
            {describeStation(station)}
          </Text>
          {station.directionLabel && (
            <Text style={[controlStyles.valueSub, { color: t.cardInk2 }]}>
              {station.directionLabel}
            </Text>
          )}
        </View>
      )}
      <View style={controlStyles.row}>
        <Button
          theme={t}
          label={station ? "Change" : "Choose station"}
          variant={station ? "secondary" : "primary"}
          disabled={!hasKey}
          onPress={() =>
            router.push({
              pathname: "/station",
              params: { profileId: profile.id },
            })
          }
        />
      </View>
      {!hasKey && (
        <Note theme={t}>Add your API key first: station search uses it.</Note>
      )}
    </Section>
  );
}

function DestinationSection({
  theme: t,
  value,
  onChangeText,
  onCommit,
  hasStation,
}: TextSectionProps & { hasStation: boolean }) {
  return (
    <Section title="Destination" theme={t}>
      <TextField
        theme={t}
        value={value}
        onChangeText={onChangeText}
        onEndEditing={onCommit}
        onSubmitEditing={onCommit}
        placeholder="e.g. Britomart"
        accessibilityLabel="Destination"
        accessibilityHint="Shown on the commute screen"
        maxLength={DESTINATION_LABEL_MAX}
        autoCapitalize="words"
        returnKeyType="done"
      />
      <Note theme={t}>
        {hasStation
          ? "Filled in from the direction you chose. Change it to what you call it."
          : "Filled in when you choose a station. Change it to what you call it."}{" "}
        Leave it empty to hide it.
      </Note>
    </Section>
  );
}

function WalkSection({
  theme: t,
  minutes,
  onChange,
}: {
  theme: AppTheme;
  minutes: number;
  onChange: (fn: Change) => void;
}) {
  const step = (delta: number) => {
    const next = clampWalkMinutes(minutes + delta);
    if (next === minutes) return;
    if (Platform.OS !== "web") Haptics.selectionAsync();
    onChange((p) => ({ ...p, walkMinutes: next }));
  };
  const label = `${minutes} min`;

  return (
    <Section title="Walk to the platform" theme={t}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Walk to the platform"
        accessibilityValue={{
          min: WALK_MINUTES_MIN,
          max: WALK_MINUTES_MAX,
          now: minutes,
          text: `${minutes} minute${minutes === 1 ? "" : "s"}`,
        }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(e) =>
          step(e.nativeEvent.actionName === "increment" ? 1 : -1)
        }
        style={[styles.stepper, { borderColor: t.rule }]}
      >
        <StepperButton
          theme={t}
          label="−"
          disabled={minutes <= WALK_MINUTES_MIN}
          onPress={() => step(-1)}
        />
        <Text style={[styles.stepperValue, { color: t.cardInk }]}>{label}</Text>
        <StepperButton
          theme={t}
          label="+"
          disabled={minutes >= WALK_MINUTES_MAX}
          onPress={() => step(1)}
        />
      </View>
      <Note theme={t}>
        From your door to the platform. “Leave in…” counts back from this.
      </Note>
    </Section>
  );
}

function StepperButton({
  theme: t,
  label,
  disabled,
  onPress,
}: {
  theme: AppTheme;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      importantForAccessibility="no"
      accessibilityElementsHidden
      style={({ pressed }) => [
        styles.stepperButton,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.stepperSign, { color: t.cardInk }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    minHeight: 32,
  },
  headerAction: {
    fontFamily: FontFamily.sansBold,
    fontSize: 16,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 30,
  },
  title: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 34,
    lineHeight: 38,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: 12,
    borderWidth: 1,
  },
  stepperButton: {
    width: 52,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperSign: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 24,
    lineHeight: 28,
  },
  stepperValue: {
    minWidth: 72,
    textAlign: "center",
    fontFamily: FontFamily.sansBold,
    fontSize: 17,
  },
  pressed: {
    opacity: 0.6,
  },
  disabled: {
    opacity: 0.35,
  },
});

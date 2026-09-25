import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTabBarHeight } from "@/components/app-tabs";
import { FontFamily, type PhaseTheme } from "@/constants/theme";
import {
  activeProfile,
  canAddProfile,
  missingSetup,
  PROFILES_MAX,
  type Settings,
} from "@/features/settings/domain/settings";
import { useSettings } from "@/features/settings/store/settings-store";
import {
  Button,
  controlStyles,
  Note,
  Section,
  TextField,
} from "@/features/settings/ui/controls";
import { startNewProfile } from "@/features/settings/ui/new-profile";
import { ProfileRow } from "@/features/settings/ui/profile-row";
import {
  deleteApiKey,
  hasUsableKey,
  saveApiKey,
  useApiKeyState,
} from "@/features/train-tracker/api/api-key";
import { verifyApiKey } from "@/features/train-tracker/api/at-client";
import { useDataSource } from "@/features/train-tracker/api/data-source";
import {
  checkApiKeyFormat,
  describeKeyCheck,
} from "@/features/train-tracker/domain/api-key-format";
import { useSky } from "@/hooks/use-sky";

const KEY_HELP_URL = "https://dev-portal.at.govt.nz";

const haptic = (type: Haptics.NotificationFeedbackType) => {
  if (Platform.OS !== "web") Haptics.notificationAsync(type);
};

export function SettingsScreen() {
  const { theme: t } = useSky();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useTabBarHeight();
  const dataSource = useDataSource();
  const settingsState = useSettings();
  const keyState = useApiKeyState();

  const settings =
    settingsState.status === "ready" ? settingsState.settings : null;
  const hasKey = hasUsableKey(keyState);
  const missing =
    settings && keyState.status !== "loading"
      ? missingSetup(dataSource, hasKey, activeProfile(settings).station)
      : [];

  return (
    <ScrollView
      style={{ backgroundColor: t.card }}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: Math.max(insets.top + 17, 64),
          paddingBottom: tabBarHeight + 32,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      automaticallyAdjustKeyboardInsets
    >
      <View style={styles.header}>
        <Text style={[styles.app, { color: t.muted }]}>Handy Me</Text>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: t.cardInk }]}
        >
          Settings
        </Text>
      </View>

      {missing.length > 0 && <Welcome theme={t} missing={missing} />}

      <ApiKeySection theme={t} />

      {settings && <ProfilesSection theme={t} settings={settings} />}
    </ScrollView>
  );
}

function Welcome({
  theme: t,
  missing,
}: {
  theme: PhaseTheme;
  missing: string[];
}) {
  const steps = [
    missing.includes("key") && "add your free Auckland Transport API key",
    missing.includes("station") && "choose the station you leave from",
  ].filter(Boolean);
  return (
    <View style={[styles.welcome, { backgroundColor: t.sky }]}>
      <Text style={[styles.welcomeTitle, { color: t.ink }]}>
        Let’s set up your commute.
      </Text>
      <Text style={[styles.welcomeBody, { color: t.ink2 }]}>
        To see when to leave for your train, {steps.join(", then ")}.
        {missing.includes("key") && " Your key stays on this phone."}
      </Text>
    </View>
  );
}

type KeyCheck =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "error"; message: string };

function ApiKeySection({ theme: t }: { theme: PhaseTheme }) {
  const keyState = useApiKeyState();
  const queryClient = useQueryClient();
  const [replacing, setReplacing] = useState(false);
  // The pasted key is held here only until it's saved (see CLAUDE.md).
  const [draft, setDraft] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [check, setCheck] = useState<KeyCheck>({ status: "idle" });
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => pending.current?.abort(), []);

  const closeForm = () => {
    pending.current?.abort();
    setDraft("");
    setRevealed(false);
    setReplacing(false);
    setCheck({ status: "idle" });
  };

  const refreshTrains = () =>
    queryClient.invalidateQueries({ queryKey: ["train-tracker"] });

  const submit = async () => {
    const format = checkApiKeyFormat(draft);
    if (!format.ok) {
      setCheck({ status: "error", message: format.message });
      return;
    }
    Keyboard.dismiss();
    setCheck({ status: "checking" });
    const controller = new AbortController();
    pending.current = controller;

    let result;
    try {
      result = await verifyApiKey(format.key, controller.signal);
    } catch {
      return; // Cancelled: the form was closed or the screen left.
    }
    if (controller.signal.aborted) return;
    if (result !== "valid") {
      setCheck({ status: "error", message: describeKeyCheck(result) });
      haptic(Haptics.NotificationFeedbackType.Error);
      return;
    }
    try {
      await saveApiKey(format.key);
    } catch {
      setCheck({
        status: "error",
        message:
          "The key works, but it couldn't be saved on this phone. Try again.",
      });
      return;
    }
    closeForm();
    haptic(Haptics.NotificationFeedbackType.Success);
    refreshTrains();
  };

  const confirmRemove = () =>
    Alert.alert(
      "Remove API key?",
      "Live trains will stop until you add a key again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            await deleteApiKey();
            closeForm();
            refreshTrains();
          },
        },
      ],
    );

  const openHelp = () =>
    WebBrowser.openBrowserAsync(KEY_HELP_URL, {
      toolbarColor: t.card,
      controlsColor: t.cardInk,
    });

  if (keyState.status === "loading") {
    return (
      <Section title="Auckland Transport API key" theme={t}>
        {null}
      </Section>
    );
  }

  const checking = check.status === "checking";
  // Secure store doesn't work in browsers, so a key can't be saved on web.
  const canSave = Platform.OS !== "web";
  const view = replacing
    ? "form"
    : keyState.status === "saved"
      ? "saved"
      : keyState.status === "dev"
        ? "dev"
        : canSave
          ? "form"
          : "web";

  return (
    <Section title="Auckland Transport API key" theme={t}>
      {keyState.status === "saved" && view === "saved" && (
        <>
          <View>
            <Text style={[controlStyles.value, { color: t.cardInk }]}>
              Saved
            </Text>
            <Text
              accessibilityLabel={`Key ending in ${keyState.hint.slice(-4).split("").join(" ")}`}
              style={[styles.mask, { color: t.cardInk2 }]}
            >
              {keyState.hint}
            </Text>
          </View>
          <View style={controlStyles.row}>
            <Button
              theme={t}
              label="Replace"
              onPress={() => setReplacing(true)}
            />
            <Button
              theme={t}
              label="Remove"
              variant="danger"
              onPress={confirmRemove}
            />
          </View>
        </>
      )}
      {view === "dev" && (
        <>
          <View>
            <Text style={[controlStyles.value, { color: t.cardInk }]}>
              Using the key from .env
            </Text>
            <Text style={[controlStyles.valueSub, { color: t.cardInk2 }]}>
              Development only: the dev server adds AT_API_KEY to each request,
              so the key never reaches the app.
            </Text>
          </View>
          {canSave && (
            <View style={controlStyles.row}>
              <Button
                theme={t}
                label="Use a different key"
                onPress={() => setReplacing(true)}
              />
            </View>
          )}
        </>
      )}
      {view === "web" && (
        <Note theme={t}>
          Browsers can’t keep the key securely, so it can’t be saved here. While
          developing, add it to .env as AT_API_KEY and restart the dev server.
        </Note>
      )}
      {view === "form" && (
        <>
          <View style={styles.keyRow}>
            <TextField
              theme={t}
              value={draft}
              onChangeText={(text) => {
                setDraft(text);
                if (check.status === "error") setCheck({ status: "idle" });
              }}
              placeholder="Paste your key"
              accessibilityLabel="AT API key"
              secureTextEntry={!revealed}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              spellCheck={false}
              textContentType="none"
              importantForAutofill="no"
              returnKeyType="done"
              editable={!checking}
              autoFocus={replacing}
              onSubmitEditing={submit}
              invalid={check.status === "error"}
              style={styles.keyField}
            />
            <Pressable
              onPress={() => setRevealed((r) => !r)}
              accessibilityRole="button"
              accessibilityLabel={revealed ? "Hide key" : "Show key"}
              hitSlop={8}
              style={styles.reveal}
            >
              <Text style={[styles.revealText, { color: t.cardInk2 }]}>
                {revealed ? "Hide" : "Show"}
              </Text>
            </Pressable>
          </View>
          {check.status === "error" && (
            <Note theme={t} tone="error">
              {check.message}
            </Note>
          )}
          <View style={controlStyles.row}>
            <Button
              theme={t}
              label={checking ? "Checking…" : "Check and save"}
              variant="primary"
              busy={checking}
              disabled={!draft.trim()}
              onPress={submit}
            />
            {replacing && (
              <Button
                theme={t}
                label="Cancel"
                variant="link"
                onPress={closeForm}
              />
            )}
          </View>
        </>
      )}
      {(view === "form" || view === "web") && (
        <>
          <Button
            theme={t}
            label="How to get a free key ↗"
            variant="link"
            onPress={openHelp}
            accessibilityHint="Opens the Auckland Transport developer portal"
          />
          <Note theme={t}>
            Sign up, subscribe to the free realtime and GTFS APIs, then copy
            your primary key.
            {canSave &&
              " It’s kept in this phone’s secure storage and only ever sent to Auckland Transport."}
          </Note>
        </>
      )}
    </Section>
  );
}

function ProfilesSection({
  theme: t,
  settings,
}: {
  theme: PhaseTheme;
  settings: Settings;
}) {
  return (
    <Section title="Commute profiles" theme={t}>
      <View style={styles.profiles}>
        {settings.profiles.map((profile) => (
          <ProfileRow
            key={profile.id}
            theme={t}
            profile={profile}
            active={profile.id === settings.activeProfileId}
            trailing="chevron"
            accessibilityHint="Edit this profile"
            onPress={() =>
              router.push({ pathname: "/profile", params: { id: profile.id } })
            }
          />
        ))}
      </View>
      {canAddProfile(settings) ? (
        <View style={controlStyles.row}>
          <Button theme={t} label="+ Add profile" onPress={startNewProfile} />
        </View>
      ) : (
        <Note theme={t}>
          That’s the most you can have ({PROFILES_MAX}). Remove one to add
          another.
        </Note>
      )}
      <Note theme={t}>
        Each profile has its own station, destination and walk. Switch between
        them from the Commute screen.
      </Note>
    </Section>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    gap: 30,
  },
  header: {
    gap: 18,
  },
  app: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 13,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: 44,
    lineHeight: 46,
  },
  welcome: {
    borderRadius: 18,
    padding: 20,
    gap: 8,
  },
  welcomeTitle: {
    fontFamily: FontFamily.serifSemiBold,
    fontSize: 22,
    lineHeight: 27,
  },
  welcomeBody: {
    fontFamily: FontFamily.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  mask: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 15,
    letterSpacing: 1,
    marginTop: 2,
  },
  profiles: {
    marginHorizontal: -14,
  },
  keyRow: {
    justifyContent: "center",
  },
  keyField: {
    paddingRight: 64,
  },
  reveal: {
    position: "absolute",
    right: 14,
  },
  revealText: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 14,
  },
});

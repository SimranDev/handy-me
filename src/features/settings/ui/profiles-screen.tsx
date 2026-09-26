import { router } from "expo-router";
import { StyleSheet, View } from "react-native";

import {
  canAddProfile,
  PROFILES_MAX,
} from "@/features/settings/domain/settings";
import { useSettings } from "@/features/settings/store/settings-store";
import { Button, controlStyles, Note } from "@/features/settings/ui/controls";
import { startNewProfile } from "@/features/settings/ui/new-profile";
import { ProfileRow } from "@/features/settings/ui/profile-row";
import { SettingsPage } from "@/features/settings/ui/settings-page";
import { useSky } from "@/hooks/use-sky";

export function ProfilesScreen() {
  const { theme: t } = useSky();
  const settingsState = useSettings();
  const settings =
    settingsState.status === "ready" ? settingsState.settings : null;

  return (
    <SettingsPage theme={t} title="Commute profiles">
      {settings && (
        <>
          <View style={styles.profiles}>
            {settings.profiles.map((profile) => (
              <ProfileRow
                key={profile.id}
                theme={t}
                profile={profile}
                active={profile.id === settings.activeProfileId}
                trailing="chevron"
                highlight={t.rule}
                accessibilityHint="Edit this profile"
                onPress={() =>
                  router.push({
                    pathname: "/profile",
                    params: { id: profile.id },
                  })
                }
              />
            ))}
          </View>
          {canAddProfile(settings) ? (
            <View style={controlStyles.row}>
              <Button
                theme={t}
                label="+ Add profile"
                onPress={startNewProfile}
              />
            </View>
          ) : (
            <Note theme={t}>
              That’s the most you can have ({PROFILES_MAX}). Remove one to add
              another.
            </Note>
          )}
          <Note theme={t}>
            Each profile has its own station, destination and walk. Switch
            between them from the Commute screen.
          </Note>
        </>
      )}
    </SettingsPage>
  );
}

const styles = StyleSheet.create({
  profiles: {
    marginHorizontal: -14,
  },
});

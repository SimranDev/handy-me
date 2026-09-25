import { useQuery } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FontFamily, type PhaseTheme } from "@/constants/theme";
import { aucklandParts, HOUR } from "@/domain/time";
import {
  normaliseDestinationLabel,
  updateProfile,
} from "@/features/settings/domain/settings";
import { updateSettings } from "@/features/settings/store/settings-store";
import { Button, Note, TextField } from "@/features/settings/ui/controls";
import {
  hasUsableKey,
  useApiKeyState,
} from "@/features/train-tracker/api/api-key";
import {
  fetchAllStops,
  fetchStopTrips,
} from "@/features/train-tracker/api/at-api";
import {
  DIRECTION_SAMPLE_HOUR_RANGE,
  DIRECTION_SAMPLE_START_HOUR,
} from "@/features/train-tracker/domain/config";
import {
  deriveDestinationLabel,
  directionLabel,
  type PlatformDirection,
  platformDirections,
  railStations,
  type RailStation,
  searchStations,
} from "@/features/train-tracker/domain/stations";
import { describeArrivalsError } from "@/features/train-tracker/ui/arrivals-error";
import { useSky } from "@/hooks/use-sky";

/**
 * Pick a rail station, then the platform (and direction) you leave from, for
 * the profile in `profileId` (the active profile if it's missing).
 */
export function StationPickerScreen() {
  const { now, theme: t } = useSky();
  const { profileId } = useLocalSearchParams<{ profileId?: string }>();
  const insets = useSafeAreaInsets();
  const keyState = useApiKeyState();
  const [station, setStation] = useState<RailStation | null>(null);
  const date = aucklandParts(now).date;

  const close = () =>
    router.canGoBack() ? router.back() : router.replace("/settings");

  const choose = (s: RailStation, direction: PlatformDirection) => {
    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    updateSettings((current) =>
      updateProfile(
        current,
        profileId ?? current.activeProfileId,
        (profile) => ({
          ...profile,
          // Only the stable stop_code is stored, never stop_id.
          station: {
            stopCode: direction.stopCode,
            stationName: s.name,
            platformCode: direction.platformCode,
            directionId: direction.directionId,
            directionLabel:
              direction.headsigns.length > 0 ? directionLabel(direction) : null,
          },
          destinationLabel: normaliseDestinationLabel(
            deriveDestinationLabel(direction),
          ),
        }),
      ),
    );
    close();
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
        {station ? (
          <Pressable
            onPress={() => setStation(null)}
            accessibilityRole="button"
            accessibilityLabel="Back to stations"
            hitSlop={12}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={[styles.headerAction, { color: t.cardInk }]}>
              ‹ Stations
            </Text>
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable
          onPress={close}
          accessibilityRole="button"
          hitSlop={12}
          style={({ pressed }) => pressed && styles.pressed}
        >
          <Text style={[styles.headerAction, { color: t.cardInk }]}>
            Cancel
          </Text>
        </Pressable>
      </View>

      {keyState.status === "absent" ? (
        <View style={styles.body}>
          <Text style={[styles.title, { color: t.cardInk }]}>
            Add your API key first.
          </Text>
          <Note theme={t}>
            Station search uses the Auckland Transport API. Add your key in
            Settings, then come back here.
          </Note>
        </View>
      ) : station ? (
        <PlatformStep
          theme={t}
          station={station}
          date={date}
          bottomInset={insets.bottom}
          onChoose={(direction) => choose(station, direction)}
        />
      ) : (
        <StationStep
          theme={t}
          date={date}
          enabled={hasUsableKey(keyState)}
          bottomInset={insets.bottom}
          onChoose={setStation}
        />
      )}
    </View>
  );
}

function StationStep({
  theme: t,
  date,
  enabled,
  bottomInset,
  onChoose,
}: {
  theme: PhaseTheme;
  date: string;
  enabled: boolean;
  bottomInset: number;
  onChoose: (station: RailStation) => void;
}) {
  const [query, setQuery] = useState("");
  // AT can't filter stops by type or partial name, so the day's full list
  // (2.4 MB) is fetched once and only the rail stations are kept.
  const stations = useQuery({
    queryKey: ["train-tracker", "rail-stations", date],
    queryFn: async ({ signal }) =>
      railStations(await fetchAllStops(date, signal)),
    enabled,
    staleTime: 6 * HOUR,
    gcTime: HOUR,
    retry: false,
  });
  const results = stations.data ? searchStations(stations.data, query) : [];

  return (
    <>
      <View style={styles.body}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: t.cardInk }]}
        >
          Your station
        </Text>
        <TextField
          theme={t}
          value={query}
          onChangeText={setQuery}
          placeholder="Search rail stations"
          accessibilityLabel="Search rail stations"
          autoCorrect={false}
          autoCapitalize="words"
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoFocus
        />
      </View>
      {stations.isPending ? (
        <Loading theme={t} label="Loading stations…" />
      ) : stations.isError ? (
        <LoadError
          theme={t}
          error={stations.error}
          what="stations"
          onRetry={() => stations.refetch()}
        />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(s) => s.stopId}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
          ListEmptyComponent={
            <View style={styles.body}>
              <Note theme={t}>No rail station matches “{query.trim()}”.</Note>
            </View>
          }
          renderItem={({ item }) => (
            <ListRow
              theme={t}
              title={item.name}
              sub={
                item.platforms.length === 1
                  ? "1 platform"
                  : `${item.platforms.length} platforms`
              }
              onPress={() => onChoose(item)}
            />
          )}
        />
      )}
    </>
  );
}

function PlatformStep({
  theme: t,
  station,
  date,
  bottomInset,
  onChoose,
}: {
  theme: PhaseTheme;
  station: RailStation;
  date: string;
  bottomInset: number;
  onChoose: (direction: PlatformDirection) => void;
}) {
  // A daytime sample of each platform's trips shows which way it goes.
  const directions = useQuery({
    queryKey: ["train-tracker", "platform-directions", date, station.stopId],
    queryFn: async ({ signal }) => {
      const perPlatform = await Promise.all(
        station.platforms.map(async (platform) =>
          platformDirections(
            platform,
            await fetchStopTrips(
              platform.stop_id,
              {
                date,
                startHour: DIRECTION_SAMPLE_START_HOUR,
                hourRange: DIRECTION_SAMPLE_HOUR_RANGE,
              },
              signal,
            ),
          ),
        ),
      );
      return perPlatform.flat();
    },
    staleTime: HOUR,
    retry: false,
  });

  return (
    <>
      <View style={styles.body}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: t.cardInk }]}
        >
          {station.name}
        </Text>
        <Note theme={t}>Which platform do you leave from?</Note>
      </View>
      {directions.isPending ? (
        <Loading theme={t} label="Finding where each platform goes…" />
      ) : directions.isError ? (
        <LoadError
          theme={t}
          error={directions.error}
          what="platforms"
          onRetry={() => directions.refetch()}
        />
      ) : (
        <FlatList
          data={directions.data}
          keyExtractor={(d) => `${d.stopCode}-${d.directionId ?? "any"}`}
          contentContainerStyle={{ paddingBottom: bottomInset + 24 }}
          renderItem={({ item }) => (
            <ListRow
              theme={t}
              title={
                item.platformCode ? `Platform ${item.platformCode}` : "Platform"
              }
              sub={directionLabel(item)}
              onPress={() => onChoose(item)}
            />
          )}
        />
      )}
    </>
  );
}

function ListRow({
  theme: t,
  title,
  sub,
  onPress,
}: {
  theme: PhaseTheme;
  title: string;
  sub: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${sub}`}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: t.rule },
        pressed && styles.rowPressed,
      ]}
    >
      <Text style={[styles.rowTitle, { color: t.cardInk }]}>{title}</Text>
      <Text style={[styles.rowSub, { color: t.cardInk2 }]}>{sub}</Text>
    </Pressable>
  );
}

function Loading({ theme: t, label }: { theme: PhaseTheme; label: string }) {
  return (
    <View style={[styles.body, styles.loading]}>
      <ActivityIndicator color={t.cardInk} />
      <Note theme={t}>{label}</Note>
    </View>
  );
}

function LoadError({
  theme: t,
  error,
  what,
  onRetry,
}: {
  theme: PhaseTheme;
  error: unknown;
  what: string;
  onRetry: () => void;
}) {
  const failure = describeArrivalsError(error, `Couldn't load ${what}.`);
  return (
    <View style={styles.body}>
      <Text style={[styles.errorTitle, { color: t.cardInk }]}>
        {failure.title}
      </Text>
      <Note theme={t}>
        {failure.needsSettings
          ? "Fix it in Settings, then try again."
          : "Try again in a moment."}
      </Note>
      <View style={styles.retry}>
        <Button theme={t} label="Try again" onPress={onRetry} />
      </View>
    </View>
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
  body: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
  },
  title: {
    fontFamily: FontFamily.serif,
    fontSize: 34,
    lineHeight: 38,
  },
  loading: {
    alignItems: "flex-start",
  },
  errorTitle: {
    fontFamily: FontFamily.serifSemiBold,
    fontSize: 20,
    lineHeight: 25,
  },
  retry: {
    flexDirection: "row",
  },
  row: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
  rowPressed: {
    backgroundColor: "rgba(127,127,127,0.08)",
  },
  rowTitle: {
    fontFamily: FontFamily.sansMedium,
    fontSize: 17,
  },
  rowSub: {
    fontFamily: FontFamily.sans,
    fontSize: 14,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.6,
  },
});

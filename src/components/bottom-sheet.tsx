import { type ReactNode, useEffect, useEffectEvent, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { scheduleOnRN } from "react-native-worklets";

import type { AppTheme } from "@/constants/theme";

const OPEN_MS = 280;
const CLOSE_MS = 220;
const BACKDROP_OPACITY = 0.4;
/** Dragged this far down (share of its height), or flicked, the sheet closes. */
const DISMISS_SHARE = 0.3;
const DISMISS_VELOCITY = 800;

type Props = {
  visible: boolean;
  /** Asked to close: backdrop tap, swipe down, or Android back. */
  onClose: () => void;
  /** After the sheet has finished sliding away. */
  onDismissed?: () => void;
  theme: AppTheme;
  accessibilityLabel: string;
  children: ReactNode;
};

/**
 * A sheet that slides up from the bottom over the current screen, the same
 * on iOS, Android and web. Swipe it down or tap outside to close.
 */
export function BottomSheet({
  visible,
  onClose,
  onDismissed,
  theme: t,
  accessibilityLabel,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const reduceMotion = useReducedMotion();

  // Stays mounted while it slides away after `visible` turns false.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);

  /** 0 closed, 1 open. */
  const progress = useSharedValue(0);
  const drag = useSharedValue(0);
  const sheetHeight = useSharedValue(windowHeight);

  const dismissed = useEffectEvent(() => {
    setMounted(false);
    onDismissed?.();
  });

  useEffect(() => {
    if (!mounted) return;
    const finish = () => dismissed();
    if (visible) {
      drag.set(0);
      progress.set(
        withTiming(1, {
          duration: reduceMotion ? 0 : OPEN_MS,
          easing: Easing.out(Easing.cubic),
        }),
      );
    } else {
      progress.set(
        withTiming(
          0,
          {
            duration: reduceMotion ? 0 : CLOSE_MS,
            easing: Easing.in(Easing.cubic),
          },
          (done) => {
            if (done) scheduleOnRN(finish);
          },
        ),
      );
    }
  }, [visible, mounted, reduceMotion, progress, drag]);

  const pan = Gesture.Pan()
    .activeOffsetY(8)
    .failOffsetX([-16, 16])
    .onUpdate((e) => {
      // Down follows the finger; up only gives a little.
      drag.set(e.translationY > 0 ? e.translationY : e.translationY * 0.15);
    })
    .onEnd((e) => {
      const height = sheetHeight.get();
      if (
        drag.get() > height * DISMISS_SHARE ||
        e.velocityY > DISMISS_VELOCITY
      ) {
        // Carry on from where the finger let go.
        progress.set(Math.max(0, 1 - drag.get() / height));
        drag.set(0);
        scheduleOnRN(onClose);
      } else {
        drag.set(withSpring(0, { damping: 20, stiffness: 220 }));
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: (1 - progress.get()) * sheetHeight.get() + drag.get(),
      },
    ],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity:
      BACKDROP_OPACITY *
      progress.get() *
      Math.max(0, 1 - Math.max(0, drag.get()) / sheetHeight.get()),
  }));

  if (!mounted) return null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      {/* Gestures inside a Modal need their own root view on Android. */}
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={[StyleSheet.absoluteFill, styles.backdrop]}
          />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            accessibilityViewIsModal
            accessibilityLabel={accessibilityLabel}
            onLayout={(e) => sheetHeight.set(e.nativeEvent.layout.height)}
            style={[
              styles.sheet,
              {
                backgroundColor: t.card,
                paddingBottom: Math.max(insets.bottom, 16) + 8,
                maxHeight: windowHeight - insets.top - 24,
              },
              sheetStyle,
            ]}
          >
            <View style={styles.grabberArea}>
              <View style={[styles.grabber, { backgroundColor: t.rule }]} />
            </View>
            {children}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    backgroundColor: "#000",
  },
  sheet: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    boxShadow: "0 -10px 30px rgba(0,0,0,0.18)",
  },
  grabberArea: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 18,
  },
  grabber: {
    width: 38,
    height: 5,
    borderRadius: 2.5,
  },
});

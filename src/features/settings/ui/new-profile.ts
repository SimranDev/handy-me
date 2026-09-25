import { router } from "expo-router";

import { addProfile } from "@/features/settings/domain/settings";
import {
  newProfileId,
  updateSettings,
} from "@/features/settings/store/settings-store";

/** Open a new, blank profile in the editor; it's kept only if added there. */
export function startNewProfile() {
  const id = newProfileId();
  updateSettings((s) => addProfile(s, id));
  router.push({ pathname: "/profile", params: { id, new: "1" } });
}

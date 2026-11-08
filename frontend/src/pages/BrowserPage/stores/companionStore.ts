import { create } from "zustand";
import type { CompanionPreferences } from "../objects/CompanionState";
import {
  defaultCompanionPreferences,
  readCompanionPreferences,
} from "../functions/companionRules";
const key = "vibrowser.companion.v1";
function restore() {
  try {
    return readCompanionPreferences(localStorage.getItem(key));
  } catch {
    return defaultCompanionPreferences;
  }
}
const store = create<CompanionPreferences>(() => restore());
export const useCompanionPreferences = () => store();
export function setCompanionPreference(
  keyName: keyof CompanionPreferences,
  value: boolean,
) {
  store.setState({ [keyName]: value });
  try {
    localStorage.setItem(key, JSON.stringify(store.getState()));
  } catch {
    /* In-memory preferences still work. */
  }
}
export function listenCompanionPreferences() {
  const refresh = (event: StorageEvent) => {
    if (event.key === key || event.key === null) store.setState(restore());
  };
  window.addEventListener("storage", refresh);
  return () => window.removeEventListener("storage", refresh);
}

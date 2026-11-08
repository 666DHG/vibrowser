export type CatExpression =
  "idle" | "observe" | "waiting" | "happy" | "puzzled" | "petted";
export type {
  CompanionEvent,
  CompanionContext,
} from "../../../shared/companion";
export interface CompanionPreferences {
  visible: boolean;
  automatic: boolean;
  ai: boolean;
}

export type DisplayTextSize = "standard" | "large";
export type DisplayColours = "standard" | "high-contrast";
export type DisplayPreferenceScope = "student" | "teacher-playtest";

export interface DisplayPreferences {
  textSize: DisplayTextSize;
  colours: DisplayColours;
}

export const DISPLAY_PREFERENCE_KEYS: Readonly<Record<DisplayPreferenceScope, string>> = Object.freeze({
  student: "ad-market:display-preferences:student:v1",
  "teacher-playtest": "ad-market:display-preferences:teacher-playtest:v1"
});

export const STANDARD_DISPLAY_PREFERENCES: Readonly<DisplayPreferences> = Object.freeze({
  textSize: "standard",
  colours: "standard"
});

function validPreferences(value: unknown): DisplayPreferences | null {
  if (value === null || typeof value !== "object") return null;
  const candidate = value as Partial<DisplayPreferences>;
  if ((candidate.textSize !== "standard" && candidate.textSize !== "large") ||
    (candidate.colours !== "standard" && candidate.colours !== "high-contrast")) return null;
  return { textSize: candidate.textSize, colours: candidate.colours };
}

export function readDisplayPreferences(
  storage: Pick<Storage, "getItem"> | null,
  scope: DisplayPreferenceScope
): DisplayPreferences {
  if (storage === null) return { ...STANDARD_DISPLAY_PREFERENCES };
  try {
    const raw = storage.getItem(DISPLAY_PREFERENCE_KEYS[scope]);
    return validPreferences(raw === null ? null : JSON.parse(raw)) ?? { ...STANDARD_DISPLAY_PREFERENCES };
  } catch {
    return { ...STANDARD_DISPLAY_PREFERENCES };
  }
}

export class DisplayPreferencesController {
  #preferences: DisplayPreferences;

  constructor(
    private readonly root: HTMLElement,
    private readonly storage: Pick<Storage, "getItem" | "setItem"> | null,
    private readonly scope: DisplayPreferenceScope
  ) {
    this.#preferences = readDisplayPreferences(storage, scope);
    this.#apply();
  }

  get value(): Readonly<DisplayPreferences> { return { ...this.#preferences }; }

  update(next: DisplayPreferences): void {
    const valid = validPreferences(next);
    if (valid === null) return;
    this.#preferences = valid;
    this.#apply();
    try { this.storage?.setItem(DISPLAY_PREFERENCE_KEYS[this.scope], JSON.stringify(valid)); } catch { /* session remains usable */ }
  }

  #apply(): void {
    this.root.dataset.displayText = this.#preferences.textSize;
    this.root.dataset.displayColours = this.#preferences.colours;
  }
}

import { expect, it, vi } from "vitest";
import {
  DISPLAY_PREFERENCE_KEYS,
  DisplayPreferencesController,
  readDisplayPreferences
} from "./display-preferences";

it("defaults invalid and unavailable display preferences to standard chrome settings", () => {
  const brokenStorage: Storage = {
    getItem: vi.fn(() => { throw new Error("blocked"); }),
    setItem: vi.fn(() => { throw new Error("blocked"); }),
    clear: vi.fn(), key: vi.fn(), length: 0, removeItem: vi.fn()
  };

  expect(readDisplayPreferences(brokenStorage, "student")).toEqual({ textSize: "standard", colours: "standard" });
  expect(readDisplayPreferences({ ...brokenStorage, getItem: vi.fn(() => '{"textSize":"huge"}') }, "teacher-playtest"))
    .toEqual({ textSize: "standard", colours: "standard" });
});

it("uses distinct student and teacher keys and applies only chrome data attributes", () => {
  const values = new Map<string, string>();
  const storage: Storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    clear: () => values.clear(), key: () => null, length: 0, removeItem: (key) => { values.delete(key); }
  };
  const root = document.createElement("section");
  const controller = new DisplayPreferencesController(root, storage, "teacher-playtest");

  controller.update({ textSize: "large", colours: "high-contrast" });

  expect(root.dataset.displayText).toBe("large");
  expect(root.dataset.displayColours).toBe("high-contrast");
  expect(values.get(DISPLAY_PREFERENCE_KEYS["teacher-playtest"])).toContain("high-contrast");
  expect(values.get(DISPLAY_PREFERENCE_KEYS.student)).toBeUndefined();
});

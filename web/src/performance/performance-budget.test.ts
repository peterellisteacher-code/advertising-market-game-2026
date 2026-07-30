import { describe, expect, it } from "vitest";
import {
  PERFORMANCE_BUDGET,
  assessPerformanceMetrics,
  type PerformanceMetrics
} from "./performance-budget";

function boundaryMetrics(): PerformanceMetrics {
  return {
    liveThumbnails: 72,
    searchP95Ms: 60,
    scrollFps: 50,
    studioOpenMs: 1500,
    publishMs: 2500,
    longestTaskMs: 200,
    jsHeapMb: 512
  };
}

describe("performance budget", () => {
  it("freezes the exact classroom limits from Task 13", () => {
    expect(PERFORMANCE_BUDGET).toEqual({
      maxLiveThumbnails: 72,
      maxSearchP95Ms: 60,
      minScrollFps: 50,
      maxStudioOpenMs: 1500,
      maxPublishMs: 2500,
      maxLongTaskMs: 200,
      maxJsHeapMb: 512
    });
    expect(Object.isFrozen(PERFORMANCE_BUDGET)).toBe(true);
  });

  it("passes measurements exactly on every hard boundary", () => {
    const metrics = boundaryMetrics();
    const snapshot = structuredClone(metrics);

    const result = assessPerformanceMetrics(metrics);

    expect(result).toEqual({ passed: true, violations: [], unavailable: [] });
    expect(metrics).toEqual(snapshot);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.violations)).toBe(true);
    expect(Object.isFrozen(result.unavailable)).toBe(true);
  });

  it("reports every failed metric in deterministic order", () => {
    expect(assessPerformanceMetrics({
      liveThumbnails: 73,
      searchP95Ms: 61,
      scrollFps: 49,
      studioOpenMs: 1501,
      publishMs: 2501,
      longestTaskMs: 201,
      jsHeapMb: 513
    })).toEqual({
      passed: false,
      violations: [
        "liveThumbnails",
        "searchP95Ms",
        "scrollFps",
        "studioOpenMs",
        "publishMs",
        "longestTaskMs",
        "jsHeapMb"
      ],
      unavailable: []
    });
  });

  it("does not fail when Chromium omits optional heap data", () => {
    const { jsHeapMb: _omitted, ...metrics } = boundaryMetrics();

    expect(assessPerformanceMetrics(metrics)).toEqual({
      passed: true,
      violations: [],
      unavailable: ["jsHeapMb"]
    });
  });

  it("rejects negative, non-finite and fractional count measurements", () => {
    const invalid: ReadonlyArray<readonly [keyof PerformanceMetrics, number]> = [
      ["liveThumbnails", -1],
      ["liveThumbnails", 1.5],
      ["searchP95Ms", Number.NaN],
      ["scrollFps", Number.POSITIVE_INFINITY],
      ["studioOpenMs", -0.1],
      ["publishMs", -1],
      ["longestTaskMs", -1],
      ["jsHeapMb", -1]
    ];

    for (const [metric, value] of invalid) {
      expect(() => assessPerformanceMetrics({
        ...boundaryMetrics(),
        [metric]: value
      })).toThrow(`${metric} must be a valid non-negative measurement`);
    }
  });

  it("rejects a missing required measurement at the runtime boundary", () => {
    const required: ReadonlyArray<Exclude<keyof PerformanceMetrics, "jsHeapMb">> = [
      "liveThumbnails",
      "searchP95Ms",
      "scrollFps",
      "studioOpenMs",
      "publishMs",
      "longestTaskMs"
    ];

    for (const metric of required) {
      const incomplete = { ...boundaryMetrics() } as Record<string, number>;
      delete incomplete[metric];
      expect(() => assessPerformanceMetrics(incomplete as unknown as PerformanceMetrics)).toThrow(
        `${metric} must be a valid non-negative measurement`
      );
    }
  });
});

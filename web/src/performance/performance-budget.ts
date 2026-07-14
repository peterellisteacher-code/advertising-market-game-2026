export const PERFORMANCE_BUDGET = Object.freeze({
  maxLiveThumbnails: 72,
  maxSearchP95Ms: 60,
  minScrollFps: 50,
  maxStudioOpenMs: 1500,
  maxPublishMs: 2500,
  maxLongTaskMs: 200,
  maxJsHeapMb: 512
});

export interface PerformanceMetrics {
  readonly liveThumbnails: number;
  readonly searchP95Ms: number;
  readonly scrollFps: number;
  readonly studioOpenMs: number;
  readonly publishMs: number;
  readonly longestTaskMs: number;
  readonly jsHeapMb?: number;
}

export type PerformanceMetric = keyof PerformanceMetrics;

export interface PerformanceAssessment {
  readonly passed: boolean;
  readonly violations: readonly PerformanceMetric[];
  readonly unavailable: readonly PerformanceMetric[];
}

function assertMeasurement(metric: PerformanceMetric, value: number): void {
  const validCount = metric !== "liveThumbnails" || Number.isInteger(value);
  if (!Number.isFinite(value) || value < 0 || !validCount) {
    throw new Error(`${metric} must be a valid non-negative measurement`);
  }
}

export function assessPerformanceMetrics(metrics: PerformanceMetrics): PerformanceAssessment {
  const measurements: ReadonlyArray<readonly [PerformanceMetric, number | undefined]> = [
    ["liveThumbnails", metrics.liveThumbnails],
    ["searchP95Ms", metrics.searchP95Ms],
    ["scrollFps", metrics.scrollFps],
    ["studioOpenMs", metrics.studioOpenMs],
    ["publishMs", metrics.publishMs],
    ["longestTaskMs", metrics.longestTaskMs],
    ["jsHeapMb", metrics.jsHeapMb]
  ];

  for (const [metric, value] of measurements) {
    if (value === undefined) {
      if (metric !== "jsHeapMb") {
        throw new Error(`${metric} must be a valid non-negative measurement`);
      }
      continue;
    }
    assertMeasurement(metric, value);
  }

  const violations: PerformanceMetric[] = [];
  if (metrics.liveThumbnails > PERFORMANCE_BUDGET.maxLiveThumbnails) violations.push("liveThumbnails");
  if (metrics.searchP95Ms > PERFORMANCE_BUDGET.maxSearchP95Ms) violations.push("searchP95Ms");
  if (metrics.scrollFps < PERFORMANCE_BUDGET.minScrollFps) violations.push("scrollFps");
  if (metrics.studioOpenMs > PERFORMANCE_BUDGET.maxStudioOpenMs) violations.push("studioOpenMs");
  if (metrics.publishMs > PERFORMANCE_BUDGET.maxPublishMs) violations.push("publishMs");
  if (metrics.longestTaskMs > PERFORMANCE_BUDGET.maxLongTaskMs) violations.push("longestTaskMs");
  if (metrics.jsHeapMb !== undefined && metrics.jsHeapMb > PERFORMANCE_BUDGET.maxJsHeapMb) {
    violations.push("jsHeapMb");
  }

  const unavailable: PerformanceMetric[] = metrics.jsHeapMb === undefined ? ["jsHeapMb"] : [];
  const frozenViolations = Object.freeze(violations);
  const frozenUnavailable = Object.freeze(unavailable);
  return Object.freeze({
    passed: frozenViolations.length === 0,
    violations: frozenViolations,
    unavailable: frozenUnavailable
  });
}

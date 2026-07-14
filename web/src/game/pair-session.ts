export type PairRole = "art-director" | "strategist";
export type CreatorPhase = "round-zero" | "invent" | "sell" | "refine" | "preview";

export interface PairSession {
  sessionId: string;
  activeRole: PairRole;
  phase: CreatorPhase;
  audienceBriefId: string;
  handoffCount: number;
  startedAt: string;
}

export interface PairRoleProgress {
  "art-director": number;
  strategist: number;
}

export interface CreatePairSessionInput {
  sessionId: string;
  audienceBriefId: string;
  startedAt: string;
}

const ISO_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function nonBlankId(value: string, name: "sessionId" | "audienceBriefId"): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`${name} must be non-blank`);
  }
  return trimmed;
}

function validIsoTimestamp(value: string): string {
  const match = ISO_TIMESTAMP.exec(value);
  if (match === null || Number.isNaN(Date.parse(value))) {
    throw new Error("startedAt must be a valid ISO timestamp");
  }
  const year = Number(match[1]!);
  const month = Number(match[2]!);
  const day = Number(match[3]!);
  const hour = Number(match[4]!);
  const minute = Number(match[5]!);
  const second = Number(match[6]!);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const validCalendarTime = month >= 1
    && month <= 12
    && day >= 1
    && day <= daysInMonth[month - 1]!
    && hour <= 23
    && minute <= 59
    && second <= 59;
  if (!validCalendarTime) {
    throw new Error("startedAt must be a valid ISO timestamp");
  }
  return value;
}

export function createPairSession(input: CreatePairSessionInput): PairSession {
  return {
    sessionId: nonBlankId(input.sessionId, "sessionId"),
    activeRole: "art-director",
    phase: "round-zero",
    audienceBriefId: nonBlankId(input.audienceBriefId, "audienceBriefId"),
    handoffCount: 0,
    startedAt: validIsoTimestamp(input.startedAt)
  };
}

export function swapActiveRole(session: PairSession): PairSession {
  return {
    ...session,
    activeRole: session.activeRole === "art-director" ? "strategist" : "art-director",
    handoffCount: session.handoffCount + 1
  };
}

export function selectAudienceBrief(
  session: PairSession,
  audienceBriefId: string
): PairSession {
  return {
    ...session,
    audienceBriefId: nonBlankId(audienceBriefId, "audienceBriefId")
  };
}

export function createEmptyRoleProgress(): PairRoleProgress {
  return { "art-director": 0, strategist: 0 };
}

export function recordProductiveAction(
  progress: PairRoleProgress,
  role: PairRole
): PairRoleProgress {
  return {
    ...progress,
    [role]: progress[role] + 1
  };
}

export function bothRolesHaveActed(progress: PairRoleProgress): boolean {
  return progress["art-director"] > 0 && progress.strategist > 0;
}

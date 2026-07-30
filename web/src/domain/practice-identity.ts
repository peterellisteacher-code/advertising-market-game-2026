export const PRACTICE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
export const CLOUD_PROGRESS_DOCUMENT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/u;
export const RESERVED_PRACTICE_ID = "classroom-campaign";

export interface PracticeDocumentIdentities {
  readonly documentId: unknown;
  readonly sessionId: unknown;
  readonly teamId?: unknown;
}

export function isPracticeIdentity(value: unknown): value is string {
  return typeof value === "string" && PRACTICE_ID_PATTERN.test(value);
}

export function hasRecoverablePracticeDocumentIdentities(
  value: PracticeDocumentIdentities
): value is { readonly documentId: string; readonly sessionId: string; readonly teamId: string } {
  const identities = [value.documentId, value.sessionId, value.teamId];
  return identities.every((identity) =>
    isPracticeIdentity(identity) && identity !== RESERVED_PRACTICE_ID) &&
    new Set(identities).size === identities.length;
}

export function isCloudProgressDocumentId(value: unknown): value is string {
  return typeof value === "string" && CLOUD_PROGRESS_DOCUMENT_ID_PATTERN.test(value);
}

export function hasCloudProgressPracticeDocumentIdentities(
  value: PracticeDocumentIdentities
): value is { readonly documentId: string; readonly sessionId: string; readonly teamId: string } {
  return hasRecoverablePracticeDocumentIdentities(value) &&
    isCloudProgressDocumentId(value.documentId);
}

export function selectDistinctPracticeRunIdentity(
  base: string,
  document: PracticeDocumentIdentities
): string | undefined {
  if (!hasRecoverablePracticeDocumentIdentities(document)) return undefined;
  const occupied = new Set([document.documentId, document.sessionId, document.teamId]);
  for (let suffix = 0; suffix <= occupied.size; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}:${suffix}`;
    if (isPracticeIdentity(candidate) && candidate !== RESERVED_PRACTICE_ID &&
      !occupied.has(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

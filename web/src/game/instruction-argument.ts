export type InstructionClaimId =
  | `P${1 | 2 | 3 | 5 | 6 | 7 | 8 | 10 | 11 | 12 | 13 | 15 | 16 | 17 | 18 | 20 | 21 | 22 | 23 | 24}`
  | "ICA"
  | "ICB"
  | "ICC"
  | "ICD"
  | "C";

export interface InstructionClaim {
  readonly id: InstructionClaimId;
  readonly kind: "premise" | "intermediate-conclusion" | "overall-conclusion";
  readonly text: string;
  readonly supports: readonly InstructionClaimId[];
  readonly uses: readonly InstructionClaimId[];
}

export interface InstructionSubargument {
  readonly id: "A" | "B" | "C" | "D" | "E";
  readonly title: string;
  readonly claims: readonly InstructionClaim[];
  readonly conclusionId: InstructionClaimId;
}

function claim(
  id: InstructionClaimId,
  kind: InstructionClaim["kind"],
  text: string,
  supports: readonly InstructionClaimId[],
  uses: readonly InstructionClaimId[] = []
): InstructionClaim {
  return Object.freeze({
    id,
    kind,
    text,
    supports: Object.freeze([...supports]),
    uses: Object.freeze([...uses])
  });
}

function subargument(
  id: InstructionSubargument["id"],
  title: string,
  claims: readonly InstructionClaim[],
  conclusionId: InstructionClaimId
): InstructionSubargument {
  return Object.freeze({
    id,
    title,
    claims: Object.freeze([...claims]),
    conclusionId
  });
}

export const INSTRUCTION_ARGUMENT: readonly InstructionSubargument[] = Object.freeze([
  subargument("A", "Establish a shared audience purpose", [
    claim(
      "P1",
      "premise",
      "Signing in opens the campaign and saved work assigned to the pair.",
      ["ICA"]
    ),
    claim(
      "P2",
      "premise",
      "Reading the audience brief identifies the audience's situation, need and values.",
      ["ICA"]
    ),
    claim(
      "P3",
      "premise",
      "Assigning the Art Director and Strategist roles gives each partner a stated responsibility for the same audience brief.",
      ["ICA"]
    ),
    claim(
      "ICA",
      "intermediate-conclusion",
      "Completing premises 1 to 3 is likely to give the pair a shared audience purpose.",
      ["P5"],
      ["P1", "P2", "P3"]
    )
  ], "ICA"),
  subargument("B", "Turn the audience purpose into a product", [
    claim(
      "P5",
      "premise",
      "If intermediate conclusion A is established, each product choice can be tested against the audience's situation, need and values.",
      ["ICB"],
      ["ICA"]
    ),
    claim(
      "P6",
      "premise",
      "Choosing a starter product provides a workable object that can be changed.",
      ["ICB"]
    ),
    claim(
      "P7",
      "premise",
      "Adding, moving, filling or removing product parts allows the pair to adapt that object for the audience.",
      ["ICB"]
    ),
    claim(
      "P8",
      "premise",
      "Naming the product gives the advertisement a clear subject.",
      ["ICB"]
    ),
    claim(
      "ICB",
      "intermediate-conclusion",
      "Completing premises 5 to 8 is likely to produce a named product that suits the shared audience purpose.",
      ["P10"],
      ["P5", "P6", "P7", "P8"]
    )
  ], "ICB"),
  subargument("C", "Turn the product into an advertisement", [
    claim(
      "P10",
      "premise",
      "Intermediate conclusion B supplies a named, visible product for the advertisement.",
      ["ICC"],
      ["ICB"]
    ),
    claim(
      "P11",
      "premise",
      "The Art Director's visible change supplies evidence of a deliberate visual choice.",
      ["ICC"]
    ),
    claim(
      "P12",
      "premise",
      "The Strategist's wording supplies evidence of a deliberate message choice.",
      ["ICC"]
    ),
    claim(
      "P13",
      "premise",
      "Attention, Interest, Desire and Action each require one visible choice and one explanation connected to the product and audience.",
      ["ICC"]
    ),
    claim(
      "ICC",
      "intermediate-conclusion",
      "Completing premises 10 to 13 is likely to produce a coherent advertisement for the product and audience.",
      ["P15"],
      ["P10", "P11", "P12", "P13"]
    )
  ], "ICC"),
  subargument("D", "Turn the advertisement into a credible offer", [
    claim(
      "P15",
      "premise",
      "Intermediate conclusion C supplies a coherent advertisement whose offer can be evaluated.",
      ["ICD"],
      ["ICC"]
    ),
    claim(
      "P16",
      "premise",
      "An audience-led price explains what the product costs and why that amount is suitable.",
      ["ICD"]
    ),
    claim(
      "P17",
      "premise",
      "A market route identifies where the audience is likely to encounter the advertisement.",
      ["ICD"]
    ),
    claim(
      "P18",
      "premise",
      "A proof point supports the advertisement's main claim with a fact, feature or demonstration.",
      ["ICD"]
    ),
    claim(
      "ICD",
      "intermediate-conclusion",
      "Completing premises 15 to 18 is likely to produce a clear and credible offer.",
      ["P20"],
      ["P15", "P16", "P17", "P18"]
    )
  ], "ICD"),
  subargument("E", "Turn the offer into a completed market entry", [
    claim(
      "P20",
      "premise",
      "Intermediate conclusion D supplies a clear and credible offer for final review.",
      ["C"],
      ["ICD"]
    ),
    claim(
      "P21",
      "premise",
      "The final review checks audience fit, product value and price, AIDA, visual technique and claim credibility.",
      ["C"]
    ),
    claim(
      "P22",
      "premise",
      "A successful publication check proves that the saved campaign contains the evidence required by those five criteria.",
      ["C"]
    ),
    claim(
      "P23",
      "premise",
      "Entering the market makes the completed campaign available for comparison.",
      ["C"]
    ),
    claim(
      "P24",
      "premise",
      "Applying the same five criteria to other advertisements supports consistent scores and medal decisions.",
      ["C"]
    ),
    claim(
      "C",
      "overall-conclusion",
      "A pair that completes premises 20 to 24 is likely to create and judge an audience-focused, coherent and credible advertising campaign.",
      [],
      ["P20", "P21", "P22", "P23", "P24"]
    )
  ], "C")
]);

export function flattenInstructionArgument(
  argument: readonly InstructionSubargument[]
): readonly InstructionClaim[] {
  return Object.freeze(argument.flatMap(({ claims }) => claims));
}

export function validateInstructionArgument(
  argument: readonly InstructionSubargument[]
): readonly string[] {
  const errors: string[] = [];
  const claims = flattenInstructionArgument(argument);
  const byId = new Map<InstructionClaimId, InstructionClaim>();
  const position = new Map<InstructionClaimId, number>();

  for (const [index, claim] of claims.entries()) {
    if (byId.has(claim.id)) {
      errors.push(`${claim.id} appears more than once`);
      continue;
    }
    byId.set(claim.id, claim);
    position.set(claim.id, index);
  }

  for (const subargument of argument) {
    const conclusion = byId.get(subargument.conclusionId);
    if (conclusion === undefined || !subargument.claims.includes(conclusion)) {
      errors.push(`${subargument.id} is missing conclusion ${subargument.conclusionId}`);
    }
  }

  for (const claim of claims) {
    if (claim.kind === "premise" && claim.supports.length === 0) {
      errors.push(`${claim.id} has no support target`);
    }
    if (claim.kind === "overall-conclusion" && claim.supports.length > 0) {
      errors.push(`${claim.id} must not have a support target`);
    }

    for (const targetId of claim.supports) {
      const target = byId.get(targetId);
      if (target === undefined) {
        errors.push(`${claim.id} supports missing claim ${targetId}`);
        continue;
      }
      if (!target.uses.includes(claim.id)) {
        errors.push(`${targetId} does not use ${claim.id}`);
      }
      if ((position.get(targetId) ?? -1) <= (position.get(claim.id) ?? -1)) {
        errors.push(`${claim.id} does not support a later claim`);
      }
    }

    for (const sourceId of claim.uses) {
      const source = byId.get(sourceId);
      if (source === undefined) {
        errors.push(`${claim.id} uses missing claim ${sourceId}`);
      } else if (!source.supports.includes(claim.id)) {
        errors.push(`${sourceId} does not support ${claim.id}`);
      }
    }
  }

  const reachesOverallConclusion = (
    id: InstructionClaimId,
    path: ReadonlySet<InstructionClaimId>
  ): boolean => {
    if (id === "C") return true;
    if (path.has(id)) return false;
    const nextPath = new Set(path);
    nextPath.add(id);
    return (byId.get(id)?.supports ?? [])
      .some((targetId) => reachesOverallConclusion(targetId, nextPath));
  };

  for (const claim of claims) {
    if (claim.kind === "premise" && !reachesOverallConclusion(claim.id, new Set())) {
      errors.push(`${claim.id} does not reach C`);
    }
  }

  return Object.freeze(errors);
}

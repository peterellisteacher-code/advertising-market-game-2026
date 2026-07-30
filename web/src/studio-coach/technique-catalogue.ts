import {
  STUDIO_COACH_TECHNIQUE_IDS,
  type StudioCoachTechniqueId
} from "../../../shared/studio-coach-contract";

export { STUDIO_COACH_TECHNIQUE_IDS };
export type { StudioCoachTechniqueId };

export interface StudioCoachTechnique {
  id: StudioCoachTechniqueId;
  label: string;
  definition: string;
  effect: string;
  example: string;
}

export const STUDIO_COACH_TECHNIQUES: readonly StudioCoachTechnique[] = Object.freeze([
  {
    id: "salience",
    label: "Salience",
    definition: "Salience makes one element attract attention before the others.",
    effect: "It gives the audience a clear first reading point.",
    example: "One large product against smaller supporting details."
  },
  {
    id: "colour",
    label: "Colour",
    definition: "Colour creates mood, associations and links between visual elements.",
    effect: "A controlled palette can support the product identity and audience mood.",
    example: "Repeat one accent colour on related elements."
  },
  {
    id: "contrast",
    label: "Contrast",
    definition: "Contrast makes differences in light, colour, size or shape noticeable.",
    effect: "It separates important information and improves legibility.",
    example: "Place dark type on a light area, or light type on a dark area."
  },
  {
    id: "leading-lines",
    label: "Leading lines",
    definition: "Leading lines use visible or implied lines to guide the viewer's eye.",
    effect: "They direct attention towards the product or another important element.",
    example: "Angle an edge, path or repeated shape towards the product."
  },
  {
    id: "framing",
    label: "Framing",
    definition: "Framing places visual elements around a subject to define its viewing area.",
    effect: "It isolates the subject and controls where the audience looks.",
    example: "Use an arch, border or foreground shapes around the product."
  },
  {
    id: "negative-space",
    label: "Negative space",
    definition: "Negative space is the deliberately empty area around visual elements.",
    effect: "It reduces crowding and makes the main message easier to notice.",
    example: "Leave a clear area around the product name or product image."
  },
  {
    id: "depth-layers",
    label: "Depth and layers",
    definition: "Depth uses foreground, middle and background layers to create visual distance.",
    effect: "It can make a flat advertisement feel dimensional and organised.",
    example: "Overlap a foreground shape, the product and a background element."
  },
  {
    id: "rule-of-odds",
    label: "Rule of odds",
    definition: "The rule of odds groups related subjects in an odd number, often three or five.",
    effect: "An odd group can feel balanced without looking rigidly paired.",
    example: "Use three supporting shapes or three product details as a group."
  },
  {
    id: "juxtaposition",
    label: "Juxtaposition",
    definition: "Juxtaposition places unlike elements together so their difference is clear.",
    effect: "The contrast can create surprise or clarify an idea about the product.",
    example: "Place an ordinary setting beside one deliberately unexpected product feature."
  },
  {
    id: "typography",
    label: "Typography",
    definition: "Typography uses typeface, size, weight, spacing and line breaks to shape written information.",
    effect: "It controls tone, emphasis and legibility without changing the words.",
    example: "Change size or line breaks to emphasise an existing key word."
  },
  {
    id: "visual-hierarchy",
    label: "Visual hierarchy",
    definition: "Visual hierarchy orders elements so the audience reads them in a planned sequence.",
    effect: "It makes the first, second and final reading points clear.",
    example: "Use decreasing size and emphasis across the product, support and price."
  }
]);

const BY_ID = new Map(STUDIO_COACH_TECHNIQUES.map((technique) => [technique.id, technique]));

export function studioCoachTechnique(id: StudioCoachTechniqueId): StudioCoachTechnique {
  const technique = BY_ID.get(id);
  if (!technique) throw new Error(`Unknown Studio Coach technique: ${id}`);
  return technique;
}

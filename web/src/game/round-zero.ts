export const ROUND_ZERO_COMMANDS = Object.freeze([
  "search",
  "add",
  "move",
  "resize",
  "text",
  "undo"
] as const);

export const CREATOR_COMMANDS = Object.freeze([
  ...ROUND_ZERO_COMMANDS,
  "crop",
  "drawing",
  "recolour",
  "layers"
] as const);

export type CreatorCommand = typeof CREATOR_COMMANDS[number];

const CREATOR_COMMAND_SET: ReadonlySet<string> = new Set(CREATOR_COMMANDS);

export function isCreatorCommand(value: unknown): value is CreatorCommand {
  return typeof value === "string" && CREATOR_COMMAND_SET.has(value);
}

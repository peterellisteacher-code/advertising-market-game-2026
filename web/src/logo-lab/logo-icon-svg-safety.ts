import { isSafeColourableSvgBody as sharedValidator } from "../../../scripts/logo-icon-svg-safety.mjs";

export function isSafeColourableSvgBody(body: string): boolean {
  return sharedValidator(body);
}

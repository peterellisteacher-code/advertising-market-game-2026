import { lstat } from "node:fs/promises";
import path from "node:path";

/** Checks every existing path component so ancestor junctions cannot hide indirection. */
export async function assertPathHasNoIndirection(target, {
  allowMissing = false,
  label = "path",
  rejectHardLinkedFile = false
} = {}) {
  const resolved = path.resolve(target);
  const root = path.parse(resolved).root;
  const parts = path.relative(root, resolved).split(path.sep).filter(Boolean);
  let current = root;
  let metadata;
  for (const part of parts) {
    current = path.join(current, part);
    try {
      metadata = await lstat(current);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT" && allowMissing) {
        return undefined;
      }
      throw error;
    }
    if (metadata.isSymbolicLink()) {
      throw new Error(`Refusing ${label} symlink, junction, or reparse-point indirection: ${current}`);
    }
  }
  if (rejectHardLinkedFile && metadata?.isFile() && metadata.nlink > 1) {
    throw new Error(`Refusing ${label} hard-link indirection: ${resolved}`);
  }
  return metadata;
}

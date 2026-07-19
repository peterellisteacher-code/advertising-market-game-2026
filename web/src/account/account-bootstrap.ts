import type { AccountAccessController } from "./account-gate";
import type { CloudProgressSyncState } from "./cloud-progress-sync";

export interface AccountBootstrapPublicApi {
  requireAccess(): Promise<void>;
}

export function createAccountBootstrap(
  controller: Pick<AccountAccessController, "requireAccess">
): AccountBootstrapPublicApi {
  return Object.freeze({
    requireAccess: () => controller.requireAccess()
  });
}

export function cloudStatusMessage(state: CloudProgressSyncState): string {
  switch (state.phase) {
    case "idle":
      return "Progress saves on this device first.";
    case "syncing":
      return "Saved on this device · connecting the cloud copy…";
    case "synced":
      return `Saved on this device and cloud · revision ${state.revision}`;
    case "offline":
      return "Saved on this device · cloud copy paused";
    case "signed-out":
      return "Saved on this device · sign in to reconnect the cloud copy";
    case "conflict":
      return "Saved on this device · another cloud copy needs review. Your local work is unchanged.";
  }
}

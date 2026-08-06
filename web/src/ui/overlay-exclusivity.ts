export interface OverlayExclusivityMember {
  readonly id: string;
  isOpen(): boolean;
  close(): void;
}

export interface OverlayExclusivity {
  register(member: OverlayExclusivityMember): void;
  notifyOpened(id: string): void;
}

/**
 * Keeps floating overlay surfaces mutually exclusive: at most one of the
 * layers panel, inspector, section-fill panel and display-preferences panel
 * is open at a time (docs/superpowers/specs/2026-08-06-studio-tuckability-single-action-design.md,
 * "Layers / inspector / section-fill / display panel" zone). Members report
 * their own open state and close themselves; this only decides who else
 * must close when one of them opens, including contextual auto-opens
 * (e.g. the inspector opening on a canvas selection).
 */
export function createOverlayExclusivity(): OverlayExclusivity {
  const members = new Map<string, OverlayExclusivityMember>();

  return {
    register(member) {
      members.set(member.id, member);
    },
    notifyOpened(id) {
      for (const member of members.values()) {
        if (member.id !== id && member.isOpen()) member.close();
      }
    }
  };
}

export type RevisionChangeAction =
  | "updated"
  | "added"
  | "invalidated"
  | "deleted";

export const REVISION_CHANGE_ACTION_LABELS: Record<
  RevisionChangeAction,
  string
> = {
  updated: "Шинэчилсэн",
  added: "Нэмсэн",
  invalidated: "Хүчингүй болгосон",
  deleted: "Устгасан",
};

export function getRevisionChangeActionLabel(
  action: RevisionChangeAction | null | undefined,
) {
  return REVISION_CHANGE_ACTION_LABELS[action ?? "updated"];
}

export function shouldStrikeRevisionTarget(
  action: RevisionChangeAction | null | undefined,
) {
  return action === "updated" || action === "invalidated" || action === "deleted";
}

export function normalizeRevisionChangeAction(
  action: unknown,
): RevisionChangeAction {
  if (
    action === "updated" ||
    action === "added" ||
    action === "invalidated" ||
    action === "deleted"
  ) {
    return action;
  }

  return "updated";
}

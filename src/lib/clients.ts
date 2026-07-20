export function clientDeletionNameMatches(
  confirmationName: unknown,
  clientName: string
): boolean {
  return (
    typeof confirmationName === "string" &&
    confirmationName.trim() === clientName.trim()
  );
}

export function planYearDeletionLabelMatches(
  confirmationLabel: unknown,
  planYearLabel: string
): boolean {
  return (
    typeof confirmationLabel === "string" &&
    confirmationLabel.trim() === planYearLabel.trim()
  );
}

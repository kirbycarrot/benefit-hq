export function clientDeletionNameMatches(
  confirmationName: unknown,
  clientName: string
): boolean {
  return (
    typeof confirmationName === "string" &&
    confirmationName.trim() === clientName.trim()
  );
}

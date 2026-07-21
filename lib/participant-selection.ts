export function participantSelectionDisabled(selectedCount: number, checked: boolean) {
  return !checked && selectedCount >= 10;
}

export function getEmptyListEnterStrategy(state = {}) {
  if (state.inTaskItem) {
    return "exit";
  }

  if (state.inListItem) {
    return "default";
  }

  return "ignore";
}

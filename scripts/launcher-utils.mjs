export function clampFloatingPosition(state = {}, viewport = {}, elementSize = {}) {
  const maximumLeft = Math.max(0, Number(viewport.width || 0) - Number(elementSize.width || 0));
  const maximumTop = Math.max(0, Number(viewport.height || 0) - Number(elementSize.height || 0));
  return {
    ...state,
    left: Math.max(0, Math.min(maximumLeft, Math.round(Number(state.left) || 0))),
    top: Math.max(0, Math.min(maximumTop, Math.round(Number(state.top) || 0)))
  };
}

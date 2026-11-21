/** Current time in ms. All server code reads the time here, so the preview harness can fake the date. */
export const nowMs = (): number => Date.now();

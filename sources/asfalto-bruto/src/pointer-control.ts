interface PointerControl {
  enabled: () => boolean;
  start?: (event: PointerEvent) => void;
  move?: (event: PointerEvent) => void;
  end: () => void;
}

// Each control owns one finger. Window listeners also catch releases outside the
// button, including when the browser interrupts or cannot retain pointer capture.
export function bindPointerControl(element: HTMLElement, control: PointerControl) {
  let pointer: number | null = null;
  const reset = () => {
    const previous = pointer;
    pointer = null;
    control.end();
    if (previous !== null && element.hasPointerCapture(previous)) element.releasePointerCapture(previous);
  };
  element.addEventListener('pointerdown', event => {
    if (!control.enabled() || event.button !== 0) return;
    event.preventDefault();
    if (pointer !== null) return;
    pointer = event.pointerId;
    try { element.setPointerCapture(pointer); } catch { /* Window listeners still release this finger. */ }
    control.start?.(event);
    control.move?.(event);
  });
  window.addEventListener('pointermove', event => {
    if (event.pointerId !== pointer) return;
    if (!control.enabled() || event.pointerType === 'mouse' && !event.buttons) { reset(); return; }
    if (event.cancelable) event.preventDefault();
    control.move?.(event);
  }, {capture: true, passive: false});
  const release = (event: PointerEvent) => { if (event.pointerId === pointer) reset(); };
  window.addEventListener('pointerup', release, true);
  window.addEventListener('pointercancel', release, true);
  element.addEventListener('lostpointercapture', release);
  return reset;
}

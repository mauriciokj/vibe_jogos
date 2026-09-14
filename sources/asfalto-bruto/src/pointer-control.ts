export interface ControlPoint {
  clientX: number;
  clientY: number;
  timeStamp: number;
}

interface PointerControl {
  enabled: () => boolean;
  start?: (event: ControlPoint) => void;
  move?: (event: ControlPoint) => void;
  end: () => void;
}

// Touch controls use the browser's list of actual fingers. Pointer capture alone
// can leave a held command behind when a mobile browser takes over a gesture.
// Mouse/pen (and browsers without Touch Events) still use Pointer Events.
export function bindPointerControl(element: HTMLElement, control: PointerControl) {
  let pointer: number | null = null;
  let finger: number | null = null;
  const nativeTouch = 'ontouchstart' in window;
  const reset = () => {
    const previous = pointer;
    pointer = null;
    finger = null;
    control.end();
    if (previous !== null && element.hasPointerCapture(previous)) element.releasePointerCapture(previous);
  };
  const preventGesture = (event: Event) => { if (event.cancelable) event.preventDefault(); };
  const touchPoint = (touch: Touch, event: TouchEvent): ControlPoint => ({clientX: touch.clientX, clientY: touch.clientY, timeStamp: event.timeStamp});
  // Reconcile on every touch event, including events on another control. If an
  // end event went missing, the next touch immediately frees the stale owner.
  const reconcile = (event: TouchEvent) => {
    if (finger === null) return;
    const touch = Array.from(event.touches).find(t => t.identifier === finger);
    const ownerChanged = Array.from(event.changedTouches).some(t => t.identifier === finger);
    // Identifiers may be reused after a lost end; a fresh start with the same
    // identifier must replace, rather than silently keep, the old acceleration.
    if (!control.enabled() || !touch || ownerChanged && event.type !== 'touchmove') { reset(); return; }
    if (event.type === 'touchmove' && Array.from(event.changedTouches).some(t => t.identifier === finger)) {
      preventGesture(event);
      control.move?.(touchPoint(touch, event));
    }
  };
  for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel'] as const) {
    window.addEventListener(type, reconcile, {capture: true, passive: false});
    // Cancel native zoom/callout gestures, without synthesizing clicks or
    // swallowing the repeated touches used for pedalling and double taps.
    element.addEventListener(type, event => { if (control.enabled()) preventGesture(event); }, {passive: false});
  }
  element.addEventListener('touchstart', event => {
    if (!control.enabled() || finger !== null) return;
    const touch = Array.from(event.changedTouches).find(t => t.target instanceof Node && element.contains(t.target));
    if (!touch) return;
    if (pointer !== null) reset();
    finger = touch.identifier;
    const point = touchPoint(touch, event);
    control.start?.(point);
    control.move?.(point);
  }, {passive: false});
  element.addEventListener('pointerdown', event => {
    if ((nativeTouch && event.pointerType === 'touch') || finger !== null) return;
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

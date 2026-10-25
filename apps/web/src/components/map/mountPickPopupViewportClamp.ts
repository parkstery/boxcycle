import type { Popup } from "mapbox-gl";

/** Keep a point popup inside the map after its content has been measured. */
export function mountPickPopupViewportClamp(
  popup: Popup,
  container: HTMLElement,
  anchor: "top" | "bottom" | "left" | "right",
): void {
  const base = { top: [0, 18], bottom: [0, -18], left: [18, 0], right: [-18, 0] }[anchor];
  let offset: [number, number] = [base[0], base[1]];
  let frame = 0;
  const clamp = () => {
    frame = 0;
    const element = popup.getElement();
    if (!element?.isConnected) return;
    const bounds = container.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const dx = rect.left < bounds.left + 8 ? bounds.left + 8 - rect.left
      : rect.right > bounds.right - 8 ? bounds.right - 8 - rect.right : 0;
    const dy = rect.top < bounds.top + 8 ? bounds.top + 8 - rect.top
      : rect.bottom > bounds.bottom - 8 ? bounds.bottom - 8 - rect.bottom : 0;
    if (Math.abs(dx) < .5 && Math.abs(dy) < .5) return;
    offset = [offset[0] + dx, offset[1] + dy];
    popup.setOffset(offset);
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(clamp);
  };
  const element = popup.getElement();
  if (!element) return;
  const observer = new ResizeObserver(schedule);
  observer.observe(container);
  observer.observe(element);
  popup.once("close", () => {
    observer.disconnect();
    if (frame) cancelAnimationFrame(frame);
  });
  schedule();
}

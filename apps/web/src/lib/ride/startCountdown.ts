/** 준비가 끝난 뒤 3→2→1을 각각 1초 표시한다. 취소 시 시작하지 않는다. */
export function scheduleRideStartCountdown(onTick: (value: number | null) => void): {
  promise: Promise<boolean>; cancel: () => void;
} {
  let timer: ReturnType<typeof setTimeout>;
  let settled = false;
  let resolve: (started: boolean) => void = () => {};
  const promise = new Promise<boolean>((done) => { resolve = done; });
  const finish = (started: boolean) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    onTick(null);
    resolve(started);
  };
  const tick = (value: number) => {
    if (value === 0) { finish(true); return; }
    onTick(value);
    timer = setTimeout(() => tick(value - 1), 1000);
  };
  tick(3);
  return { promise, cancel: () => finish(false) };
}

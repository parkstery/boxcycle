/**
 * 화면이 가려져도(최소화·다른 창에 덮임·탭 전환) 도는 반복 타이머.
 *
 * 왜 — 브라우저는 숨은 페이지의 `setInterval` 을 1초에 1번으로 늦추고, 크롬은 5분이 지나면
 * 1분에 1번까지 늦춘다(intensive throttling). `requestAnimationFrame` 은 아예 멈춘다.
 * 주행 중인 라이더가 창을 가리면 송신이 끊겨 동행 화면에서 멈춘 사람이 됐다(2026-10-08 Chief).
 * 전용 Worker 안의 타이머는 이 제한 밖이라, Worker 가 박자만 보내고 일은 메인 스레드가 한다.
 *
 * Worker 를 만들 수 없는 환경(테스트·구형 브라우저)에서는 `window.setInterval` 로 대신한다.
 * 반환값은 정지 함수.
 */
const WORKER_SOURCE =
  "let id=null;onmessage=function(e){if(id!==null)clearInterval(id);id=null;" +
  "if(e.data>0)id=setInterval(function(){postMessage(0)},e.data)};";

export function setBackgroundSafeInterval(fn: () => void, intervalMs: number): () => void {
  let worker: Worker | null = null;
  let url: string | null = null;
  try {
    if (typeof Worker !== "undefined" && typeof Blob !== "undefined" && typeof URL !== "undefined") {
      url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
      worker = new Worker(url);
      worker.onmessage = () => fn();
      worker.postMessage(intervalMs);
    }
  } catch {
    worker?.terminate();
    worker = null;
  }
  if (!worker) {
    if (url) URL.revokeObjectURL(url);
    const id = window.setInterval(fn, intervalMs);
    return () => window.clearInterval(id);
  }
  const w = worker;
  const u = url;
  return () => {
    w.terminate();
    if (u) URL.revokeObjectURL(u);
  };
}

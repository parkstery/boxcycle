type SpinatlasMarkProps = {
  className?: string;
};

const SPINATLAS_MARK_SRC = "/spinatlas-mark.svg";

/** 인트로와 앱 헤더가 함께 쓰는 Spinatlas 심벌. */
export function SpinatlasMark({ className }: SpinatlasMarkProps) {
  return (
    <img
      className={className}
      src={SPINATLAS_MARK_SRC}
      alt=""
      aria-hidden="true"
    />
  );
}

type SpinatlasMarkProps = {
  className?: string;
};

/** 인트로와 앱 헤더가 함께 쓰는 Spinatlas 심벌. */
export function SpinatlasMark({ className }: SpinatlasMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      focusable="false"
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="50" fill="#0061fd" />
      <path
        fill="#fff"
        d="M 75.56 12.47 L 81.55 16.21 L 84.29 18.95 L 86.28 21.95 L 87.28 26.68 L 86.78 28.93 L 84.54 32.67 L 79.8 36.91 L 71.32 42.14 L 28.43 64.84 L 21.45 69.08 L 17.46 73.07 L 16.46 75.31 L 16.46 78.05 L 17.46 80.55 L 19.45 83.29 L 25.69 88.53 L 18.2 84.04 L 13.97 79.8 L 11.47 75.31 L 11.22 71.07 L 13.22 66.83 L 17.46 62.84 L 21.7 60.1 L 70.32 33.42 L 77.31 28.68 L 80.55 25.19 L 81.55 23.19 L 81.8 20.2 L 80.3 16.96 L 75.81 12.47 Z"
      />
    </svg>
  );
}

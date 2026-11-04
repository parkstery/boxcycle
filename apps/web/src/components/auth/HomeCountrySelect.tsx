import { useMemo } from "react";
import { listHomeCountryOptions } from "../../lib/identity/homeCountry";

type HomeCountrySelectProps = {
  id?: string;
  className?: string;
  value: string | null;
  disabled?: boolean;
  onChange: (code: string) => void;
};

/** 대표 국가 선택 상자 — 가입 카드·국가 확인·프로필 수정이 함께 쓴다. 이름은 화면 언어(한국어) 순. */
export function HomeCountrySelect({ id, className, value, disabled, onChange }: HomeCountrySelectProps) {
  const options = useMemo(() => listHomeCountryOptions("ko"), []);
  return (
    <select
      id={id}
      className={className}
      aria-label="국가"
      value={value ?? ""}
      disabled={disabled}
      required
      onChange={(ev) => onChange(ev.target.value)}
    >
      {value == null ? (
        <option value="" disabled>
          선택
        </option>
      ) : null}
      {options.map((o) => (
        <option key={o.code} value={o.code}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

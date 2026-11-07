import { useRef } from "react";
import { fieldErrorBorder, FormFieldError } from "./FormFieldError";
import { NHIS_PLACEHOLDER, formatNhis, nhisDigits } from "../lib/nhisFormat";

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
  id?: string;
  disabled?: boolean;
  name?: string;
  error?: string;
};

const defaultClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-navy outline-none placeholder:text-slate-400 focus:border-teal focus:ring-1 focus:ring-teal";

export function NhisInput({
  value,
  onChange,
  className = defaultClass,
  required,
  id,
  disabled,
  name,
  error,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const displayValue = formatNhis(value);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = nhisDigits(e.target.value);
    onChange(next ? formatNhis(next) : "");
  }

  function handleBlur() {
    const d = nhisDigits(value);
    onChange(d ? formatNhis(d) : "");
  }

  return (
    <div>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        required={required}
        className={fieldErrorBorder(Boolean(error), className)}
        placeholder={NHIS_PLACEHOLDER}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        maxLength={9}
        aria-label="NHIS membership number"
        aria-invalid={error ? true : undefined}
      />
      <FormFieldError message={error} />
    </div>
  );
}

import { useRef } from "react";
import { fieldErrorBorder, FormFieldError } from "./FormFieldError";
import {
  GHANA_PHONE_PLACEHOLDER,
  formatGhanaPhone,
  ghanaPhoneDigits,
} from "../lib/ghanaPhoneFormat";

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
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-navy outline-none placeholder:text-slate-400 focus:border-teal focus:ring-1 focus:ring-teal";

export function PhoneInput({
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
  const displayValue = formatGhanaPhone(value);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = ghanaPhoneDigits(e.target.value);
    onChange(next ? formatGhanaPhone(next) : "");
  }

  return (
    <div>
      <input
        ref={inputRef}
        id={id}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        disabled={disabled}
        required={required}
        className={fieldErrorBorder(Boolean(error), className)}
        placeholder={GHANA_PHONE_PLACEHOLDER}
        value={displayValue}
        onChange={handleChange}
        maxLength={14}
        aria-label="Contact phone number"
        aria-invalid={error ? true : undefined}
        aria-describedby={error && id ? `${id}-error` : undefined}
      />
      <FormFieldError message={error} />
    </div>
  );
}

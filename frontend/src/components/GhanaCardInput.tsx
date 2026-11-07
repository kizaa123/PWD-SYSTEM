import { useRef, useState } from "react";
import { fieldErrorBorder, FormFieldError } from "./FormFieldError";
import {
  GHANA_CARD_PLACEHOLDER,
  formatGhanaCard,
  ghanaCardDigits,
} from "../lib/ghanaCardFormat";

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
  "w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 font-mono text-sm text-navy uppercase tracking-wide outline-none placeholder:text-slate-400 focus:border-teal focus:ring-1 focus:ring-teal";

export function GhanaCardInput({
  value,
  onChange,
  className = defaultClass,
  required,
  id,
  disabled,
  name,
  error,
}: Props) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const digits = ghanaCardDigits(value);
  const displayValue = digits.length > 0 || focused ? formatGhanaCard(value) || "GHA-" : "";

  function commitFromRaw(raw: string) {
    const nextDigits = ghanaCardDigits(raw);
    if (nextDigits.length === 0) {
      onChange(focused ? "GHA-" : "");
      return;
    }
    onChange(formatGhanaCard(nextDigits));
  }

  function handleFocus() {
    setFocused(true);
    if (digits.length === 0) {
      onChange("GHA-");
      requestAnimationFrame(() => {
        const el = inputRef.current;
        if (el) el.setSelectionRange(el.value.length, el.value.length);
      });
    }
  }

  function handleBlur() {
    setFocused(false);
    const d = ghanaCardDigits(value);
    if (d.length === 0) onChange("");
    else onChange(formatGhanaCard(d));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    commitFromRaw(e.target.value);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Backspace" || !inputRef.current) return;
    const el = inputRef.current;
    const pos = el.selectionStart ?? 0;
    const selEnd = el.selectionEnd ?? pos;
    if (pos !== selEnd) return;

    if (pos <= 4 && digits.length === 0) {
      e.preventDefault();
      return;
    }

    if (pos > 0 && pos <= 4 && digits.length > 0) {
      e.preventDefault();
      commitFromRaw(digits.slice(0, -1));
      return;
    }

    const v = el.value;
    if (e.key === "Backspace" && pos > 0 && v[pos - 1] === "-") {
      e.preventDefault();
      commitFromRaw(digits.slice(0, -1));
    }
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
        placeholder={GHANA_CARD_PLACEHOLDER}
        value={displayValue}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        maxLength={15}
        aria-label="Ghana Card number"
        aria-invalid={error ? true : undefined}
      />
      <FormFieldError message={error} />
    </div>
  );
}

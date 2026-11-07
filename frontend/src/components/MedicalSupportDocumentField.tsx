import { Field, inputClass } from "./StatusBadge";
import { fieldErrorBorder, FormFieldError } from "./FormFieldError";

type Props = {
  file: File | null;
  onChange: (file: File | null) => void;
  required?: boolean;
  error?: string;
};

export function MedicalSupportDocumentField({ file, onChange, required = true, error }: Props) {
  return (
    <Field label="Hospital medical document (required)">
      <input
        type="file"
        accept="image/*,application/pdf"
        required={required && !file ? true : undefined}
        className={fieldErrorBorder(
          Boolean(error),
          `${inputClass} block w-full cursor-pointer text-sm text-navy file:mr-3 file:rounded-lg file:border-0 file:bg-navy/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-navy`,
        )}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {file ? <p className="mt-1.5 text-xs text-muted">Selected: {file.name}</p> : null}
      <FormFieldError message={error} />
    </Field>
  );
}

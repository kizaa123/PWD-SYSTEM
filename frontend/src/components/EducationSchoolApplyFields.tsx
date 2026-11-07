import {
  EDUCATION_SCHOOL_LETTER_HELPER,
} from "../lib/educationSupportPolicy";
import { Field, inputClass } from "./StatusBadge";
import { fieldErrorBorder, FormFieldError } from "./FormFieldError";

type Props = {
  schoolName: string;
  schoolAccountNumber: string;
  onSchoolNameChange: (v: string) => void;
  onSchoolAccountNumberChange: (v: string) => void;
  schoolNameError?: string;
  schoolAccountNumberError?: string;
  letterFile: File | null;
  onLetterFileChange: (file: File | null) => void;
};

export function EducationSchoolApplyFields({
  schoolName,
  schoolAccountNumber,
  onSchoolNameChange,
  onSchoolAccountNumberChange,
  schoolNameError,
  schoolAccountNumberError,
  letterFile,
  onLetterFileChange,
}: Props) {
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <div>
        <h4 className="text-sm font-semibold text-navy">School payment details</h4>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Required for education support applications (including returning applicants).
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="School name">
          <div id="apply-field-schoolName">
            <input
              className={fieldErrorBorder(Boolean(schoolNameError), inputClass)}
              value={schoolName}
              onChange={(e) => onSchoolNameChange(e.target.value)}
              placeholder="Name of school or institution"
              required
            />
            <FormFieldError message={schoolNameError} />
          </div>
        </Field>
        <Field label="School account No.">
          <div id="apply-field-schoolAccountNumber">
            <input
              className={fieldErrorBorder(Boolean(schoolAccountNumberError), inputClass)}
              value={schoolAccountNumber}
              onChange={(e) => onSchoolAccountNumberChange(e.target.value)}
              placeholder="Account number for fees"
              required
            />
            <FormFieldError message={schoolAccountNumberError} />
          </div>
        </Field>
      </div>
      <Field label="Letter from school (optional)">
        <input
          type="file"
          accept="image/*,application/pdf"
          className={`${inputClass} block w-full cursor-pointer text-sm text-navy file:mr-3 file:rounded-lg file:border-0 file:bg-navy/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-navy`}
          onChange={(e) => onLetterFileChange(e.target.files?.[0] ?? null)}
        />
        {letterFile ? <p className="mt-1.5 text-xs text-muted">Selected: {letterFile.name}</p> : null}
        <p className="mt-1.5 text-xs text-muted">{EDUCATION_SCHOOL_LETTER_HELPER}</p>
      </Field>
    </div>
  );
}

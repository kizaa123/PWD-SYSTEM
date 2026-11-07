import { FormFieldError } from "./FormFieldError";
import { Field, inputClass } from "./StatusBadge";

export type DeclarationState = {
  signatureMode: "" | "signature" | "thumbprint";
  officeUseQualified: "" | "qualified" | "not_qualified";
  officeUseRemarks: string;
};

export const EMPTY_DECLARATION: DeclarationState = {
  signatureMode: "",
  officeUseQualified: "",
  officeUseRemarks: "",
};

type Props = {
  value: DeclarationState;
  onChange: (next: DeclarationState) => void;
  errors?: Partial<Record<keyof DeclarationState, string>>;
  /** Shown above the applicant signature line. */
  children?: React.ReactNode;
};

export function ApplicationDeclarationBlock({ value, onChange, errors = {}, children }: Props) {
  function set<K extends keyof DeclarationState>(key: K, v: DeclarationState[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <div className="space-y-8">
      {children}

      <div id="apply-field-signatureMode" className="space-y-3 border-t border-canvas pt-6">
        <div className="text-sm font-semibold text-navy">Signature / Thumbprint:</div>
        <div className="flex flex-wrap gap-x-8 gap-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-navy">
            <input
              type="radio"
              name="signatureMode"
              checked={value.signatureMode === "signature"}
              onChange={() => set("signatureMode", "signature")}
              className="h-4 w-4 accent-navy"
            />
            Signature
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-navy">
            <input
              type="radio"
              name="signatureMode"
              checked={value.signatureMode === "thumbprint"}
              onChange={() => set("signatureMode", "thumbprint")}
              className="h-4 w-4 accent-navy"
            />
            Thumbprint
          </label>
        </div>
        <FormFieldError message={errors.signatureMode} />
        <div className="mt-1 border-b border-dashed border-navy/30 pb-6" aria-hidden />
      </div>

      <div className="space-y-2 text-sm leading-relaxed text-navy">
        <p>Please attach all supporting documents.</p>
        <p className="font-medium">I certify that all answers are true to the best of my knowledge.</p>
      </div>

      <div className="rounded-xl border border-navy/15 bg-canvas/60 p-5">
        <h4 className="text-sm font-bold uppercase tracking-wide text-navy">For Office Use Only</h4>
        <div id="apply-field-officeUseQualified" className="mt-4">
          <div className="text-xs font-medium text-muted">Remarks</div>
          <div className="mt-2 flex flex-wrap gap-x-8 gap-y-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-navy">
              <input
                type="radio"
                name="officeUseQualified"
                checked={value.officeUseQualified === "qualified"}
                onChange={() => set("officeUseQualified", "qualified")}
                className="h-4 w-4 accent-teal"
              />
              Qualified
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-navy">
              <input
                type="radio"
                name="officeUseQualified"
                checked={value.officeUseQualified === "not_qualified"}
                onChange={() => set("officeUseQualified", "not_qualified")}
                className="h-4 w-4 accent-teal"
              />
              Not Qualified
            </label>
          </div>
          <FormFieldError message={errors.officeUseQualified} />
        </div>
        <div className="mt-4">
          <Field label="Additional remarks (optional)">
            <textarea
              className={inputClass}
              rows={2}
              value={value.officeUseRemarks}
              onChange={(e) => set("officeUseRemarks", e.target.value)}
              placeholder="Notes for the office record"
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

import { Field, inputClass } from "./StatusBadge";

export const RESIDENCE_OPTIONS = ["Renting", "Rent-free", "Perching", "Squatting", "Caretaker", "Other"];

export const RESIDENCE_TYPE_PLACEHOLDER = "Select type of Residence";

export const CAREGIVER_RELATIONSHIP_OPTIONS = ["Mother", "Father", "Other relative", "Friend", "Other"];

export const CAREGIVER_PURPOSE_OPTIONS = [
  "Treatments of person receiving care",
  "Basic Needs",
  "Utility Bills",
  "House Rent",
  "Other",
];

export const SUPPORT_TYPE_OPTIONS = [
  { value: "economic_empowerment", label: "Economic Empowerment" },
  { value: "health", label: "Health" },
  { value: "education", label: "Education" },
  { value: "assistive_device", label: "Assistive Device" },
  { value: "other", label: "Other" },
];

export function RegSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-canvas pt-6 first:border-t-0 first:pt-0">
      <h3 className="mb-4 border-b border-canvas pb-2 text-sm font-semibold text-navy">{title}</h3>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </div>
  );
}

export function RadioGroup({
  label,
  name,
  value,
  options,
  onChange,
  otherValue,
  onOther,
  span2,
}: {
  label: string;
  name: string;
  value: string;
  options: { value: string; label: string }[] | string[];
  onChange: (v: string) => void;
  otherValue?: string;
  onOther?: (v: string) => void;
  span2?: boolean;
}) {
  const opts = options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  const isOther = value === "Other" || value === "other";
  return (
    <div className={span2 ? "md:col-span-2" : ""}>
      <label className="mb-1.5 block text-sm font-medium text-navy">{label}</label>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {opts.map((opt) => (
          <label key={opt.value} className="inline-flex cursor-pointer items-center gap-2 text-sm text-navy">
            <input
              type="radio"
              name={name}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className="h-4 w-4 accent-teal"
            />
            {opt.label}
          </label>
        ))}
      </div>
      {isOther && onOther && (
        <input
          className={`${inputClass} mt-2`}
          placeholder="Please specify"
          value={otherValue || ""}
          onChange={(e) => onOther(e.target.value)}
        />
      )}
    </div>
  );
}

export { Field };

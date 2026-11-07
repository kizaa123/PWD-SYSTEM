import { EDUCATION_LEVEL_OPTIONS, educationLevelChoices, isPresetEducationLevel } from "../lib/educationLevels";

type Props = {
  value: string;
  onChange: (value: string) => void;
  otherValue?: string;
  onOtherChange?: (value: string) => void;
  className?: string;
  id?: string;
  required?: boolean;
};

/** Beneficiary (PWD): preset list; choosing Other shows a text field. */
export function EducationLevelSelect({ value, onChange, otherValue = "", onOtherChange, className, id, required }: Props) {
  const selectValue = !value.trim() ? "" : isPresetEducationLevel(value) ? value : "Other";
  const other = selectValue === "Other" ? otherValue || (!isPresetEducationLevel(value) ? value : "") : "";
  const options = educationLevelChoices(selectValue === "Other" ? other : value);

  return (
    <div className="space-y-2">
      <select
        id={id}
        className={className}
        value={selectValue}
        required={required && selectValue !== "Other"}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v);
          if (v !== "Other") onOtherChange?.("");
        }}
      >
        <option value="">Select level of education</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      {selectValue === "Other" ? (
        <input
          type="text"
          className={className}
          value={other}
          required={required}
          placeholder="Type level of education"
          onChange={(e) => {
            onOtherChange?.(e.target.value);
            onChange("Other");
          }}
        />
      ) : null}
    </div>
  );
}

type TextProps = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  placeholder?: string;
};

/** Caregiver: free text (not limited to the beneficiary preset list). */
export function EducationLevelTextInput({
  value,
  onChange,
  className,
  id,
  placeholder = "e.g. JHS, SHS, Vocational, Tertiary",
}: TextProps) {
  return (
    <input
      id={id}
      type="text"
      className={className}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

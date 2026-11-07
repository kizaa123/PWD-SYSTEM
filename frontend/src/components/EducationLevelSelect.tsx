import { educationLevelChoices } from "../lib/educationLevels";

type Props = {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  required?: boolean;
};

export function EducationLevelSelect({ value, onChange, className, id, required }: Props) {
  const options = educationLevelChoices(value);
  return (
    <select
      id={id}
      className={className}
      value={value}
      required={required}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Select level of education</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

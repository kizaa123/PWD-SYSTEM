import { useEffect, useState } from "react";
import {
  EDUCATION_TECHNICAL_AID_OPTIONS,
  HEALTH_ASSISTIVE_DEVICE_OPTIONS,
  type AssistiveDeviceKey,
  type PurposeFormState,
} from "../lib/supportPurposeOptions";
import {
  isStartupToolPreviouslyRequested,
  startupToolLabelsFromHistory,
  type StartupToolHistoryRow,
} from "../lib/startupToolPolicy";
import { Field, inputClass } from "./StatusBadge";

function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-baseline gap-2 border-b border-slate-200 pb-2">
      <span className="text-xs font-bold uppercase tracking-wide text-muted">{n}.</span>
      <h3 className="text-sm font-semibold text-navy">{title}</h3>
    </div>
  );
}

function educationPathReady(form: PurposeFormState): boolean {
  if (form.educationTrack === "formal") {
    if (!form.formalLevel) return false;
    if (form.formalLevel === "tertiary" && !form.qualificationPursued.trim()) return false;
    return true;
  }
  if (form.educationTrack === "apprenticeship") {
    return form.apprenticeshipType === "vocational" || form.apprenticeshipType === "technical";
  }
  return false;
}

function RadioRow({
  name,
  value,
  checked,
  onChange,
  label,
  labelClassName = "text-navy",
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  label: string;
  labelClassName?: string;
}) {
  return (
    <label className={`flex cursor-pointer items-center gap-2 text-sm ${labelClassName}`}>
      <input type="radio" name={name} checked={checked} onChange={onChange} className="h-4 w-4 accent-navy" />
      {label}
    </label>
  );
}

function DevicePicker({
  legend,
  options,
  name,
  selectedKey,
  otherText,
  appliedSet,
  onSelect,
  onOtherText,
  onBlocked,
}: {
  legend: string;
  options: { key: AssistiveDeviceKey; label: string }[];
  name: string;
  selectedKey: AssistiveDeviceKey | "";
  otherText: string;
  appliedSet: Set<AssistiveDeviceKey>;
  onSelect: (key: AssistiveDeviceKey) => void;
  onOtherText: (text: string) => void;
  onBlocked: (message: string) => void;
}) {
  return (
    <fieldset className="space-y-2 border-t border-slate-200 pt-3">
      <legend className="text-xs font-medium text-muted">{legend}</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map(({ key, label }) => {
          const alreadyApplied = appliedSet.has(key);
          if (alreadyApplied) {
            return (
              <label
                key={key}
                className="flex cursor-not-allowed items-center gap-2 text-sm font-medium text-red-600"
                onClick={() => onBlocked("This device has been requested before and cannot be applied for again.")}
              >
                <input
                  type="checkbox"
                  checked
                  readOnly
                  tabIndex={-1}
                  className="h-4 w-4 cursor-not-allowed accent-red-600"
                  aria-label={`${label} — already requested`}
                />
                {label}
              </label>
            );
          }
          return (
            <RadioRow
              key={key}
              name={name}
              value={key}
              checked={selectedKey === key}
              onChange={() => onSelect(key)}
              label={label}
            />
          );
        })}
      </div>
      {selectedKey === "other" && (
        <Field label="Other — specify device">
          <input
            className={inputClass}
            value={otherText}
            onChange={(e) => onOtherText(e.target.value)}
            placeholder="Type the specific device needed"
          />
        </Field>
      )}
    </fieldset>
  );
}

type Props = {
  categoryCode: string;
  value: PurposeFormState;
  onChange: (next: PurposeFormState) => void;
  previouslyAppliedDeviceKeys?: AssistiveDeviceKey[];
  startupToolHistory?: StartupToolHistoryRow[];
};

export function SupportPurposeDetails({
  categoryCode,
  value,
  onChange,
  previouslyAppliedDeviceKeys = [],
  startupToolHistory = [],
}: Props) {
  const [deviceBlockMessage, setDeviceBlockMessage] = useState("");
  const appliedSet = new Set(previouslyAppliedDeviceKeys);
  const previouslyRequestedStartupTools = startupToolLabelsFromHistory(startupToolHistory);

  useEffect(() => {
    setDeviceBlockMessage("");
  }, [categoryCode, previouslyAppliedDeviceKeys, startupToolHistory]);

  useEffect(() => {
    if (categoryCode !== "income_generating" || value.incomeSupportType !== "startup_tool") return;
    const typed = value.itemSpecification.trim();
    if (!typed) {
      setDeviceBlockMessage("");
      return;
    }
    if (isStartupToolPreviouslyRequested(typed, startupToolHistory)) {
      setDeviceBlockMessage("This start-up tool has been requested before and cannot be applied for again.");
    } else {
      setDeviceBlockMessage("");
    }
  }, [categoryCode, value.incomeSupportType, value.itemSpecification, startupToolHistory]);

  function patch(partial: Partial<PurposeFormState>) {
    onChange({ ...value, ...partial });
  }

  function onDeviceBlocked(message: string) {
    setDeviceBlockMessage(message);
  }

  if (categoryCode === "income_generating") {
    return (
      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <SectionTitle n={1} title="Economic generation" />
        <Field label="Type of economic activity">
          <input
            className={inputClass}
            value={value.economicActivity}
            onChange={(e) => patch({ economicActivity: e.target.value })}
            placeholder="Describe the economic activity"
          />
        </Field>
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-muted">Type of support</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["startup_capital", "Capital"],
                ["startup_tool", "Start-up tool"],
              ] as const
            ).map(([key, label]) => (
              <RadioRow
                key={key}
                name="incomeSupportType"
                value={key}
                checked={value.incomeSupportType === key}
                onChange={() =>
                  patch({
                    incomeSupportType: key,
                    itemSpecification: "",
                    assistiveDeviceType: "",
                    assistiveDeviceOther: "",
                  })
                }
                label={label}
              />
            ))}
          </div>
        </fieldset>
        {value.incomeSupportType === "startup_capital" && (
          <Field label="What will the capital be used for?">
            <input
              className={inputClass}
              value={value.itemSpecification}
              onChange={(e) => patch({ itemSpecification: e.target.value })}
              placeholder="e.g. stock, rent, raw materials"
            />
          </Field>
        )}
        {value.incomeSupportType === "startup_tool" && (
          <div className="space-y-3 border-t border-slate-200 pt-3">
            {previouslyRequestedStartupTools.length > 0 ? (
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-muted">Previously requested start-up tools</legend>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {previouslyRequestedStartupTools.map((tool) => (
                    <li
                      key={tool}
                      className="flex cursor-not-allowed items-center gap-2 text-sm font-medium text-red-600"
                    >
                      <input
                        type="checkbox"
                        checked
                        readOnly
                        tabIndex={-1}
                        className="h-4 w-4 cursor-not-allowed accent-red-600"
                        aria-label={`${tool} — already requested`}
                      />
                      {tool}
                    </li>
                  ))}
                </ul>
              </fieldset>
            ) : null}
            <Field label="Start-up tool or equipment needed">
              <input
                className={inputClass}
                value={value.itemSpecification}
                onChange={(e) => {
                  setDeviceBlockMessage("");
                  patch({ itemSpecification: e.target.value });
                }}
                placeholder="e.g. fufu machine, freezer"
              />
            </Field>
            {deviceBlockMessage ? (
              <p className="text-sm font-medium text-red-600" role="alert">
                {deviceBlockMessage}
              </p>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  if (categoryCode === "education") {
    return (
      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <SectionTitle n={2} title="Education" />
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-muted">Level or apprenticeship</legend>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <RadioRow
              name="educationTrack"
              value="formal"
              checked={value.educationTrack === "formal"}
              onChange={() =>
                patch({
                  educationTrack: "formal",
                  apprenticeshipType: "",
                  formalLevel: "",
                  qualificationPursued: "",
                  educationalSupportType: "",
                  assistiveDeviceType: "",
                  assistiveDeviceOther: "",
                })
              }
              label="Formal (Basic / Secondary / Tertiary)"
            />
            <RadioRow
              name="educationTrack"
              value="apprenticeship"
              checked={value.educationTrack === "apprenticeship"}
              onChange={() =>
                patch({
                  educationTrack: "apprenticeship",
                  formalLevel: "",
                  qualificationPursued: "",
                  apprenticeshipType: "",
                  educationalSupportType: "",
                  assistiveDeviceType: "",
                  assistiveDeviceOther: "",
                })
              }
              label="Apprenticeship"
            />
          </div>
        </fieldset>

        {value.educationTrack === "formal" && (
          <fieldset className="space-y-2 pl-1">
            <legend className="text-xs font-medium text-muted">Education level</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {(
                [
                  ["basic", "Basic"],
                  ["secondary", "Secondary"],
                  ["tertiary", "Tertiary"],
                ] as const
              ).map(([level, label]) => (
                <RadioRow
                  key={level}
                  name="formalLevel"
                  value={level}
                  checked={value.formalLevel === level}
                  onChange={() =>
                    patch({
                      formalLevel: level,
                      qualificationPursued: level === "tertiary" ? value.qualificationPursued : "",
                      educationalSupportType: "",
                      assistiveDeviceType: "",
                      assistiveDeviceOther: "",
                    })
                  }
                  label={label}
                />
              ))}
            </div>
            {value.formalLevel === "tertiary" && (
              <Field label="Type of qualification being pursued">
                <input
                  className={inputClass}
                  value={value.qualificationPursued}
                  onChange={(e) => patch({ qualificationPursued: e.target.value })}
                  placeholder="e.g. Diploma, Degree, Certificate"
                />
              </Field>
            )}
          </fieldset>
        )}

        {value.educationTrack === "apprenticeship" && (
          <fieldset className="space-y-2 pl-1">
            <legend className="text-xs font-medium text-muted">Type of apprenticeship</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <RadioRow
                name="apprenticeshipType"
                value="vocational"
                checked={value.apprenticeshipType === "vocational"}
                onChange={() =>
                  patch({ apprenticeshipType: "vocational", educationalSupportType: "", assistiveDeviceType: "", assistiveDeviceOther: "" })
                }
                label="Vocational"
              />
              <RadioRow
                name="apprenticeshipType"
                value="technical"
                checked={value.apprenticeshipType === "technical"}
                onChange={() =>
                  patch({ apprenticeshipType: "technical", educationalSupportType: "", assistiveDeviceType: "", assistiveDeviceOther: "" })
                }
                label="Technical"
              />
            </div>
          </fieldset>
        )}

        {educationPathReady(value) && value.educationTrack !== "apprenticeship" && (
          <fieldset className="space-y-2 border-t border-slate-200 pt-3">
            <legend className="text-xs font-medium text-muted">Type of educational support</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {(
                [
                  ["school_fees", "School fees"],
                  ["bursary", "Bursary"],
                  ["technical_aid", "Technical aid"],
                ] as const
              ).map(([key, label]) => (
                <RadioRow
                  key={key}
                  name="educationalSupportType"
                  value={key}
                  checked={value.educationalSupportType === key}
                  onChange={() =>
                    patch({
                      educationalSupportType: key,
                      assistiveDeviceType: "",
                      assistiveDeviceOther: "",
                    })
                  }
                  label={label}
                />
              ))}
            </div>
          </fieldset>
        )}

        {value.educationalSupportType === "technical_aid" && (
          <>
            <DevicePicker
              legend="Technical aid — select the device needed"
              options={EDUCATION_TECHNICAL_AID_OPTIONS}
              name="educationTechnicalAid"
              selectedKey={value.assistiveDeviceType}
              otherText={value.assistiveDeviceOther}
              appliedSet={appliedSet}
              onSelect={(key) => {
                setDeviceBlockMessage("");
                patch({
                  assistiveDeviceType: key,
                  assistiveDeviceOther: key === "other" ? value.assistiveDeviceOther : "",
                });
              }}
              onOtherText={(text) => patch({ assistiveDeviceOther: text })}
              onBlocked={onDeviceBlocked}
            />
            {deviceBlockMessage ? (
              <p className="text-sm font-medium text-red-600" role="alert">
                {deviceBlockMessage}
              </p>
            ) : null}
          </>
        )}
      </div>
    );
  }

  if (categoryCode === "health") {
    return (
      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <SectionTitle n={3} title="Health" />
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-muted">Type of support</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["assistive_device", "Assistive device"],
                ["medication", "Medication"],
                ["surgery", "Surgery"],
                ["therapy", "Therapy"],
              ] as const
            ).map(([key, label]) => (
              <RadioRow
                key={key}
                name="healthNeed"
                value={key}
                checked={value.healthNeed === key}
                onChange={() =>
                  patch({
                    healthNeed: key,
                    assistiveDeviceType: key === "assistive_device" ? value.assistiveDeviceType : "",
                    assistiveDeviceOther: key === "assistive_device" ? value.assistiveDeviceOther : "",
                  })
                }
                label={label}
              />
            ))}
          </div>
        </fieldset>
        {value.healthNeed === "assistive_device" && (
          <>
            <DevicePicker
              legend="State the specific device needed (e.g. wheelchair) — cannot request the same device twice"
              options={HEALTH_ASSISTIVE_DEVICE_OPTIONS}
              name="healthAssistiveDevice"
              selectedKey={value.assistiveDeviceType}
              otherText={value.assistiveDeviceOther}
              appliedSet={appliedSet}
              onSelect={(key) => {
                setDeviceBlockMessage("");
                patch({
                  assistiveDeviceType: key,
                  assistiveDeviceOther: key === "other" ? value.assistiveDeviceOther : "",
                });
              }}
              onOtherText={(text) => patch({ assistiveDeviceOther: text })}
              onBlocked={onDeviceBlocked}
            />
            {deviceBlockMessage ? (
              <p className="text-sm font-medium text-red-600" role="alert">
                {deviceBlockMessage}
              </p>
            ) : null}
          </>
        )}
      </div>
    );
  }

  return (
    <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-muted">
      Select a support category to show the type of support options.
    </p>
  );
}

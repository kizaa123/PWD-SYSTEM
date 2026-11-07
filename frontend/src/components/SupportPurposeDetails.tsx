import { useEffect, useState } from "react";
import {
  ASSISTIVE_DEVICE_OPTIONS,
  CAREGIVER_PURPOSE_OPTIONS,
  type AssistiveDeviceKey,
  type PurposeFormState,
} from "../lib/supportPurposeOptions";
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

type Props = {
  categoryCode: string;
  value: PurposeFormState;
  onChange: (next: PurposeFormState) => void;
  previouslyAppliedDeviceKeys?: AssistiveDeviceKey[];
};

export function SupportPurposeDetails({
  categoryCode,
  value,
  onChange,
  previouslyAppliedDeviceKeys = [],
}: Props) {
  const [deviceBlockMessage, setDeviceBlockMessage] = useState("");
  const appliedSet = new Set(previouslyAppliedDeviceKeys);

  useEffect(() => {
    setDeviceBlockMessage("");
  }, [categoryCode, previouslyAppliedDeviceKeys]);

  function patch(partial: Partial<PurposeFormState>) {
    onChange({ ...value, ...partial });
  }

  if (categoryCode === "income_generating") {
    return (
      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <SectionTitle n={1} title="Income generation" />
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
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <RadioRow
              name="incomeSupportType"
              value="startup_capital"
              checked={value.incomeSupportType === "startup_capital"}
              onChange={() => patch({ incomeSupportType: "startup_capital" })}
              label="Capital"
            />
            <RadioRow
              name="incomeSupportType"
              value="startup_tool"
              checked={value.incomeSupportType === "startup_tool"}
              onChange={() => patch({ incomeSupportType: "startup_tool" })}
              label="Start-up tool"
            />
          </div>
        </fieldset>
        <Field label="Specify item (required for start-up tool)">
          <input
            className={inputClass}
            value={value.itemSpecification}
            onChange={(e) => patch({ itemSpecification: e.target.value })}
            placeholder="Item or equipment to be provided"
          />
        </Field>
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
                onChange={() => patch({ apprenticeshipType: "vocational", educationalSupportType: "" })}
                label="Vocational"
              />
              <RadioRow
                name="apprenticeshipType"
                value="technical"
                checked={value.apprenticeshipType === "technical"}
                onChange={() => patch({ apprenticeshipType: "technical", educationalSupportType: "" })}
                label="Technical"
              />
            </div>
          </fieldset>
        )}

        {educationPathReady(value) && (
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
                  onChange={() => patch({ educationalSupportType: key })}
                  label={label}
                />
              ))}
            </div>
          </fieldset>
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
                ["surgery", "Surgery"],
                ["therapy", "Therapy"],
                ["medication", "Medication"],
              ] as const
            ).map(([key, label]) => (
              <RadioRow
                key={key}
                name="healthNeed"
                value={key}
                checked={value.healthNeed === key}
                onChange={() => patch({ healthNeed: key })}
                label={label}
              />
            ))}
          </div>
        </fieldset>
      </div>
    );
  }

  if (categoryCode === "assistive_device") {
    return (
      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <SectionTitle n={4} title="Assistive device" />
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-muted">
            Type of assistive device applied for (select one for this year)
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {ASSISTIVE_DEVICE_OPTIONS.map(({ key, label }) => {
              const alreadyApplied = appliedSet.has(key);
              if (alreadyApplied) {
                return (
                  <label
                    key={key}
                    className="flex cursor-not-allowed items-center gap-2 text-sm font-medium text-red-600"
                    onClick={() => setDeviceBlockMessage("This device has been applied for already.")}
                  >
                    <input
                      type="checkbox"
                      checked
                      readOnly
                      tabIndex={-1}
                      className="h-4 w-4 cursor-not-allowed accent-red-600"
                      aria-label={`${label} — already applied`}
                    />
                    {label}
                  </label>
                );
              }
              return (
                <RadioRow
                  key={key}
                  name="assistiveDeviceType"
                  value={key}
                  checked={value.assistiveDeviceType === key}
                  onChange={() => {
                    setDeviceBlockMessage("");
                    patch({
                      assistiveDeviceType: key,
                      assistiveDeviceOther: key === "other" ? value.assistiveDeviceOther : "",
                    });
                  }}
                  label={label}
                />
              );
            })}
          </div>
          {deviceBlockMessage ? (
            <p className="text-sm font-medium text-red-600" role="alert">
              {deviceBlockMessage}
            </p>
          ) : null}
        </fieldset>
        {value.assistiveDeviceType === "other" && (
          <Field label="Other — specify">
            <input
              className={inputClass}
              value={value.assistiveDeviceOther}
              onChange={(e) => patch({ assistiveDeviceOther: e.target.value })}
              placeholder="Describe the device"
            />
          </Field>
        )}
        <fieldset className="space-y-2 border-t border-slate-200 pt-3">
          <legend className="text-xs font-medium text-muted">Are you already receiving any form of assistive support?</legend>
          <div className="flex flex-wrap gap-x-8 gap-y-2">
            <RadioRow
              name="alreadyReceivingAssistive"
              value="yes"
              checked={value.alreadyReceivingAssistive === "yes"}
              onChange={() => patch({ alreadyReceivingAssistive: "yes" })}
              label="Yes"
            />
            <RadioRow
              name="alreadyReceivingAssistive"
              value="no"
              checked={value.alreadyReceivingAssistive === "no"}
              onChange={() =>
                patch({
                  alreadyReceivingAssistive: "no",
                  existingAssistiveDetail: "",
                  prescribedWhere: "",
                })
              }
              label="No"
            />
          </div>
        </fieldset>
        {value.alreadyReceivingAssistive === "yes" && (
          <div className="grid gap-3 border-l-2 border-slate-200 pl-3 md:grid-cols-2 md:items-start">
            <Field label="If yes, specify">
              <input
                className={inputClass}
                value={value.existingAssistiveDetail}
                onChange={(e) => patch({ existingAssistiveDetail: e.target.value })}
                placeholder="Existing assistive support"
              />
            </Field>
            <Field label="Where was it prescribed?">
              <input
                className={inputClass}
                value={value.prescribedWhere}
                onChange={(e) => patch({ prescribedWhere: e.target.value })}
                placeholder="Facility or prescriber"
              />
            </Field>
          </div>
        )}
      </div>
    );
  }

  if (categoryCode === "caregivers") {
    return (
      <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
        <SectionTitle n={5} title="Caregiver" />
        <fieldset className="space-y-2">
          <legend className="text-xs font-medium text-muted">Purpose of support</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {CAREGIVER_PURPOSE_OPTIONS.map((label) => (
              <RadioRow
                key={label}
                name="caregiverPurpose"
                value={label}
                checked={value.caregiverPurpose === label}
                onChange={() => patch({ caregiverPurpose: label })}
                label={label}
              />
            ))}
          </div>
        </fieldset>
        {value.caregiverPurpose === "Other" && (
          <Field label="Specify purpose">
            <input
              className={inputClass}
              value={value.caregiverPurposeOther}
              onChange={(e) => patch({ caregiverPurposeOther: e.target.value })}
            />
          </Field>
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

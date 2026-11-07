/** Parse DACF support type + need from caregiver application detail blobs (not registration type). */

const SUPPORT_TYPE_LABEL: Record<string, string> = {
  education: "Education",
  economic_empowerment: "Economic empowerment",
  health: "Health",
  assistive_device: "Assistive device",
  other: "Other",
};

function normalizeCategoryLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const key = t.toLowerCase().replace(/\s+/g, "_").replace("economic_empowerment", "economic_empowerment");
  if (SUPPORT_TYPE_LABEL[key]) return SUPPORT_TYPE_LABEL[key];
  if (t.toLowerCase() === "economic empowerment") return SUPPORT_TYPE_LABEL.economic_empowerment;
  if (t.toLowerCase() === "assistive device") return SUPPORT_TYPE_LABEL.assistive_device;
  return t;
}

function lineAfterColon(text: string, label: string): string {
  const re = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*(.+)$`, "im");
  const m = text.match(re);
  return m ? m[1].trim() : "";
}

function healthNeedFromText(raw: string): string {
  const p = raw.toLowerCase();
  if (p.includes("medication") || p.includes("for medication")) return "Medication";
  if (p.includes("therapy")) return "Therapy";
  if (p.includes("surgery")) return "Surgery";
  return raw.trim();
}

/**
 * Caregiver registrations store category_code "caregivers"; the real support type lives in
 * purpose_other (assessment lines) or in purpose_summary ("· Support: Health").
 */
export function caregiverApplicationSupportDisplay(
  details: Record<string, unknown> | null | undefined,
  purposeSummary?: string | null,
): { category: string; requested: string } {
  const blob = [details?.purpose_other, details?.purposeOther].find(
    (v) => v != null && String(v).trim(),
  );
  const text = blob ? String(blob) : "";

  let category = normalizeCategoryLabel(lineAfterColon(text, "Type of support applied for"));
  let requested = "";

  const healthRaw = lineAfterColon(text, "Health");
  if (healthRaw) requested = healthNeedFromText(healthRaw);

  if (!requested) {
    const device = lineAfterColon(text, "Assistive device");
    if (device) requested = device;
  }

  if (!requested) {
    const edu = [
      lineAfterColon(text, "Education mode"),
      lineAfterColon(text, "Formal level"),
      lineAfterColon(text, "Apprenticeship"),
    ].filter(Boolean);
    if (edu.length) requested = edu.join(" — ");
  }

  if (!requested) {
    const econ = [
      lineAfterColon(text, "Business"),
      lineAfterColon(text, "Business activity"),
    ].filter(Boolean);
    if (econ.length) requested = econ.join(" — ");
  }

  const summary = purposeSummary?.trim() || "";
  if (!category && summary) {
    const m = summary.match(/(?:·|\||—)\s*Support:\s*([^·—|]+)/i);
    if (m) category = normalizeCategoryLabel(m[1]);
  }

  if (!requested && summary) {
    const tail = summary.split(/(?:·|\||—)/).map((p) => p.trim());
    for (const part of tail) {
      if (/^support:/i.test(part)) continue;
      if (/treatments|basic needs|utility|house rent|caregiver/i.test(part) && !/surgery|medication|therapy/i.test(part)) {
        continue;
      }
      if (part.length > 2) {
        requested = healthNeedFromText(part);
        break;
      }
    }
  }

  return { category, requested };
}

export function supportTypeLabelFromCode(code: string | null | undefined): string {
  if (!code) return "";
  return SUPPORT_TYPE_LABEL[code] || normalizeCategoryLabel(code);
}

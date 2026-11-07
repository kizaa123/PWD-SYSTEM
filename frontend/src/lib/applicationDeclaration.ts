const PARENT_RELATIONSHIPS = new Set(["Mother", "Father"]);

export type DeclarationSubject = {
  registrationType?: string | null;
  /** Caregiver's relationship to the beneficiary, as captured at registration. */
  relationship?: string | null;
  beneficiaryName?: string | null;
};

export type DeclarationParts = {
  before: string;
  /** Beneficiary name, present only when a caregiver applies on someone's behalf. */
  beneficiaryName: string | null;
  after: string;
};

/**
 * The applicant declaration reads differently for a person applying for themselves
 * and for a caregiver applying on behalf of a child or a ward. The beneficiary name
 * is kept separate so the screen can render it as a link to the applicant record.
 */
export function applicationDeclarationParts(subject: DeclarationSubject): DeclarationParts {
  if (subject.registrationType !== "caregiver") {
    return {
      before: "I wish to apply for support from the DACF for Persons with Disabilities for myself.",
      beneficiaryName: null,
      after: "",
    };
  }
  const kinship = PARENT_RELATIONSHIPS.has((subject.relationship ?? "").trim()) ? "my child" : "my ward";
  const name = subject.beneficiaryName?.trim() || null;
  return {
    before: `I wish to apply for support from the DACF for Persons with Disabilities for ${kinship}${name ? ", " : "."}`,
    beneficiaryName: name,
    after: name ? "." : "",
  };
}

export function applicationDeclarationSentence(subject: DeclarationSubject): string {
  const parts = applicationDeclarationParts(subject);
  return `${parts.before}${parts.beneficiaryName ?? ""}${parts.after}`;
}

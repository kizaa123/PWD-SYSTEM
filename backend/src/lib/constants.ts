export const DISABILITY_CATEGORIES = [
  "Persons with physical disabilities",
  "Deaf persons",
  "Persons who are non-verbal",
  "Persons with communication disabilities including speech and language disabilities",
  "Persons who are hard of hearing",
  "Persons with visual disabilities",
  "Persons with multiple disabilities such as deafblind",
  "Persons with psychosocial disabilities",
  "Persons with cerebral palsy",
  "Persons with bipolar conditions",
  "Persons with attention deficit disorders",
  "Persons with schizophrenia",
  "Persons with developmental and neurological disabilities",
  "Persons with autism",
  "Persons with Down syndrome",
  "Persons with Turner Syndrome",
  "Persons with spinal injury",
  "Persons with autoimmune conditions",
  "Persons with osteogenesis imperfecta",
  "Persons with albinism",
  "Persons with intellectual disabilities",
  "Persons with epilepsy",
  "Persons with leprosy",
  "Little persons",
  "Persons with hunchback",
  "Burns Survivors",
  "Other (specify)",
];

export const RESIDENCE_TYPES = ["Renting", "Rent-free", "Perching", "Squatting", "Caretaker", "Other"];

/** Four-phase DACF request flow: registration → interview → selection → disbursement → completed */
export const WORKFLOW = {
  registration: ["interview", "returned_for_correction", "cancelled"],
  returned_for_correction: ["registration", "cancelled"],
  interview: ["selection", "returned_for_correction", "rejected", "on_hold"],
  selection: ["disbursement", "rejected", "returned_for_correction", "on_hold"],
  disbursement: ["completed", "partially_fulfilled"],
  partially_fulfilled: ["completed"],
  rejected: [],
  completed: [],
  on_hold: ["registration", "interview", "selection", "cancelled"],
  cancelled: [],
} as const;

export type AppStatus = keyof typeof WORKFLOW;

export const STATUS_LABELS: Record<string, string> = {
  registration: "Registration",
  interview: "Interview",
  selection: "Selection",
  disbursement: "Disbursement",
  completed: "Completed",
  returned_for_correction: "Returned for Correction",
  rejected: "Rejected",
  partially_fulfilled: "Partially Disbursed",
  on_hold: "On Hold",
  cancelled: "Cancelled",
  // legacy labels (migrated data / old exports)
  draft: "Registration",
  submitted: "Registration",
  under_verification: "Interview",
  under_assessment: "Interview",
  pending_decision: "Selection",
  escalated: "Selection",
  approved: "Selection",
  pending_fulfilment: "Disbursement",
  fulfilled: "Completed",
};

export const PHASE_ORDER = ["registration", "interview", "selection", "disbursement", "completed"] as const;

export const DEMO_PASSWORD = "Demo1234";

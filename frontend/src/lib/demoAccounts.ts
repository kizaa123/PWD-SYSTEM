/** Keep in sync with backend seed / policy demo accounts. */
export const DEMO_PASSWORD = "Demo1234";

export const DEMO_ACCOUNTS = [
  { label: "Social Welfare", email: "welfare@demo.gh", password: DEMO_PASSWORD },
  { label: "System Admin", email: "admin@demo.gh", password: DEMO_PASSWORD },
] as const;

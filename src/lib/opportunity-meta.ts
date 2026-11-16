/** Opportunity constants — no database imports, so client components can use them. */
export const OPP_STATUSES = ["inbox", "interested", "applying", "submitted", "interview", "result", "closed"] as const;
export type OppStatus = (typeof OPP_STATUSES)[number];

export const OPP_STATUS_LABELS: Record<OppStatus, string> = {
  inbox: "Inbox",
  interested: "Interested",
  applying: "Applying",
  submitted: "Submitted",
  interview: "Interview",
  result: "Result",
  closed: "Closed",
};

export const OPP_TYPES = ["Hackathon", "Internship", "Job", "Scholarship", "Fellowship", "Research", "Competition", "Conference", "Masters application", "Open source"];

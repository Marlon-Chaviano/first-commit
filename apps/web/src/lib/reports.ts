import { z } from "zod";

export const REPORT_REASONS = {
  malicious: "Runs something malicious or suspicious",
  broken: "Doesn't work or doesn't build",
  spam: "Spam or misleading",
  copyright: "Copies someone else's content without permission",
  other: "Other reason",
} as const;

/** Shared by the report form and POST /api/v1/reports. */
export const reportSchema = z.object({
  kit: z.string().min(1).max(200),
  reason: z.enum(Object.keys(REPORT_REASONS) as [keyof typeof REPORT_REASONS, ...(keyof typeof REPORT_REASONS)[]]),
  details: z.string().trim().min(10, "Tell us a bit more (at least 10 characters)").max(2000),
  contact: z.union([z.email("Invalid email"), z.literal("")]).optional(),
});

export type ReportInput = z.infer<typeof reportSchema>;

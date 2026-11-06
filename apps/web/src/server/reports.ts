import "server-only";

import { createHash } from "node:crypto";

import { db } from "./db";
import { kitReports } from "./db/schema";
import { sendEmail } from "./email";
import { env } from "./env";
import type { ReportInput } from "@/lib/reports";
import { REPORT_REASONS } from "@/lib/reports";

/** Stores a report and, if Resend is configured, emails the team. Returns false without a database. */
export async function saveReport(report: ReportInput, ip: string): Promise<boolean> {
  if (!db) return false;
  const ipHash = createHash("sha256").update(`${env.IP_HASH_SALT ?? "kits"}:${ip}`).digest("hex");
  await db.insert(kitReports).values({
    kit: report.kit,
    reason: report.reason,
    details: report.details,
    contact: report.contact || null,
    ipHash,
  });
  await notify(report).catch((error) => console.error("[reports] email not sent", error));
  return true;
}

async function notify(report: ReportInput): Promise<void> {
  if (!env.REPORTS_EMAIL) return;
  await sendEmail({
    to: env.REPORTS_EMAIL,
    subject: `Denuncia: ${report.kit} (${report.reason})`,
    text: `Kit: ${report.kit}\nMotivo: ${REPORT_REASONS[report.reason]}\nContacto: ${report.contact || "—"}\n\n${report.details}`,
  });
}

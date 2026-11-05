import { z } from "zod";

export const REPORT_REASONS = {
  malicious: "Ejecuta algo malicioso o sospechoso",
  broken: "No funciona o no compila",
  spam: "Spam o engañoso",
  copyright: "Copia contenido ajeno sin permiso",
  other: "Otro motivo",
} as const;

/** Shared by the report form and POST /api/v1/reports. */
export const reportSchema = z.object({
  kit: z.string().min(1).max(200),
  reason: z.enum(Object.keys(REPORT_REASONS) as [keyof typeof REPORT_REASONS, ...(keyof typeof REPORT_REASONS)[]]),
  details: z.string().trim().min(10, "Cuéntanos un poco más (mínimo 10 caracteres)").max(2000),
  contact: z.union([z.email("Email no válido"), z.literal("")]).optional(),
});

export type ReportInput = z.infer<typeof reportSchema>;

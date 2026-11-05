import { z } from "zod";

import { PACKAGE_MANAGER_IDS } from "./schema";

/**
 * Sent by the CLI after a successful `create-first-commit init`. Anonymous by design: no
 * project name, paths or IP. `anonId` is a random id stored on the machine so
 * unique installs can be counted; users opt out with DO_NOT_TRACK=1.
 */
export const installEventSchema = z.object({
  /** install: `init`. update / add: retention, never counted as installs. */
  type: z.enum(["install", "update", "add"]),
  /** Kit reference exactly as typed: "mobile-expo", "owner/repo", never local paths. */
  kit: z.string().min(1).max(200).regex(/^[\w.-]+(\/[\w.-]+)*$/),
  /** Version of the kit that was installed (from its kit.json). */
  kitVersion: z.string().max(32).optional(),
  /** option id → chosen choice ids */
  options: z.record(z.string().max(64), z.array(z.string().max(64)).max(20)).default({}),
  skills: z.array(z.string().max(200)).max(100).default([]),
  agents: z.array(z.string().max(64)).max(20).default([]),
  pm: z.enum(PACKAGE_MANAGER_IDS),
  cliVersion: z.string().max(32),
  os: z.string().max(32).optional(),
  anonId: z.uuid(),
});

export type InstallEvent = z.infer<typeof installEventSchema>;

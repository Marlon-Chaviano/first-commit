import type { Choice, Kit } from "@kits/schema/light";

/** Selection data for the browser. Templates and commands stay in the server-side planner. */
export function configuratorKit(kit: Kit): Kit {
  const contribution = <T extends Choice | Kit>(part: T): T => ({
    ...part,
    instructions: undefined,
    postInstall: [],
    files: undefined,
    writeFiles: part.writeFiles.map((file) => ({ ...file, content: "", anchor: undefined })),
  });
  return {
    ...contribution(kit),
    base: { command: "" }, finalize: [], addCommand: undefined, verify: undefined,
    workspace: kit.workspace && { ...kit.workspace, nativeBase: undefined, nativeVerify: undefined },
    service: kit.service && { dev: "", port: kit.service.port, dockerfile: kit.service.dockerfile ? "available" : undefined },
    options: kit.options.map((option) => ({ ...option, choices: option.choices.map(contribution) })),
    services: kit.services && Object.fromEntries(Object.entries(kit.services).map(([slot, variants]) => [slot,
      Object.fromEntries(Object.entries(variants).map(([variant, child]) => [variant, configuratorKit(child)])),
    ])),
  };
}

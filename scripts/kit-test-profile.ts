import { fileURLToPath, pathToFileURL } from "node:url";

import { loadKitFrom, selectedServices, testCombinations, type Kit } from "@kits/schema";
import { registrySource } from "@kits/schema/node";

/** Toolchains needed by the same combinations that `create-first-commit test` runs. */
export function kitTestProfile(kit: Kit) {
  const pm = kit.packageManagers.includes("pnpm") ? "pnpm" : kit.packageManagers[0]!;
  const pms = new Set(kit.packageManagers);
  for (const { sel } of testCombinations(kit)) {
    for (const service of selectedServices(kit, { ...sel, pm })) {
      for (const manager of service.kit.packageManagers) pms.add(manager);
    }
  }
  return { pm, pms: [...pms] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const name = process.argv[2];
  if (!name) throw new Error("A kit name is required");
  const source = registrySource(fileURLToPath(new URL("../registry", import.meta.url)));
  const profile = kitTestProfile(await loadKitFrom(await source.read(name), source));
  console.log(`pm=${profile.pm}\npms= ${profile.pms.join(" ")} `);
}

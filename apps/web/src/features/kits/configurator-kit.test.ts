import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { loadKitFrom, selectionsFrom, initArgs, resolve } from "@kits/schema";
import { registrySource } from "@kits/schema/node";
import { configuratorKit } from "./configurator-kit";

it("keeps service selections and summaries while removing installation templates from the browser", async () => {
  const source = registrySource(fileURLToPath(new URL("../../../../../registry", import.meta.url)));
  const kit = await loadKitFrom(await source.read("monorepo"), source);
  const client = configuratorKit(kit);
  const options = { api: ["django"], docs: ["starlight"], "web.nextjs.components": ["mantine"] };
  const fullSel = selectionsFrom(kit, { options }).selections;
  const clientSel = selectionsFrom(client, { options }).selections;
  expect(clientSel).toEqual(fullSel);
  expect(initArgs("monorepo", client, clientSel)).toEqual(initArgs("monorepo", kit, fullSel));
  const full = resolve(kit, fullSel), light = resolve(client, clientSel);
  expect(light.skills).toEqual(full.skills);
  expect(light.services?.map((s) => s.resolved.dependencies)).toEqual(full.services?.map((s) => s.resolved.dependencies));
  expect(JSON.stringify(client).length).toBeLessThan(JSON.stringify(kit).length * 0.7);
});

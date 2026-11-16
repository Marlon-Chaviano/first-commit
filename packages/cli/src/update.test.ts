import { describe, expect, it } from "vitest";
import { defaultSelections, parseKit, resolve } from "@kits/schema";

import { fileAction, kitForUpdate } from "./update";

describe("fileAction (update never overwrites the user's work)", () => {
  it("writes a new file the kit never wrote before", () => expect(fileAction(null, undefined, "new")).toBe("write"));
  it("respects a managed file the user deleted", () => expect(fileAction(null, "old", "new")).toBe("skip-deleted"));
  it("does nothing when the file already has the new content", () => expect(fileAction("new", "old", "new")).toBe("unchanged"));
  it("updates a file untouched since the kit wrote it", () => expect(fileAction("old", "old", "new")).toBe("write"));
  it("keeps a file the user edited", () => expect(fileAction("mine", "old", "new")).toBe("skip-modified"));
  it("keeps a pre-existing file the kit never managed", () => expect(fileAction("theirs", undefined, "new")).toBe("skip-modified"));
});

it("updates service libraries without adding the standalone kit's default hosting configuration", () => {
  const kit = parseKit({ name: "web", version: "1.0.0", author: "test", title: "Web", description: "Web", category: "web", base: { command: "true" }, options: [
    { id: "components", label: "Components", default: "ui", choices: [{ id: "ui", label: "UI", dependencies: ["my-ui"] }] },
    { id: "deploy", label: "Hosting", default: "vercel", choices: [{ id: "vercel", label: "Vercel", writeFiles: [{ path: "vercel.json", content: "{}" }] }] },
  ] });
  const service = kitForUpdate(kit, { workspaceService: true });
  const result = resolve(service, defaultSelections(service));
  expect(result.dependencies).toEqual(["my-ui"]);
  expect(result.writeFiles).toEqual([]);
  expect(kitForUpdate(kit, {})).toBe(kit);
});

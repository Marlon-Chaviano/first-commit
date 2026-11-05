import { describe, expect, it } from "vitest";

import { fileAction } from "./update";

describe("fileAction (update never overwrites the user's work)", () => {
  it("writes a new file the kit never wrote before", () => expect(fileAction(null, undefined, "new")).toBe("write"));
  it("respects a managed file the user deleted", () => expect(fileAction(null, "old", "new")).toBe("skip-deleted"));
  it("does nothing when the file already has the new content", () => expect(fileAction("new", "old", "new")).toBe("unchanged"));
  it("updates a file untouched since the kit wrote it", () => expect(fileAction("old", "old", "new")).toBe("write"));
  it("keeps a file the user edited", () => expect(fileAction("mine", "old", "new")).toBe("skip-modified"));
  it("keeps a pre-existing file the kit never managed", () => expect(fileAction("theirs", undefined, "new")).toBe("skip-modified"));
});

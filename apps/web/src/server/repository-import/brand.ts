import "server-only";

import { basename } from "node:path";
import { detectFromCss, detectFromJson, isEmptyDetection, isSafeSvg, mergeDetections, svgColors, type BrandDetection } from "@kits/schema";
import { fail } from "../errors";
import type { Snapshot } from "./github";

const profileFile = /^(?:brand|(?:design[.-])?tokens|brand[.-]tokens)\.json$/i;
const styleFile = /^(?:global[s]?|(?:app|index|main|style[s]?|theme|tokens|brand))(?:[.-][\w-]+)?\.(?:css|scss)$/i;
const imageFile = /^(?:[\w.-]+[-.])?(?:logo|wordmark|favicon|icon)(?:[-.][\w-]+)?\.(?:png|svg|ico|webp|jpe?g)$/i;

function imageType(bytes: Buffer) {
  if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return "png";
  if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return "jpeg";
  if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") return "webp";
  if (bytes.subarray(0, 4).equals(Buffer.from([0, 0, 1, 0]))) return "x-icon";
  const svg = bytes.toString("utf8");
  if (/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(svg) && isSafeSvg(svg)) return "svg+xml";
}

export async function importRepositoryBrand(snapshot: Snapshot, title: string) {
  const paths = snapshot.paths
    .filter((p) => !/(?:^|\/)(?:fixtures|examples|tests|__tests__)(?:\/|$)/.test(p))
    .sort((a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b));
  const candidates = [
    ...paths.filter((p) => basename(p) === "brand.json"),
    ...paths.filter((p) => basename(p) !== "brand.json" && profileFile.test(basename(p))),
    ...paths.filter((p) => styleFile.test(basename(p))),
    ...paths.filter((p) => imageFile.test(basename(p))),
  ];
  const chosen = candidates.filter((p) => snapshot.readable(p)).slice(0, 12);
  const detections: BrandDetection[] = [];
  let skipped = candidates.length - chosen.length;
  for (const path of chosen) {
    const bytes = await snapshot.read(path);
    let detection: BrandDetection;
    if (imageFile.test(basename(path))) {
      const type = imageType(bytes);
      if (!type) {
        skipped++;
        continue;
      }
      const kind = /(?:favicon|icon)/i.test(basename(path)) ? "icon" : "logo";
      const value = "data:image/" + type + ";base64," + bytes.toString("base64");
      detection = detectFromCss(
        type === "svg+xml"
          ? svgColors(bytes.toString())
              .map((color) => ".logo { color: " + color + " }")
              .join("\n")
          : "",
      );
      detection.profile.assets = { [kind]: value };
      detection.candidates![kind] = [{ value, source: path }];
      detection.found.push(kind);
    } else if (path.endsWith(".json")) {
      try {
        detection = detectFromJson(JSON.parse(bytes.toString()));
      } catch {
        skipped++;
        continue;
      }
    } else {
      detection = detectFromCss(bytes.toString());
    }
    if (isEmptyDetection(detection)) continue;
    const c = (detection.candidates ??= { primary: [], logo: [], icon: [], fonts: [] });
    if (detection.profile.colors.primary) c.primary.unshift({ value: detection.profile.colors.primary, source: path });
    for (const group of Object.values(c)) for (const choice of group) choice.source = path;
    detection.found = detection.found.map((s) => path + " · " + s);
    detections.push(detection);
  }
  if (!detections.length) fail("No brand found here. Choose another folder, upload a stylesheet or start from scratch.");
  const merged = mergeDetections({ profile: { colors: {} }, found: [] }, ...detections);
  merged.profile.title ??= title.slice(0, 80);
  return { detection: merged, partial: snapshot.partial || skipped > 0 };
}

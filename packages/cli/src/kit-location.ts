import { isAbsolute, resolve } from "node:path";

import { splitKitRef } from "@kits/schema";

/** What the registry says about a published community kit ("ana/landing"). */
export interface PublishedKit {
  version: string;
  repo: string;
  path: string;
  commitSha: string;
  integrity: string;
  /** Private kit: download it with ?archive=1 instead of from GitHub. */
  archive?: boolean;
}

/**
 * Where a kit's files come from, and how they're trusted:
 * - local / local-registry: read in place, never checked (it's the author's working copy).
 * - official: downloaded from the registry repo, checked against its integrity.json.
 * - published / private: the published commit (or the private archive), checked against the published hash.
 * - github: an unpublished GitHub path, not checked (nothing to compare with).
 */
export type KitLocation =
  // Two members, not one with kind "local" | "local-registry": TypeScript narrows separate literals.
  | { kind: "local"; dir: string }
  | { kind: "local-registry"; dir: string }
  | { kind: "official"; source: string }
  | { kind: "published"; source: string; published: PublishedKit }
  | { kind: "private"; slug: string; published: PublishedKit }
  | { kind: "github"; source: string };

export interface LocatedKit {
  name: string;
  version?: string;
  location: KitLocation;
}

export const isLocalPath = (ref: string): boolean => ref.startsWith(".") || isAbsolute(ref);

/** Whether locating `ref` needs to ask the registry about a published kit first (only "owner/kit"). */
export function needsPublishedLookup(ref: string): boolean {
  const { base } = splitKitRef(ref);
  return !isLocalPath(base) && base.split("/").length === 2;
}

/**
 * Pure: decides where a kit reference points. `published` is the registry's
 * answer for "owner/kit" refs (null when it's not a published kit).
 *   mobile-expo[@1.2.0]           official kit ("<kit>@<version>" git tag)
 *   owner/repo[/path][@v1.0.0]    community kit on GitHub (version = git ref)
 *   ./path/to/kit                 local kit, relative to `from`
 */
export function locateKit(ref: string, { registry, from, published = null }: { registry: string; from: string; published?: PublishedKit | null }): LocatedKit {
  const { base: name, version } = splitKitRef(ref);
  if (isLocalPath(name)) return { name, location: { kind: "local", dir: resolve(from, name) } };
  const official = !name.includes("/");
  if (official) {
    if (isLocalPath(registry)) return { name, version, location: { kind: "local-registry", dir: resolve(registry, "kits", name) } };
    return { name, version, location: { kind: "official", source: `${registry}/kits/${name}${version ? `#${name}@${version}` : ""}` } };
  }
  if (published?.archive) return { name, version, location: { kind: "private", slug: name, published } };
  if (published) {
    return { name, version, location: { kind: "published", source: `gh:${published.repo}${published.path ? `/${published.path}` : ""}#${published.commitSha}`, published } };
  }
  return { name, version, location: { kind: "github", source: `gh:${name}${version ? `#${version}` : ""}` } };
}

/** The version a kit.json must have: a local registry only has its current version, so a mismatched tag is caught here. */
export function versionMismatch(name: string, requested: string | undefined, actual: string): string | null {
  return requested && requested.replace(/^v/, "") !== actual ? `${name}@${requested} was requested but the available kit is version ${actual}` : null;
}

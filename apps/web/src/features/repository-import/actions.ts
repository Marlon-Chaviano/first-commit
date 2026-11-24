"use server";

import { action } from "@/server/action";
import { githubToken } from "@/server/accounts";
import { fail } from "@/server/errors";
import { getCatalog } from "@/server/registry";
import { importRepositoryBrand } from "@/server/repository-import/brand";
import { repositoryReader, type Source } from "@/server/repository-import/github";
import { detectRepositoryKit, prepareRepositoryKit, type KitChoices } from "@/server/repository-import/kit";

async function reader(userId: string) {
  const token = await githubToken(userId);
  if (!token) fail("Link GitHub in account settings to choose a repository.");
  return repositoryReader(token);
}

export async function listRepositories(page: number) {
  return action({}, async (viewer) => (await reader(viewer.id)).repositories(page));
}

export async function listBranches(repo: string) {
  return action({}, async (viewer) => (await reader(viewer.id)).branches(repo));
}

export async function locateProjects(repo: string, branch: string) {
  return action({}, async (viewer) => (await reader(viewer.id)).locate(repo, branch));
}

export async function readBrand(source: Source) {
  return action({}, async (viewer) =>
    importRepositoryBrand(await (await reader(viewer.id)).snapshot(source), source.folder.split("/").pop() || source.repo.split("/")[1]!),
  );
}

export async function readKit(source: Source) {
  return action(
    {},
    async (viewer) => (await detectRepositoryKit(await (await reader(viewer.id)).snapshot(source), source, await getCatalog())).review,
  );
}

export async function prepareKit(source: Source, choices: KitChoices) {
  return action({}, async (viewer) =>
    prepareRepositoryKit(await (await reader(viewer.id)).snapshot(source), source, await getCatalog(), choices),
  );
}

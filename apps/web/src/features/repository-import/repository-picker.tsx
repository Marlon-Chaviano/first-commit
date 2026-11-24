"use client";

import { ArrowLeftIcon, ArrowRightIcon, ChevronRightIcon, FolderGit2Icon, GitBranchIcon, LoaderCircleIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { TechIcon } from "@/components/shared/tech-icon";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LinkGithub } from "@/features/account/link-github";
import type { ImportAccess } from "@/server/repository-import/access";
import type { Repository, Source } from "@/server/repository-import/github";
import { listBranches, listRepositories, locateProjects } from "./actions";

type Props = { access: ImportAccess; kind: "kit" | "brand"; onRead: (source: Source) => Promise<string | void> };

export function RepositoryPicker(props: Props) {
  const back = props.kind === "kit" ? "/kits/new" : "/brands/new?source=github";
  if (props.access === "link" || props.access === "unconfigured")
    return <LinkGithub back={back} enabled={props.access === "link"} importing />;
  if (props.access === "guest")
    return (
      <section className="flex flex-col items-start gap-4 rounded-xl border p-5 sm:p-6">
        <TechIcon id="github" label="" className="size-6" />
        <div className="space-y-1">
          <h2 className="font-medium">Choose a GitHub repository</h2>
          <p className="text-sm text-muted-foreground">Log in to browse your public repositories and choose the project to import.</p>
        </div>
        <Button nativeButton={false} render={<Link href={`/login?next=${encodeURIComponent(back)}`} />}>
          Log in to choose a repository
        </Button>
      </section>
    );
  return <ConnectedPicker {...props} />;
}

function ConnectedPicker({ kind, onRead }: Props) {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [query, setQuery] = useState("");
  const [repo, setRepo] = useState<Repository>();
  const [branches, setBranches] = useState<string[]>([]);
  const [branch, setBranch] = useState("");
  const [location, setLocation] = useState<{ commit: string; folders: string[]; partial: boolean }>();
  const [customFolder, setCustomFolder] = useState(false);
  const [folder, setFolder] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    let active = true;
    listRepositories(1)
      .then((result) => {
        if (!active) return;
        if (!result.ok) return setError(result.error);
        setRepos(result.data.repos);
        setMore(result.data.more);
        setPage(1);
      })
      .catch(() => {
        if (active) setError("Couldn't load repositories. Try again.");
      });
    return () => {
      active = false;
    };
  }, []);

  const run = (task: () => Promise<void>) => {
    setError("");
    start(async () => {
      try {
        await task();
      } catch {
        setError("Connection interrupted. Try again.");
      }
    });
  };
  const nextPage = () =>
    run(async () => {
      const r = await listRepositories(page + 1);
      if (!r.ok) return setError(r.error);
      setRepos((current) => [...current, ...r.data.repos.filter((row) => !current.some((old) => old.name === row.name))]);
      setPage(page + 1);
      setMore(r.data.more);
    });
  const choose = (r: Repository) =>
    run(async () => {
      const result = await listBranches(r.name);
      if (!result.ok) return setError(result.error);
      setRepo(r);
      setBranches(result.data);
      setBranch(r.branch);
      setLocation(undefined);
      setFolder("");
    });
  const locate = () =>
    run(async () => {
      const result = await locateProjects(repo!.name, branch.trim());
      if (!result.ok) return setError(result.error);
      setLocation(result.data);
      setFolder("");
      setCustomFolder(false);
    });
  const shown = repos.filter((r) => r.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <section
      aria-label="GitHub repository"
      aria-busy={pending || (!page && !error)}
      className="flex min-w-0 flex-col gap-5 rounded-xl border p-5 sm:p-6"
    >
      <div className="flex items-center gap-3">
        <TechIcon id="github" label="" className="size-5 shrink-0" />
        <h2 className="min-w-0 break-all font-medium">{repo ? repo.name : "Choose a repository"}</h2>
      </div>
      {!repo ? (
        <>
          <InputGroup className="h-10">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Filter repositories"
              placeholder="Filter public repositories…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InputGroup>
          <div className="max-h-80 overflow-auto">
            <ul className="divide-y">
              {shown.map((r) => (
                <li key={r.name}>
                  <Button
                    disabled={pending}
                    variant="ghost"
                    onClick={() => choose(r)}
                    className="h-auto min-h-11 w-full justify-start whitespace-normal py-2 text-left"
                  >
                    <FolderGit2Icon />
                    <span className="min-w-0 flex-1 break-all font-mono">{r.name}</span>
                    <ChevronRightIcon />
                  </Button>
                </li>
              ))}
            </ul>
            {!shown.length && !!page && (
              <p className="p-2 text-sm text-muted-foreground">
                {repos.length ? "No matches in the loaded repositories." : "Your linked account has no public repositories."}
              </p>
            )}
          </div>
          {(more || (!page && error)) && (
            <Button variant="outline" disabled={pending} onClick={nextPage}>
              {page ? "Load more repositories" : "Retry"}
            </Button>
          )}
        </>
      ) : (
        <>
          <button
            className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            disabled={pending}
            onClick={() => {
              setRepo(undefined);
              setLocation(undefined);
              setError("");
            }}
          >
            <ArrowLeftIcon className="size-3.5" />
            Change repository
          </button>
          <form
            className="flex flex-col gap-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!location) return locate();
              run(async () => {
                const message = await onRead({ repo: repo.name, commit: location.commit, folder: folder.trim() });
                if (message) setError(message);
              });
            }}
          >
            <Field>
              <FieldLabel htmlFor="repository-branch">
                <GitBranchIcon className="size-4" />
                Branch
              </FieldLabel>
              <Input
                id="repository-branch"
                required
                list="import-branches"
                className="font-mono"
                value={branch}
                disabled={pending}
                onChange={(e) => {
                  setBranch(e.target.value);
                  setLocation(undefined);
                  setError("");
                }}
              />
              <datalist id="import-branches">
                {branches.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </Field>
            {location && (
              <Field>
                <FieldLabel htmlFor="project-folder">Project folder</FieldLabel>
                <Select
                  value={customFolder ? ":custom" : folder || ":root"}
                  disabled={pending}
                  onValueChange={(value) => {
                    if (!value) return;
                    setCustomFolder(value === ":custom");
                    setFolder(value === ":root" || value === ":custom" ? "" : value);
                  }}
                >
                  <SelectTrigger id="project-folder" className="h-10 w-full font-mono">
                    <SelectValue>{customFolder ? "Another folder…" : folder || "Repository root"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=":root">Repository root</SelectItem>
                    {location.folders.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                    <SelectItem value=":custom">Another folder…</SelectItem>
                  </SelectContent>
                </Select>
                {customFolder && (
                  <Input
                    aria-label="Folder path"
                    className="font-mono"
                    placeholder="apps/web"
                    required
                    value={folder}
                    disabled={pending}
                    onChange={(e) => setFolder(e.target.value)}
                  />
                )}
                {location.partial && (
                  <p className="text-xs text-muted-foreground">Only some folders are listed. Use “Another folder” to enter a path.</p>
                )}
              </Field>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={pending || !branch.trim()}>
                {location ? "Detect " + kind : "Choose project folder"}
                <ArrowRightIcon />
              </Button>
              {location && <span className="font-mono text-xs text-muted-foreground">commit {location.commit.slice(0, 7)}</span>}
            </div>
          </form>
        </>
      )}
      {(pending || (!page && !error)) && (
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircleIcon className="size-4 animate-spin" />
          Reading GitHub…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
    </section>
  );
}

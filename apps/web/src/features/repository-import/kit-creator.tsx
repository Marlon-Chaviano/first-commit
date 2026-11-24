"use client";

import { ArrowLeftIcon, DownloadIcon, FileJsonIcon } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ImportAccess } from "@/server/repository-import/access";
import type { Source } from "@/server/repository-import/github";
import type { KitChoices, detectRepositoryKit, prepareRepositoryKit } from "@/server/repository-import/kit";
import { prepareKit, readKit } from "./actions";
import { RepositoryPicker } from "./repository-picker";

type Review = Awaited<ReturnType<typeof detectRepositoryKit>>["review"];
type Download = Awaited<ReturnType<typeof prepareRepositoryKit>>;
const groups = {
  libraries: "Catalog libraries",
  dependencies: "Dependencies",
  devDependencies: "Development dependencies",
  skills: "Agent skills",
  servers: "MCP servers",
  files: "Project files",
} as const;
const groupKeys = Object.keys(groups) as (keyof typeof groups)[];

export function KitCreator({ access }: { access: ImportAccess }) {
  const [project, setProject] = useState<{ source: Source; review: Review }>();
  if (project) return <KitReview {...project} onBack={() => setProject(undefined)} />;
  return (
    <RepositoryPicker
      kind="kit"
      access={access}
      onRead={async (source) => {
        const r = await readKit(source);
        if (!r.ok) return r.error;
        setProject({ source, review: r.data });
      }}
    />
  );
}

function KitReview({ source, review, onBack }: { source: Source; review: Review; onBack: () => void }) {
  const [choices, setChoices] = useState<KitChoices>({ ...review, files: [], instructions: false });
  const [download, setDownload] = useState<Download>();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <section className="flex min-w-0 flex-col gap-5">
      <Button
        className="self-start"
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => (download ? setDownload(undefined) : onBack())}
      >
        <ArrowLeftIcon />
        {download ? "Edit selections" : "Change project"}
      </Button>
      <div className="space-y-2">
        <p className="break-all font-mono text-xs text-muted-foreground">
          {source.repo}
          {source.folder && "/" + source.folder} · {source.commit.slice(0, 7)}
        </p>
        <h2 className="text-xl font-semibold">{download ? "Your kit is ready" : "Review your kit"}</h2>
        <p className="text-sm text-muted-foreground">
          {review.framework} · {review.pm}
        </p>
      </div>
      {download ? (
        <>
          <Button
            className="self-start"
            nativeButton={false}
            render={<a href={"data:application/zip;base64," + download.zip} download={choices.name + "-kit.zip"} />}
          >
            <DownloadIcon />
            Download kit
          </Button>
          <div className="flex flex-col gap-4 rounded-xl border p-5">
            <h3 className="label-mono">Installation plan</h3>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              {download.plan.map((step, i) => (
                <li key={i} className="break-words font-mono">
                  {step}
                </li>
              ))}
            </ol>
            <details className="border-t pt-3">
              <summary className="cursor-pointer text-sm">View kit.json</summary>
              <pre className="mt-3 max-h-80 overflow-auto bg-muted p-3 text-xs">{download.content}</pre>
            </details>
          </div>
          <p className="text-sm text-muted-foreground">
            To share it, add the extracted <code>kit/</code> folder to your repository, commit it, then{" "}
            <Link href="/publish" className="text-foreground underline underline-offset-4">
              publish your kit
            </Link>
            .
          </p>
        </>
      ) : (
        <form
          className="flex flex-col gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            start(async () => {
              try {
                const r = await prepareKit(source, choices);
                if (r.ok) setDownload(r.data);
                else setError(r.error);
              } catch {
                setError("Couldn't prepare the download. Try again.");
              }
            });
          }}
        >
          <fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="kit-title">Kit title</FieldLabel>
              <Input
                id="kit-title"
                required
                maxLength={100}
                value={choices.title}
                onChange={(e) => setChoices({ ...choices, title: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="kit-name">Identifier</FieldLabel>
              <Input
                id="kit-name"
                className="font-mono"
                required
                pattern="[a-z0-9\-]+"
                maxLength={80}
                value={choices.name}
                onChange={(e) => setChoices({ ...choices, name: e.target.value })}
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="kit-description">Description</FieldLabel>
              <Textarea
                id="kit-description"
                required
                maxLength={300}
                value={choices.description}
                onChange={(e) => setChoices({ ...choices, description: e.target.value })}
              />
            </Field>
          </fieldset>
          <div className="divide-y rounded-xl border px-4">
            {groupKeys
              .filter((k) => review[k].length > 0)
              .map((key) => (
                <details key={key} className="py-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    {groups[key]}{" "}
                    <span className="ml-2 font-mono text-xs text-muted-foreground">
                      {choices[key].length}/{review[key].length}
                    </span>
                  </summary>
                  {key === "files" && (
                    <p className="mt-2 text-xs text-muted-foreground">Choose up to ten files to copy into new projects.</p>
                  )}
                  <div className="mt-2 grid max-h-64 gap-1 overflow-auto">
                    {review[key].map((item) => (
                      <label key={item} className="flex min-h-9 items-center gap-3 break-all text-sm">
                        <Checkbox
                          disabled={pending || (key === "files" && choices.files.length >= 10 && !choices.files.includes(item))}
                          checked={choices[key].includes(item)}
                          onCheckedChange={(checked) =>
                            setChoices((c) => ({ ...c, [key]: checked ? [...c[key], item] : c[key].filter((v) => v !== item) }))
                          }
                        />
                        <span className="font-mono">{key === "libraries" ? review.libraryNames[item] : item}</span>
                      </label>
                    ))}
                  </div>
                </details>
              ))}
            {review.instructions && (
              <label className="flex items-center gap-3 py-3 text-sm">
                <Checkbox
                  checked={choices.instructions}
                  disabled={pending}
                  onCheckedChange={(v) => setChoices({ ...choices, instructions: v })}
                />
                Include AGENTS.md instructions
              </label>
            )}
          </div>
          {(review.partial || review.omitted.length > 0) && (
            <p className="text-sm text-muted-foreground">
              {review.partial && "Only part of this folder is shown. Choose a smaller folder for a narrower scan. "}
              {review.omitted.length > 0 && "Left out local dependencies or custom MCP definitions: " + review.omitted.join(", ")}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm">
              {error}
            </p>
          )}
          <Button className="self-start" type="submit" disabled={pending}>
            <FileJsonIcon />
            {pending ? "Preparing kit…" : "Preview kit"}
          </Button>
        </form>
      )}
    </section>
  );
}

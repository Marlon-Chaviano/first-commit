import { buildPlan, type Kit, type Selections, type Step } from "@kits/schema";

/**
 * The same steps `--dry-run` prints, computed with the shared planner: what
 * will run on the user's machine, before they copy the command.
 */
export function PlanPreview({ kit, sel, name }: { kit: Kit; sel: Selections; name: string }) {
  const steps = buildPlan({ kit, kitDir: "kit", sel, parentDir: ".", name, git: true });
  const project = `./${name}/`;
  const rel = (path: string) => (path.startsWith(project) ? path.slice(project.length) : path);

  return (
    <ol className="flex flex-col divide-y">
      {steps.map((step, i) => (
        <li key={i} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2 py-2.5 text-sm">
          <span className="font-mono text-xs text-muted-foreground tabular-nums">{i + 1}</span>
          <div className="flex min-w-0 flex-col gap-1">
            <span>{step.title}</span>
            <StepDetail step={step} rel={rel} />
          </div>
        </li>
      ))}
    </ol>
  );
}

function StepDetail({ step, rel }: { step: Step; rel: (p: string) => string }) {
  switch (step.kind) {
    case "run":
      return (
        <code className="font-mono text-xs [overflow-wrap:anywhere] text-muted-foreground">
          <span className="select-none">$ </span>
          {step.command}
        </code>
      );
    case "write":
      return <code className="font-mono text-xs text-muted-foreground">{rel(step.path)}</code>;
    case "copy":
    case "git":
      return null;
  }
}

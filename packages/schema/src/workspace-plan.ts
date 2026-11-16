import { applyWrite, buildPlan, fillTemplate, shellQuote, templateVars, type PlanInput, type Step, posixPaths } from "./plan";
import { preservesWorkspaceBase, selectedServices } from "./workspace";

/** Compose the same child plans used by standalone kits, without nested git repositories. */
export function workspacePlan(input: PlanInput): Step[] {
  const { kit, sel, parentDir, name } = input;
  const paths = input.paths ?? posixPaths;
  const root = paths.join(parentDir, name);
  const services = selectedServices(kit, sel);
  const api = services.find((s) => s.id === "api");
  const web = services.find((s) => s.id === "web");
  const apiVariable = web?.kit.service?.client?.env;
  const steps: Step[] = [{ kind: "run", title: "Create workspace", cwd: parentDir, command: `mkdir -p ${shellQuote(name)}` }];
  const preserveBase = preservesWorkspaceBase(kit, sel);
  if (preserveBase) {
    steps.length = 0;
    const base = { ...kit, base: kit.workspace?.nativeBase ?? kit.base, workspace: undefined, services: undefined, options: kit.options.filter((o) => !o.id.includes(".") && !kit.workspace!.services[o.id]) };
    const baseSel = { ...sel, agents: [], options: Object.fromEntries(Object.entries(sel.options).filter(([id]) => base.options.some((o) => o.id === id))), badge: false };
    steps.push(...buildPlan({ ...input, kit: base, sel: baseSel, git: false, brand: undefined }).filter((step) => !(step.kind === "run" && step.title.startsWith("Install skills"))));
  }
  const write = (path: string, content: string): void => { steps.push({ kind: "write", title: "Configure workspace", path: paths.join(root, path), merge: (old) => old ?? content }); };
  const commands: Record<string, { cwd: string; dev: string; build: string; verify: string; env?: Record<string, string> }> = {};
  for (const service of services) {
    const parent = service.path.split("/").slice(0, -1).join("/");
    steps.push({ kind: "run", title: `Prepare ${service.id}`, cwd: root, command: `mkdir -p ${shellQuote(parent || ".")}` });
    const existing = preserveBase && kit.workspace?.services[service.id]?.existing;
    const childKit = existing ? { ...service.kit, files: undefined, writeFiles: [], postInstall: [], dependencies: [], devDependencies: [], base: { command: "true" } } : service.kit;
    const childSteps = buildPlan({ ...input, kit: childKit, sel: { ...service.sel, agents: [], badge: false }, parentDir: paths.join(root, parent), name: paths.basename(service.path), git: false, brand: service.id === "web" ? input.brand : undefined });
    for (const step of childSteps) {
      if (step.kind === "run" && step.title.startsWith("Install skills")) continue;
      steps.push({ ...step, title: `${service.id}: ${step.title}`, ...("optional" in step ? { optional: false } : {}) });
    }
    const vars = templateVars(service.sel, paths.basename(service.path));
    const profile = service.kit.service;
    const verify = existing ? "true" : fillTemplate(profile?.verify ?? service.kit.verify?.command ?? "{{pm}} run build", vars);
    commands[service.id] = { cwd: service.path, env: { PORT: String(profile?.port ?? 3000), SERVER_PORT: String(profile?.port ?? 3000) }, dev: fillTemplate(profile?.dev ?? "{{pm}} run dev", vars), build: fillTemplate(profile?.build ?? service.kit.verify?.command ?? "{{pm}} run build", vars), verify };
    write(`${service.path}/.env.example`, `PORT=${profile?.port ?? 3000}\n`);
    // Root build context includes shared packages, while each app retains its own dependency manifest.
    if (profile?.dockerfile && (sel.options["deployment"]?.[0] === "compose" || ["docker", "railway", "render"].includes(sel.options[`${service.id}.${service.variant}.deploy`]?.[0] ?? "none"))) {
      let dockerfile = fillTemplate(profile.dockerfile, { ...vars, servicePath: service.path });
      if (service.id === "web" && api && apiVariable) dockerfile = dockerfile.replace(/(^FROM[^\n]*\n)/m, `$1ARG ${apiVariable}\nENV ${apiVariable}=\$${apiVariable}\n`);
      write(`${service.path}/Dockerfile`, dockerfile);
    }
    const deploy = sel.options[`${service.id}.${service.variant}.deploy`]?.[0];
    if (deploy === "railway") write(`${service.path}/railway.json`, JSON.stringify({ $schema: "https://railway.com/railway.schema.json", build: { builder: "DOCKERFILE", dockerfilePath: `${service.path}/Dockerfile` }, deploy: { healthcheckPath: profile?.health } }, null, 2));
    if (deploy === "vercel") write(`${service.path}/vercel.json`, JSON.stringify({ $schema: "https://openapi.vercel.sh/vercel.json" }, null, 2));
  }
  const orchestrator = sel.options.orchestrator?.[0] ?? kit.workspace?.orchestrator;
  if (!preserveBase && orchestrator !== "simple") {
    const tool = orchestrator === "nx" ? "nx" : "turbo";
    write("package.json", JSON.stringify({ name, private: true, engines: { node: ">=22" }, packageManager: `${sel.pm}@${sel.pm === "pnpm" ? "10.27.0" : sel.pm === "npm" ? "10.9.2" : "1.3.0"}`, scripts: { dev: tool === "nx" ? "nx run-many -t dev --parallel" : "turbo run workspace:dev", build: tool === "nx" ? "nx run-many -t build" : "turbo run workspace:build", test: "node scripts/workspace.mjs verify" }, devDependencies: { [tool]: "latest" }, workspaces: services.map((s) => s.path) }, null, 2));
    write("pnpm-workspace.yaml", "packages:\n" + services.map((s) => `  - '${s.path}'`).join("\n") + "\n");
    if (tool === "turbo") write("turbo.json", JSON.stringify({ $schema: "https://turbo.build/schema.json", tasks: { "workspace:build": { dependsOn: ["^workspace:build"], outputs: ["dist/**", ".next/**", "!.next/cache/**"] }, "workspace:dev": { cache: false, persistent: true } } }, null, 2));
    else write("nx.json", JSON.stringify({ targetDefaults: { build: { cache: true } } }, null, 2));
    for (const service of services) {
      if (tool === "nx") write(`${service.path}/project.json`, JSON.stringify({ name: service.id, targets: Object.fromEntries(["dev", "build"].map((task) => [task, { executor: "nx:run-commands", options: { command: `node scripts/workspace.mjs ${task} ${service.id}`, cwd: "." } }])) }, null, 2));
      steps.push({ kind: "write", title: `Register ${service.id} workspace`, path: paths.join(root, service.path, "package.json"), merge: (old) => {
        const pkg = JSON.parse(old ?? "{}");
        return JSON.stringify({ ...pkg, name: service.id, private: true, scripts: { ...pkg.scripts, "workspace:dev": `node ${"../".repeat(service.path.split("/").length)}scripts/workspace.mjs dev ${service.id}`, "workspace:build": `node ${"../".repeat(service.path.split("/").length)}scripts/workspace.mjs build ${service.id}` } }, null, 2);
      } });
    }
    steps.push({ kind: "run", title: "Install workspace orchestrator", command: `${sel.pm} install`, cwd: root });
  }
  if (preserveBase && kit.workspace?.nativeVerify) {
    const verify = fillTemplate(kit.workspace.nativeVerify, templateVars(sel, name));
    commands.workspace = { cwd: ".", dev: verify, build: verify, verify };
  }
  write("workspace.json", JSON.stringify(commands, null, 2) + "\n");
  write("scripts/workspace.mjs", RUNNER);
  write("package.json", JSON.stringify({ name, private: true, engines: { node: ">=22" }, scripts: { dev: "node scripts/workspace.mjs dev", build: "node scripts/workspace.mjs build", test: "node scripts/workspace.mjs verify" } }, null, 2));
  write(".gitignore", "node_modules\n.venv\n.env\n.env.local\n.next\ndist\n__pycache__\n");
  write(".dockerignore", "**/node_modules\n**/.venv\n**/.env\n**/.env.*\n!**/.env.example\n**/.next\n**/dist\n.git\n");
  const dockerServices = services.filter((s) => s.kit.service?.dockerfile && s.id !== "mobile");
  if (sel.options["deployment"]?.[0] === "compose") {
    const entries = Object.fromEntries(dockerServices.map((s) => [s.id, {
      build: { context: ".", dockerfile: `${s.path}/Dockerfile`, ...(s.id === "web" && api && apiVariable ? { args: { [apiVariable]: `\${${apiVariable}:-http://localhost:${api.kit.service?.port ?? 8000}}` } } : {}) },
      ...(s.id === "api" && web ? { environment: { WEB_ORIGINS: `\${WEB_ORIGINS:-http://localhost:${web.kit.service?.port ?? 3000}}` } } : {}),
      ports: [`${s.kit.service?.port ?? 3000}:${s.kit.service?.port ?? 3000}`],
    }]));
    write("compose.yaml", JSON.stringify({ services: entries }, null, 2));
  }
  const render = services.filter((s) => sel.options[`${s.id}.${s.variant}.deploy`]?.[0] === "render");
  if (render.length) write("render.yaml", JSON.stringify({ services: render.map((s) => ({ type: "web", name: `${name}-${s.id}`, runtime: "docker", dockerfilePath: `./${s.path}/Dockerfile`, dockerContext: ".", healthCheckPath: s.kit.service?.health })) }, null, 2));
  if (api) {
    for (const file of api.kit.service?.connect ?? []) {
      steps.push({ kind: "write", title: "Connect API to web", path: paths.join(root, api.path, file.path), merge: applyWrite({ ...file, content: fillTemplate(file.content, { ...templateVars(api.sel, paths.basename(api.path)), webOrigin: `http://localhost:${web?.kit.service?.port ?? 3000}` }) }) });
    }
    steps.push({ kind: "write", title: "Configure allowed web origins", path: paths.join(root, api.path, ".env.example"), merge: (old) => `${old ?? ""}\nWEB_ORIGINS=http://localhost:${web?.kit.service?.port ?? 3000}\n` });
  }
  if (api && web) {
    const url = `http://localhost:${api.kit.service?.port ?? 8000}`;
    if (apiVariable) steps.push({ kind: "write", title: "Connect web to API", path: paths.join(root, web.path, ".env.example"), merge: (old) => `${old ?? ""}\n${apiVariable}=${url}\n` });
    write("scripts/check-connection.mjs", `const response = await fetch(process.env.API_URL ?? ${JSON.stringify(url + (api.kit.service?.health ?? "/health"))}, { headers: { Origin: ${JSON.stringify(`http://localhost:${web.kit.service?.port ?? 3000}`)} } });\nif (!response.ok || response.headers.get('access-control-allow-origin') !== ${JSON.stringify(`http://localhost:${web.kit.service?.port ?? 3000}`)}) throw new Error('API health or CORS check failed');\nconsole.log('API and web origin are connected');\n`);
    for (const file of web.kit.service?.client?.files ?? []) steps.push({ kind: "write", title: "Configure API client", path: paths.join(root, web.path, file.path), merge: applyWrite({ ...file, content: fillTemplate(file.content, { apiUrl: url, healthPath: api.kit.service?.health ?? "/health" }) }) });
  }
  const hostingInstructions = (id: string, variant: string, path: string): string => {
    const destination = sel.options[`${id}.${variant}.deploy`]?.[0];
    if (destination === "vercel") return `Import this repository as a Vercel project and set Root Directory to ${path}.`;
    if (destination === "railway") return `Create a Railway service with the repository root as its source. Set its config file path to /${path}/railway.json.`;
    if (destination === "render") return "Create a Render Blueprint from render.yaml at the repository root.";
    if (destination === "docker" || sel.options.deployment?.[0] === "compose") return `Build from the repository root: docker build -f ${path}/Dockerfile .`;
    return "Configure the hosting provider when ready.";
  };
  write("DEPLOYMENT.md", `# Deployment\n\n${services.map((s) => `## ${s.id}\n\nRoot: \`${s.path}\`. Build: \`${commands[s.id]!.build}\`.\n\n${s.kit.service?.start ? `Start: \`${fillTemplate(s.kit.service.start, templateVars(s.sel, paths.basename(s.path)))}\`.` : "Use the framework's hosting integration."}\n\n${hostingInstructions(s.id, s.variant, s.path)}\n`).join("\n")}\n${sel.options.deployment?.[0] === "compose" ? "Start all containers with docker compose up --build. Set public API URLs and WEB_ORIGINS in a root .env before building.\n\n" : ""}${api && web ? `Set ${apiVariable ?? "src/environments/environment.ts: apiUrl"} to the public API URL and WEB_ORIGINS to the public web origin. For Docker, pass the public URL as a build argument (also declared in the Dockerfile); a browser bundle needs it during the build.\n\n` : ""}Connect each service separately. For Docker use the repository root as build context. Localhost URLs are for local development only. Copy each .env.example and fill the required values. Never commit secrets.\n`);
  const setupNode = { uses: "actions/setup-node@v4", with: { "node-version": "22" } };
  const setupManager = (pm: string): object[] => pm === "pnpm"
    ? [{ uses: "pnpm/action-setup@v4", with: { version: "10" } }]
    : pm === "bun" ? [{ uses: "oven-sh/setup-bun@v2" }] : [];
  const jobs: Record<string, object> = {};
  for (const service of services) {
    if (preserveBase && kit.workspace?.services[service.id]?.existing) continue;
    const profile = service.kit.service;
    jobs[service.id] = { "runs-on": "ubuntu-latest", steps: [
      { uses: "actions/checkout@v4" }, setupNode, ...(profile?.ci ?? []), ...setupManager(service.sel.pm),
      { run: ["npm", "pnpm", "bun"].includes(service.sel.pm) ? `${service.sel.pm} install` : profile?.install, "working-directory": service.path },
      { run: commands[service.id]!.verify, "working-directory": service.path },
    ] };
  }
  if (preserveBase && kit.workspace?.nativeVerify) {
    jobs.workspace = { "runs-on": "ubuntu-latest", steps: [
      { uses: "actions/checkout@v4" }, setupNode, ...setupManager(sel.pm),
      ...(sel.pm === "go" ? [{ uses: "actions/setup-go@v5", with: { "go-version": "1.24" } }] : []),
      { run: sel.pm === "go" ? "go work sync" : `${sel.pm} install` },
      { run: commands.workspace!.verify },
    ] };
  }
  write(".github/workflows/workspace.yml", JSON.stringify({ name: "Workspace", on: ["push", "pull_request"], permissions: { contents: "read" }, jobs }, null, 2));
  return steps;
}
const RUNNER = `import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve as resolvePath } from 'node:path';
import { parseEnv } from 'node:util';
const root = fileURLToPath(new URL('../', import.meta.url));
const services = JSON.parse(await readFile(new URL('../workspace.json', import.meta.url), 'utf8'));
const task = process.argv[2] ?? 'dev';
if (!['dev', 'build', 'verify'].includes(task)) throw new Error('Unknown task');
const selected = process.argv[3] ? [[process.argv[3], services[process.argv[3]]]] : Object.entries(services);
const children = new Set();
const stop = () => { for (const child of children) { try { if (process.platform === 'win32') child.kill('SIGTERM'); else process.kill(-child.pid, 'SIGTERM'); } catch {} } };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
const run = async ([id, service]) => {
  if (!service) throw new Error('Unknown service: ' + id);
  let fileEnv = {};
  for (const file of ['.env', '.env.local']) {
    try { fileEnv = { ...fileEnv, ...parseEnv(await readFile(resolvePath(root, service.cwd, file), 'utf8')) }; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return new Promise((resolve, reject) => {
  if (!service) return reject(new Error('Unknown service: ' + id));
  const child = spawn(service[task], { cwd: resolvePath(root, service.cwd), shell: true, detached: process.platform !== 'win32', stdio: 'inherit', env: { ...service.env, ...fileEnv, ...process.env } });
  children.add(child);
  child.on('error', reject);
  child.on('exit', (code) => { children.delete(child); code === 0 ? resolve() : reject(new Error(id + ' failed: ' + code)); });
});
};
try { if (task === 'dev') await Promise.all(selected.filter(([id]) => id !== "workspace").map(run)); else for (const service of selected) await run(service); }
catch (error) { stop(); console.error(error.message); process.exitCode = 1; }
`;

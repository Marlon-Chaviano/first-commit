/**
 * First-visit guide progress, in this browser only: which of the three steps are done and whether
 * the guide was dismissed. Storage may be blocked (private mode): then the guide just doesn't
 * remember, and nothing breaks.
 */
export type Step = "pick" | "configure" | "copy";
export const STEPS: Step[] = ["pick", "configure", "copy"];

const KEY = "first-commit:onboarding";
const EVENT = "first-commit:onboarding";

interface Progress {
  done: Step[];
  dismissed: boolean;
}

function read(): Progress {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Progress> | null;
    return { done: (raw?.done ?? []).filter((s): s is Step => STEPS.includes(s as Step)), dismissed: Boolean(raw?.dismissed) };
  } catch {
    return { done: [], dismissed: false };
  }
}

function write(progress: Progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Storage blocked: the guide still works for this page view.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Marks a step as done (no-op once dismissed or already done). Safe to call from any component. */
export function markStep(step: Step) {
  if (typeof window === "undefined") return;
  const progress = read();
  if (progress.dismissed || progress.done.includes(step)) return;
  write({ ...progress, done: [...progress.done, step] });
}

export function dismissGuide() {
  write({ ...read(), dismissed: true });
}

/** For useSyncExternalStore: the snapshot is a string so React can compare it. */
export const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};
export const snapshot = () => JSON.stringify(read());
/** On the server (and before hydration) the guide is hidden: it never shifts the page. */
export const serverSnapshot = () => JSON.stringify({ done: [], dismissed: true } satisfies Progress);

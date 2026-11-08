/**
 * The signed-in person for the header's account menu, without loading Better Auth's client in
 * every page (it brings zod, ~140 KB). One request to /api/v1/me per page load, shared by every
 * component that asks; the role is the effective one (ADMIN_HANDLES applied on the server).
 */
export interface Viewer {
  name: string;
  handle: string | null;
  role: string | null;
  image: string | null;
}

type State = { status: "loading" } | { status: "ready"; viewer: Viewer | null };

const LOADING: State = { status: "loading" };
let state: State = LOADING;
let requested = false;
const listeners = new Set<() => void>();

function load() {
  if (requested) return;
  requested = true;
  fetch("/api/v1/me", { credentials: "same-origin" })
    .then((res) => (res.ok ? (res.json() as Promise<Viewer>) : null))
    .catch(() => null)
    .then((viewer) => {
      state = { status: "ready", viewer };
      for (const listener of listeners) listener();
    });
}

export const subscribeViewer = (onChange: () => void) => {
  listeners.add(onChange);
  load();
  return () => listeners.delete(onChange);
};
export const viewerSnapshot = () => state;
export const viewerServerSnapshot = () => LOADING;

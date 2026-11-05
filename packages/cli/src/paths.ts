import { basename, join, resolve } from "node:path";

import type { PathOps } from "@kits/schema";

/** Real filesystem paths for the shared planner (Windows-safe, unlike the POSIX defaults). */
export const nodePaths: PathOps = { join, resolve: (dir, p) => resolve(dir, p), basename };

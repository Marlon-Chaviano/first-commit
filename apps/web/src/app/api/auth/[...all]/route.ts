import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/server/auth";

const unavailable = () => Response.json({ error: "Cuentas no disponibles (sin base de datos)" }, { status: 503 });

export const { GET, POST } = auth ? toNextJsHandler(auth) : { GET: unavailable, POST: unavailable };

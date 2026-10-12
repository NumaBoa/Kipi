import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  const captured = consumeLastCapturedError();
  console.error("CATALOGUED SSR ERROR:", captured ?? body);
  return new Response(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Kipi — Gestão</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" />
    <style>
      body { margin:0; font-family:'Plus Jakarta Sans',sans-serif; background:#F3F6F8; color:#084463; display:grid; place-items:center; min-height:100vh; }
      .box { background:white; padding:32px; border-radius:24px; box-shadow:0 10px 40px rgba(8,68,99,0.08); text-align:center; max-width:440px; margin:20px; }
      .btn { display:inline-block; margin-top:20px; background:#084463; color:white; padding:12px 28px; border-radius:9999px; text-decoration:none; font-weight:700; font-size:14px; border:none; cursor:pointer; }
    </style>
  </head>
  <body>
    <div class="box">
      <div style="font-size:36px;margin-bottom:12px">⚡</div>
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:800">Carregando painel Kipi...</h2>
      <p style="margin:0;font-size:13px;color:#557385">O sistema está inicializando. Se demorar, clique abaixo.</p>
      <button class="btn" onclick="window.location.reload()">Entrar no Sistema</button>
      <script>
        setTimeout(function() { window.location.reload(); }, 1500);
      </script>
    </div>
  </body>
</html>`, {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error: any) {
      console.error("SERVER CRASH IN FETCH:", error);
      return new Response(`<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Kipi — Gestão</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" />
    <style>
      body { margin:0; font-family:'Plus Jakarta Sans',sans-serif; background:#F3F6F8; color:#084463; display:grid; place-items:center; min-height:100vh; }
      .box { background:white; padding:32px; border-radius:24px; box-shadow:0 10px 40px rgba(8,68,99,0.08); text-align:center; max-width:440px; margin:20px; }
      .btn { display:inline-block; margin-top:20px; background:#084463; color:white; padding:12px 28px; border-radius:9999px; text-decoration:none; font-weight:700; font-size:14px; border:none; cursor:pointer; }
    </style>
  </head>
  <body>
    <div class="box">
      <div style="font-size:36px;margin-bottom:12px">⚡</div>
      <h2 style="margin:0 0 8px;font-size:20px;font-weight:800">Carregando painel Kipi...</h2>
      <p style="margin:0;font-size:13px;color:#557385">O sistema está inicializando. Se demorar, clique abaixo.</p>
      <button class="btn" onclick="window.location.reload()">Entrar no Sistema</button>
      <script>
        setTimeout(function() { window.location.reload(); }, 1500);
      </script>
    </div>
  </body>
</html>`, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};

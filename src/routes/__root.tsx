import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import { Component, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";

class GlobalErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null; errorInfo: any }> {
  constructor(props: any) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, errorInfo: any) {
    console.error("CRITICAL CLIENT CRASH:", error, errorInfo);
    this.setState({ error, errorInfo });
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: "sans-serif", background: "#F8FAFB", color: "#084463", minHeight: "100vh" }}>
          <div style={{ maxWidth: 800, margin: "40px auto", background: "white", padding: 32, borderRadius: 24, boxShadow: "0 10px 40px rgba(8,68,99,0.1)", border: "1px solid rgba(8,68,99,0.1)" }}>
            <h1 style={{ fontSize: 22, fontWeight: "bold", color: "#EF4444" }}>⚠️ Diagnóstico de Execução da Interface</h1>
            <p style={{ margin: "12px 0 20px", fontSize: 14, color: "#557385" }}>
              Identificamos um erro de renderização no componente cliente:
            </p>
            <div style={{ background: "#FEF2F2", color: "#991B1B", padding: 16, borderRadius: 16, fontSize: 13, fontWeight: "bold", marginBottom: 16 }}>
              {this.state.error.message}
            </div>
            <pre style={{ background: "#F1F5F9", color: "#334155", padding: 16, borderRadius: 16, overflow: "auto", fontSize: 11, maxHeight: 250 }}>
              {this.state.error.stack}
              {"\n\nComponent Stack:\n"}
              {this.state.errorInfo?.componentStack}
            </pre>
            <div style={{ marginTop: 24, display: "flex", gap: 12 }}>
              <button
                type="button"
                onClick={() => { localStorage.clear(); window.location.reload(); }}
                style={{ padding: "10px 20px", background: "#084463", color: "white", border: "none", borderRadius: 9999, cursor: "pointer", fontWeight: "bold", fontSize: 12 }}
              >
                Limpar Cache Local e Recarregar
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{ padding: "10px 20px", background: "#E8F4F8", color: "#084463", border: "none", borderRadius: 9999, cursor: "pointer", fontWeight: "bold", fontSize: 12 }}
              >
                Tentar Novamente
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" }, { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Kipi — Gestão de Produção & Vendas" },
      { name: "description", content: "Sistema inteligente de gestão de estoque, produtos, vendas e clientes." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&display=swap" },
      { rel: "stylesheet", href: appCss }, { rel: "icon", href: "/favicon.ico" }
    ]
  }),
  shellComponent: ({ children }: { children: ReactNode }) => (
    <html lang="pt-BR">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('error', function(e) {
                console.error("GLOBAL WINDOW ERROR:", e.error || e.message);
                var existing = document.getElementById('debug-global-err-box');
                if (!existing && document.body) {
                  var b = document.createElement('div');
                  b.id = 'debug-global-err-box';
                  b.style = 'position:fixed;bottom:16px;left:16px;right:16px;z-index:999999;background:#991B1B;color:white;padding:16px;border-radius:16px;font-family:sans-serif;font-size:12px;box-shadow:0 10px 30px rgba(0,0,0,0.5);';
                  b.innerHTML = '<strong style="font-size:14px">⚠️ Erro Detectado no Navegador:</strong><p style="margin:6px 0">' + (e.message || '') + '</p><pre style="background:rgba(0,0,0,0.3);padding:8px;border-radius:8px;overflow:auto;max-height:120px">' + (e.error ? e.error.stack : '') + '</pre><button onclick="localStorage.clear();location.reload()" style="margin-top:8px;background:white;color:#991B1B;border:none;padding:6px 14px;border-radius:9999px;font-weight:bold;cursor:pointer">Limpar dados e recarregar</button>';
                  document.body.appendChild(b);
                }
              });
            `,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  ),
  component: () => {
    const { queryClient } = Route.useRouteContext();
    return (
      <GlobalErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <Outlet />
          <Toaster position="top-right" />
        </QueryClientProvider>
      </GlobalErrorBoundary>
    );
  },
  errorComponent: ({ error }: { error: any }) => (
    <div style={{ padding: 32, fontFamily: "sans-serif", background: "#FEF2F2", color: "#991B1B", minHeight: "100vh" }}>
      <h1 style={{ fontSize: 24, fontWeight: "bold" }}>Erro na rota:</h1>
      <pre style={{ background: "white", padding: 16, borderRadius: 12, marginTop: 16 }}>
        {error?.message || String(error)}
        {"\n\n"}
        {error?.stack}
      </pre>
      <button
        type="button"
        onClick={() => { localStorage.clear(); window.location.reload(); }}
        style={{ marginTop: 16, padding: "10px 20px", background: "#DC2626", color: "white", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: "bold" }}
      >
        Limpar dados e reiniciar
      </button>
    </div>
  ),
  notFoundComponent: () => <div className="grid min-h-screen place-items-center bg-background text-center"><div><h1 className="text-5xl">404</h1><p className="mt-2 text-muted-foreground">Página não encontrada</p><Link to="/" className="mt-4 inline-block text-primary">Voltar ao painel</Link></div></div>
});

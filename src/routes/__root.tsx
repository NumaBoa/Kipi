import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Outlet, Link, createRootRouteWithContext, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";

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
  shellComponent: ({ children }: { children: ReactNode }) => <html lang="pt-BR"><head><HeadContent /></head><body>{children}<Scripts /></body></html>,
  component: () => { const { queryClient } = Route.useRouteContext(); return <QueryClientProvider client={queryClient}><Outlet /><Toaster position="top-right" /></QueryClientProvider>; },
  notFoundComponent: () => <div className="grid min-h-screen place-items-center bg-background text-center"><div><h1 className="text-5xl">404</h1><p className="mt-2 text-muted-foreground">Página não encontrada</p><Link to="/" className="mt-4 inline-block text-primary">Voltar ao painel</Link></div></div>
});

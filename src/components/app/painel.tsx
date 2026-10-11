import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Painel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("glass-panel rounded-3xl", className)} {...props}>
      {children}
    </div>
  );
}

export function TituloSecao({
  titulo,
  descricao,
  acao,
}: {
  titulo: string;
  descricao?: string;
  acao?: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
      <div className="min-w-0">
        <h2 className="truncate text-xl">{titulo}</h2>
        {descricao ? <p className="mt-0.5 text-xs text-muted-foreground">{descricao}</p> : null}
      </div>
      {acao}
    </div>
  );
}

type Tom = "brand" | "blossom" | "success" | "warning" | "danger" | "neutro";

const tons: Record<Tom, string> = {
  brand: "bg-brand/12 text-brand",
  blossom: "bg-blossom/15 text-blossom",
  success: "bg-success/15 text-success",
  warning: "bg-warning/18 text-warning",
  danger: "bg-danger/15 text-danger",
  neutro: "bg-muted text-muted-foreground",
};

export function Etiqueta({
  children,
  tom = "neutro",
  className,
}: {
  children: ReactNode;
  tom?: Tom;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap",
        tons[tom],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function CartaoIndicador({
  rotulo,
  valor,
  detalhe,
  etiqueta,
  tom = "brand",
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  etiqueta?: string;
  tom?: Tom;
}) {
  return (
    <Painel className="p-5">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <p className="min-w-0 truncate text-xs font-medium text-muted-foreground">{rotulo}</p>
        {etiqueta ? <Etiqueta tom={tom}>{etiqueta}</Etiqueta> : null}
      </div>
      <p className="mt-3 font-display text-3xl font-semibold tracking-tight">{valor}</p>
      {detalhe ? <p className="mt-1 text-[11px] text-muted-foreground">{detalhe}</p> : null}
    </Painel>
  );
}

export function Vazio({ texto }: { texto: string }) {
  return (
    <div className="glass-inset rounded-2xl px-4 py-8 text-center text-sm text-muted-foreground">
      {texto}
    </div>
  );
}

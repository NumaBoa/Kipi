import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Painel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("bg-white dark:bg-card border border-slate-200/70 dark:border-border/50 rounded-2xl sm:rounded-[28px] shadow-sm shadow-indigo-500/5 transition-all duration-200", className)} {...props}>
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
        <h2 className="truncate text-xl font-extrabold text-[#084463] dark:text-foreground tracking-tight">{titulo}</h2>
        {descricao ? <p className="mt-0.5 text-xs text-slate-500 dark:text-muted-foreground font-medium">{descricao}</p> : null}
      </div>
      {acao}
    </div>
  );
}

type Tom = "brand" | "blossom" | "saffron" | "success" | "warning" | "danger" | "neutro";

const tons: Record<Tom, string> = {
  brand: "bg-[#084463]/10 text-[#084463]",
  blossom: "bg-[#6BB9D4]/20 text-[#084463]",
  saffron: "bg-[#FFC64F]/30 text-[#92400E]",
  success: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  warning: "bg-[#FFC64F]/30 text-[#92400E] dark:text-amber-400",
  danger: "bg-red-500/15 text-red-600 dark:text-red-400",
  neutro: "bg-[#EBF1F5] text-[#557385] dark:bg-muted dark:text-muted-foreground",
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
        "inline-flex shrink-0 items-center rounded-full px-3 py-1 text-[11px] font-bold tracking-wide whitespace-nowrap",
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
  onClick,
  className,
}: {
  rotulo: string;
  valor: string;
  detalhe?: ReactNode;
  etiqueta?: string | undefined;
  tom?: Tom | undefined;
  onClick?: (() => void) | undefined;
  className?: string | undefined;
}) {
  return (
    <Painel
      onClick={onClick}
      className={cn(
        "p-4 sm:p-6",
        onClick &&
          "cursor-pointer hover:border-[#084463]/50 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all select-none group",
        className
      )}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
        <p className="min-w-0 truncate text-[11px] sm:text-xs font-bold text-slate-500 dark:text-muted-foreground uppercase tracking-wider group-hover:text-[#084463] transition-colors">
          {rotulo}
        </p>
        {etiqueta ? <Etiqueta tom={tom} className="px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-[11px]">{etiqueta}</Etiqueta> : null}
      </div>
      <p className="mt-2 sm:mt-3 font-display text-2xl sm:text-3xl font-extrabold text-[#084463] dark:text-foreground tracking-tight">{valor}</p>
      {detalhe ? <div className="mt-1 text-[11px] sm:text-xs text-slate-500 dark:text-muted-foreground font-medium leading-tight">{detalhe}</div> : null}
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

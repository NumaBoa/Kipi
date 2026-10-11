export const brl = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    Number.isFinite(value) ? value : 0,
  );

export const num = (value: number, max = 2) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: max }).format(
    Number.isFinite(value) ? value : 0,
  );

export const dataCurta = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(iso));

export const dataHora = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export const hoje = () =>
  new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());

export const diaSemana = (iso: string) =>
  new Intl.DateTimeFormat("pt-BR", { weekday: "short" }).format(new Date(iso));

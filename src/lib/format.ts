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

/**
 * Formata data no formato DD/MM/AAAA evitando recuo de dia causado por fuso horário
 * quando a data vem armazenada em UTC meia-noite (ex: "2026-10-16 00:00:00+00" ou "2026-10-16T00:00:00Z")
 */
export const formatarDataSemFuso = (dataStr?: string | null): string => {
  if (!dataStr) return "";
  const parteData = String(dataStr).split("T")[0].split(" ")[0];
  if (parteData && /^\d{4}-\d{2}-\d{2}$/.test(parteData)) {
    const [ano, mes, dia] = parteData.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  return new Date(dataStr).toLocaleDateString("pt-BR");
};

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

export const formatarTelefone = (valor: string): string => {
  let digitos = valor.replace(/\D/g, "");
  if (digitos.startsWith("55") && digitos.length > 11) {
    digitos = digitos.slice(2);
  }
  digitos = digitos.slice(0, 11);

  if (digitos.length === 0) return "";
  if (digitos.length <= 2) return `(${digitos}`;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) {
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  }
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7, 11)}`;
};

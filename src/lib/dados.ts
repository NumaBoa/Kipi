import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "./supabase";
import { obterEmpresaAtivaId } from "./auth";

export type Insumo = {
  id: string;
  nome: string;
  tipo: "materia_prima" | "embalagem" | "acessorio" | "ingrediente" | "material";
  unidade: "un" | "m" | "cm" | "folha" | "rolo" | "par" | "kg" | "g" | "ml" | "L" | string;
  quantidade: number;
  minimo: number;
  custo_unitario: number;
  empresa_id?: string | undefined;
};
export type Produto = {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  estoque: number;
  estoque_congelado?: number | undefined;
  ativo: boolean;
  disponibilidade?: "pronta_entrega" | "sob_encomenda" | "hibrido" | undefined;
  custo_manual?: number | undefined;
  tempo_preparo_minutos?: number;
  valor_hora_trabalho?: number;
  rendimento_unidades?: number;
  empresa_id?: string | undefined;
};
export type Cliente = {
  id: string;
  nome: string;
  telefone: string | null;
  tag?: string | null | undefined;
  email?: string | null | undefined;
  cpf_cnpj?: string | null | undefined;
  aniversario?: string | null | undefined;
  cep?: string | null | undefined;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  cidade?: string | null | undefined;
  estado?: string | null | undefined;
  complemento: string | null;
  observacoes: string | null;
  tipo_contato?: "cliente" | "revendedor" | "parceiro" | undefined;
  revendedora_id?: string | null | undefined;
  empresa_id?: string | undefined;
};
export type Revendedora = {
  id: string;
  nome: string;
  telefone: string | null;
  tipo_comissao: "porcentagem" | "valor_fixo";
  comissao_percentual: number | null;
  comissao_fixa: number | null;
  observacoes: string | null;
  categoria_parceria?: "revendedor" | "parceiro" | undefined;
  subtipo_parceria?: string | null | undefined;
  cliente_ids?: string[] | undefined;
  email?: string | null | undefined;
  usuario_id?: string | null | undefined;
  empresa_id?: string | undefined;
};
export type PagamentoComissao = {
  id: string;
  revendedora_id: string;
  valor: number;
  data: string;
  observacoes: string | null;
  empresa_id?: string | undefined;
};
export type Categoria = {
  id: string;
  nome: string;
  empresa_id?: string | undefined;
};
export type ReceitaItem = { id: string; produto_id: string; insumo_id: string; quantidade: number; empresa_id?: string | undefined };
export type VendaItem = { id: string; venda_id: string; produto_id: string | null; nome_produto: string; quantidade: number; preco_unitario: number; com_desconto?: boolean | undefined; empresa_id?: string | undefined };
export type Venda = {
  id: string;
  cliente_id: string | null;
  canal: "propria" | "revendedora";
  revendedora_id: string | null;
  data: string;
  tipo_pedido?: "pronta_entrega" | "sob_encomenda" | "producao_lote" | "fornada_freezer" | undefined;
  data_entrega_prometida?: string | null | undefined;
  valor_sinal_pago?: number | undefined;
  saldo_na_entrega?: number | undefined;
  status_producao?: "a_fazer" | "fazendo" | "pronto_retirada" | "entregue" | undefined;
  pagamento: "pix" | "dinheiro" | "cartao" | "transferencia" | "pendente";
  status: "pago" | "pendente" | "cancelado";
  total: number;
  custo_total: number;
  observacoes: string | null;
  venda_itens: VendaItem[];
  clientes: { nome: string } | null;
  revendedoras?: { nome: string } | null;
  tipo_destino_lote?: "pronto" | "congelado" | undefined;
  baixar_insumos_lote?: boolean | undefined;
  empresa_id?: string | undefined;
};
export type RemessaConsignacao = {
  id: string;
  revendedora_id: string;
  produto_id: string;
  nome_produto: string;
  quantidade: number;
  data: string;
  observacoes?: string | null | undefined;
  baixar_estoque_atelie?: boolean | undefined;
  empresa_id?: string | undefined;
};

export type ItemEstoqueConsignado = {
  produto_id: string;
  nome_produto: string;
  categoria?: string | undefined;
  preco_unitario: number;
  total_entregue: number;
  total_vendido: number;
  saldo_atual: number;
  minimo_alerta: number;
  precisa_reposicao: boolean;
  qtd_sugerida_reposicao: number;
  status: "esgotado" | "critico" | "ok";
};

export type AlertaReposicaoConsignado = {
  revendedora_id: string;
  nome_revendedora: string;
  telefone_revendedora: string | null;
  produto_id: string;
  nome_produto: string;
  saldo_atual: number;
  minimo_alerta: number;
  qtd_sugerida_reposicao: number;
  status: "esgotado" | "critico";
};

export type ItemCarrinho = { produto: Produto; quantidade: number; com_desconto?: boolean | undefined };

type Dados = {
  insumos: Insumo[];
  produtos: Produto[];
  clientes: Cliente[];
  receitas: ReceitaItem[];
  vendas: Venda[];
  revendedoras: Revendedora[];
  pagamentos_comissao: PagamentoComissao[];
  categorias: Categoria[];
  remessas_consignacao: RemessaConsignacao[];
};

const CHAVE = "meu-atelie-dados-v9";
const haDias = (dias: number, hora = 14) => { const d = new Date(); d.setDate(d.getDate() - dias); d.setHours(hora, 0, 0, 0); return d.toISOString(); };

const iniciais: Dados = {
  insumos: [],
  produtos: [],
  categorias: [],
  remessas_consignacao: [],
  clientes: [],
  revendedoras: [],
  pagamentos_comissao: [],
  receitas: [],
  vendas: [],
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function ler(): Dados {
  if (typeof window === "undefined") return clone(iniciais);
  
  // Limpar chaves antigas de dados mockados se existirem
  ["meu-atelie-dados-mocados-v2", "meu-atelie-dados-v3", "meu-atelie-dados-v4", "meu-atelie-dados-v5", "meu-atelie-dados-v6", "meu-atelie-dados-v7", "meu-atelie-dados-v8"].forEach((k) => {
    localStorage.removeItem(k);
  });

  const salvo = localStorage.getItem(CHAVE);
  if (!salvo) {
    localStorage.setItem(CHAVE, JSON.stringify(iniciais));
    return clone(iniciais);
  }
  try {
    const d = JSON.parse(salvo) as Dados;
    if (!d.revendedoras) d.revendedoras = [];
    if (!d.pagamentos_comissao) d.pagamentos_comissao = [];
    if (!d.categorias) d.categorias = [];
    if (!d.remessas_consignacao) d.remessas_consignacao = [];
    return d;
  } catch {
    return clone(iniciais);
  }
}

function gravar(d: Dados) { if (typeof window !== "undefined") localStorage.setItem(CHAVE, JSON.stringify(d)); }
const id = () => typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export const chaves = {
  insumos: ["insumos"] as const,
  produtos: ["produtos"] as const,
  clientes: ["clientes"] as const,
  receitas: ["receitas"] as const,
  vendas: ["vendas"] as const,
  revendedoras: ["revendedoras"] as const,
  pagamentos_comissao: ["pagamentos_comissao"] as const,
  categorias: ["categorias"] as const,
  remessas_consignacao: ["remessas_consignacao"] as const,
};

// HOOKS DE CONSULTA (SUPABASE + LOCALSTORAGE FALLBACK)
export const useInsumos = () => useQuery({
  queryKey: [...chaves.insumos, obterEmpresaAtivaId()],
  queryFn: async () => {
    if (isSupabaseConfigured) {
      const empId = obterEmpresaAtivaId();
      const { data, error } = await supabase
        .from("insumos")
        .select("*")
        .or(`empresa_id.eq.${empId},empresa_id.is.null`);
      if (error) throw error;
      const ins = (data || []) as Insumo[];
      const d = ler();
      d.insumos = ins;
      gravar(d);
      return ins;
    }
    return ler().insumos;
  }
});

export const useProdutos = () => useQuery({
  queryKey: [...chaves.produtos, obterEmpresaAtivaId()],
  queryFn: async () => {
    const dadosLocais = ler();
    if (isSupabaseConfigured) {
      try {
        const empId = obterEmpresaAtivaId();
        const { data, error } = await supabase
          .from("produtos")
          .select("*")
          .or(`empresa_id.eq.${empId},empresa_id.is.null`);
        if (error) throw error;
        const produtosSupabase = (data || []) as Produto[];
        const map = new Map<string, Produto>();
        dadosLocais.produtos.forEach((p) => map.set(p.id, p));
        produtosSupabase.forEach((sp) => {
          const local = map.get(sp.id);
          map.set(sp.id, {
            ...local,
            ...sp,
            preco: Number(sp.preco ?? local?.preco ?? 0),
            estoque: Number(sp.estoque ?? local?.estoque ?? 0),
            estoque_congelado: Number(local?.estoque_congelado ?? 0),
            rendimento_unidades: Number(sp.rendimento_unidades ?? local?.rendimento_unidades ?? 1),
            tempo_preparo_minutos: Number(sp.tempo_preparo_minutos ?? local?.tempo_preparo_minutos ?? 0),
          });
        });
        const listaMesclada = Array.from(map.values());
        dadosLocais.produtos = listaMesclada;
        gravar(dadosLocais);
        return listaMesclada;
      } catch (err) {
        console.warn("Aviso ao carregar produtos do Supabase, usando locais:", err);
      }
    }
    return dadosLocais.produtos;
  }
});

export const useClientes = () => useQuery({
  queryKey: [...chaves.clientes, obterEmpresaAtivaId()],
  queryFn: async () => {
    const dadosLocais = ler().clientes || [];
    if (isSupabaseConfigured) {
      try {
        const empId = obterEmpresaAtivaId();
        const { data, error } = await supabase
          .from("clientes")
          .select("*")
          .or(`empresa_id.eq.${empId},empresa_id.is.null`);
        if (!error && data) {
          const map = new Map<string, Cliente>();
          dadosLocais.forEach((c) => map.set(c.id, c));
          data.forEach((sc: any) => {
            const local = map.get(sc.id);
            let tagFinal = (sc.tag && typeof sc.tag === "string" && sc.tag.trim())
              ? sc.tag.trim()
              : (local?.tag && typeof local.tag === "string" && local.tag.trim())
              ? local.tag.trim()
              : null;

            let obsFinal = sc.observacoes ?? local?.observacoes ?? null;
            if (obsFinal && typeof obsFinal === "string" && obsFinal.includes("[TAG:")) {
              const match = obsFinal.match(/\[TAG:\s*([^\]]+)\]/);
              if (match?.[1]) {
                if (!tagFinal) tagFinal = match[1].trim();
                obsFinal = obsFinal.replace(/\[TAG:[^\]]*\]/g, "").trim() || null;
              }
            }

            map.set(sc.id, {
              ...sc,
              tag: tagFinal,
              observacoes: obsFinal,
              rua: sc.rua ?? local?.rua ?? null,
              numero: sc.numero ?? local?.numero ?? null,
              bairro: sc.bairro ?? local?.bairro ?? null,
              complemento: sc.complemento ?? local?.complemento ?? null,
              cidade: sc.cidade ?? local?.cidade ?? null,
              estado: sc.estado ?? local?.estado ?? null,
              cep: sc.cep ?? local?.cep ?? null,
              email: sc.email ?? local?.email ?? null,
              cpf_cnpj: sc.cpf_cnpj ?? local?.cpf_cnpj ?? null,
              aniversario: sc.aniversario ?? local?.aniversario ?? null,
              revendedora_id: sc.revendedora_id ?? local?.revendedora_id ?? null,
            });
          });
          const lista = Array.from(map.values());
          const d = ler();
          d.clientes = lista;
          gravar(d);
          return lista;
        }
      } catch (err) {
        console.warn("Supabase clientes aviso:", err);
      }
    }
    return dadosLocais;
  }
});

export const useReceitas = () => useQuery({
  queryKey: [...chaves.receitas, obterEmpresaAtivaId()],
  queryFn: async () => {
    if (isSupabaseConfigured) {
      try {
        const empId = obterEmpresaAtivaId();
        const { data, error } = await supabase
          .from("receitas")
          .select("*")
          .or(`empresa_id.eq.${empId},empresa_id.is.null`);
        if (error) throw error;
        const rec = (data || []) as ReceitaItem[];
        const d = ler();
        d.receitas = rec;
        gravar(d);
        return rec;
      } catch (err) {
        console.warn("Aviso ao carregar receitas do Supabase:", err);
      }
    }
    return ler().receitas;
  }
});

export const useVendas = () => useQuery({
  queryKey: [...chaves.vendas, obterEmpresaAtivaId()],
  queryFn: async () => {
    const dadosLocais = ler().vendas || [];
    if (isSupabaseConfigured) {
      try {
        const empId = obterEmpresaAtivaId();
        const { data, error } = await supabase
          .from("vendas")
          .select("*, clientes(nome), revendedoras(nome), venda_itens(*)")
          .or(`empresa_id.eq.${empId},empresa_id.is.null`)
          .order("data", { ascending: false });
        if (!error && data) {
          const map = new Map<string, Venda>();
          dadosLocais.forEach((v) => map.set(v.id, v));
          data.forEach((sv: any) => {
            const local = map.get(sv.id);
            map.set(sv.id, {
              ...sv,
              tipo_pedido: local?.tipo_pedido ?? sv.tipo_pedido ?? "pronta_entrega",
              status_producao: local?.status_producao ?? sv.status_producao,
              tipo_destino_lote: local?.tipo_destino_lote ?? sv.tipo_destino_lote,
              baixar_insumos_lote: local?.baixar_insumos_lote ?? sv.baixar_insumos_lote,
              valor_sinal_pago: local?.valor_sinal_pago ?? sv.valor_sinal_pago,
              saldo_na_entrega: local?.saldo_na_entrega ?? sv.saldo_na_entrega,
              data_entrega_prometida: local?.data_entrega_prometida ?? sv.data_entrega_prometida,
              clientes: sv.clientes || local?.clientes || null,
              revendedoras: sv.revendedoras || local?.revendedoras || null,
              venda_itens: (sv.venda_itens && sv.venda_itens.length > 0) ? sv.venda_itens : (local?.venda_itens || []),
            });
          });
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()
          );
        }
      } catch (err) {
        console.warn("Supabase vendas aviso:", err);
      }
    }
    return dadosLocais;
  }
});

export const useRevendedoras = () => useQuery({
  queryKey: [...chaves.revendedoras, obterEmpresaAtivaId()],
  queryFn: async () => {
    if (isSupabaseConfigured) {
      const empId = obterEmpresaAtivaId();
      const { data, error } = await supabase
        .from("revendedoras")
        .select("*")
        .or(`empresa_id.eq.${empId},empresa_id.is.null`);
      if (error) throw error;
      return (data || []) as Revendedora[];
    }
    return ler().revendedoras;
  }
});

export const usePagamentosComissao = () => useQuery({
  queryKey: [...chaves.pagamentos_comissao, obterEmpresaAtivaId()],
  queryFn: async () => {
    if (isSupabaseConfigured) {
      const empId = obterEmpresaAtivaId();
      const { data, error } = await supabase
        .from("pagamentos_comissao")
        .select("*")
        .or(`empresa_id.eq.${empId},empresa_id.is.null`)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data || []) as PagamentoComissao[];
    }
    return ler().pagamentos_comissao;
  }
});

export const useCategorias = () => useQuery({
  queryKey: [...chaves.categorias, obterEmpresaAtivaId()],
  queryFn: async () => {
    if (isSupabaseConfigured) {
      const empId = obterEmpresaAtivaId();
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .or(`empresa_id.eq.${empId},empresa_id.is.null`);
      if (error) throw error;
      return (data || []) as Categoria[];
    }
    return ler().categorias;
  }
});

export const useRemessasConsignacao = () => useQuery({
  queryKey: [...chaves.remessas_consignacao, obterEmpresaAtivaId()],
  queryFn: async () => {
    if (isSupabaseConfigured) {
      try {
        const empId = obterEmpresaAtivaId();
        const { data, error } = await supabase
          .from("remessas_consignacao")
          .select("*")
          .or(`empresa_id.eq.${empId},empresa_id.is.null`)
          .order("data", { ascending: false });
        if (!error && data) return (data || []) as RemessaConsignacao[];
      } catch (err) {
        console.warn("Supabase remessas_consignacao:", err);
      }
    }
    return ler().remessas_consignacao || [];
  }
});

const CHAVE_VALOR_HORA = "meu-atelie-valor-hora-padrao";

export function lerValorHoraPadrao(): number {
  if (typeof window === "undefined") return 25;
  const salvo = localStorage.getItem(CHAVE_VALOR_HORA);
  return salvo ? Number(salvo) : 25;
}

export function gravarValorHoraPadrao(valor: number) {
  if (typeof window !== "undefined") {
    localStorage.setItem(CHAVE_VALOR_HORA, String(Math.max(0, valor)));
  }
}

export function custoMaoDeObraFornada(produto?: Partial<Produto>, valorHoraOverride?: number): number {
  if (!produto) return 0;
  const mins = Number(produto.tempo_preparo_minutos ?? 0);
  const valorHora = valorHoraOverride ?? Number(produto.valor_hora_trabalho ?? lerValorHoraPadrao());
  return (mins / 60) * valorHora;
}

export function custoInsumosFornada(produtoId: string, receitas: ReceitaItem[], insumos: Insumo[]): number {
  return receitas
    .filter((r) => r.produto_id === produtoId)
    .reduce((t, r) => t + (insumos.find((i) => i.id === r.insumo_id)?.custo_unitario ?? 0) * Number(r.quantidade), 0);
}

export function custoTotalFornada(produto: Partial<Produto>, receitas: ReceitaItem[], insumos: Insumo[]): number {
  if (!produto.id) return 0;
  const insumosCusto = custoInsumosFornada(produto.id, receitas, insumos);
  const maoDeObra = custoMaoDeObraFornada(produto);
  return insumosCusto + maoDeObra;
}

export function custoProduto(produtoId: string, receitas: ReceitaItem[], insumos: Insumo[], produto?: Partial<Produto>): number {
  const itensReceita = receitas.filter((r) => r.produto_id === produtoId);
  if (itensReceita.length === 0) return 0;

  const insumosCusto = custoInsumosFornada(produtoId, receitas, insumos);
  const maoDeObra = produto ? custoMaoDeObraFornada(produto) : 0;
  const rendimento = Math.max(Number(produto?.rendimento_unidades ?? 1), 1);

  return (insumosCusto + maoDeObra) / rendimento;
}

export function calcularProducaoPossivel(
  produtoId: string,
  receitas: ReceitaItem[],
  insumos: Insumo[],
  rendimentoUnidades = 1
): { possiveis: number; gargaloInsumo: Insumo | null } {
  const itens = receitas.filter((r) => r.produto_id === produtoId);
  if (itens.length === 0) return { possiveis: 0, gargaloInsumo: null };

  let minFornadas = Infinity;
  let gargaloInsumo: Insumo | null = null;

  for (const item of itens) {
    const insumo = insumos.find((i) => i.id === item.insumo_id);
    if (!insumo || item.quantidade <= 0) continue;

    const fornadas = Math.floor(Number(insumo.quantidade) / Number(item.quantidade));
    if (fornadas < minFornadas) {
      minFornadas = fornadas;
      gargaloInsumo = insumo;
    }
  }

  if (minFornadas === Infinity) return { possiveis: 0, gargaloInsumo: null };

  const rend = Math.max(Number(rendimentoUnidades), 1);
  return {
    possiveis: Math.max(0, minFornadas * rend),
    gargaloInsumo,
  };
}

export function verificarIngredientesSuficientes(
  produtoId: string,
  quantidadeAProduzir: number,
  receitas: ReceitaItem[],
  insumos: Insumo[],
  rendimentoUnidades = 1
): {
  suficiente: boolean;
  faltantes: Array<{
    nomeInsumo: string;
    unidade: string;
    necessario: number;
    disponivel: number;
    falta: number;
  }>;
} {
  const itens = receitas.filter((r) => r.produto_id === produtoId);
  if (itens.length === 0) return { suficiente: true, faltantes: [] };

  const rend = Math.max(Number(rendimentoUnidades || 1), 1);
  const fator = quantidadeAProduzir / rend;
  const faltantes: Array<{
    nomeInsumo: string;
    unidade: string;
    necessario: number;
    disponivel: number;
    falta: number;
  }> = [];

  for (const item of itens) {
    const insumo = insumos.find((i) => i.id === item.insumo_id);
    const necessario = Number(item.quantidade) * fator;
    const disponivel = Number(insumo?.quantidade || 0);
    if (disponivel < necessario) {
      faltantes.push({
        nomeInsumo: insumo?.nome || "Ingrediente",
        unidade: insumo?.unidade || "un",
        necessario,
        disponivel,
        falta: Math.max(0, necessario - disponivel),
      });
    }
  }

  return {
    suficiente: faltantes.length === 0,
    faltantes,
  };
}

export function verificarCongeladoSuficiente(
  produtoId: string,
  quantidadeAssar: number,
  produtos: Produto[]
): {
  suficiente: boolean;
  disponivel: number;
  necessario: number;
  falta: number;
} {
  const prod = produtos.find((p) => p.id === produtoId);
  const disponivel = Number(prod?.estoque_congelado || 0);
  const suficiente = disponivel >= quantidadeAssar && disponivel > 0;
  return {
    suficiente,
    disponivel,
    necessario: quantidadeAssar,
    falta: Math.max(0, quantidadeAssar - disponivel),
  };
}

export function statusInsumo(i: Insumo) {
  if (!i) return "ok" as const;
  const qtd = Number(i.quantidade ?? 0);
  const min = Number(i.minimo ?? 0);
  return qtd <= 0 ? "acabou" as const : qtd <= min ? "baixo" as const : "ok" as const;
}

export function calcularComissaoRevendedora(venda: Venda, revendedora?: Revendedora | null): number {
  if (venda.canal !== "revendedora" || !revendedora) return 0;
  if (venda.status === "cancelado") return 0;
  
  if (revendedora.tipo_comissao === "valor_fixo") {
    const fixa = Number(revendedora.comissao_fixa ?? 0);
    if (venda.venda_itens && venda.venda_itens.length > 0) {
      return venda.venda_itens.reduce((s, i) => {
        const taxa = i.com_desconto ? fixa / 2 : fixa;
        return s + (Number(i.quantidade) || 1) * taxa;
      }, 0);
    }
    const qtdItens = (venda.venda_itens || []).reduce((s, i) => s + i.quantidade, 0);
    return qtdItens * fixa;
  }
  
  const perc = Number(revendedora.comissao_percentual ?? 0) / 100;
  if (venda.venda_itens && venda.venda_itens.length > 0) {
    return venda.venda_itens.reduce((s, i) => {
      const taxa = i.com_desconto ? perc / 2 : perc;
      const valorItem = (Number(i.preco_unitario) || 0) * (Number(i.quantidade) || 1);
      return s + valorItem * taxa;
    }, 0);
  }
  
  return Number(venda.total) * perc;
}

export function calcularComissaoEstimadaCarrinho(
  carrinho: ItemCarrinho[],
  revendedora?: Revendedora | null
): number {
  if (!revendedora) return 0;
  
  if (revendedora.tipo_comissao === "valor_fixo") {
    const fixa = Number(revendedora.comissao_fixa ?? 0);
    return carrinho.reduce((s, i) => {
      const taxa = i.com_desconto ? fixa / 2 : fixa;
      return s + (Number(i.quantidade) || 1) * taxa;
    }, 0);
  }
  
  const perc = Number(revendedora.comissao_percentual ?? 0) / 100;
  return carrinho.reduce((s, i) => {
    const taxa = i.com_desconto ? perc / 2 : perc;
    const valorItem = (Number(i.produto.preco) || 0) * (Number(i.quantidade) || 1);
    return s + valorItem * taxa;
  }, 0);
}

// MUTATIONS COM SUPABASE + FALLBACK
export const useSalvarInsumo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Partial<Insumo>) => {
      // O banco Supabase possui a restrição: CHECK (tipo IN ('ingrediente', 'material'))
      // Portanto, qualquer tipo não-ingrediente (materia_prima, embalagem, acessorio, material) é gravado como 'material'
      const tipoDb: Insumo["tipo"] = v.tipo === "ingrediente" ? "ingrediente" : "material";
      const item = {
        id: v.id ?? id(),
        nome: v.nome ?? "",
        tipo: tipoDb,
        unidade: v.unidade ?? "un",
        quantidade: Number(String(v.quantidade ?? 0).replace(",", ".")) || 0,
        minimo: Number(String(v.minimo ?? 0).replace(",", ".")) || 0,
        custo_unitario: Number(String(v.custo_unitario ?? 0).replace(",", ".")) || 0,
        empresa_id: obterEmpresaAtivaId(),
      };
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("insumos").upsert(item);
        if (error) {
          console.error("Erro ao salvar insumo no Supabase:", error);
          throw error;
        }
      } else {
        const d = ler();
        const pos = d.insumos.findIndex((x) => x.id === item.id);
        pos >= 0 ? d.insumos.splice(pos, 1, item) : d.insumos.push(item);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.insumos }),
  });
};

export const useApagarInsumo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: string) => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("insumos").delete().eq("id", v);
        if (error) throw error;
      } else {
        const d = ler();
        d.insumos = d.insumos.filter((x) => x.id !== v);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.insumos }),
  });
};

export const useEntradaEstoque = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { insumo: Insumo; quantidade: number; motivo: string }) => {
      const novaQtd = Number(v.insumo.quantidade) + Number(v.quantidade);
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("insumos").update({ quantidade: novaQtd }).eq("id", v.insumo.id);
        if (error) throw error;
      } else {
        const d = ler();
        const x = d.insumos.find((i) => i.id === v.insumo.id);
        if (x) x.quantidade = novaQtd;
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.insumos }),
  });
};

export const useSalvarProduto = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Partial<Produto>) => {
      const catNome = (v.categoria ?? "Geral").trim();
      const novoId = v.id ?? id();
      const d = ler();
      const pos = d.produtos.findIndex((x) => x.id === novoId);
      const existente: Produto | undefined = pos >= 0 ? d.produtos[pos] : undefined;

      const produtoAtualizado: Produto = {
        id: novoId,
        nome: v.nome ?? existente?.nome ?? "",
        categoria: catNome,
        preco: Number(v.preco ?? existente?.preco ?? 0),
        estoque: Number(v.estoque ?? existente?.estoque ?? 0),
        estoque_congelado: Number(v.estoque_congelado ?? existente?.estoque_congelado ?? 0),
        ativo: v.ativo ?? existente?.ativo ?? true,
        disponibilidade: v.disponibilidade ?? existente?.disponibilidade ?? "hibrido",
        custo_manual: v.custo_manual ? Number(v.custo_manual) : (existente?.custo_manual ?? 0),
        tempo_preparo_minutos: Number(v.tempo_preparo_minutos ?? existente?.tempo_preparo_minutos ?? 0),
        valor_hora_trabalho: Number(v.valor_hora_trabalho ?? existente?.valor_hora_trabalho ?? 0),
        rendimento_unidades: Number(v.rendimento_unidades ?? existente?.rendimento_unidades ?? 1),
        empresa_id: obterEmpresaAtivaId(),
      };

      if (pos >= 0) {
        d.produtos[pos] = produtoAtualizado;
      } else {
        d.produtos.push(produtoAtualizado);
      }
      if (catNome && !d.categorias.some((c) => c.nome.toLowerCase() === catNome.toLowerCase())) {
        d.categorias.push({ id: id(), nome: catNome, empresa_id: obterEmpresaAtivaId() });
      }
      gravar(d);

      if (isSupabaseConfigured) {
        try {
          const empId = obterEmpresaAtivaId();
          const dadosSupabase = {
            id: produtoAtualizado.id,
            nome: produtoAtualizado.nome,
            categoria: produtoAtualizado.categoria,
            preco: produtoAtualizado.preco,
            estoque: produtoAtualizado.estoque,
            ativo: produtoAtualizado.ativo,
            empresa_id: empId,
            estoque_congelado: produtoAtualizado.estoque_congelado,
            disponibilidade: produtoAtualizado.disponibilidade,
            custo_manual: produtoAtualizado.custo_manual,
            tempo_preparo_minutos: produtoAtualizado.tempo_preparo_minutos,
            valor_hora_trabalho: produtoAtualizado.valor_hora_trabalho,
            rendimento_unidades: produtoAtualizado.rendimento_unidades,
          };
          const { error } = await supabase.from("produtos").upsert(dadosSupabase);
          if (error) console.warn("Supabase upsert produto aviso:", error.message);
          if (catNome) {
            await supabase.from("categorias").upsert({ id: id(), nome: catNome, empresa_id: empId }, { onConflict: "nome" }).select();
          }
        } catch (err) {
          console.warn("Erro ao sincronizar produto no Supabase:", err);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaves.produtos });
      qc.invalidateQueries({ queryKey: chaves.categorias });
    },
  });
};

export const useApagarProduto = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: string) => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("produtos").delete().eq("id", v);
        if (error) throw error;
      } else {
        const d = ler();
        d.produtos = d.produtos.filter((x) => x.id !== v);
        d.receitas = d.receitas.filter((x) => x.produto_id !== v);
        gravar(d);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaves.produtos });
      qc.invalidateQueries({ queryKey: chaves.receitas });
    },
  });
};

export const useSalvarCategoria = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nomeCat: string) => {
      const nomeFormatado = nomeCat.trim();
      if (!nomeFormatado) return;
      const d = ler();
      if (!d.categorias.some((c) => c.nome.toLowerCase() === nomeFormatado.toLowerCase())) {
        d.categorias.push({ id: id(), nome: nomeFormatado, empresa_id: obterEmpresaAtivaId() });
        gravar(d);
      }
      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase.from("categorias").insert({ id: id(), nome: nomeFormatado, empresa_id: obterEmpresaAtivaId() });
          if (error) console.warn("Supabase categoria insert:", error.message);
        } catch (err) {
          console.warn("Erro ao salvar categoria no Supabase:", err);
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.categorias }),
  });
};

export const useApagarCategoria = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (catId: string) => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("categorias").delete().eq("id", catId);
        if (error) throw error;
      } else {
        const d = ler();
        d.categorias = d.categorias.filter((c) => c.id !== catId);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.categorias }),
  });
};

export const useSalvarCliente = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Partial<Cliente>) => {
      const empId = obterEmpresaAtivaId();
      const novo: Cliente = {
        id: v.id ?? id(),
        nome: v.nome ?? "",
        telefone: v.telefone ?? null,
        tag: v.tag ? v.tag.trim() : null,
        email: v.email ?? null,
        cpf_cnpj: v.cpf_cnpj ?? null,
        aniversario: v.aniversario ?? null,
        cep: v.cep ?? null,
        rua: v.rua ?? null,
        numero: v.numero ?? null,
        bairro: v.bairro ?? null,
        cidade: v.cidade ?? null,
        estado: v.estado ?? null,
        complemento: v.complemento ?? null,
        observacoes: v.observacoes ?? null,
        tipo_contato: v.tipo_contato ?? "cliente",
        revendedora_id: v.revendedora_id ?? null,
        empresa_id: empId,
      };

      // 1. Salva localmente primeiro para garantir resposta instantânea
      const d = ler();
      const pos = d.clientes.findIndex((x) => x.id === novo.id);
      pos >= 0 ? d.clientes.splice(pos, 1, novo) : d.clientes.push(novo);
      gravar(d);

      // 2. Sincroniza com Supabase sanitizando os campos da tabela clientes
      if (isSupabaseConfigured) {
        try {
          let obsComTag = novo.observacoes || "";
          if (novo.tag) {
            const limpa = obsComTag.replace(/\[TAG:[^\]]*\]/g, "").trim();
            obsComTag = limpa ? `[TAG:${novo.tag}] ${limpa}` : `[TAG:${novo.tag}]`;
          } else {
            obsComTag = obsComTag.replace(/\[TAG:[^\]]*\]/g, "").trim();
          }

          const payloadSupabase: any = {
            id: novo.id,
            nome: novo.nome,
            telefone: novo.telefone,
            tag: novo.tag,
            email: novo.email,
            cpf_cnpj: novo.cpf_cnpj,
            aniversario: novo.aniversario,
            cep: novo.cep,
            rua: novo.rua,
            numero: novo.numero,
            bairro: novo.bairro,
            cidade: novo.cidade,
            estado: novo.estado,
            complemento: novo.complemento,
            observacoes: obsComTag || null,
            tipo_contato: novo.tipo_contato,
            revendedora_id: novo.revendedora_id,
            empresa_id: empId,
          };
          const { error } = await supabase.from("clientes").upsert(payloadSupabase);
          if (error) {
            console.warn("Supabase clientes upsert aviso:", error.message);
            // Fallback caso colunas estendidas ainda não existam no Supabase
            const basePayload = {
              id: novo.id,
              nome: novo.nome,
              telefone: novo.telefone,
              tag: novo.tag,
              rua: novo.rua,
              numero: novo.numero,
              bairro: novo.bairro,
              complemento: novo.complemento,
              observacoes: obsComTag || null,
              tipo_contato: novo.tipo_contato,
              revendedora_id: novo.revendedora_id,
              empresa_id: empId,
            };
            const { error: errBase } = await supabase.from("clientes").upsert(basePayload);
            if (errBase && (errBase.message?.includes("tag") || errBase.code === "PGRST204" || errBase.code === "42703")) {
              const { tag: _, ...semTag } = basePayload;
              await supabase.from("clientes").upsert(semTag);
            }
          }
        } catch (err) {
          console.warn("Erro ao sincronizar cliente no Supabase:", err);
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.clientes }),
  });
};

export const useApagarCliente = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: string) => {
      // 1. Remove localmente
      const d = ler();
      d.clientes = d.clientes.filter((x) => x.id !== v);
      gravar(d);

      // 2. Sincroniza exclusão no Supabase
      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase.from("clientes").delete().eq("id", v);
          if (error) console.warn("Supabase cliente delete:", error.message);
        } catch (err) {
          console.warn("Erro ao deletar cliente no Supabase:", err);
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.clientes }),
  });
};

export const useSalvarRevendedora = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Partial<Revendedora>) => {
      const empId = obterEmpresaAtivaId();
      const tipoComissao = v.tipo_comissao ?? "porcentagem";
      const ehValorFixo = tipoComissao === "valor_fixo";

      const comissaoPercentual = ehValorFixo
        ? null
        : v.comissao_percentual !== null && v.comissao_percentual !== undefined && (v.comissao_percentual as unknown) !== ""
          ? Number(v.comissao_percentual)
          : null;

      const comissaoFixa = !ehValorFixo
        ? null
        : v.comissao_fixa !== null && v.comissao_fixa !== undefined && (v.comissao_fixa as unknown) !== ""
          ? Number(v.comissao_fixa)
          : null;

      const novo: Revendedora = {
        id: v.id ?? id(),
        nome: v.nome ?? "",
        telefone: v.telefone ?? null,
        tipo_comissao: tipoComissao,
        comissao_percentual: comissaoPercentual,
        comissao_fixa: comissaoFixa,
        observacoes: v.observacoes ?? null,
        categoria_parceria: v.categoria_parceria ?? "revendedor",
        subtipo_parceria: v.subtipo_parceria ?? null,
        cliente_ids: v.cliente_ids ?? [],
        email: v.email ?? null,
        usuario_id: v.usuario_id ?? null,
        empresa_id: empId,
      };

      // 1. Salva localmente primeiro para garantir que NUNCA falhe no client
      const d = ler();
      const pos = d.revendedoras.findIndex((x) => x.id === novo.id);
      pos >= 0 ? d.revendedoras.splice(pos, 1, novo) : d.revendedoras.push(novo);
      gravar(d);

      // 2. Sincroniza com Supabase apenas as colunas existentes na tabela revendedoras
      if (isSupabaseConfigured) {
        try {
          const payloadSupabase = {
            id: novo.id,
            nome: novo.nome,
            telefone: novo.telefone,
            tipo_comissao: novo.tipo_comissao,
            comissao_percentual: novo.comissao_percentual,
            comissao_fixa: novo.comissao_fixa,
            observacoes: novo.observacoes,
            cliente_ids: novo.cliente_ids,
            categoria_parceria: novo.categoria_parceria,
            subtipo_parceria: novo.subtipo_parceria,
            email: novo.email,
            usuario_id: novo.usuario_id,
            empresa_id: empId,
          };
          const { error } = await supabase.from("revendedoras").upsert(payloadSupabase);
          if (error) {
            console.warn("Supabase revendedoras upsert:", error.message);
            // Fallback de compatibilidade caso o banco ainda possua a restrição NOT NULL legada
            if (error.code === "23502") {
              await supabase.from("revendedoras").upsert({
                ...payloadSupabase,
                comissao_percentual: payloadSupabase.comissao_percentual ?? 0,
                comissao_fixa: payloadSupabase.comissao_fixa ?? 0,
              });
            }
          }
        } catch (err) {
          console.warn("Erro ao sincronizar revendedora no Supabase:", err);
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.revendedoras }),
  });
};

export const useApagarRevendedora = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: string) => {
      // 1. Remove localmente
      const d = ler();
      d.revendedoras = d.revendedoras.filter((x) => x.id !== v);
      gravar(d);

      // 2. Sincroniza exclusão no Supabase
      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase.from("revendedoras").delete().eq("id", v);
          if (error) console.warn("Supabase revendedora delete:", error.message);
        } catch (err) {
          console.warn("Erro ao deletar revendedora no Supabase:", err);
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.revendedoras }),
  });
};

export const useSalvarPagamentoComissao = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Omit<PagamentoComissao, "id">) => {
      const empId = obterEmpresaAtivaId();
      const novo: PagamentoComissao = { ...v, id: id(), empresa_id: empId };
      // 1. Salva localmente primeiro
      const d = ler();
      d.pagamentos_comissao.unshift(novo);
      gravar(d);

      // 2. Sincroniza com Supabase sanitizando campos existentes
      if (isSupabaseConfigured) {
        try {
          const payloadSupabase = {
            id: novo.id,
            revendedora_id: novo.revendedora_id,
            valor: Number(novo.valor),
            data: novo.data,
            observacoes: novo.observacoes,
            empresa_id: empId,
          };
          const { error } = await supabase.from("pagamentos_comissao").insert(payloadSupabase);
          if (error) console.warn("Supabase pagamentos_comissao insert:", error.message);
        } catch (err) {
          console.warn("Erro ao salvar pagamento comissao no Supabase:", err);
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.pagamentos_comissao }),
  });
};

export const useApagarPagamentoComissao = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idPag: string) => {
      // 1. Remove localmente
      const d = ler();
      d.pagamentos_comissao = d.pagamentos_comissao.filter((p) => p.id !== idPag);
      gravar(d);

      // 2. Sincroniza exclusão no Supabase
      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase.from("pagamentos_comissao").delete().eq("id", idPag);
          if (error) console.warn("Supabase pagamento comissao delete:", error.message);
        } catch (err) {
          console.warn("Erro ao deletar pagamento de comissão no Supabase:", err);
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.pagamentos_comissao }),
  });
};

export const useSalvarReceitaItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Omit<ReceitaItem, "id">) => {
      const empId = obterEmpresaAtivaId();
      const novo = { ...v, id: id(), empresa_id: empId };
      // Salva localmente primeiro para resposta instantânea e fallback
      const d = ler();
      d.receitas.push(novo);
      gravar(d);

      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase.from("receitas").insert(novo);
          if (error) console.warn("Supabase receitas insert:", error.message);
        } catch (err) {
          console.warn("Erro ao sincronizar receita com Supabase:", err);
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.receitas }),
  });
};

export const useApagarReceitaItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: string) => {
      const d = ler();
      d.receitas = d.receitas.filter((x) => x.id !== v);
      gravar(d);

      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase.from("receitas").delete().eq("id", v);
          if (error) console.warn("Supabase receitas delete:", error.message);
        } catch (err) {
          console.warn("Erro ao remover receita do Supabase:", err);
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.receitas }),
  });
};

export const useAtualizarVenda = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Partial<Venda> & { id: string }) => {
      // 1. Atualiza no cache local primeiro
      const d = ler();
      const idx = d.vendas.findIndex((i) => i.id === v.id);
      if (idx !== -1) {
        let clientesEmbed = v.clientes;
        if (v.cliente_id !== undefined && !clientesEmbed) {
          const cli = d.clientes.find((c) => c.id === v.cliente_id);
          clientesEmbed = cli ? { nome: cli.nome } : null;
        }
        let revEmbed = v.revendedoras;
        if (v.revendedora_id !== undefined && !revEmbed) {
          const rev = d.revendedoras.find((r) => r.id === v.revendedora_id);
          revEmbed = rev ? { nome: rev.nome } : null;
        }

        d.vendas[idx] = {
          ...d.vendas[idx],
          ...v,
          ...(clientesEmbed !== undefined ? { clientes: clientesEmbed } : {}),
          ...(revEmbed !== undefined ? { revendedoras: revEmbed } : {}),
        } as Venda;
        gravar(d);
      }

      // 2. Sincroniza no Supabase com fallback
      if (isSupabaseConfigured) {
        const { id: vendaId, clientes, revendedoras, venda_itens, ...resto } = v;
        try {
          const { error } = await supabase.from("vendas").update(resto).eq("id", vendaId);
          if (error) {
            console.warn("Supabase atualizar venda aviso:", error.message);
            if (error.code === "23514" && resto.pagamento === "pendente") {
              await supabase.from("vendas").update({ ...resto, pagamento: "pix" }).eq("id", vendaId);
            }
          }

          // Se itens da venda foram alterados, sincroniza a tabela de itens
          if (venda_itens && Array.isArray(venda_itens)) {
            const empId = obterEmpresaAtivaId();
            await supabase.from("venda_itens").delete().eq("venda_id", vendaId);
            const novosItens = venda_itens.map((it) => ({
              id: it.id || id(),
              venda_id: vendaId,
              produto_id: it.produto_id,
              nome_produto: it.nome_produto,
              quantidade: Number(it.quantidade) || 1,
              preco_unitario: Number(it.preco_unitario) || 0,
              com_desconto: Boolean(it.com_desconto),
              empresa_id: empId,
            }));
            if (novosItens.length > 0) {
              let { error: errItens } = await supabase.from("venda_itens").insert(novosItens);
              if (errItens && (errItens.message?.includes("com_desconto") || errItens.code === "PGRST204" || errItens.code === "42703")) {
                const fallbackItens = novosItens.map(({ com_desconto, ...r }) => r);
                const { error: errRetry } = await supabase.from("venda_itens").insert(fallbackItens);
                if (!errRetry) errItens = null;
              }
              if (errItens) console.warn("Supabase atualizar venda_itens aviso:", errItens.message);
            }
          }
        } catch (err) {
          console.warn("Erro ao atualizar venda no Supabase:", err);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaves.vendas });
      qc.invalidateQueries({ queryKey: chaves.produtos });
    },
  });
};

export const useApagarVenda = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: string) => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("vendas").delete().eq("id", v);
        if (error) throw error;
      } else {
        const d = ler();
        d.vendas = d.vendas.filter((x) => x.id !== v);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.vendas }),
  });
};

export const useRegistrarVenda = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      itens: ItemCarrinho[];
      clienteId: string | null;
      canal?: "propria" | "revendedora";
      revendedoraId?: string | null;
      data?: string;
      tipo_pedido?: "pronta_entrega" | "sob_encomenda";
      data_entrega_prometida?: string | null;
      valor_sinal_pago?: number;
      saldo_na_entrega?: number;
      status_producao?: "a_fazer" | "fazendo" | "pronto_retirada" | "entregue" | undefined;
      pagamento: Venda["pagamento"];
      status: Venda["status"];
      observacoes: string;
      receitas?: ReceitaItem[];
      insumos?: Insumo[];
    }) => {
      const vendaId = id();
      const total = v.itens.reduce((s, i) => s + i.produto.preco * i.quantidade, 0);
      const receitasList = v.receitas || [];
      const insumosList = v.insumos || [];
      const custo = v.itens.reduce((s, i) => s + (i.produto.custo_manual || custoProduto(i.produto.id, receitasList, insumosList)) * i.quantidade, 0);
      const dataFinal = v.data ? new Date(v.data).toISOString() : new Date().toISOString();

      if (isSupabaseConfigured) {
        const empId = obterEmpresaAtivaId();
        const novaVenda: any = {
          id: vendaId,
          cliente_id: v.clienteId ?? null,
          canal: v.canal ?? "propria",
          revendedora_id: v.canal === "revendedora" ? (v.revendedoraId ?? null) : null,
          data: dataFinal,
          tipo_pedido: v.tipo_pedido ?? "pronta_entrega",
          data_entrega_prometida: v.data_entrega_prometida ?? null,
          valor_sinal_pago: v.valor_sinal_pago ?? total,
          saldo_na_entrega: v.saldo_na_entrega ?? 0,
          status_producao: v.status_producao,
          pagamento: v.pagamento,
          status: v.status,
          total,
          custo_total: custo,
          observacoes: v.observacoes || null,
          empresa_id: empId,
        };

        let { error: errVenda } = await supabase.from("vendas").insert(novaVenda);
        if (errVenda && errVenda.code === "23514" && novaVenda.pagamento === "pendente") {
          // Fallback caso a constraint no banco ainda não tenha sido atualizada com 'pendente'
          const { error: errRetry } = await supabase.from("vendas").insert({ ...novaVenda, pagamento: "pix" });
          if (!errRetry) errVenda = null;
        }
        if (errVenda) throw errVenda;

        const itensParaInserir = v.itens.map((i) => ({
          id: id(),
          venda_id: vendaId,
          produto_id: i.produto.id,
          nome_produto: i.produto.nome,
          quantidade: i.quantidade,
          preco_unitario: i.produto.preco,
          com_desconto: Boolean(i.com_desconto),
          empresa_id: empId,
        }));
        let { error: errItens } = await supabase.from("venda_itens").insert(itensParaInserir);
        if (errItens && (errItens.message?.includes("com_desconto") || errItens.code === "PGRST204" || errItens.code === "42703")) {
          const fallbackItens = itensParaInserir.map(({ com_desconto, ...r }) => r);
          const { error: errRetry } = await supabase.from("venda_itens").insert(fallbackItens);
          if (!errRetry) errItens = null;
        }
        if (errItens) throw errItens;

        // Se for pronta entrega, atualizar estoque
        if (v.tipo_pedido !== "sob_encomenda" && v.canal !== "revendedora") {
          for (const item of v.itens) {
            const novoEstoque = Math.max(0, Number(item.produto.estoque) - item.quantidade);
            await supabase.from("produtos").update({ estoque: novoEstoque }).eq("id", item.produto.id);
          }
        }
      } else {
        const d = ler();
        const cliente = d.clientes.find((c) => c.id === v.clienteId);
        const revendedora = v.canal === "revendedora" && v.revendedoraId ? d.revendedoras.find((r) => r.id === v.revendedoraId) : null;

        const novaVendaObj: Venda = {
          id: vendaId,
          cliente_id: v.clienteId ?? null,
          canal: v.canal ?? "propria",
          revendedora_id: v.canal === "revendedora" ? (v.revendedoraId ?? null) : null,
          data: dataFinal,
          tipo_pedido: v.tipo_pedido ?? "pronta_entrega",
          data_entrega_prometida: v.data_entrega_prometida ?? null,
          valor_sinal_pago: v.valor_sinal_pago ?? total,
          saldo_na_entrega: v.saldo_na_entrega ?? 0,
          status_producao: v.status_producao,
          pagamento: v.pagamento,
          status: v.status,
          total,
          custo_total: custo,
          observacoes: v.observacoes || null,
          clientes: cliente ? { nome: cliente.nome } : null,
          revendedoras: revendedora ? { nome: revendedora.nome } : null,
          venda_itens: v.itens.map((i) => ({
            id: id(),
            venda_id: vendaId,
            produto_id: i.produto.id,
            nome_produto: i.produto.nome,
            quantidade: i.quantidade,
            preco_unitario: i.produto.preco,
            com_desconto: Boolean(i.com_desconto),
          })),
        };

        d.vendas.unshift(novaVendaObj);

        // Se for pronta entrega, baixar estoque de prateleira
        if (v.tipo_pedido !== "sob_encomenda" && v.canal !== "revendedora") {
          for (const item of v.itens) {
            const p = d.produtos.find((x) => x.id === item.produto.id);
            if (p) p.estoque = Math.max(0, Number(p.estoque) - item.quantidade);
          }
        }
        gravar(d);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaves.vendas });
      qc.invalidateQueries({ queryKey: chaves.produtos });
      qc.invalidateQueries({ queryKey: chaves.insumos });
    },
  });
};

export function useProduzirLoteEstoque() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      produtoId,
      quantidadeProduzida,
      baixarMateriais = true,
      tipoDestino = "pronto",
    }: {
      produtoId: string;
      quantidadeProduzida: number;
      baixarMateriais?: boolean | undefined;
      tipoDestino?: "pronto" | "congelado" | undefined;
    }) => {
      const dados = ler();
      const produtosCache = qc.getQueryData<Produto[]>(chaves.produtos) || [];
      let prod = dados.produtos.find((p: Produto) => p.id === produtoId) || produtosCache.find((p) => p.id === produtoId);
      
      if (!prod && isSupabaseConfigured) {
        try {
          const { data } = await supabase.from("produtos").select("*").eq("id", produtoId).maybeSingle();
          if (data) prod = data as Produto;
        } catch (e) {
          console.warn("Supabase buscar produto aviso:", e);
        }
      }

      if (prod) {
        const idx = dados.produtos.findIndex((p) => p.id === prod!.id);
        if (idx >= 0) {
          dados.produtos[idx] = { ...dados.produtos[idx], ...prod };
          prod = dados.produtos[idx];
        } else {
          dados.produtos.push(prod);
        }

        if (tipoDestino === "congelado") {
          prod.estoque_congelado = (Number(prod.estoque_congelado) || 0) + quantidadeProduzida;
        } else {
          prod.estoque = (Number(prod.estoque) || 0) + quantidadeProduzida;
          if (isSupabaseConfigured) {
            try {
              await supabase.from("produtos").update({ estoque: prod.estoque }).eq("id", prod.id);
            } catch (e) {
              console.warn("Supabase update estoque:", e);
            }
          }
        }
      }

      if (baixarMateriais && prod) {
        const receitasCache = qc.getQueryData<ReceitaItem[]>(chaves.receitas) || dados.receitas;
        const insumosCache = qc.getQueryData<Insumo[]>(chaves.insumos) || dados.insumos;
        const itensReceita = receitasCache.filter((r: ReceitaItem) => r.produto_id === produtoId);
        const rendimento = Math.max(Number(prod?.rendimento_unidades || 1), 1);
        const fator = quantidadeProduzida / rendimento;
        for (const r of itensReceita) {
          const ins = dados.insumos.find((i: Insumo) => i.id === r.insumo_id) || insumosCache.find((i) => i.id === r.insumo_id);
          if (ins) {
            ins.quantidade = Math.max(0, Number(ins.quantidade) - Number(r.quantidade) * fator);
            if (isSupabaseConfigured) {
              try {
                await supabase.from("insumos").update({ quantidade: ins.quantidade }).eq("id", ins.id);
              } catch (e) {
                console.warn("Supabase update insumo:", e);
              }
            }
          }
        }
      }
      gravar(dados);
      return prod;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaves.produtos });
      qc.invalidateQueries({ queryKey: chaves.insumos });
    },
  });
}

export function useAssarFornada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      produtoId,
      quantidadeAssada,
    }: {
      produtoId: string;
      quantidadeAssada: number;
    }) => {
      const dados = ler();
      const produtosCache = qc.getQueryData<Produto[]>(chaves.produtos) || [];
      let prod = dados.produtos.find((p: Produto) => p.id === produtoId) || produtosCache.find((p) => p.id === produtoId);
      
      if (!prod && isSupabaseConfigured) {
        try {
          const { data } = await supabase.from("produtos").select("*").eq("id", produtoId).maybeSingle();
          if (data) prod = data as Produto;
        } catch (e) {
          console.warn("Supabase buscar produto aviso:", e);
        }
      }

      if (prod) {
        const idx = dados.produtos.findIndex((p) => p.id === prod!.id);
        if (idx >= 0) {
          dados.produtos[idx] = { ...dados.produtos[idx], ...prod };
          prod = dados.produtos[idx];
        } else {
          dados.produtos.push(prod);
        }

        const congeladoAtual = Number(prod.estoque_congelado || 0);
        prod.estoque_congelado = Math.max(0, congeladoAtual - quantidadeAssada);
        prod.estoque = (Number(prod.estoque) || 0) + quantidadeAssada;
        gravar(dados);

        if (isSupabaseConfigured) {
          try {
            await supabase.from("produtos").update({ estoque: prod.estoque }).eq("id", prod.id);
          } catch (e) {
            console.warn("Supabase update estoque:", e);
          }
        }
      }
      return prod;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaves.produtos });
    },
  });
}

export function useCriarOrdemLoteOuFornada() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tipo,
      produtoId,
      produto,
      quantidade,
      tipoDestino = "pronto",
      baixarMateriais = true,
      observacoes,
    }: {
      tipo: "producao_lote" | "fornada_freezer";
      produtoId: string;
      produto?: Produto;
      quantidade: number;
      tipoDestino?: "pronto" | "congelado";
      baixarMateriais?: boolean;
      observacoes?: string;
    }) => {
      const dados = ler();
      const produtosCache = qc.getQueryData<Produto[]>(chaves.produtos) || [];
      
      let prod: Produto | undefined =
        produto ||
        produtosCache.find((p) => p.id === produtoId) ||
        dados.produtos.find((p) => p.id === produtoId);

      if (!prod && isSupabaseConfigured) {
        try {
          const { data } = await supabase.from("produtos").select("*").eq("id", produtoId).maybeSingle();
          if (data) {
            prod = data as Produto;
          }
        } catch (err) {
          console.warn("Supabase buscar produto aviso:", err);
        }
      }

      // Fallback por nome
      if (!prod) {
        prod =
          produtosCache.find((p) => p.nome.toLowerCase() === produtoId.toLowerCase()) ||
          dados.produtos.find((p) => p.nome.toLowerCase() === produtoId.toLowerCase());
      }

      if (!prod) throw new Error("Produto não encontrado.");

      // Garante que o produto existe em dados.produtos para próximas operações locais
      const idx = dados.produtos.findIndex((p) => p.id === prod!.id);
      if (idx >= 0) {
        dados.produtos[idx] = { ...dados.produtos[idx], ...prod };
        prod = dados.produtos[idx];
      } else {
        dados.produtos.push(prod);
      }

      if (tipo === "fornada_freezer") {
        const congeladoAtual = Number(prod.estoque_congelado || 0);
        if (congeladoAtual < quantidade || congeladoAtual <= 0) {
          throw new Error(
            `Estoque congelado insuficiente! Há apenas ${congeladoAtual} un de "${prod.nome}" no freezer (solicitado: ${quantidade} un).`
          );
        }
      }

      if (tipo === "producao_lote" && baixarMateriais) {
        const receitasCache = qc.getQueryData<ReceitaItem[]>(chaves.receitas) || dados.receitas;
        const insumosCache = qc.getQueryData<Insumo[]>(chaves.insumos) || dados.insumos;
        const itensReceita = receitasCache.filter((r) => r.produto_id === prod!.id);
        const rendimento = Math.max(Number(prod.rendimento_unidades || 1), 1);
        const fator = quantidade / rendimento;
        for (const r of itensReceita) {
          const ins = insumosCache.find((i) => i.id === r.insumo_id) || dados.insumos.find((i) => i.id === r.insumo_id);
          const necessitado = Number(r.quantidade) * fator;
          const disponivel = Number(ins?.quantidade || 0);
          if (disponivel < necessitado) {
            throw new Error(
              `Ingrediente insuficiente: "${ins?.nome || "Insumo"}" tem ${disponivel} ${ins?.unidade || "un"} (necessário: ${necessitado.toFixed(1)} ${ins?.unidade || "un"}).`
            );
          }
        }
      }

      const novaVendaId = id();
      const novaOrdem: Venda = {
        id: novaVendaId,
        cliente_id: null,
        canal: "propria",
        revendedora_id: null,
        data: new Date().toISOString(),
        tipo_pedido: tipo,
        data_entrega_prometida: new Date().toISOString().split("T")[0],
        valor_sinal_pago: 0,
        saldo_na_entrega: 0,
        status_producao: "a_fazer",
        pagamento: "pix",
        status: "pendente",
        total: 0,
        custo_total: 0,
        tipo_destino_lote: tipoDestino,
        baixar_insumos_lote: baixarMateriais,
        observacoes:
          observacoes ||
          (tipo === "fornada_freezer"
            ? `Assar fornada de ${quantidade} un do freezer para a vitrine`
            : tipoDestino === "congelado"
            ? `Produção de lote para guardar no freezer (para assar)`
            : `Produção de lote para vitrine pronta-entrega`),
        clientes: {
          nome: tipo === "fornada_freezer" ? "🔥 Fornada do Freezer" : "📦 Lote de Produção",
        },
        revendedoras: null,
        venda_itens: [
          {
            id: id(),
            venda_id: novaVendaId,
            produto_id: prod.id,
            nome_produto: prod.nome,
            quantidade,
            preco_unitario: prod.preco,
          },
        ],
      };

      dados.vendas.unshift(novaOrdem);
      gravar(dados);

      if (isSupabaseConfigured) {
        try {
          const empId = obterEmpresaAtivaId();
          await supabase.from("vendas").insert({
            id: novaVendaId,
            canal: "propria",
            data: novaOrdem.data,
            pagamento: "pix",
            status: "pendente",
            total: 0,
            custo_total: 0,
            observacoes: novaOrdem.observacoes,
            empresa_id: empId,
          });
          await supabase.from("venda_itens").insert([
            {
              id: id(),
              venda_id: novaVendaId,
              produto_id: prod.id,
              nome_produto: prod.nome,
              quantidade,
              preco_unitario: prod.preco,
              empresa_id: empId,
            },
          ]);
        } catch (sbErr) {
          console.warn("Aviso ao persistir ordem no Supabase:", sbErr);
        }
      }

      return novaOrdem;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaves.vendas });
      qc.invalidateQueries({ queryKey: chaves.produtos });
      qc.invalidateQueries({ queryKey: chaves.insumos });
    },
  });
}

export function useAtualizarStatusProducao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      vendaId,
      novoStatus,
      baixarMateriais = false,
    }: {
      vendaId: string;
      novoStatus: "a_fazer" | "fazendo" | "pronto_retirada" | "entregue";
      baixarMateriais?: boolean;
    }) => {
      const dados = ler();
      let venda = dados.vendas.find((v: Venda) => v.id === vendaId);
      if (!venda) {
        const vendasCache = qc.getQueryData<Venda[]>(chaves.vendas) || [];
        const vCache = vendasCache.find((v) => v.id === vendaId);
        if (vCache) {
          venda = { ...vCache };
          dados.vendas.push(venda);
        }
      }
      if (!venda) throw new Error("Ordem não encontrada.");

      const produtosCache = qc.getQueryData<Produto[]>(chaves.produtos) || [];
      const acharProduto = (prodId?: string | null) => {
        if (!prodId) return undefined;
        let p = dados.produtos.find((x) => x.id === prodId) || produtosCache.find((x) => x.id === prodId);
        if (p && !dados.produtos.some((x) => x.id === p!.id)) {
          dados.produtos.push(p);
        }
        return p;
      };

      // 1. SE FOR FORNADA DO FREEZER (ASSAR) CONCLUÍDA
      if (venda.tipo_pedido === "fornada_freezer" && (novoStatus === "pronto_retirada" || novoStatus === "entregue")) {
        for (const item of venda.venda_itens || []) {
          if (item.produto_id) {
            const prod = acharProduto(item.produto_id);
            if (prod) {
              const congeladoAtual = Number(prod.estoque_congelado || 0);
              const qtd = Number(item.quantidade);
              // BLOQUEIO RIGOROSO:
              if (congeladoAtual < qtd) {
                throw new Error(
                  `Não é possível sinalizar como assado! O estoque congelado no freezer é insuficiente (disponível: ${congeladoAtual} un, necessário: ${qtd} un de "${prod.nome}").`
                );
              }
              prod.estoque_congelado = Math.max(0, congeladoAtual - qtd);
              prod.estoque = (Number(prod.estoque) || 0) + qtd;

              if (isSupabaseConfigured) {
                try {
                  await supabase.from("produtos").update({ estoque: prod.estoque }).eq("id", prod.id);
                } catch (e) {
                  console.warn("Supabase update estoque:", e);
                }
              }
            }
          }
        }
      }

      // 2. SE FOR LOTE DE PRODUÇÃO CONCLUÍDO
      if (venda.tipo_pedido === "producao_lote" && (novoStatus === "pronto_retirada" || novoStatus === "entregue")) {
        const deveBaixar = venda.baixar_insumos_lote !== false;
        for (const item of venda.venda_itens || []) {
          if (item.produto_id) {
            const prod = acharProduto(item.produto_id);
            const qtd = Number(item.quantidade);
            if (prod) {
              if (deveBaixar) {
                const receitasCache = qc.getQueryData<ReceitaItem[]>(chaves.receitas) || dados.receitas;
                const itensReceita = receitasCache.filter((r: ReceitaItem) => r.produto_id === item.produto_id);
                const rend = Math.max(Number(prod.rendimento_unidades || 1), 1);
                const fator = qtd / rend;

                // Validação de ingredientes antes de baixar
                for (const r of itensReceita) {
                  const ins = dados.insumos.find((i: Insumo) => i.id === r.insumo_id);
                  const necessitado = Number(r.quantidade) * fator;
                  const disponivel = Number(ins?.quantidade || 0);
                  if (disponivel < necessitado) {
                    throw new Error(
                      `Não é possível concluir: falta o ingrediente "${ins?.nome || "Insumo"}" no estoque (disponível: ${disponivel} ${ins?.unidade || "un"}, necessário: ${necessitado.toFixed(1)} ${ins?.unidade || "un"}).`
                    );
                  }
                }

                // Baixa nos insumos
                for (const r of itensReceita) {
                  const ins = dados.insumos.find((i: Insumo) => i.id === r.insumo_id);
                  if (ins) {
                    ins.quantidade = Math.max(0, Number(ins.quantidade) - Number(r.quantidade) * fator);
                    if (isSupabaseConfigured) {
                      try {
                        await supabase.from("insumos").update({ quantidade: ins.quantidade }).eq("id", ins.id);
                      } catch (e) {
                        console.warn("Supabase update insumo:", e);
                      }
                    }
                  }
                }
              }

              // Incrementa estoque conforme destino escolhido
              if (venda.tipo_destino_lote === "congelado") {
                prod.estoque_congelado = (Number(prod.estoque_congelado) || 0) + qtd;
              } else {
                prod.estoque = (Number(prod.estoque) || 0) + qtd;
                if (isSupabaseConfigured) {
                  try {
                    await supabase.from("produtos").update({ estoque: prod.estoque }).eq("id", prod.id);
                  } catch (e) {
                    console.warn("Supabase update estoque:", e);
                  }
                }
              }
            }
          }
        }
      }

      // 3. SE FOR ENCOMENDA DE CLIENTE COM BAIXA DE INSUMOS
      if (venda.tipo_pedido === "sob_encomenda" && baixarMateriais && (novoStatus === "pronto_retirada" || novoStatus === "entregue")) {
        for (const item of venda.venda_itens || []) {
          if (item.produto_id) {
            const receitasCache = qc.getQueryData<ReceitaItem[]>(chaves.receitas) || dados.receitas;
            const itensReceita = receitasCache.filter((r: ReceitaItem) => r.produto_id === item.produto_id);
            const prod = acharProduto(item.produto_id);
            const rend = Math.max(Number(prod?.rendimento_unidades || 1), 1);
            const fator = Number(item.quantidade) / rend;
            for (const r of itensReceita) {
              const ins = dados.insumos.find((i: Insumo) => i.id === r.insumo_id);
              if (ins) {
                ins.quantidade = Math.max(0, Number(ins.quantidade) - Number(r.quantidade) * fator);
                if (isSupabaseConfigured) {
                  try {
                    await supabase.from("insumos").update({ quantidade: ins.quantidade }).eq("id", ins.id);
                  } catch (e) {
                    console.warn("Supabase update insumo:", e);
                  }
                }
              }
            }
          }
        }
      }

      venda.status_producao = novoStatus;
      if (novoStatus === "entregue") {
        venda.status = "pago";
        venda.saldo_na_entrega = 0;
      }
      gravar(dados);
      return venda;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaves.vendas });
      qc.invalidateQueries({ queryKey: chaves.produtos });
      qc.invalidateQueries({ queryKey: chaves.insumos });
    },
  });
}


export const useSalvarRemessaConsignacao = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: {
      id?: string;
      revendedora_id: string;
      produto_id: string;
      nome_produto: string;
      quantidade: number;
      data?: string;
      observacoes?: string | null;
      baixar_estoque_atelie?: boolean;
    }) => {
      const empId = obterEmpresaAtivaId();
      const nova: RemessaConsignacao = {
        id: v.id ?? id(),
        empresa_id: empId,
        revendedora_id: v.revendedora_id,
        produto_id: v.produto_id,
        nome_produto: v.nome_produto,
        quantidade: Number(v.quantidade) || 0,
        data: v.data || new Date().toISOString(),
        observacoes: v.observacoes || null,
        baixar_estoque_atelie: v.baixar_estoque_atelie ?? true,
      };

      const d = ler();
      if (!d.remessas_consignacao) d.remessas_consignacao = [];
      const pos = d.remessas_consignacao.findIndex((x) => x.id === nova.id);
      if (pos >= 0) {
        d.remessas_consignacao[pos] = nova;
      } else {
        d.remessas_consignacao.unshift(nova);
        // Se solicitado, baixa do estoque do ateliê
        if (nova.baixar_estoque_atelie) {
          const prod = d.produtos.find((p) => p.id === nova.produto_id);
          if (prod) {
            prod.estoque = Math.max(0, Number(prod.estoque || 0) - nova.quantidade);
          }
        }
      }
      gravar(d);

      if (isSupabaseConfigured) {
        try {
          const { error } = await supabase.from("remessas_consignacao").upsert(nova);
          if (error) console.warn("Supabase remessa upsert:", error.message);
          if (nova.baixar_estoque_atelie) {
            const prod = d.produtos.find((p) => p.id === nova.produto_id);
            if (prod) {
              await supabase.from("produtos").update({ estoque: prod.estoque }).eq("id", prod.id);
            }
          }
        } catch (err) {
          console.warn("Erro ao sincronizar remessa com Supabase:", err);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaves.remessas_consignacao });
      qc.invalidateQueries({ queryKey: chaves.produtos });
    },
  });
};

export const useApagarRemessaConsignacao = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (remessaId: string) => {
      const d = ler();
      if (d.remessas_consignacao) {
        d.remessas_consignacao = d.remessas_consignacao.filter((r) => r.id !== remessaId);
        gravar(d);
      }
      if (isSupabaseConfigured) {
        try {
          await supabase.from("remessas_consignacao").delete().eq("id", remessaId);
        } catch (err) {
          console.warn("Supabase remessa delete:", err);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chaves.remessas_consignacao });
      qc.invalidateQueries({ queryKey: chaves.produtos });
    },
  });
};

export function calcularEstoqueConsignadoRevendedor(
  revendedoraId: string,
  remessas: RemessaConsignacao[],
  vendas: Venda[],
  produtos: Produto[]
): ItemEstoqueConsignado[] {
  const remessasDoRevendedor = remessas.filter((r) => r.revendedora_id === revendedoraId);
  const vendasProntaEntrega = vendas.filter(
    (v) =>
      v.status !== "cancelado" &&
      v.canal === "revendedora" &&
      v.revendedora_id === revendedoraId &&
      v.tipo_pedido !== "sob_encomenda"
  );

  const mapa = new Map<string, { nome: string; entregue: number; vendido: number }>();

  remessasDoRevendedor.forEach((r) => {
    const atual = mapa.get(r.produto_id) || { nome: r.nome_produto, entregue: 0, vendido: 0 };
    atual.entregue += Number(r.quantidade || 0);
    if (!atual.nome && r.nome_produto) atual.nome = r.nome_produto;
    mapa.set(r.produto_id, atual);
  });

  vendasProntaEntrega.forEach((v) => {
    (v.venda_itens || []).forEach((item) => {
      if (!item.produto_id) return;
      const atual = mapa.get(item.produto_id) || { nome: item.nome_produto, entregue: 0, vendido: 0 };
      atual.vendido += Number(item.quantidade || 0);
      mapa.set(item.produto_id, atual);
    });
  });

  const lista: ItemEstoqueConsignado[] = [];

  mapa.forEach((dados, produtoId) => {
    const prod = produtos.find((p) => p.id === produtoId);
    const nomeProduto = prod?.nome || dados.nome;
    const preco = prod?.preco || 0;
    const saldo = Math.max(0, dados.entregue - dados.vendido);
    const minimoAlerta = 3;
    const precisaReposicao = saldo <= minimoAlerta;
    const status: ItemEstoqueConsignado["status"] = saldo === 0 ? "esgotado" : saldo <= minimoAlerta ? "critico" : "ok";
    const qtdSugerida = precisaReposicao ? Math.max(5, 10 - saldo) : 0;

    lista.push({
      produto_id: produtoId,
      nome_produto: nomeProduto,
      categoria: prod?.categoria,
      preco_unitario: preco,
      total_entregue: dados.entregue,
      total_vendido: dados.vendido,
      saldo_atual: saldo,
      minimo_alerta: minimoAlerta,
      precisa_reposicao: precisaReposicao,
      qtd_sugerida_reposicao: qtdSugerida,
      status,
    });
  });

  return lista.sort((a, b) => a.saldo_atual - b.saldo_atual);
}

export function obterAlertasReposicaoRevendedores(
  revendedoras: Revendedora[],
  remessas: RemessaConsignacao[],
  vendas: Venda[],
  produtos: Produto[]
): AlertaReposicaoConsignado[] {
  const alertas: AlertaReposicaoConsignado[] = [];
  const revendedores = revendedoras.filter((r) => r.categoria_parceria !== "parceiro");

  for (const rev of revendedores) {
    const itens = calcularEstoqueConsignadoRevendedor(rev.id, remessas, vendas, produtos);
    for (const item of itens) {
      if (item.precisa_reposicao) {
        alertas.push({
          revendedora_id: rev.id,
          nome_revendedora: rev.nome,
          telefone_revendedora: rev.telefone,
          produto_id: item.produto_id,
          nome_produto: item.nome_produto,
          saldo_atual: item.saldo_atual,
          minimo_alerta: item.minimo_alerta,
          qtd_sugerida_reposicao: item.qtd_sugerida_reposicao,
          status: item.status === "esgotado" ? "esgotado" : "critico",
        });
      }
    }
  }

  return alertas;
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "./supabase";

export type Insumo = { id: string; nome: string; tipo: "ingrediente" | "material"; unidade: string; quantidade: number; minimo: number; custo_unitario: number };
export type Produto = {
  id: string;
  nome: string;
  categoria: string;
  preco: number;
  estoque: number;
  ativo: boolean;
  tempo_preparo_minutos?: number;
  valor_hora_trabalho?: number;
  rendimento_unidades?: number;
};
export type Cliente = {
  id: string;
  nome: string;
  telefone: string | null;
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  complemento: string | null;
  observacoes: string | null;
};
export type Revendedora = {
  id: string;
  nome: string;
  telefone: string | null;
  tipo_comissao: "porcentagem" | "valor_fixo";
  comissao_percentual: number;
  comissao_fixa: number;
  observacoes: string | null;
  cliente_ids?: string[];
};
export type PagamentoComissao = {
  id: string;
  revendedora_id: string;
  valor: number;
  data: string;
  observacoes: string | null;
};
export type Categoria = {
  id: string;
  nome: string;
};
export type ReceitaItem = { id: string; produto_id: string; insumo_id: string; quantidade: number };
export type VendaItem = { id: string; venda_id: string; produto_id: string | null; nome_produto: string; quantidade: number; preco_unitario: number };
export type Venda = {
  id: string;
  cliente_id: string | null;
  canal: "propria" | "revendedora";
  revendedora_id: string | null;
  data: string;
  pagamento: "pix" | "dinheiro" | "cartao" | "transferencia";
  status: "pago" | "pendente" | "cancelado";
  total: number;
  custo_total: number;
  observacoes: string | null;
  venda_itens: VendaItem[];
  clientes: { nome: string } | null;
  revendedoras?: { nome: string } | null;
};
export type ItemCarrinho = { produto: Produto; quantidade: number };

type Dados = {
  insumos: Insumo[];
  produtos: Produto[];
  clientes: Cliente[];
  receitas: ReceitaItem[];
  vendas: Venda[];
  revendedoras: Revendedora[];
  pagamentos_comissao: PagamentoComissao[];
  categorias: Categoria[];
};

const CHAVE = "meu-atelie-dados-v7";
const haDias = (dias: number, hora = 14) => { const d = new Date(); d.setDate(d.getDate() - dias); d.setHours(hora, 0, 0, 0); return d.toISOString(); };

const iniciais: Dados = {
  insumos: [
    { id: "ins_1", nome: "Farinha de Trigo Premium", tipo: "ingrediente", unidade: "kg", quantidade: 15, minimo: 5, custo_unitario: 6.5 },
    { id: "ins_2", nome: "Chocolate 70% Cacau", tipo: "ingrediente", unidade: "kg", quantidade: 6, minimo: 3, custo_unitario: 38.0 },
    { id: "ins_3", nome: "Leite Condensado 395g", tipo: "ingrediente", unidade: "un", quantidade: 30, minimo: 10, custo_unitario: 5.9 },
    { id: "ins_4", nome: "Manteiga Sem Sal", tipo: "ingrediente", unidade: "kg", quantidade: 4, minimo: 2, custo_unitario: 32.0 },
    { id: "ins_5", nome: "Embalagem Torta Luxo", tipo: "material", unidade: "un", quantidade: 8, minimo: 15, custo_unitario: 4.2 }
  ],
  produtos: [
    { id: "prod_1", nome: "Bolo Vulcão Ninho com Nutella", categoria: "Bolos & Tortas", preco: 85.0, estoque: 14, ativo: true, tempo_preparo_minutos: 45, rendimento_unidades: 1 },
    { id: "prod_2", nome: "Caixa 12 Brigadeiros Gourmet", categoria: "Doces Gourmet", preco: 36.0, estoque: 28, ativo: true, tempo_preparo_minutos: 20, rendimento_unidades: 12 },
    { id: "prod_3", nome: "Torta Holandesa Especial", categoria: "Bolos & Tortas", preco: 110.0, estoque: 6, ativo: true, tempo_preparo_minutos: 60, rendimento_unidades: 1 },
    { id: "prod_4", nome: "Empadão de Frango com Requeijão", categoria: "Salgados", preco: 68.0, estoque: 10, ativo: true, tempo_preparo_minutos: 40, rendimento_unidades: 1 }
  ],
  categorias: [
    { id: "cat_1", nome: "Bolos & Tortas" },
    { id: "cat_2", nome: "Doces Gourmet" },
    { id: "cat_3", nome: "Salgados" }
  ],
  clientes: [
    { id: "cli_1", nome: "Mariana Souza", telefone: "(11) 98877-6655", rua: "Av. Paulista", numero: "1000", bairro: "Bela Vista", complemento: "Apt 42", observacoes: "Cliente VIP" },
    { id: "cli_2", nome: "Fernanda Oliveira", telefone: "(11) 97766-5544", rua: "Rua Augusta", numero: "500", bairro: "Consolação", complemento: null, observacoes: null }
  ],
  revendedoras: [
    { id: "rev_1", nome: "Café & Doce Parceiro", telefone: "(11) 95544-3322", tipo_comissao: "porcentagem", comissao_percentual: 15, comissao_fixa: 0, observacoes: "Entregas terças e quintas" }
  ],
  pagamentos_comissao: [],
  receitas: [],
  vendas: [
    {
      id: "vnd_1",
      cliente_id: "cli_1",
      canal: "propria",
      revendedora_id: null,
      data: haDias(0),
      pagamento: "pix",
      status: "pago",
      total: 121.0,
      custo_total: 42.0,
      observacoes: "Entrega agendada para às 16h",
      venda_itens: [
        { id: "vi_1", venda_id: "vnd_1", produto_id: "prod_1", nome_produto: "Bolo Vulcão Ninho com Nutella", quantidade: 1, preco_unitario: 85.0 },
        { id: "vi_2", venda_id: "vnd_1", produto_id: "prod_2", nome_produto: "Caixa 12 Brigadeiros Gourmet", quantidade: 1, preco_unitario: 36.0 }
      ],
      clientes: { nome: "Mariana Souza" },
      revendedoras: null
    },
    {
      id: "vnd_2",
      cliente_id: "cli_2",
      canal: "revendedora",
      revendedora_id: "rev_1",
      data: haDias(1),
      pagamento: "cartao",
      status: "pago",
      total: 220.0,
      custo_total: 80.0,
      observacoes: "Venda consignada café",
      venda_itens: [
        { id: "vi_3", venda_id: "vnd_2", produto_id: "prod_3", nome_produto: "Torta Holandesa Especial", quantidade: 2, preco_unitario: 110.0 }
      ],
      clientes: { nome: "Fernanda Oliveira" },
      revendedoras: { nome: "Café & Doce Parceiro" }
    },
    {
      id: "vnd_3",
      cliente_id: "cli_1",
      canal: "propria",
      revendedora_id: null,
      data: haDias(2),
      pagamento: "pix",
      status: "pago",
      total: 153.0,
      custo_total: 55.0,
      observacoes: null,
      venda_itens: [
        { id: "vi_4", venda_id: "vnd_3", produto_id: "prod_1", nome_produto: "Bolo Vulcão Ninho com Nutella", quantidade: 1, preco_unitario: 85.0 },
        { id: "vi_5", venda_id: "vnd_3", produto_id: "prod_4", nome_produto: "Empadão de Frango com Requeijão", quantidade: 1, preco_unitario: 68.0 }
      ],
      clientes: { nome: "Mariana Souza" },
      revendedoras: null
    }
  ]
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

function ler(): Dados {
  if (typeof window === "undefined") return clone(iniciais);
  
  // Limpar chaves antigas de dados mockados se existirem
  ["meu-atelie-dados-mocados-v2", "meu-atelie-dados-v3", "meu-atelie-dados-v4"].forEach((k) => {
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
};

// HOOKS DE CONSULTA (SUPABASE + LOCALSTORAGE FALLBACK)
export const useInsumos = () => useQuery({
  queryKey: chaves.insumos,
  queryFn: async () => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from("insumos").select("*");
      if (error) throw error;
      return (data || []) as Insumo[];
    }
    return ler().insumos;
  }
});

export const useProdutos = () => useQuery({
  queryKey: chaves.produtos,
  queryFn: async () => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from("produtos").select("*");
      if (error) throw error;
      return (data || []) as Produto[];
    }
    return ler().produtos;
  }
});

export const useClientes = () => useQuery({
  queryKey: chaves.clientes,
  queryFn: async () => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from("clientes").select("*");
      if (error) throw error;
      return (data || []) as Cliente[];
    }
    return ler().clientes;
  }
});

export const useReceitas = () => useQuery({
  queryKey: chaves.receitas,
  queryFn: async () => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from("receitas").select("*");
      if (error) throw error;
      return (data || []) as ReceitaItem[];
    }
    return ler().receitas;
  }
});

export const useVendas = () => useQuery({
  queryKey: chaves.vendas,
  queryFn: async () => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from("vendas")
        .select("*, clientes(nome), revendedoras(nome), venda_itens(*)")
        .order("data", { ascending: false });
      if (error) throw error;
      return (data || []) as Venda[];
    }
    return ler().vendas;
  }
});

export const useRevendedoras = () => useQuery({
  queryKey: chaves.revendedoras,
  queryFn: async () => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from("revendedoras").select("*");
      if (error) throw error;
      return (data || []) as Revendedora[];
    }
    return ler().revendedoras;
  }
});

export const usePagamentosComissao = () => useQuery({
  queryKey: chaves.pagamentos_comissao,
  queryFn: async () => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from("pagamentos_comissao").select("*").order("data", { ascending: false });
      if (error) throw error;
      return (data || []) as PagamentoComissao[];
    }
    return ler().pagamentos_comissao;
  }
});

export const useCategorias = () => useQuery({
  queryKey: chaves.categorias,
  queryFn: async () => {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from("categorias").select("*");
      if (error) throw error;
      return (data || []) as Categoria[];
    }
    return ler().categorias;
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

export function statusInsumo(i: Insumo) {
  return i.quantidade <= 0 ? "acabou" as const : i.quantidade <= i.minimo ? "baixo" as const : "ok" as const;
}

export function calcularComissaoRevendedora(venda: Venda, revendedora?: Revendedora | null): number {
  if (venda.canal !== "revendedora" || !revendedora) return 0;
  if (venda.status === "cancelado") return 0;
  
  if (revendedora.tipo_comissao === "valor_fixo") {
    const qtdItens = venda.venda_itens.reduce((s, i) => s + i.quantidade, 0);
    return qtdItens * Number(revendedora.comissao_fixa ?? 0);
  }
  
  return Number(venda.total) * (Number(revendedora.comissao_percentual ?? 0) / 100);
}

export function calcularComissaoEstimadaCarrinho(
  carrinho: ItemCarrinho[],
  revendedora?: Revendedora | null
): number {
  if (!revendedora) return 0;
  const qtdTotal = carrinho.reduce((s, i) => s + i.quantidade, 0);
  const valorTotal = carrinho.reduce((s, i) => s + Number(i.produto.preco) * i.quantidade, 0);
  
  if (revendedora.tipo_comissao === "valor_fixo") {
    return qtdTotal * Number(revendedora.comissao_fixa ?? 0);
  }
  
  return valorTotal * (Number(revendedora.comissao_percentual ?? 0) / 100);
}

// MUTATIONS COM SUPABASE + FALLBACK
export const useSalvarInsumo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Partial<Insumo>) => {
      const item = { id: v.id ?? id(), nome: v.nome ?? "", tipo: v.tipo ?? "ingrediente", unidade: v.unidade ?? "kg", quantidade: Number(v.quantidade ?? 0), minimo: Number(v.minimo ?? 0), custo_unitario: Number(v.custo_unitario ?? 0) };
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("insumos").upsert(item);
        if (error) throw error;
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
      const catNome = (v.categoria ?? "bolo").trim().toLowerCase();
      const novo = { id: v.id ?? id(), nome: v.nome ?? "", categoria: catNome, preco: Number(v.preco ?? 0), estoque: Number(v.estoque ?? 0), ativo: v.ativo ?? true };
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("produtos").upsert(novo);
        if (error) throw error;
        if (catNome) {
          await supabase.from("categorias").upsert({ id: id(), nome: catNome }, { onConflict: "nome" }).select();
        }
      } else {
        const d = ler();
        const pos = d.produtos.findIndex((x) => x.id === novo.id);
        pos >= 0 ? d.produtos.splice(pos, 1, novo) : d.produtos.push(novo);
        if (catNome && !d.categorias.some((c) => c.nome.toLowerCase() === catNome)) {
          d.categorias.push({ id: id(), nome: catNome });
        }
        gravar(d);
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
      const nomeLimpo = nomeCat.trim().toLowerCase();
      if (!nomeLimpo) return;
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("categorias").insert({ id: id(), nome: nomeLimpo });
        if (error) throw error;
      } else {
        const d = ler();
        if (!d.categorias.some((c) => c.nome.toLowerCase() === nomeLimpo)) {
          d.categorias.push({ id: id(), nome: nomeLimpo });
          gravar(d);
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
      const novo: Cliente = {
        id: v.id ?? id(),
        nome: v.nome ?? "",
        telefone: v.telefone ?? null,
        rua: v.rua ?? null,
        numero: v.numero ?? null,
        bairro: v.bairro ?? null,
        complemento: v.complemento ?? null,
        observacoes: v.observacoes ?? null,
      };
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("clientes").upsert(novo);
        if (error) throw error;
      } else {
        const d = ler();
        const pos = d.clientes.findIndex((x) => x.id === novo.id);
        pos >= 0 ? d.clientes.splice(pos, 1, novo) : d.clientes.push(novo);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.clientes }),
  });
};

export const useApagarCliente = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: string) => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("clientes").delete().eq("id", v);
        if (error) throw error;
      } else {
        const d = ler();
        d.clientes = d.clientes.filter((x) => x.id !== v);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.clientes }),
  });
};

export const useSalvarRevendedora = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Partial<Revendedora>) => {
      const novo: Revendedora = {
        id: v.id ?? id(),
        nome: v.nome ?? "",
        telefone: v.telefone ?? null,
        tipo_comissao: v.tipo_comissao ?? "porcentagem",
        comissao_percentual: Number(v.comissao_percentual ?? 0),
        comissao_fixa: Number(v.comissao_fixa ?? 0),
        observacoes: v.observacoes ?? null,
        cliente_ids: v.cliente_ids ?? [],
      };
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("revendedoras").upsert(novo);
        if (error) throw error;
      } else {
        const d = ler();
        const pos = d.revendedoras.findIndex((x) => x.id === novo.id);
        pos >= 0 ? d.revendedoras.splice(pos, 1, novo) : d.revendedoras.push(novo);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.revendedoras }),
  });
};

export const useApagarRevendedora = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: string) => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("revendedoras").delete().eq("id", v);
        if (error) throw error;
      } else {
        const d = ler();
        d.revendedoras = d.revendedoras.filter((x) => x.id !== v);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.revendedoras }),
  });
};

export const useSalvarPagamentoComissao = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Omit<PagamentoComissao, "id">) => {
      const novo = { ...v, id: id() };
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("pagamentos_comissao").insert(novo);
        if (error) throw error;
      } else {
        const d = ler();
        d.pagamentos_comissao.unshift(novo);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.pagamentos_comissao }),
  });
};

export const useApagarPagamentoComissao = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idPag: string) => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("pagamentos_comissao").delete().eq("id", idPag);
        if (error) throw error;
      } else {
        const d = ler();
        d.pagamentos_comissao = d.pagamentos_comissao.filter((p) => p.id !== idPag);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.pagamentos_comissao }),
  });
};

export const useSalvarReceitaItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: Omit<ReceitaItem, "id">) => {
      const novo = { ...v, id: id() };
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("receitas").insert(novo);
        if (error) throw error;
      } else {
        const d = ler();
        d.receitas.push(novo);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.receitas }),
  });
};

export const useApagarReceitaItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: string) => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("receitas").delete().eq("id", v);
        if (error) throw error;
      } else {
        const d = ler();
        d.receitas = d.receitas.filter((x) => x.id !== v);
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.receitas }),
  });
};

export const useAtualizarVenda = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; status: Venda["status"] }) => {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("vendas").update({ status: v.status }).eq("id", v.id);
        if (error) throw error;
      } else {
        const d = ler();
        const x = d.vendas.find((i) => i.id === v.id);
        if (x) x.status = v.status;
        gravar(d);
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.vendas }),
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
      pagamento: Venda["pagamento"];
      status: Venda["status"];
      observacoes: string;
      receitas: ReceitaItem[];
      insumos: Insumo[];
    }) => {
      const vendaId = id();
      const total = v.itens.reduce((s, i) => s + i.produto.preco * i.quantidade, 0);
      const custo = v.itens.reduce((s, i) => s + custoProduto(i.produto.id, v.receitas, v.insumos) * i.quantidade, 0);
      const dataFinal = v.data ? new Date(`${v.data}T12:00:00`).toISOString() : new Date().toISOString();

      if (isSupabaseConfigured) {
        const novaVenda = {
          id: vendaId,
          cliente_id: v.clienteId ?? null,
          canal: v.canal ?? "propria",
          revendedora_id: v.canal === "revendedora" ? (v.revendedoraId ?? null) : null,
          data: dataFinal,
          pagamento: v.canal === "revendedora" ? "pix" : v.pagamento,
          status: v.canal === "revendedora" ? "pago" : v.status,
          total,
          custo_total: custo,
          observacoes: v.observacoes || null,
        };

        const { error: errVenda } = await supabase.from("vendas").insert(novaVenda);
        if (errVenda) throw errVenda;

        const itensParaInserir = v.itens.map((i) => ({
          id: id(),
          venda_id: vendaId,
          produto_id: i.produto.id,
          nome_produto: i.produto.nome,
          quantidade: i.quantidade,
          preco_unitario: i.produto.preco,
        }));
        const { error: errItens } = await supabase.from("venda_itens").insert(itensParaInserir);
        if (errItens) throw errItens;

        // Atualizar estoque no Supabase
        for (const item of v.itens) {
          const novoEstoque = Math.max(0, Number(item.produto.estoque) - item.quantidade);
          await supabase.from("produtos").update({ estoque: novoEstoque }).eq("id", item.produto.id);

          for (const r of v.receitas.filter((x) => x.produto_id === item.produto.id)) {
            const insumoAtual = v.insumos.find((x) => x.id === r.insumo_id);
            if (insumoAtual) {
              const novaQtdInsumo = Math.max(0, Number(insumoAtual.quantidade) - r.quantidade * item.quantidade);
              await supabase.from("insumos").update({ quantidade: novaQtdInsumo }).eq("id", insumoAtual.id);
            }
          }
        }
      } else {
        const d = ler();
        const cliente = d.clientes.find((c) => c.id === v.clienteId);
        const revendedora = v.canal === "revendedora" && v.revendedoraId ? d.revendedoras.find((r) => r.id === v.revendedoraId) : null;

        d.vendas.unshift({
          id: vendaId,
          cliente_id: v.clienteId ?? null,
          canal: v.canal ?? "propria",
          revendedora_id: v.canal === "revendedora" ? (v.revendedoraId ?? null) : null,
          data: dataFinal,
          pagamento: v.canal === "revendedora" ? "pix" : v.pagamento,
          status: v.canal === "revendedora" ? "pago" : v.status,
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
          })),
        });

        for (const item of v.itens) {
          const p = d.produtos.find((x) => x.id === item.produto.id);
          if (p) p.estoque = Math.max(0, p.estoque - item.quantidade);
          for (const r of d.receitas.filter((x) => x.produto_id === item.produto.id)) {
            const ins = d.insumos.find((x) => x.id === r.insumo_id);
            if (ins) ins.quantidade = Math.max(0, ins.quantidade - r.quantidade * item.quantidade);
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

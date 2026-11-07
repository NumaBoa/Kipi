import { useSyncExternalStore } from 'react';
import { supabase, bancoLigado, SCHEMA_BANCO } from '@/lib/supabase';
import {
  registrarCarregadorRemoto,
  aguardarAntesDaSessao,
  definirDadosDeAcessoRemotos,
  registrarGravadorDeUsuario,
  exportarLoja,
  importarLoja,
  estabelecimentoAtualId,
  listarEstabelecimentos,
  PLANOS,
  type Estabelecimento,
  type UsuarioAcesso,
  type AreaDeAcesso,
  type PlanoKipi,
  type StatusEstabelecimento,
} from '@/lib/acesso';
import { camposDeData, mesDoAniversario, ressincronizarComissoes, type Pedido, type PedidoItem, type ClienteCadastro } from '@/lib/clientesPedidos';
import { comissaoDaVenda, type Revendedora, type EntregaRevenda, type PagamentoRevenda, type VendaRevenda } from '@/lib/revenda';
import type { ProdutoVitrine } from '@/lib/estoqueVitrine';
import type { Insumo, FichaTecnica, CompraInsumo, TipoInsumo, Armazenamento } from '@/lib/insumos';
import type { RegistroProducao, TipoRegistroProducao } from '@/lib/historicoProducao';
import { usarFonteRemotaConfig, type ConfigLoja } from '@/lib/configuracoes';

// ============================================================================
// SINCRONIZAÇÃO COM O BANCO — liga TODAS as telas ao Supabase sem mudar as telas.
// As libs (pedidos, estoque, revenda...) continuam sendo a fonte das telas:
//  · ao entrar num ateliê do banco, os dados são lidos e entregues a cada lib;
//  · a cada poucos segundos, o que mudou nas libs é gravado de volta (só as linhas alteradas).
// Os nomes antigos do banco (cartao, bater_massa, fazendo...) são lidos e preservados.
// Sem .env (banco desligado) nada aqui roda e o app usa os dados de exemplo.
// ============================================================================

type Linha = Record<string, any>;

// ---------------------------------------------------------------------------
// STATUS (selo na tela: carregando, salvo, erro)
// ---------------------------------------------------------------------------
export type EstadoBanco = 'desligado' | 'carregando' | 'ok' | 'salvando' | 'erro';
type AtalhoBanco = { rotulo: string; email: string; senha: string };
let atalhos: AtalhoBanco[] = [];
let status: { estado: EstadoBanco; mensagem: string; area: string; atalhos: AtalhoBanco[] } = {
  estado: bancoLigado ? 'carregando' : 'desligado',
  mensagem: '',
  area: SCHEMA_BANCO,
  atalhos: [],
};
const ouvintesStatus = new Set<() => void>();
const definirStatus = (estado: EstadoBanco, mensagem = '') => {
  status = { estado, mensagem, area: SCHEMA_BANCO, atalhos };
  ouvintesStatus.forEach((fn) => fn());
};
export const useStatusBanco = () =>
  useSyncExternalStore(
    (fn) => {
      ouvintesStatus.add(fn);
      return () => {
        ouvintesStatus.delete(fn);
      };
    },
    () => status,
    () => status
  );

// Atalhos de login: com o banco ligado ficam vazios (cada pessoa usa o próprio login)
// Empresa que representa o próprio Kipi (dona do sistema): não é um ateliê com vendas
const EMPRESA_DO_KIPI = 'emp_matriz';
// (ficam também no status: a tela de entrada recebe a lista quando o banco carrega)
export const atalhosDoBanco = () => atalhos;

// ---------------------------------------------------------------------------
// AUXILIARES
// ---------------------------------------------------------------------------
const num = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v));
const r2 = (v: number) => Math.round(v * 100) / 100;
const nulo = <T,>(v: T | undefined | null) => (v === undefined || v === '' ? null : v);

// Valor antigo do banco continua igual quando o app não mudou o significado
// (ex.: "cartao" segue "cartao" se a pessoa não trocou a forma de pagamento)
const manter = <T extends string>(original: string | null | undefined, valorApp: T, paraApp: Record<string, string>): string =>
  original && paraApp[original] === valorApp ? original : valorApp;

const PAGAMENTO_APP: Record<string, Pedido['formaPagamento']> = {
  pix: 'pix',
  dinheiro: 'dinheiro',
  cartao: 'cartao_credito',
  cartao_credito: 'cartao_credito',
  cartao_debito: 'cartao_debito',
  transferencia: 'pix',
  pendente: 'pendente',
};
const PRODUCAO_APP: Record<string, Pedido['statusProducao']> = {
  a_fazer: 'a_fazer',
  fazendo: 'em_producao',
  em_producao: 'em_producao',
  pronto_retirada: 'pronto',
  pronto: 'pronto',
  entregue: 'entregue',
};
const HISTORICO_APP: Record<string, TipoRegistroProducao> = {
  bater_massa: 'preparo_massa',
  preparo_massa: 'preparo_massa',
  assar_fornada: 'assar_fornada',
  descarte_perda: 'perda',
  perda: 'perda',
  ajuste: 'ajuste',
};
const STATUS_EMPRESA_APP: Record<string, StatusEstabelecimento> = {
  ativa: 'ativo',
  ativo: 'ativo',
  bloqueada: 'bloqueado',
  bloqueado: 'bloqueado',
  teste: 'teste',
};

const lerTudo = async (tabela: string, filtro?: { coluna: string; valor: string }) => {
  const todas: Linha[] = [];
  for (let inicio = 0; ; inicio += 1000) {
    let consulta = supabase!.from(tabela).select('*').range(inicio, inicio + 999);
    if (filtro) consulta = consulta.eq(filtro.coluna, filtro.valor);
    const { data, error } = await consulta;
    if (error) throw new Error(`${tabela}: ${error.message}`);
    todas.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return todas;
};

// ---------------------------------------------------------------------------
// ESTADO DA SINCRONIZAÇÃO DO ATELIÊ ABERTO
// ---------------------------------------------------------------------------
let empresaAtiva: string | null = null; // só grava quando o ateliê terminou de carregar
let idsEmpresasBanco = new Set<string>();
let linhasEmpresas = new Map<string, Linha>();
// Linhas como vieram do banco (para manter os valores antigos: pagamento, status...)
const originais: Record<string, Map<string, Linha>> = {};
// Última versão gravada/lida de cada linha (comparação para saber o que mudou)
const gravado: Record<string, Map<string, string>> = {};
// Entrega com vários produtos = várias linhas em remessas_consignacao
let linhasDaEntrega = new Map<string, string[]>();

const original = (tabela: string, id: string) => originais[tabela]?.get(id);

// ---------------------------------------------------------------------------
// BANCO → APP
// ---------------------------------------------------------------------------
const revendedoraDoBanco = (r: Linha): Revendedora => ({
  id: r.id,
  nome: r.nome,
  telefone: r.telefone ?? '',
  email: r.email ?? null,
  cpf: r.cpf ?? null,
  tag: r.tag ?? null,
  tipoComissao: r.tipo_comissao === 'valor_fixo' ? 'valor_fixo' : 'porcentagem',
  valorComissao: r.tipo_comissao === 'valor_fixo' ? num(r.comissao_fixa) : num(r.comissao_percentual),
  cep: r.cep ?? null,
  rua: r.rua ?? null,
  numero: r.numero ?? null,
  complemento: r.complemento ?? null,
  bairro: r.bairro ?? null,
  cidade: r.cidade ?? null,
  estado: r.estado ?? null,
  observacoes: r.observacoes ?? null,
  created_at: r.created_at ?? undefined,
});

const clienteDoBanco = (c: Linha, revs: Revendedora[]): ClienteCadastro => ({
  id: c.id,
  nome: c.nome,
  telefone: c.telefone ?? '',
  email: c.email ?? null,
  cpf_cnpj: c.cpf_cnpj ?? null,
  aniversario: c.aniversario ?? null,
  mesAniversario: mesDoAniversario(c.aniversario),
  cep: c.cep ?? null,
  rua: c.rua ?? null,
  numero: c.numero ?? null,
  bairro: c.bairro ?? null,
  cidade: c.cidade ?? null,
  estado: c.estado ?? null,
  complemento: c.complemento ?? null,
  observacoes: c.observacoes ?? null,
  tag: c.tag ?? null,
  revendedoraId: c.revendedora_id ?? null,
  revendedoraNome: revs.find((r) => r.id === c.revendedora_id)?.nome ?? null,
  status: c.status === 'inativo' ? 'inativo' : 'ativo',
  created_at: c.created_at ?? undefined,
});

// Colunas novas de produtos: só grava quando o banco já tem a coluna
// (supabase/area_hml/07_produtos_imagem_minimos_hml.sql). Sem ela, o app segue funcionando
// e só esses campos deixam de ser salvos.
let colunasProdutos = { emoji: false, foto: false, estoque_minimo_congelado: false };
const verificarColunasProdutos = async () => {
  const testar = async (c: string) => !(await supabase!.from('produtos').select(c).limit(1)).error;
  const [emoji, foto, estoque_minimo_congelado] = await Promise.all([testar('emoji'), testar('foto'), testar('estoque_minimo_congelado')]);
  colunasProdutos = { emoji, foto, estoque_minimo_congelado };
};

const produtoDoBanco = (p: Linha): ProdutoVitrine => ({
  id: p.id,
  nome: p.nome,
  detalhe: p.detalhe ?? p.categoria ?? '',
  categoria: p.categoria ?? 'Outros',
  preco: r2(num(p.preco)),
  custo: num(p.custo_manual),
  estoque: num(p.estoque),
  estoqueMinimo: num(p.estoque_minimo),
  desconto: num(p.desconto_promocional) > 0 ? r2(num(p.desconto_promocional)) : undefined,
  ativo: p.ativo !== false,
  disponibilidade: ['pronta_entrega', 'sob_encomenda', 'hibrido'].includes(p.disponibilidade) ? p.disponibilidade : undefined,
  emoji: p.emoji || undefined,
  foto: p.foto || null,
  minimoFreezer: num(p.estoque_minimo_congelado),
});

const pedidoDoBanco = (
  v: Linha,
  itensDaVenda: Linha[],
  clientes: ClienteCadastro[],
  revs: Revendedora[],
  produtos: ProdutoVitrine[]
): Pedido => {
  const rev = v.canal === 'revendedora' ? revs.find((r) => r.id === v.revendedora_id) : undefined;
  const cli = clientes.find((c) => c.id === v.cliente_id);
  const data: string = v.data ?? v.created_at ?? new Date().toISOString();
  const itens: PedidoItem[] = itensDaVenda.map((i) => {
    const quantidade = num(i.quantidade);
    const precoUnitario = r2(num(i.preco_unitario));
    return {
      id: i.id,
      nome: i.nome_produto,
      categoria: produtos.find((p) => p.id === i.produto_id)?.categoria ?? 'Outros',
      quantidade,
      precoUnitario,
      desconto: i.desconto_unitario != null ? num(i.desconto_unitario) : undefined,
      comDesconto: !!i.com_desconto,
      motivoPromocao: i.motivo_promocao ?? undefined,
      totalItem: r2(quantidade * precoUnitario),
      produtoId: i.produto_id ?? null,
      custoUnitario: i.custo_unitario != null ? num(i.custo_unitario) : undefined,
    };
  });
  return {
    id: v.id,
    codigoDisplay: `${rev ? '#REV' : '#PED'}-${v.numero ?? 0}`,
    clienteId: v.cliente_id ?? null,
    clienteNome: cli?.nome ?? 'Venda Avulsa (Balcão)',
    clienteTelefone: cli?.telefone || null,
    clienteEmail: cli?.email ?? null,
    tag: rev ? 'Revenda' : v.tipo_pedido === 'sob_encomenda' ? 'Encomenda' : 'Pronta Entrega',
    tipoPedido: v.tipo_pedido === 'sob_encomenda' ? 'sob_encomenda' : 'pronta_entrega',
    data,
    ...camposDeData(data),
    dataEntrega: v.data_entrega_prometida ?? null,
    vendedor: v.vendedor_nome ?? rev?.nome ?? 'Ateliê',
    vendedorCargo: v.vendedor_cargo ?? (rev ? 'Revendedora' : 'Proprietária'),
    formaPagamento: PAGAMENTO_APP[v.pagamento] ?? 'pix',
    status: v.status === 'cancelado' ? 'cancelado' : v.status === 'pendente' ? 'pendente' : 'pago',
    total: r2(num(v.total)),
    valorSinalPago: r2(num(v.valor_sinal_pago)),
    saldoNaEntrega: r2(num(v.saldo_na_entrega)),
    statusProducao: PRODUCAO_APP[v.status_producao] ?? 'a_fazer',
    itens,
    custoTotal: r2(num(v.custo_total)),
    observacoes: v.observacoes ?? null,
    deletado: v.status === 'cancelado',
    revendedoraId: rev ? rev.id : null,
  };
};

const historicoDoBanco = (h: Linha): RegistroProducao => {
  const data: string = h.created_at ?? new Date().toISOString();
  return {
    id: h.id,
    tipo: HISTORICO_APP[h.tipo] ?? 'ajuste',
    produtoId: h.produto_id ?? '',
    produtoNome: h.nome_produto,
    quantidade: num(h.quantidade),
    data,
    horario: new Date(data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    responsavel: h.responsavel ?? '—',
    detalhes: h.observacoes ?? undefined,
    motivo: h.motivo ?? undefined,
    origem: h.origem ?? undefined,
    custo: h.custo != null ? num(h.custo) : undefined,
  };
};

const TIPOS_INSUMO: TipoInsumo[] = ['ingrediente', 'embalagem', 'outro'];
const insumoDoBanco = (i: Linha): Insumo => ({
  id: i.id,
  nome: i.nome,
  tipo: TIPOS_INSUMO.includes(i.tipo) ? i.tipo : 'outro', // material, materia_prima, acessorio → outro
  unidade: i.unidade ?? 'un',
  unidadeFracionada: i.unidade_fracionada ?? i.unidade ?? 'un',
  fatorFracionado: num(i.fator_fracionado) || 1,
  precoPago: num(i.preco_pago),
  conteudoEmbalagem: num(i.conteudo_embalagem),
  custoUnitario: num(i.custo_unitario),
  quantidadeEstoque: num(i.quantidade),
  estoqueMinimo: num(i.minimo),
  armazenamento: (i.armazenamento ?? 'seco') as Armazenamento,
  marcaFornecedor: i.marca_fornecedor ?? undefined,
  status: i.status === 'inativo' ? 'inativo' : 'ativo',
  emoji: i.emoji ?? (i.tipo === 'ingrediente' ? '🥣' : '📦'),
  categoria: i.categoria ?? undefined,
  usadoEm: i.usado_em ?? undefined,
});

// ---------------------------------------------------------------------------
// APP → BANCO (só as colunas que o app controla; o resto da linha fica como está)
// ---------------------------------------------------------------------------
const comissaoDoPedido = (p: Pedido) => {
  const revenda = exportarLoja('revenda') as { revendedoras: Revendedora[]; vendas: VendaRevenda[] } | undefined;
  const venda = revenda?.vendas.find((v) => v.pedidoId === p.id);
  const rev = venda ? revenda?.revendedoras.find((r) => r.id === venda.revendedoraId) : undefined;
  return venda && rev ? r2(comissaoDaVenda(venda, rev)) : 0;
};

// soAtualizar: grava com update (a linha já existe e só algumas colunas são do app)
type Tabela = { nome: string; chave: string; linhas: (empresa: string) => Linha[]; soAtualizar?: boolean };

const TABELAS: Tabela[] = [
  {
    nome: 'produtos',
    chave: 'id',
    linhas: (empresa) => {
      const e = exportarLoja('vitrine') as { produtos: ProdutoVitrine[]; congelados: Record<string, number> } | undefined;
      return (e?.produtos ?? []).map((p) => ({
        id: p.id,
        empresa_id: empresa,
        nome: p.nome,
        detalhe: nulo(p.detalhe),
        categoria: p.categoria,
        preco: r2(p.preco),
        custo_manual: r2(p.custo),
        estoque: p.estoque,
        estoque_congelado: e?.congelados[p.id] ?? 0,
        estoque_minimo: p.estoqueMinimo,
        ativo: p.ativo !== false,
        disponibilidade: p.disponibilidade ?? 'pronta_entrega',
        desconto_promocional: r2(p.desconto ?? 0),
        preco_promocional: p.desconto ? r2(p.preco - p.desconto) : null,
        tem_promocao: !!p.desconto,
        ...(colunasProdutos.emoji ? { emoji: p.emoji ?? null } : {}),
        ...(colunasProdutos.foto ? { foto: p.foto ?? null } : {}),
        ...(colunasProdutos.estoque_minimo_congelado ? { estoque_minimo_congelado: p.minimoFreezer ?? 0 } : {}),
      }));
    },
  },
  {
    nome: 'revendedoras',
    chave: 'id',
    linhas: (empresa) => {
      const e = exportarLoja('revenda') as { revendedoras: Revendedora[] } | undefined;
      return (e?.revendedoras ?? []).map((r) => {
        const o = original('revendedoras', r.id);
        return {
          id: r.id,
          empresa_id: empresa,
          nome: r.nome,
          telefone: nulo(r.telefone),
          email: nulo(r.email),
          cpf: nulo(r.cpf),
          tag: nulo(r.tag),
          tipo_comissao: r.tipoComissao,
          comissao_fixa: r.tipoComissao === 'valor_fixo' ? r.valorComissao : o?.comissao_fixa ?? null,
          comissao_percentual: r.tipoComissao === 'porcentagem' ? r.valorComissao : o?.comissao_percentual ?? null,
          cep: nulo(r.cep),
          rua: nulo(r.rua),
          numero: nulo(r.numero),
          complemento: nulo(r.complemento),
          bairro: nulo(r.bairro),
          cidade: nulo(r.cidade),
          estado: nulo(r.estado),
          observacoes: nulo(r.observacoes),
        };
      });
    },
  },
  {
    nome: 'clientes',
    chave: 'id',
    linhas: (empresa) => {
      const e = exportarLoja('clientesPedidos') as { clientes: ClienteCadastro[] } | undefined;
      return (e?.clientes ?? []).map((c) => ({
        id: c.id,
        empresa_id: empresa,
        nome: c.nome,
        telefone: nulo(c.telefone),
        email: nulo(c.email),
        cpf_cnpj: nulo(c.cpf_cnpj),
        aniversario: nulo(c.aniversario),
        cep: nulo(c.cep),
        rua: nulo(c.rua),
        numero: nulo(c.numero),
        bairro: nulo(c.bairro),
        cidade: nulo(c.cidade),
        estado: nulo(c.estado),
        complemento: nulo(c.complemento),
        observacoes: nulo(c.observacoes),
        tag: nulo(c.tag),
        revendedora_id: c.revendedoraId ?? null,
        status: c.status,
      }));
    },
  },
  {
    nome: 'insumos',
    chave: 'id',
    linhas: (empresa) => {
      const e = exportarLoja('insumos') as { insumos: Insumo[] } | undefined;
      return (e?.insumos ?? []).map((i) => {
        const o = original('insumos', i.id);
        return {
          id: i.id,
          empresa_id: empresa,
          nome: i.nome,
          // Tipo antigo (material, acessorio...) continua se o app só mostra como "outro"
          tipo: o?.tipo && !TIPOS_INSUMO.includes(o.tipo) && i.tipo === 'outro' ? o.tipo : i.tipo,
          unidade: i.unidade,
          unidade_fracionada: i.unidadeFracionada,
          fator_fracionado: i.fatorFracionado,
          preco_pago: i.precoPago,
          conteudo_embalagem: i.conteudoEmbalagem,
          custo_unitario: i.custoUnitario,
          quantidade: i.quantidadeEstoque,
          minimo: i.estoqueMinimo,
          armazenamento: i.armazenamento,
          marca_fornecedor: nulo(i.marcaFornecedor),
          status: i.status,
          emoji: i.emoji,
          categoria: nulo(i.categoria),
          usado_em: nulo(i.usadoEm),
        };
      });
    },
  },
  {
    nome: 'vendas',
    chave: 'id',
    linhas: (empresa) => {
      const e = exportarLoja('clientesPedidos') as { pedidos: Pedido[] } | undefined;
      return (e?.pedidos ?? []).map((p) => {
        const o = original('vendas', p.id);
        return {
          id: p.id,
          empresa_id: empresa,
          numero: parseInt(p.codigoDisplay.replace(/\D/g, ''), 10) || o?.numero || null,
          cliente_id: p.clienteId ?? null,
          canal: p.revendedoraId ? 'revendedora' : 'propria',
          revendedora_id: p.revendedoraId ?? null,
          data: p.data,
          tipo_pedido: p.tipoPedido,
          data_entrega_prometida: p.dataEntrega ?? null,
          valor_sinal_pago: r2(p.valorSinalPago),
          saldo_na_entrega: r2(p.saldoNaEntrega),
          status_producao: manter(o?.status_producao, p.statusProducao, PRODUCAO_APP),
          pagamento: manter(o?.pagamento, p.formaPagamento, PAGAMENTO_APP),
          status: p.deletado ? 'cancelado' : p.status,
          total: r2(p.total),
          custo_total: r2(p.custoTotal ?? 0),
          observacoes: nulo(p.observacoes),
          vendedor_nome: p.vendedor,
          vendedor_cargo: p.vendedorCargo,
          comissao_valor: comissaoDoPedido(p),
        };
      });
    },
  },
  {
    nome: 'venda_itens',
    chave: 'id',
    linhas: (empresa) => {
      const e = exportarLoja('clientesPedidos') as { pedidos: Pedido[] } | undefined;
      return (e?.pedidos ?? []).flatMap((p) =>
        p.itens.map((it) => ({
          id: it.id,
          empresa_id: empresa,
          venda_id: p.id,
          produto_id: it.produtoId ?? null,
          nome_produto: it.nome,
          quantidade: it.quantidade,
          preco_unitario: r2(it.precoUnitario),
          com_desconto: !!it.comDesconto,
          desconto_unitario: it.desconto != null ? r2(it.desconto) : null,
          motivo_promocao: nulo(it.motivoPromocao),
          custo_unitario: it.custoUnitario != null ? r2(it.custoUnitario) : null,
        }))
      );
    },
  },
  {
    nome: 'remessas_consignacao',
    chave: 'id',
    linhas: (empresa) => {
      const e = exportarLoja('revenda') as { entregas: EntregaRevenda[] } | undefined;
      return (e?.entregas ?? []).flatMap((ent) =>
        ent.itens.map((it, idx) => {
          const id = linhasDaEntrega.get(ent.id)?.[idx] ?? `${ent.id}#${idx}`;
          return {
            id,
            empresa_id: empresa,
            revendedora_id: ent.revendedoraId,
            produto_id: it.produtoId,
            nome_produto: it.nome,
            quantidade: it.quantidade,
            data: ent.data,
            observacoes: nulo(ent.observacoes),
            baixar_estoque_atelie: original('remessas_consignacao', id)?.baixar_estoque_atelie ?? true,
          };
        })
      );
    },
  },
  {
    nome: 'pagamentos_comissao',
    chave: 'id',
    linhas: (empresa) => {
      const e = exportarLoja('revenda') as { pagamentos: PagamentoRevenda[] } | undefined;
      return (e?.pagamentos ?? []).map((p) => ({
        id: p.id,
        empresa_id: empresa,
        revendedora_id: p.revendedoraId,
        valor: r2(p.valor),
        data: p.data,
        forma_pagamento: p.formaPagamento,
        observacoes: nulo(p.observacoes),
      }));
    },
  },
  {
    nome: 'historico_producao',
    chave: 'id',
    linhas: (empresa) => {
      const e = exportarLoja('historicoProducao') as RegistroProducao[] | undefined;
      return (e ?? []).map((h) => ({
        id: h.id,
        empresa_id: empresa,
        tipo: manter(original('historico_producao', h.id)?.tipo, h.tipo, HISTORICO_APP),
        produto_id: h.produtoId || null,
        nome_produto: h.produtoNome,
        quantidade: h.quantidade,
        observacoes: nulo(h.detalhes),
        motivo: nulo(h.motivo),
        origem: h.origem ?? null,
        custo: h.custo != null ? r2(h.custo) : null,
        responsavel: nulo(h.responsavel),
        created_at: h.data,
      }));
    },
  },
  {
    nome: 'fichas_tecnicas',
    chave: 'produto_id',
    linhas: (empresa) => {
      const e = exportarLoja('insumos') as { fichas: FichaTecnica[] } | undefined;
      return (e?.fichas ?? []).map((f) => ({
        produto_id: f.produtoId,
        empresa_id: empresa,
        rendimento: f.rendimento,
        tempo_preparo_minutos: f.tempoPreparoMinutos,
        modo_lucro: f.modoLucro,
        lucro_desejado: f.lucroDesejado,
      }));
    },
  },
  {
    nome: 'receitas',
    chave: 'id',
    linhas: (empresa) => {
      const e = exportarLoja('insumos') as { fichas: FichaTecnica[] } | undefined;
      const existentes = [...(originais['receitas']?.values() ?? [])];
      return (e?.fichas ?? []).flatMap((f) =>
        f.itens.map((it) => ({
          id: existentes.find((r) => r.produto_id === f.produtoId && r.insumo_id === it.insumoId)?.id ?? `${f.produtoId}__${it.insumoId}`,
          empresa_id: empresa,
          produto_id: f.produtoId,
          insumo_id: it.insumoId,
          quantidade: it.quantidade,
        }))
      );
    },
  },
  {
    nome: 'fichas_custos_extras',
    chave: 'id',
    linhas: (empresa) => {
      const e = exportarLoja('insumos') as { fichas: FichaTecnica[] } | undefined;
      return (e?.fichas ?? []).flatMap((f) =>
        f.custosExtras.map((c) => ({ id: c.id, empresa_id: empresa, produto_id: f.produtoId, descricao: c.descricao, valor: c.valor }))
      );
    },
  },
  {
    nome: 'compras_insumos',
    chave: 'id',
    linhas: (empresa) => {
      const e = exportarLoja('insumos') as { compras: CompraInsumo[] } | undefined;
      return (e?.compras ?? []).map((c) => ({
        id: c.id,
        empresa_id: empresa,
        insumo_id: c.insumoId,
        nome_insumo: c.nome,
        quantidade: c.quantidade,
        unidade: nulo(c.unidade),
        valor: r2(c.valor),
        data: c.data,
      }));
    },
  },
  {
    // Valor da hora de trabalho fica na empresa (linha já existe: só atualiza)
    nome: 'empresas',
    soAtualizar: true,
    chave: 'id',
    linhas: (empresa) => {
      const e = exportarLoja('insumos') as { horaTrabalhada: number } | undefined;
      return e ? [{ id: empresa, valor_hora_trabalho: e.horaTrabalhada }] : [];
    },
  },
];

// Painel do Kipi (admin): ateliês e mensalidades, independem do ateliê aberto
const linhasAdmin = (): Record<string, Linha[]> => {
  const ests = listarEstabelecimentos();
  return {
    empresas_admin: ests.map((e) => ({
      id: e.id,
      nome: e.nome,
      plano_kipi: e.plano,
      mensalidade: e.mensalidade,
      dia_vencimento: e.diaVencimento,
      status: manter(linhasEmpresas.get(e.id)?.status, e.status, STATUS_EMPRESA_APP),
      telefone: nulo(e.telefone),
      cidade: nulo(e.cidade),
      responsavel_nome: nulo(e.donaNome),
      responsavel_email: nulo(e.donaEmail),
    })),
    mensalidades: ests.flatMap((e) =>
      e.pagamentos.map((p) => ({ id: p.id, empresa_id: e.id, competencia: p.competencia, valor: p.valor, pago_em: p.data }))
    ),
  };
};

// ---------------------------------------------------------------------------
// GRAVAÇÃO: compara com a última versão e grava só o que mudou
// ---------------------------------------------------------------------------
const fotografar = (tabela: string, chave: string, linhas: Linha[]) => {
  gravado[tabela] = new Map(linhas.map((l) => [String(l[chave]), JSON.stringify(l)]));
};

const fotografarTudo = () => {
  if (empresaAtiva) TABELAS.forEach((t) => fotografar(t.nome, t.chave, t.linhas(empresaAtiva!)));
  const admin = linhasAdmin();
  fotografar('empresas_admin', 'id', admin.empresas_admin);
  fotografar('mensalidades', 'id', admin.mensalidades);
};

let salvando = false;
let pausaAte = 0;

const gravarDiferencas = async () => {
  if (!supabase || salvando || Date.now() < pausaAte) return;
  const pendentes: { tabela: string; destino: string; chave: string; mudou: Linha[]; saiu: string[]; atuais: Linha[]; soAtualizar?: boolean }[] = [];
  const comparar = (tabela: string, destino: string, chave: string, atuais: Linha[], permitirExcluir = true, soAtualizar = false) => {
    const antes = gravado[tabela];
    if (!antes) return;
    const mudou = atuais.filter((l) => antes.get(String(l[chave])) !== JSON.stringify(l));
    const presentes = new Set(atuais.map((l) => String(l[chave])));
    const saiu = permitirExcluir ? [...antes.keys()].filter((id) => !presentes.has(id)) : [];
    if (mudou.length || saiu.length) pendentes.push({ tabela, destino, chave, mudou, saiu, atuais, soAtualizar });
  };

  // Ateliê aberto (só depois de carregar do banco)
  if (empresaAtiva && estabelecimentoAtualId() === empresaAtiva) {
    TABELAS.forEach((t) => comparar(t.nome, t.nome, t.chave, t.linhas(empresaAtiva!), !t.soAtualizar, !!t.soAtualizar));
  }
  const admin = linhasAdmin();
  comparar('empresas_admin', 'empresas', 'id', admin.empresas_admin, false);
  comparar('mensalidades', 'mensalidades', 'id', admin.mensalidades);
  if (!pendentes.length) return;

  // Proteção: nunca apaga uma tabela inteira de uma vez (sinal de dados não carregados)
  const suspeita = pendentes.find((p) => p.atuais.length === 0 && p.saiu.length > 3);
  if (suspeita) {
    definirStatus('erro', `Proteção: o app tentou apagar todos os registros de ${suspeita.destino}. Nada foi apagado.`);
    pausaAte = Date.now() + 60000;
    return;
  }

  salvando = true;
  definirStatus('salvando');
  try {
    for (const p of pendentes) {
      if (p.soAtualizar) {
        for (const linha of p.mudou) {
          const { error } = await supabase.from(p.destino).update(linha).eq(p.chave, linha[p.chave]);
          if (error) throw new Error(`${p.destino}: ${error.message}`);
        }
        continue;
      }
      for (let i = 0; i < p.mudou.length; i += 200) {
        const { error } = await supabase.from(p.destino).upsert(p.mudou.slice(i, i + 200), { onConflict: p.chave });
        if (error) throw new Error(`${p.destino}: ${error.message}`);
      }
    }
    // Exclusões na ordem inversa (itens antes da venda, por exemplo)
    for (const p of [...pendentes].reverse()) {
      if (!p.saiu.length) continue;
      const { error } = await supabase.from(p.destino).delete().in(p.chave, p.saiu);
      if (error) throw new Error(`${p.destino}: ${error.message}`);
    }
    pendentes.forEach((p) => fotografar(p.tabela, p.chave, p.atuais));
    definirStatus('ok');
  } catch (e) {
    definirStatus('erro', e instanceof Error ? e.message : String(e));
    pausaAte = Date.now() + 10000; // tenta de novo em 10 s
  } finally {
    salvando = false;
  }
};

// ---------------------------------------------------------------------------
// CARREGAR UM ATELIÊ DO BANCO
// ---------------------------------------------------------------------------
let carregamento = 0;

const carregarEmpresa = async (empresa: string) => {
  const meu = ++carregamento;
  definirStatus('carregando');
  try {
    const filtro = { coluna: 'empresa_id', valor: empresa };
    const [revsB, clientesB, produtosB, vendasB, itensB, remessasB, pagamentosB, historicoB, insumosB, receitasB, fichasB, extrasB, comprasB] =
      await Promise.all([
        lerTudo('revendedoras', filtro),
        lerTudo('clientes', filtro),
        lerTudo('produtos', filtro),
        lerTudo('vendas', filtro),
        lerTudo('venda_itens', filtro),
        lerTudo('remessas_consignacao', filtro),
        lerTudo('pagamentos_comissao', filtro),
        lerTudo('historico_producao', filtro),
        lerTudo('insumos', filtro),
        lerTudo('receitas', filtro),
        lerTudo('fichas_tecnicas', filtro),
        lerTudo('fichas_custos_extras', filtro),
        lerTudo('compras_insumos', filtro),
        verificarColunasProdutos(),
      ]);
    if (meu !== carregamento || estabelecimentoAtualId() !== empresa) return; // trocou de ateliê no meio

    const guardar = (tabela: string, linhas: Linha[], chave = 'id') => {
      originais[tabela] = new Map(linhas.map((l) => [String(l[chave]), l]));
    };
    guardar('revendedoras', revsB);
    guardar('vendas', vendasB);
    guardar('insumos', insumosB);
    guardar('historico_producao', historicoB);
    guardar('remessas_consignacao', remessasB);
    guardar('receitas', receitasB);

    const revendedoras = revsB.map(revendedoraDoBanco);
    const clientes = clientesB.map((c) => clienteDoBanco(c, revendedoras));
    const produtos = produtosB.map(produtoDoBanco);
    const congelados = Object.fromEntries(produtosB.map((p) => [p.id, num(p.estoque_congelado)]));

    const itensPorVenda = new Map<string, Linha[]>();
    itensB.forEach((i) => itensPorVenda.set(i.venda_id, [...(itensPorVenda.get(i.venda_id) ?? []), i]));
    const pedidos = vendasB
      .map((v) => pedidoDoBanco(v, itensPorVenda.get(v.id) ?? [], clientes, revendedoras, produtos))
      .sort((a, b) => b.data.localeCompare(a.data));
    const maiorNumero = vendasB.reduce((m, v) => Math.max(m, num(v.numero)), 0);

    // Remessas: linhas da mesma entrega (mesma revendedora, data e observação) viram uma entrega
    linhasDaEntrega = new Map();
    const entregasMap = new Map<string, EntregaRevenda>();
    [...remessasB]
      .sort((a, b) => String(a.data).localeCompare(String(b.data)) || String(a.id).localeCompare(String(b.id)))
      .forEach((r) => {
        const grupo = `${r.revendedora_id}|${r.data}|${r.observacoes ?? ''}`;
        const atual = entregasMap.get(grupo);
        const item = { produtoId: r.produto_id, nome: r.nome_produto, quantidade: num(r.quantidade) };
        if (atual) {
          atual.itens.push(item);
          linhasDaEntrega.get(atual.id)!.push(r.id);
        } else {
          entregasMap.set(grupo, { id: r.id, revendedoraId: r.revendedora_id, data: r.data, itens: [item], observacoes: r.observacoes ?? null });
          linhasDaEntrega.set(r.id, [r.id]);
        }
      });
    const entregas = [...entregasMap.values()].sort((a, b) => b.data.localeCompare(a.data));
    const pagamentos: PagamentoRevenda[] = pagamentosB
      .map((p) => ({
        id: p.id,
        revendedoraId: p.revendedora_id,
        valor: r2(num(p.valor)),
        data: p.data,
        formaPagamento: p.forma_pagamento ?? 'pix',
        observacoes: p.observacoes ?? null,
      }))
      .sort((a, b) => b.data.localeCompare(a.data));

    const historico = historicoB.map(historicoDoBanco).sort((a, b) => b.data.localeCompare(a.data));

    // Ficha técnica: cabeçalho + linhas da receita + custos extras
    const produtosComFicha = new Set([...fichasB.map((f) => f.produto_id), ...receitasB.map((r) => r.produto_id)]);
    const fichas: FichaTecnica[] = [...produtosComFicha].map((produtoId) => {
      const cab = fichasB.find((f) => f.produto_id === produtoId);
      const prod = produtosB.find((p) => p.id === produtoId);
      return {
        produtoId,
        rendimento: num(cab?.rendimento ?? prod?.rendimento_unidades) || 1,
        tempoPreparoMinutos: num(cab?.tempo_preparo_minutos ?? prod?.tempo_preparo_minutos),
        itens: receitasB.filter((r) => r.produto_id === produtoId).map((r) => ({ insumoId: r.insumo_id, quantidade: num(r.quantidade) })),
        custosExtras: extrasB.filter((c) => c.produto_id === produtoId).map((c) => ({ id: c.id, descricao: c.descricao, valor: num(c.valor) })),
        modoLucro: cab?.modo_lucro === 'reais' ? 'reais' : 'porcentagem',
        lucroDesejado: num(cab?.lucro_desejado),
      };
    });
    const compras: CompraInsumo[] = comprasB.map((c) => ({
      id: c.id,
      insumoId: c.insumo_id,
      nome: c.nome_insumo,
      quantidade: num(c.quantidade),
      unidade: c.unidade ?? '',
      valor: num(c.valor),
      data: c.data,
    }));

    // Entrega a cada lib (as telas atualizam sozinhas)
    importarLoja('vitrine', { produtos, congelados });
    importarLoja('revenda', { revendedoras, vendas: [], entregas, pagamentos });
    importarLoja('clientesPedidos', { clientes, pedidos, proximoNumero: maiorNumero + 1 });
    importarLoja('historicoProducao', historico);
    importarLoja('insumos', {
      insumos: insumosB.map(insumoDoBanco),
      fichas,
      horaTrabalhada: num(linhasEmpresas.get(empresa)?.valor_hora_trabalho) || 20,
      compras,
    });
    ressincronizarComissoes(); // vendas das revendedoras a partir dos pedidos

    empresaAtiva = empresa;
    fotografarTudo();
    definirStatus('ok');
  } catch (e) {
    if (meu === carregamento) definirStatus('erro', `Não foi possível carregar os dados: ${e instanceof Error ? e.message : String(e)}`);
  }
};

// ---------------------------------------------------------------------------
// INÍCIO: ateliês, acessos de teste e configurações vêm do banco
// ---------------------------------------------------------------------------
const configDoBanco = (e: Linha): Partial<ConfigLoja> => ({
  nome: e.nome ?? '',
  slogan: e.slogan ?? '',
  logoUri: e.logo_url ?? null,
  documento: e.documento ?? '',
  telefone: e.telefone ?? '',
  email: e.email ?? '',
  instagram: e.instagram ?? '',
  endereco: e.endereco ?? '',
  cidade: e.cidade ?? '',
  estado: e.estado ?? '',
  chavePix: e.chave_pix ?? '',
  comissaoPadraoTipo: e.comissao_padrao_tipo === 'valor_fixo' ? 'valor_fixo' : 'porcentagem',
  comissaoPadraoValor: e.comissao_padrao_valor != null ? num(e.comissao_padrao_valor) : 15,
});

const iniciar = async () => {
  const [empresasB, mensalidadesB, revendedorasB, usuariosB] = await Promise.all([
    lerTudo('empresas'),
    lerTudo('mensalidades'),
    lerTudo('revendedoras'),
    lerTudo('usuarios'),
  ]);
  linhasEmpresas = new Map(empresasB.map((e) => [e.id, e]));
  idsEmpresasBanco = new Set(empresasB.map((e) => e.id));

  const estabelecimentos: Estabelecimento[] = empresasB.map((e) => {
    const plano: PlanoKipi = ['Essencial', 'Profissional', 'Premium'].includes(e.plano_kipi) ? e.plano_kipi : 'Profissional';
    return {
      id: e.id,
      nome: e.nome,
      donaNome: e.responsavel_nome ?? '',
      donaEmail: e.responsavel_email ?? '',
      telefone: e.telefone ?? '',
      cidade: e.cidade ?? '',
      plano,
      mensalidade: e.mensalidade != null ? num(e.mensalidade) : PLANOS.find((p) => p.id === plano)!.preco,
      diaVencimento: e.dia_vencimento ?? 10,
      status: STATUS_EMPRESA_APP[e.status] ?? 'ativo',
      criadoEm: e.created_at ?? new Date().toISOString(),
      pagamentos: mensalidadesB
        .filter((m) => m.empresa_id === e.id)
        .map((m) => ({ id: m.id, competencia: m.competencia, valor: num(m.valor), data: m.pago_em })),
    };
  });

  // Logins: tabela usuarios (os mesmos do sistema antigo). Um login pode abrir mais de uma área:
  //  · super_admin → Administração Kipi
  //  · admin/operador → Responsável por cada empresa da lista dele (menos a empresa do próprio Kipi)
  //  · qualquer login ligado a uma revendedora (usuario_id ou mesmo e-mail) → Revendedora daquela empresa
  const nomeEmpresa = (id: string) => empresasB.find((e) => e.id === id)?.nome ?? '';
  const acessos: UsuarioAcesso[] = usuariosB
    .filter((u) => u.status === 'ativo')
    .flatMap((u): UsuarioAcesso[] => {
      const areas: AreaDeAcesso[] = [];
      if (u.papel === 'super_admin') areas.push({ perfil: 'admin', estabelecimentoId: null, rotulo: 'Administração Kipi' });
      if (u.papel === 'admin' || u.papel === 'operador') {
        ((u.empresa_ids as string[] | null) ?? [])
          .filter((id) => idsEmpresasBanco.has(id) && id !== EMPRESA_DO_KIPI)
          .forEach((id) => areas.push({ perfil: 'dona', estabelecimentoId: id, rotulo: `Responsável · ${nomeEmpresa(id)}` }));
      }
      revendedorasB
        .filter((r) => r.usuario_id === u.id || (!!r.email && r.email.toLowerCase() === String(u.email).toLowerCase()))
        .forEach((r) =>
          areas.push({ perfil: 'revendedora', estabelecimentoId: r.empresa_id, revendedoraId: r.id, rotulo: `Revendedora · ${nomeEmpresa(r.empresa_id)}` })
        );
      if (!areas.length) return [];
      const [principal, ...outras] = areas;
      return [
        {
          id: u.id,
          nome: u.nome,
          email: u.email,
          senha: u.senha,
          perfil: principal.perfil,
          estabelecimentoId: principal.estabelecimentoId,
          revendedoraId: principal.revendedoraId ?? null,
          outrasAreas: outras,
        },
      ];
    });
  definirDadosDeAcessoRemotos(estabelecimentos, acessos);
  atalhos = []; // sem atalhos de teste: cada pessoa entra com o próprio login

  // Troca de senha e de dados (Configurações) grava na tabela usuarios
  registrarGravadorDeUsuario(async (id, campos) => {
    const { error } = await supabase!.from('usuarios').update(campos).eq('id', id);
    return error ? `Não foi possível salvar: ${error.message}` : null;
  });

  usarFonteRemotaConfig({
    atende: (id) => idsEmpresasBanco.has(id),
    ler: async (id) => {
      const { data, error } = await supabase!.from('empresas').select('*').eq('id', id).maybeSingle();
      if (error || !data) return null;
      linhasEmpresas.set(id, data);
      return configDoBanco(data);
    },
    gravar: async (id, c) => {
      const { error } = await supabase!
        .from('empresas')
        .update({
          nome: c.nome,
          slogan: nulo(c.slogan),
          logo_url: c.logoUri,
          documento: nulo(c.documento),
          telefone: nulo(c.telefone),
          email: nulo(c.email),
          instagram: nulo(c.instagram),
          endereco: nulo(c.endereco),
          cidade: nulo(c.cidade),
          estado: nulo(c.estado),
          chave_pix: nulo(c.chavePix),
          comissao_padrao_tipo: c.comissaoPadraoTipo,
          comissao_padrao_valor: c.comissaoPadraoValor,
        })
        .eq('id', id);
      if (error) {
        definirStatus('erro', `empresas: ${error.message}`);
        throw error;
      }
    },
  });

  fotografarTudo();
  definirStatus('ok');
};

if (bancoLigado && supabase) {
  // Troca de ateliê: para de gravar o anterior; se o novo é do banco, busca os dados dele
  registrarCarregadorRemoto((id) => {
    empresaAtiva = null;
    carregamento++;
    if (idsEmpresasBanco.has(id)) setTimeout(() => carregarEmpresa(id), 0);
  });
  const inicio = iniciar().catch((e) => definirStatus('erro', `Não foi possível conectar ao banco: ${e instanceof Error ? e.message : String(e)}`));
  aguardarAntesDaSessao(inicio);
  setInterval(() => {
    gravarDiferencas();
  }, 2000);
}

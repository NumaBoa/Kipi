import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Factory,
  Flame,
  MinusCircle,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Snowflake,
  Sparkles,
  Store,
  TrendingUp,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Estrutura } from "@/components/app/estrutura";
import { CartaoIndicador } from "@/components/app/painel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { brl, dataHora } from "@/lib/format";
import {
  useAjustarEstoqueAssado,
  useAssarFornada,
  useClientes,
  useHistoricoProducao,
  useInsumos,
  useProduzirLoteEstoque,
  useProdutos,
  useReceitas,
  useRegistrarVenda,
  useRevendedoras,
  useSalvarRemessaConsignacao,
  useVendas,
  verificarIngredientesSuficientes,
  type Cliente,
  type HistoricoProducao,
  type Insumo,
  type Produto,
  type Revendedora,
  type Venda,
} from "@/lib/dados";

export const Route = createFileRoute("/_authenticated/planejamento")({
  head: () => ({
    meta: [
      { title: "Produção de Cookies — Meu Ateliê" },
      {
        name: "description",
        content: "Controle ágil de cookies congelados no freezer e fornadas assadas para a vitrine.",
      },
      { property: "og:title", content: "Produção de Cookies — Meu Ateliê" },
      {
        property: "og:description",
        content: "Controle ágil de cookies congelados no freezer e fornadas assadas para a vitrine.",
      },
    ],
  }),
  component: PaginaPlanejamento,
});

export function PaginaPlanejamento() {
  const { data: produtos = [] } = useProdutos();
  const { data: insumos = [] } = useInsumos();
  const { data: receitas = [] } = useReceitas();
  const { data: vendas = [] } = useVendas();
  const { data: revendedoras = [] } = useRevendedoras();
  const { data: clientes = [] } = useClientes();
  const { data: historico = [] } = useHistoricoProducao();

  const assarFornada = useAssarFornada();
  const produzirMassas = useProduzirLoteEstoque();
  const ajustarAssados = useAjustarEstoqueAssado();
  const registrarVenda = useRegistrarVenda();
  const salvarRemessa = useSalvarRemessaConsignacao();

  // Estados de busca e filtros
  const [busca, setBusca] = useState("");
  const [mostrarApenasAtivos, setMostrarApenasAtivos] = useState(true);
  const [expandirEncomendas, setExpandirEncomendas] = useState(false);
  const [expandirHistorico, setExpandirHistorico] = useState(true);

  // Modal 1: Produzir massas para congelar
  const [modalProduzir, setModalProduzir] = useState(false);
  const [produtoProduzirId, setProdutoProduzirId] = useState("");
  const [qtdProduzir, setQtdProduzir] = useState<number | "">(7);
  const [baixarInsumos, setBaixarInsumos] = useState(true);

  // Modal 2: Assar fornada
  const [modalAssar, setModalAssar] = useState(false);
  const [produtoAssar, setProdutoAssar] = useState<Produto | null>(null);
  const [qtdAssar, setQtdAssar] = useState<number | "">(7);

  // Modal 3: Descarte / Perda de assados (queimado ou quebrado)
  const [modalPerda, setModalPerda] = useState(false);
  const [produtoPerda, setProdutoPerda] = useState<Produto | null>(null);
  const [qtdPerda, setQtdPerda] = useState<number | "">(1);
  const [motivoPerda, setMotivoPerda] = useState<string>("Queimou no forno");

  // Estados para Atalhos de Saída da Vitrine (Vendas & Revendedores)
  const [modalEscolhaSaida, setModalEscolhaSaida] = useState(false);
  const [produtoSaida, setProdutoSaida] = useState<Produto | null>(null);

  // Fluxo 1: Venda Balcão / Pronta-Entrega
  const [modalVendaBalcao, setModalVendaBalcao] = useState(false);
  const [produtoVendaId, setProdutoVendaId] = useState("");
  const [qtdVenda, setQtdVenda] = useState<number | "">(1);
  const [pagamentoVenda, setPagamentoVenda] = useState<"pix" | "dinheiro" | "cartao">("pix");
  const [clienteVendaId, setClienteVendaId] = useState("");

  // Fluxo 2: Entrega para Revendedor (Consignado)
  const [modalRemessa, setModalRemessa] = useState(false);
  const [revendedoraRemessaId, setRevendedoraRemessaId] = useState("");
  const [produtoRemessaId, setProdutoRemessaId] = useState("");
  const [qtdRemessa, setQtdRemessa] = useState<number | "">(7);
  const [obsRemessa, setObsRemessa] = useState("");

  // Lista de produtos filtrados
  const produtosFiltrados = useMemo(() => {
    return produtos.filter((p) => {
      if (mostrarApenasAtivos && p.ativo === false) return false;
      if (!busca.trim()) return true;
      return p.nome.toLowerCase().includes(busca.toLowerCase());
    });
  }, [produtos, busca, mostrarApenasAtivos]);

  // Coluna 1 (Freezer): prioriza os cookies que têm massa para assar (> 0 primeiro)
  const produtosFreezer = useMemo(() => {
    return [...produtosFiltrados].sort((a, b) => {
      const congA = Number(a.estoque_congelado || 0);
      const congB = Number(b.estoque_congelado || 0);
      if (congA > 0 && congB === 0) return -1;
      if (congA === 0 && congB > 0) return 1;
      if (congA !== congB) return congB - congA;
      return a.nome.localeCompare(b.nome);
    });
  }, [produtosFiltrados]);

  // Coluna 2 (Vitrine): prioriza os cookies que têm estoque assado (> 0 primeiro)
  const produtosVitrine = useMemo(() => {
    return [...produtosFiltrados].sort((a, b) => {
      const estA = Number(a.estoque || 0);
      const estB = Number(b.estoque || 0);
      if (estA > 0 && estB === 0) return -1;
      if (estA === 0 && estB > 0) return 1;
      if (estA !== estB) return estB - estA;
      return a.nome.localeCompare(b.nome);
    });
  }, [produtosFiltrados]);

  // Totais para os indicadores do topo
  const totalCongelado = useMemo(
    () => produtos.reduce((s, p) => s + (Number(p.estoque_congelado) || 0), 0),
    [produtos]
  );

  const totalAssadosVitrine = useMemo(
    () => produtos.reduce((s, p) => s + (Number(p.estoque) || 0), 0),
    [produtos]
  );

  const saboresZeradosNoFreezer = useMemo(
    () => produtos.filter((p) => p.ativo !== false && (Number(p.estoque_congelado) || 0) === 0).length,
    [produtos]
  );

  // Encomendas agendadas que ainda precisam de entrega
  const encomendasAgendadas = useMemo(() => {
    return vendas.filter(
      (v) =>
        v.tipo_pedido === "sob_encomenda" &&
        v.status !== "cancelado" &&
        v.status_producao !== "entregue"
    );
  }, [vendas]);

  // Checagem de ingredientes para produzir massa no freezer
  const produtoSelecionadoProduzir = useMemo(
    () => produtos.find((p) => p.id === produtoProduzirId),
    [produtos, produtoProduzirId]
  );

  const checagemIngredientes = useMemo(() => {
    const qtdNum = Number(qtdProduzir) || 0;
    if (!produtoProduzirId || qtdNum <= 0) return { suficiente: true, faltantes: [] };
    return verificarIngredientesSuficientes(
      produtoProduzirId,
      qtdNum,
      receitas,
      insumos,
      produtoSelecionadoProduzir?.rendimento_unidades || 1
    );
  }, [produtoProduzirId, qtdProduzir, receitas, insumos, produtoSelecionadoProduzir]);

  // AÇÃO RÁPIDA 1: Assar Fornada direta (com validação estrita de estoque congelado)
  const executarAssarFornada = async (prod: Produto, quantidade: number) => {
    const congelado = Number(prod.estoque_congelado || 0);
    if (congelado <= 0) {
      toast.error(`Não há massas de "${prod.nome}" no freezer para assar!`);
      return;
    }
    if (quantidade > congelado) {
      toast.error(
        `Estoque insuficiente no freezer! Disponível: ${congelado} un, solicitado: ${quantidade} un.`
      );
      return;
    }

    try {
      await assarFornada.mutateAsync({
        produtoId: prod.id,
        quantidadeAssada: quantidade,
      });
      toast.success(
        `🔥 ${quantidade}x "${prod.nome}" assados com sucesso! Transferido do freezer para a vitrine.`
      );
      setModalAssar(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao assar fornada.");
    }
  };

  // Abrir modal de assar para um produto específico
  const abrirModalAssar = (prod: Produto, quantidadeSugerida = 7) => {
    const congelado = Number(prod.estoque_congelado || 0);
    if (congelado <= 0) {
      toast.error(`"${prod.nome}" não possui massas congeladas no freezer.`);
      return;
    }
    setProdutoAssar(prod);
    setQtdAssar(Math.min(quantidadeSugerida, congelado));
    setModalAssar(true);
  };

  // Abrir modal de produção de massas para um produto
  const abrirModalProduzir = (prodId?: string) => {
    const idAlvo = prodId || produtos[0]?.id || "";
    setProdutoProduzirId(idAlvo);
    setQtdProduzir(7); // Padrão de 1 bandeja de 7
    setModalProduzir(true);
  };

  // AÇÃO RÁPIDA 2: Confirmar produção de massas cruas para o freezer
  const handleConfirmarProducao = async () => {
    if (!produtoProduzirId) {
      toast.error("Selecione o cookie que foi produzido.");
      return;
    }
    const prod = produtos.find((p) => p.id === produtoProduzirId);
    if (!prod) return;

    const qtdNum = Math.max(1, Number(qtdProduzir) || 1);

    if (baixarInsumos && !checagemIngredientes.suficiente) {
      const nomes = checagemIngredientes.faltantes
        .map((f) => `${f.nomeInsumo} (falta ${f.falta.toFixed(1)}${f.unidade})`)
        .join(", ");
      toast.error(`Ingredientes insuficientes no estoque! Faltam: ${nomes}`);
      return;
    }

    try {
      await produzirMassas.mutateAsync({
        produtoId: prod.id,
        quantidadeProduzida: qtdNum,
        tipoDestino: "congelado",
        baixarMateriais: baixarInsumos,
      });

      toast.success(
        `❄️ ${qtdNum} massas de "${prod.nome}" guardadas no freezer com sucesso!`
      );
      setModalProduzir(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao registrar produção de massas.");
    }
  };

  // Ação complementar: Descarte / Perda de cookies assados
  const handleConfirmarPerda = async () => {
    if (!produtoPerda) return;
    const qtdNum = Math.max(1, Number(qtdPerda) || 1);
    const estoqueAtual = Number(produtoPerda.estoque || 0);

    if (qtdNum > estoqueAtual) {
      toast.error(`Você não pode descartar mais do que o estoque pronto atual (${estoqueAtual} un).`);
      return;
    }

    try {
      await ajustarAssados.mutateAsync({
        produtoId: produtoPerda.id,
        quantidadePerda: qtdNum,
      });
      toast.success(
        `Baixa registrada: ${qtdNum}x "${produtoPerda.nome}" removidos da vitrine (${motivoPerda}).`
      );
      setModalPerda(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao registrar perda.");
    }
  };

  // Ações para o Atalho de Vendas/Saída na Vitrine
  const abrirEscolhaSaida = (prod?: Produto) => {
    if (prod) {
      setProdutoSaida(prod);
      setProdutoVendaId(prod.id);
      setProdutoRemessaId(prod.id);
      setQtdVenda(Math.min(1, Number(prod.estoque || 0)));
      setQtdRemessa(Math.min(7, Number(prod.estoque || 7)));
    } else {
      const primeiroComEstoque = produtosVitrine.find((p) => Number(p.estoque || 0) > 0) || produtos[0];
      setProdutoSaida(primeiroComEstoque || null);
      if (primeiroComEstoque) {
        setProdutoVendaId(primeiroComEstoque.id);
        setProdutoRemessaId(primeiroComEstoque.id);
      }
      setQtdVenda(1);
      setQtdRemessa(7);
    }
    setModalEscolhaSaida(true);
  };

  const handleConfirmarVendaBalcao = async () => {
    const prod = produtos.find((p) => p.id === produtoVendaId) || produtoSaida;
    if (!prod) {
      toast.error("Selecione um produto.");
      return;
    }
    const qtdNum = Math.max(1, Number(qtdVenda) || 1);
    const estoqueAtual = Number(prod.estoque || 0);

    if (qtdNum > estoqueAtual) {
      toast.error(`Estoque insuficiente na vitrine! Disponível: ${estoqueAtual} un.`);
      return;
    }

    try {
      await registrarVenda.mutateAsync({
        clienteId: clienteVendaId || null,
        canal: "propria",
        data: new Date().toISOString(),
        tipo_pedido: "pronta_entrega",
        itens: [{ produto: prod, quantidade: qtdNum, com_desconto: false }],
        pagamento: pagamentoVenda,
        status: "pago",
        observacoes: "Venda rápida registrada via atalho da Vitrine",
      });

      toast.success(`🎉 Venda de ${qtdNum}x "${prod.nome}" concluída! Estoque da vitrine atualizado.`);
      setModalVendaBalcao(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao registrar venda.");
    }
  };

  const handleConfirmarRemessaRevendedor = async () => {
    if (!revendedoraRemessaId) {
      toast.error("Selecione o revendedor parceiro.");
      return;
    }
    const prod = produtos.find((p) => p.id === produtoRemessaId) || produtoSaida;
    if (!prod) {
      toast.error("Selecione o produto.");
      return;
    }
    const rev = revendedoras.find((r) => r.id === revendedoraRemessaId);
    const qtdNum = Math.max(1, Number(qtdRemessa) || 1);
    const estoqueAtual = Number(prod.estoque || 0);

    if (qtdNum > estoqueAtual) {
      toast.error(`Estoque insuficiente na vitrine do ateliê! Disponível: ${estoqueAtual} un.`);
      return;
    }

    try {
      await salvarRemessa.mutateAsync({
        revendedora_id: revendedoraRemessaId,
        produto_id: prod.id,
        nome_produto: prod.nome,
        quantidade: qtdNum,
        baixar_estoque_atelie: true,
        observacoes: obsRemessa || null,
      });

      toast.success(`🚚 ${qtdNum}x "${prod.nome}" entregues para ${rev?.nome || "revendedor"}! Baixa realizada na vitrine.`);
      setModalRemessa(false);
      setObsRemessa("");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao registrar entrega para revendedor.");
    }
  };

  return (
    <Estrutura
      titulo="Produção de Cookies"
      subtitulo="Controle direto e sem burocracia: massas no freezer e fornadas assadas para a vitrine"
    >
      {/* INDICADORES PRINCIPAIS NO TOPO */}
      <section className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <CartaoIndicador
          rotulo="No Freezer (Congelados)"
          valor={`${totalCongelado} un`}
          detalhe="Massas cruas prontas para assar"
          etiqueta="congelados"
          tom={totalCongelado > 0 ? "brand" : "warning"}
        />

        <CartaoIndicador
          rotulo="Na Vitrine (Assados)"
          valor={`${totalAssadosVitrine} un`}
          detalhe="Cookies prontos para venda/revenda"
          etiqueta="assados"
          tom={totalAssadosVitrine > 0 ? "success" : "neutro"}
        />

        <CartaoIndicador
          rotulo="Freezer Zerado"
          valor={String(saboresZeradosNoFreezer)}
          detalhe="Sabores que precisam de massa urgente"
          etiqueta="atenção"
          tom={saboresZeradosNoFreezer > 0 ? "warning" : "neutro"}
        />

        <CartaoIndicador
          rotulo="Encomendas Marcadas"
          valor={String(encomendasAgendadas.length)}
          detalhe="Pedidos agendados de clientes"
          etiqueta="agendado"
          tom={encomendasAgendadas.length > 0 ? "brand" : "neutro"}
        />
      </section>

      {/* BARRA DE BUSCA E AÇÕES GLOBAIS */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar sabor de cookie..."
            className="pl-9 rounded-2xl bg-white border-slate-200 text-xs h-10 shadow-xs"
          />
          {busca && (
            <button
              onClick={() => setBusca("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => abrirModalProduzir()}
            className="rounded-2xl gap-2 font-bold bg-[#084463] text-white hover:bg-[#06344C] shadow-md shadow-[#084463]/20 h-10 px-4 text-xs shrink-0"
          >
            <Snowflake className="size-4 text-sky-300" /> + Produzir Massas (Freezer)
          </Button>
        </div>
      </div>

      {/* AS DUAS COLUNAS PRINCIPAIS: CONGELADOS vs ASSADOS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ========================================================= */}
        {/* COLUNA 1: MASSAS NO FREEZER (CONGELADOS)                   */}
        {/* ========================================================= */}
        <div className="bg-sky-50/40 rounded-3xl p-5 border border-sky-200/80 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-2 pb-3 border-b border-sky-200/70">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-sky-100 text-sky-700">
                  <Snowflake className="size-5" />
                </span>
                <div>
                  <h2 className="font-black text-slate-900 text-base flex items-center gap-2">
                    1. No Freezer (Congelados)
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 border border-sky-200">
                      {totalCongelado} massas
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Massas cruas prontas. Clique para assar fornadas de 7 em 7.
                  </p>
                </div>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => abrirModalProduzir()}
              className="rounded-xl font-bold border-sky-300 bg-white text-sky-900 hover:bg-sky-50 text-xs h-8 px-3 shrink-0"
              title="Registrar nova produção de massas cruas para o freezer"
            >
              <Plus className="size-3.5 mr-1" /> Bater Massa
            </Button>
          </div>

          {produtosFiltrados.length === 0 ? (
            <div className="text-center py-10 bg-white/60 rounded-2xl border border-dashed border-sky-200 space-y-3">
              <Snowflake className="size-8 mx-auto text-sky-300" />
              <p className="text-xs font-semibold text-slate-600">Nenhum cookie cadastrado ou encontrado.</p>
              <Link
                to="/produtos"
                className="inline-flex items-center justify-center rounded-xl font-bold bg-[#084463] text-white hover:bg-[#06344C] text-xs h-9 px-4 gap-1.5 shadow-xs"
              >
                <Plus className="size-3.5" /> Ir para Catálogo de Produtos
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {produtosFreezer.map((p) => {
                const congelado = Number(p.estoque_congelado || 0);
                const temEstoque = congelado > 0;

                return (
                  <div
                    key={p.id}
                    className={`p-3 px-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      temEstoque
                        ? "bg-white border-sky-200 hover:border-sky-300 hover:shadow-xs"
                        : "bg-slate-50/80 border-dashed border-slate-200"
                    }`}
                  >
                    {/* LADO ESQUERDO: PRODUTO + CATEGORIA */}
                    <div className="min-w-0 flex-1">
                      <h3 className={`font-black text-sm truncate ${temEstoque ? "text-slate-900" : "text-slate-600"}`}>
                        {p.nome}
                      </h3>
                      {p.categoria && (
                        <span className="text-[10px] font-semibold text-slate-400 block truncate">
                          {p.categoria}
                        </span>
                      )}
                    </div>

                    {/* LADO DIREITO: QUANTIDADE + BOTÃO */}
                    <div className="flex items-center gap-3 shrink-0">
                      {temEstoque ? (
                        <>
                          <div className="text-right">
                            <span className="font-black text-sky-700 text-sm">
                              {congelado}
                            </span>
                            <span className="text-[11px] font-semibold text-sky-900 ml-1">
                              {congelado === 1 ? "massa" : "massas"}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => abrirModalAssar(p, Math.min(7, congelado))}
                            className="h-8 px-3.5 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs"
                          >
                            <Flame className="size-3.5 text-amber-200 mr-1" /> Assar...
                          </Button>
                        </>
                      ) : (
                        <>
                          <span className="text-xs font-semibold text-slate-400">
                            0 massas
                          </span>
                          <Button
                            size="sm"
                            onClick={() => abrirModalProduzir(p.id)}
                            className="h-8 px-3.5 text-xs font-bold rounded-xl bg-[#084463] text-white hover:bg-[#06344C] shadow-xs shrink-0"
                          >
                            <Plus className="size-3.5 text-sky-300 mr-1" /> Bater Massa
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* COLUNA 2: COOKIES NA VITRINE (JÁ ASSADOS)                  */}
        {/* ========================================================= */}
        <div className="bg-amber-50/40 rounded-3xl p-5 border border-amber-200/80 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-2 pb-3 border-b border-amber-200/70">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-amber-100 text-amber-800">
                <Flame className="size-5" />
              </span>
              <div>
                <h2 className="font-black text-slate-900 text-base flex items-center gap-2">
                  2. Na Vitrine (Já Assados)
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200">
                    {totalAssadosVitrine} prontos
                  </span>
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Prontos para venda no balcão e entregas a revendedores.
                </p>
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => abrirEscolhaSaida()}
              className="rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 px-3 shrink-0 shadow-xs gap-1.5"
              title="Registrar venda no balcão ou entrega para revendedor"
            >
              <ShoppingBag className="size-3.5" /> Vender / Saída
            </Button>
          </div>

          {produtosVitrine.length === 0 ? (
            <div className="text-center py-10 bg-white/60 rounded-2xl border border-dashed border-amber-200 space-y-3">
              <Flame className="size-8 mx-auto text-amber-300" />
              <p className="text-xs font-semibold text-slate-600">Nenhum cookie cadastrado ou encontrado.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {produtosVitrine.map((p) => {
                const assados = Number(p.estoque || 0);
                const temPronto = assados > 0;

                return (
                  <div
                    key={p.id}
                    className={`p-3 px-4 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                      temPronto
                        ? "bg-white border-amber-200 hover:border-amber-300 hover:shadow-xs"
                        : "bg-slate-50/80 border-dashed border-slate-200"
                    }`}
                  >
                    {/* LADO ESQUERDO: PRODUTO + CATEGORIA + PREÇO */}
                    <div className="min-w-0 flex-1">
                      <h3 className={`font-black text-sm truncate ${temPronto ? "text-slate-900" : "text-slate-500"}`}>
                        {p.nome}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold truncate">
                        {p.categoria && <span>{p.categoria}</span>}
                        {p.categoria && <span>•</span>}
                        <span>{brl(p.preco)}</span>
                      </div>
                    </div>

                    {/* LADO DIREITO: QUANTIDADE PRONTA + BOTÃO DE SAÍDA / PERDA */}
                    <div className="flex items-center gap-2 shrink-0">
                      {temPronto ? (
                        <>
                          <div className="text-right mr-1">
                            <span className="font-black text-amber-900 text-sm">
                              {assados}
                            </span>
                            <span className="text-[11px] font-semibold text-amber-800 ml-1">
                              {assados === 1 ? "pronto" : "prontos"}
                            </span>
                          </div>

                          <Button
                            size="sm"
                            onClick={() => abrirEscolhaSaida(p)}
                            className="h-8 px-3 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs gap-1"
                            title="Vender ou entregar este cookie"
                          >
                            <ShoppingBag className="size-3.5 mr-0.5" /> Vender
                          </Button>

                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setProdutoPerda(p);
                              setQtdPerda(1);
                              setModalPerda(true);
                            }}
                            className="h-8 px-2 text-xs text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-xl"
                            title="Registrar perda (queimado, quebrado, etc.)"
                          >
                            <MinusCircle className="size-3.5 text-slate-400" />
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs font-semibold text-slate-400">
                          0 na vitrine
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* SEÇÃO OPCIONAL: ENCOMENDAS AGENDADAS DE CLIENTES          */}
      {/* ========================================================= */}
      {encomendasAgendadas.length > 0 && (
        <div className="mt-4 bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
          <div
            className="flex items-center justify-between cursor-pointer select-none"
            onClick={() => setExpandirEncomendas(!expandirEncomendas)}
          >
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-purple-100 text-purple-800">
                <Calendar className="size-5" />
              </span>
              <div>
                <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                  Encomendas Agendadas de Clientes
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-200">
                    {encomendasAgendadas.length} {encomendasAgendadas.length === 1 ? "pedido" : "pedidos"}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Pedidos sob medida encomendados com prazo de entrega específico.
                </p>
              </div>
            </div>

            <Button variant="ghost" size="sm" className="rounded-xl text-slate-500">
              {expandirEncomendas ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </Button>
          </div>

          {expandirEncomendas && (
            <div className="mt-4 pt-4 border-t border-slate-100 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {encomendasAgendadas.map((v) => (
                <div
                  key={v.id}
                  className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900">{v.clientes?.nome || "Cliente"}</span>
                    {v.data_entrega_prometida && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                        Entrega: {v.data_entrega_prometida}
                      </span>
                    )}
                  </div>

                  <div className="bg-white p-2.5 rounded-xl border border-slate-200/70 space-y-1">
                    {(v.venda_itens || []).map((i) => (
                      <div key={i.id} className="font-semibold text-slate-800 flex justify-between">
                        <span>{i.quantidade}x {i.nome_produto}</span>
                      </div>
                    ))}
                  </div>

                  {v.observacoes && (
                    <p className="text-[11px] text-slate-500 italic">"{v.observacoes}"</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* SEÇÃO: HISTÓRICO DE PRODUÇÃO & FORNADAS                   */}
      {/* ========================================================= */}
      <div className="mt-4 bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
        <div
          className="flex items-center justify-between cursor-pointer select-none"
          onClick={() => setExpandirHistorico(!expandirHistorico)}
        >
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-100 text-amber-900">
              <Clock className="size-5" />
            </span>
            <div>
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                Histórico de Fornadas e Produção
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                  {historico.length} {historico.length === 1 ? "registro" : "registros"}
                </span>
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Extrato com data e hora de massas batidas para o freezer e fornadas assadas para a vitrine.
              </p>
            </div>
          </div>

          <Button variant="ghost" size="sm" className="rounded-xl text-slate-500">
            {expandirHistorico ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
        </div>

        {expandirHistorico && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            {historico.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 font-medium space-y-2">
                <Clock className="size-8 mx-auto text-slate-300" />
                <p>Nenhuma produção ou fornada registrada ainda.</p>
                <p className="text-[11px] text-slate-400">Ao bater massas ou assar fornadas, cada evento com data e hora exata aparecerá aqui.</p>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {historico.slice(0, 18).map((h) => {
                  const ehFreezer = h.tipo === "bater_massa";
                  const ehVitrine = h.tipo === "assar_fornada";
                  const ehPerda = h.tipo === "descarte_perda";

                  return (
                    <div
                      key={h.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs transition-all ${
                        ehFreezer
                          ? "bg-sky-50/50 border-sky-200/80 hover:bg-sky-50"
                          : ehVitrine
                          ? "bg-amber-50/50 border-amber-200/80 hover:bg-amber-50"
                          : "bg-rose-50/50 border-rose-200/80 hover:bg-rose-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <span
                          className={`p-2 rounded-xl shrink-0 ${
                            ehFreezer
                              ? "bg-sky-100 text-sky-700"
                              : ehVitrine
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {ehFreezer ? (
                            <Snowflake className="size-4" />
                          ) : ehVitrine ? (
                            <Flame className="size-4" />
                          ) : (
                            <MinusCircle className="size-4" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-extrabold text-slate-900 truncate">
                            {h.nome_produto}
                          </h4>
                          <span className="text-[11px] font-semibold text-slate-500 block">
                            {dataHora(h.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`font-black text-sm block ${
                            ehFreezer
                              ? "text-sky-800"
                              : ehVitrine
                              ? "text-amber-900"
                              : "text-rose-700"
                          }`}
                        >
                          {ehPerda ? `-${h.quantidade}` : `+${h.quantidade}`} un
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-block ${
                            ehFreezer
                              ? "bg-sky-100 text-sky-800 border border-sky-200"
                              : ehVitrine
                              ? "bg-amber-100 text-amber-900 border border-amber-200"
                              : "bg-rose-100 text-rose-800 border border-rose-200"
                          }`}
                        >
                          {ehFreezer ? "❄️ No Freezer" : ehVitrine ? "🔥 Na Vitrine" : "🗑️ Descarte"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: PRODUZIR MASSAS CRUAS PARA O FREEZER              */}
      {/* ========================================================= */}
      <Dialog open={modalProduzir} onOpenChange={setModalProduzir}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#084463] flex items-center gap-2">
              <Snowflake className="size-5 text-sky-600" /> Produzir Massas (Freezer)
            </DialogTitle>
            <DialogDescription>
              Bata a massa, faça as porções de cookies e guarde cruas no congelador.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-bold text-slate-700">Sabor do Cookie</Label>
              <Select value={produtoProduzirId} onValueChange={setProdutoProduzirId}>
                <SelectTrigger className="mt-1 rounded-xl">
                  <SelectValue placeholder="Selecione o sabor" />
                </SelectTrigger>
                <SelectContent>
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} (Atual no freezer: {Number(p.estoque_congelado || 0)} un)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">
                Quantidade de Massas Produzidas
              </Label>
              <div className="flex gap-2 mt-1">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="7"
                  value={qtdProduzir === "" ? "" : String(qtdProduzir)}
                  onChange={(e) => {
                    const digitos = e.target.value.replace(/\D/g, "");
                    setQtdProduzir(digitos === "" ? "" : parseInt(digitos, 10));
                  }}
                  onBlur={() => {
                    if (qtdProduzir === "" || Number(qtdProduzir) <= 0) {
                      setQtdProduzir(7);
                    }
                  }}
                  className="rounded-xl font-bold"
                />

                {/* ATALHOS DE PRODUÇÃO DE 7 EM 7: 7, 14, 21, 28 */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl px-2.5 font-bold"
                  onClick={() => setQtdProduzir(7)}
                >
                  7 un
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl px-2.5 font-bold"
                  onClick={() => setQtdProduzir(14)}
                >
                  14 un
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl px-2.5 font-bold"
                  onClick={() => setQtdProduzir(21)}
                >
                  21 un
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl px-2.5 font-bold"
                  onClick={() => setQtdProduzir(28)}
                >
                  28 un
                </Button>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
              <input
                type="checkbox"
                id="chkBaixarInsumos"
                checked={baixarInsumos}
                onChange={(e) => setBaixarInsumos(e.target.checked)}
                className="size-4 accent-[#084463] rounded"
              />
              <label htmlFor="chkBaixarInsumos" className="text-xs text-slate-700 font-semibold cursor-pointer">
                Dar baixa automática nos ingredientes da receita (farinha, manteiga, chocolate...)
              </label>
            </div>

            {/* AVISO DE INGREDIENTES */}
            {baixarInsumos && produtoProduzirId && (
              <div>
                {!checagemIngredientes.suficiente ? (
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-300 text-xs text-rose-900 space-y-1.5">
                    <div className="font-extrabold flex items-center gap-1.5 text-rose-800">
                      <AlertTriangle className="size-4 text-rose-600 shrink-0" />
                      <span>Ingredientes Insuficientes para esta quantidade:</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-rose-800">
                      {checagemIngredientes.faltantes.map((f) => (
                        <li key={f.nomeInsumo}>
                          <strong>{f.nomeInsumo}</strong>: precisa {f.necessario.toFixed(1)} {f.unidade}, tem {f.disponivel} {f.unidade} (<span className="font-black text-rose-700">falta {f.falta.toFixed(1)} {f.unidade}</span>)
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    <span>Ingredientes suficientes no estoque para esta receita!</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setModalProduzir(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl font-bold bg-[#084463] text-white hover:bg-[#06344C] px-5 disabled:opacity-50"
              disabled={baixarInsumos && !checagemIngredientes.suficiente}
              onClick={handleConfirmarProducao}
            >
              Guardar no Freezer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 2: ASSAR FORNADA DO FREEZER                          */}
      {/* ========================================================= */}
      <Dialog open={modalAssar} onOpenChange={setModalAssar}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-amber-900 flex items-center gap-2">
              <Flame className="size-5 text-amber-600" /> Assar Fornada
            </DialogTitle>
            <DialogDescription>
              Tire as massas congeladas do freezer, asse e disponibilize imediatamente para venda na vitrine.
            </DialogDescription>
          </DialogHeader>

          {produtoAssar && (
            <div className="space-y-4 pt-2">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <span className="text-[11px] text-slate-500 font-bold uppercase tracking-wider block">
                  Produto Selecionado
                </span>
                <p className="font-black text-slate-900 text-base">{produtoAssar.nome}</p>
                <div className="flex items-center gap-3 text-xs pt-1">
                  <span className="text-sky-800 font-semibold">
                    ❄️ Freezer: <strong>{Number(produtoAssar.estoque_congelado || 0)} un</strong>
                  </span>
                  <span className="text-slate-300">|</span>
                  <span className="text-amber-800 font-semibold">
                    🍪 Vitrine: <strong>{Number(produtoAssar.estoque || 0)} un</strong>
                  </span>
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">
                  Quantidade a Assar nesta Fornada
                </Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="7"
                    value={qtdAssar === "" ? "" : String(qtdAssar)}
                    onChange={(e) => {
                      const digitos = e.target.value.replace(/\D/g, "");
                      const max = Number(produtoAssar.estoque_congelado || 0);
                      if (digitos === "") {
                        setQtdAssar("");
                      } else {
                        const num = parseInt(digitos, 10);
                        setQtdAssar(Math.min(max, num));
                      }
                    }}
                    onBlur={() => {
                      if (qtdAssar === "" || Number(qtdAssar) <= 0) {
                        setQtdAssar(Math.min(7, Number(produtoAssar.estoque_congelado || 1)));
                      }
                    }}
                    className="rounded-xl font-bold"
                  />

                  {/* ATALHOS SOLICITADOS: DE 7 EM 7 (+7, +14, +21, TUDO) */}
                  {Number(produtoAssar.estoque_congelado || 0) >= 7 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl px-2.5 font-black text-amber-900 border-amber-300 bg-amber-50"
                      onClick={() => setQtdAssar(7)}
                    >
                      +7 un
                    </Button>
                  )}

                  {Number(produtoAssar.estoque_congelado || 0) >= 14 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl px-2.5 font-black text-amber-900 border-amber-300 bg-amber-50"
                      onClick={() => setQtdAssar(14)}
                    >
                      +14 un
                    </Button>
                  )}

                  {Number(produtoAssar.estoque_congelado || 0) >= 21 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl px-2.5 font-black text-amber-900 border-amber-300 bg-amber-50"
                      onClick={() => setQtdAssar(21)}
                    >
                      +21 un
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl px-2.5 font-bold text-sky-800 border-sky-300 bg-sky-50"
                    onClick={() => setQtdAssar(Number(produtoAssar.estoque_congelado || 0))}
                  >
                    Tudo
                  </Button>
                </div>
              </div>

              {/* SIMULAÇÃO EM TEMPO REAL DO ESTOQUE */}
              {Number(qtdAssar) > 0 && (
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1.5 text-xs text-amber-950">
                  <div className="font-extrabold flex items-center gap-1.5 text-amber-900">
                    <Sparkles className="size-4 text-amber-600" />
                    <span>Transferência Imediata:</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                    <div className="p-2 bg-white rounded-lg border border-amber-200">
                      <span className="text-slate-500 block">No Freezer:</span>
                      <span className="font-bold text-sky-900">
                        {Number(produtoAssar.estoque_congelado || 0)} ➔{" "}
                        {Math.max(0, Number(produtoAssar.estoque_congelado || 0) - Number(qtdAssar))} un
                      </span>
                    </div>

                    <div className="p-2 bg-white rounded-lg border border-amber-200">
                      <span className="text-slate-500 block">Na Vitrine (Assados):</span>
                      <span className="font-bold text-emerald-800">
                        {Number(produtoAssar.estoque || 0)} ➔{" "}
                        {Number(produtoAssar.estoque || 0) + Number(qtdAssar)} un
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setModalAssar(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white px-5 disabled:opacity-50"
              disabled={
                !produtoAssar ||
                Number(qtdAssar) <= 0 ||
                Number(qtdAssar) > Number(produtoAssar.estoque_congelado || 0)
              }
              onClick={() => {
                if (produtoAssar) {
                  executarAssarFornada(produtoAssar, Number(qtdAssar) || 7);
                }
              }}
            >
              🔥 Assar Agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 3: REGISTRAR PERDA / QUEBRA DE ASSADOS               */}
      {/* ========================================================= */}
      <Dialog open={modalPerda} onOpenChange={setModalPerda}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-rose-900 flex items-center gap-2">
              <MinusCircle className="size-5 text-rose-600" /> Registrar Perda / Descarte
            </DialogTitle>
            <DialogDescription>
              Dê baixa em cookies que queimaram no forno, quebraram na vitrine ou foram usados para degustação.
            </DialogDescription>
          </DialogHeader>

          {produtoPerda && (
            <div className="space-y-4 pt-2">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-xs text-slate-500 font-semibold">Produto:</span>
                <p className="font-bold text-slate-900">{produtoPerda.nome}</p>
                <p className="text-xs text-slate-600">Estoque atual na vitrine: {produtoPerda.estoque} un</p>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Quantidade a Descartar</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={qtdPerda === "" ? "" : String(qtdPerda)}
                  onChange={(e) => {
                    const digitos = e.target.value.replace(/\D/g, "");
                    setQtdPerda(digitos === "" ? "" : parseInt(digitos, 10));
                  }}
                  className="mt-1 rounded-xl font-bold"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Motivo</Label>
                <Select value={motivoPerda} onValueChange={setMotivoPerda}>
                  <SelectTrigger className="mt-1 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Queimou no forno">Queimou no forno</SelectItem>
                    <SelectItem value="Quebrou na vitrine">Quebrou na vitrine</SelectItem>
                    <SelectItem value="Amostra / Degustação">Amostra / Degustação</SelectItem>
                    <SelectItem value="Ajuste de inventário">Ajuste de inventário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setModalPerda(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl font-bold bg-rose-600 hover:bg-rose-700 text-white"
              onClick={handleConfirmarPerda}
            >
              Confirmar Descarte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 4: ESCOLHA DO TIPO DE SAÍDA / VENDA                  */}
      {/* ========================================================= */}
      <Dialog open={modalEscolhaSaida} onOpenChange={setModalEscolhaSaida}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-amber-950 flex items-center gap-2">
              <ShoppingBag className="size-5 text-amber-600" /> Registrar Saída da Vitrine
            </DialogTitle>
            <DialogDescription>
              {produtoSaida ? (
                <span>
                  Para onde vão as unidades de <strong>{produtoSaida.nome}</strong> (disponível: {Number(produtoSaida.estoque || 0)} un)?
                </span>
              ) : (
                "Para onde vão os cookies assados que saíram da vitrine?"
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 pt-3">
            {/* OPÇÃO 1: VENDA BALCÃO / PRONTA-ENTREGA */}
            <button
              type="button"
              onClick={() => {
                setModalEscolhaSaida(false);
                setModalVendaBalcao(true);
              }}
              className="p-4 rounded-2xl border-2 border-amber-200 bg-amber-50/60 hover:bg-amber-100/80 hover:border-amber-400 text-left transition-all flex items-start gap-3.5 group shadow-xs cursor-pointer"
            >
              <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-xs group-hover:scale-105 transition-transform shrink-0">
                <Store className="size-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-amber-950 text-sm">
                    Vender no Balcão / Pronta-Entrega
                  </h4>
                  <ArrowRight className="size-4 text-amber-600 group-hover:translate-x-1 transition-transform" />
                </div>
                <p className="text-xs text-amber-900/80 mt-0.5">
                  Venda direta para cliente final (dinheiro, Pix ou cartão).
                </p>
                <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-amber-900 border border-amber-300">
                  💰 Baixa de estoque + Faturamento
                </span>
              </div>
            </button>

            {/* OPÇÃO 2: ENTREGA PARA REVENDEDOR */}
            <button
              type="button"
              onClick={() => {
                setModalEscolhaSaida(false);
                if (revendedoras.length > 0 && !revendedoraRemessaId) {
                  setRevendedoraRemessaId(revendedoras[0]!.id);
                }
                setModalRemessa(true);
              }}
              className="p-4 rounded-2xl border-2 border-sky-200 bg-sky-50/60 hover:bg-sky-100/80 hover:border-sky-400 text-left transition-all flex items-start gap-3.5 group shadow-xs cursor-pointer"
            >
              <div className="p-2.5 rounded-xl bg-[#084463] text-white shadow-xs group-hover:scale-105 transition-transform shrink-0">
                <Truck className="size-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-[#084463] text-sm">
                    Entregar para Revendedor (Consignado)
                  </h4>
                  <ArrowRight className="size-4 text-[#084463] group-hover:translate-x-1 transition-transform" />
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  Remessa de cookies entregues a um parceiro/revendedor.
                </p>
                <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-[#084463] border border-sky-300">
                  📦 Baixa do ateliê + Controle do revendedor
                </span>
              </div>
            </button>
          </div>

          <DialogFooter className="mt-2">
            <Button variant="ghost" className="rounded-xl text-slate-500" onClick={() => setModalEscolhaSaida(false)}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 5: VENDA NO BALCÃO / PRONTA-ENTREGA                  */}
      {/* ========================================================= */}
      <Dialog open={modalVendaBalcao} onOpenChange={setModalVendaBalcao}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-amber-950 flex items-center gap-2">
              <Store className="size-5 text-amber-600" /> Venda no Balcão (Pronta-Entrega)
            </DialogTitle>
            <DialogDescription>
              Registre a venda de cookies prontos da vitrine para cliente final.
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const prodAtual = produtos.find((p) => p.id === produtoVendaId) || produtoSaida;
            const estoqueVitrine = Number(prodAtual?.estoque || 0);
            const totalVenda = (Number(qtdVenda) || 0) * (Number(prodAtual?.preco) || 0);

            return (
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-xs font-bold text-slate-700">Cookie Vendido</Label>
                  <Select value={produtoVendaId} onValueChange={setProdutoVendaId}>
                    <SelectTrigger className="mt-1 rounded-xl">
                      <SelectValue placeholder="Selecione o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {produtosVitrine.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome} — {Number(p.estoque || 0)} un na vitrine ({brl(p.preco)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-700">Quantidade Vendida</Label>
                    <span className="text-xs font-bold text-amber-800">
                      Na vitrine: {estoqueVitrine} un
                    </span>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={qtdVenda === "" ? "" : String(qtdVenda)}
                      onChange={(e) => {
                        const digitos = e.target.value.replace(/\D/g, "");
                        if (digitos === "") {
                          setQtdVenda("");
                        } else {
                          const num = Math.min(estoqueVitrine, parseInt(digitos, 10));
                          setQtdVenda(num);
                        }
                      }}
                      onBlur={() => {
                        if (qtdVenda === "" || Number(qtdVenda) <= 0) {
                          setQtdVenda(Math.min(1, estoqueVitrine));
                        }
                      }}
                      className="rounded-xl font-bold"
                    />

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl px-2.5 font-bold"
                      onClick={() => setQtdVenda(Math.min(1, estoqueVitrine))}
                    >
                      1 un
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl px-2.5 font-bold"
                      onClick={() => setQtdVenda(Math.min(2, estoqueVitrine))}
                    >
                      2 un
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl px-2.5 font-bold"
                      onClick={() => setQtdVenda(Math.min(4, estoqueVitrine))}
                    >
                      4 un
                    </Button>
                    {estoqueVitrine > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl px-2.5 font-bold text-amber-800 border-amber-300 bg-amber-50"
                        onClick={() => setQtdVenda(estoqueVitrine)}
                      >
                        Tudo
                      </Button>
                    )}
                  </div>
                </div>

                {/* FORMA DE PAGAMENTO */}
                <div>
                  <Label className="text-xs font-bold text-slate-700">Forma de Pagamento</Label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {(
                      [
                        { id: "pix", label: "Pix", icon: "⚡" },
                        { id: "dinheiro", label: "Dinheiro", icon: "💵" },
                        { id: "cartao", label: "Cartão", icon: "💳" },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPagamentoVenda(m.id)}
                        className={`p-2.5 rounded-xl border text-xs font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          pagamentoVenda === m.id
                            ? "border-amber-500 bg-amber-50 text-amber-950 ring-2 ring-amber-300/40"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        <span className="text-base">{m.icon}</span>
                        <span>{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* CLIENTE OPCIONAL */}
                <div>
                  <Label className="text-xs font-bold text-slate-700">Cliente (Opcional)</Label>
                  <Select value={clienteVendaId} onValueChange={setClienteVendaId}>
                    <SelectTrigger className="mt-1 rounded-xl">
                      <SelectValue placeholder="Cliente Balcão (não identificado)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="balcao">Cliente Balcão</SelectItem>
                      {clientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome} {c.telefone ? `(${c.telefone})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* RESUMO TOTAL DA VENDA */}
                <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-950">Total a Pagar:</span>
                  <span className="text-lg font-black text-amber-950">{brl(totalVenda)}</span>
                </div>
              </div>
            );
          })()}

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setModalVendaBalcao(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white px-5"
              onClick={handleConfirmarVendaBalcao}
            >
              Confirmar Venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================= */}
      {/* MODAL 6: ENTREGA PARA REVENDEDOR (CONSIGNADO)              */}
      {/* ========================================================= */}
      <Dialog open={modalRemessa} onOpenChange={setModalRemessa}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#084463] flex items-center gap-2">
              <Truck className="size-5 text-sky-600" /> Entrega para Revendedor
            </DialogTitle>
            <DialogDescription>
              Transfira cookies prontos da vitrine do ateliê para a pasta/estoque do revendedor parceiro.
            </DialogDescription>
          </DialogHeader>

          {(() => {
            const prodAtual = produtos.find((p) => p.id === produtoRemessaId) || produtoSaida;
            const estoqueVitrine = Number(prodAtual?.estoque || 0);

            return (
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-xs font-bold text-slate-700">Revendedor Parceiro</Label>
                  <Select value={revendedoraRemessaId} onValueChange={setRevendedoraRemessaId}>
                    <SelectTrigger className="mt-1 rounded-xl">
                      <SelectValue placeholder="Selecione o revendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {revendedoras.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.nome} {r.telefone ? `(${r.telefone})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-700">Cookie Entregue</Label>
                  <Select value={produtoRemessaId} onValueChange={setProdutoRemessaId}>
                    <SelectTrigger className="mt-1 rounded-xl">
                      <SelectValue placeholder="Selecione o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {produtosVitrine.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome} — {Number(p.estoque || 0)} un na vitrine
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-slate-700">Quantidade Entregue</Label>
                    <span className="text-xs font-bold text-sky-800">
                      Disponível na vitrine: {estoqueVitrine} un
                    </span>
                  </div>
                  <div className="flex gap-2 mt-1">
                    <Input
                      type="text"
                      inputMode="numeric"
                      value={qtdRemessa === "" ? "" : String(qtdRemessa)}
                      onChange={(e) => {
                        const digitos = e.target.value.replace(/\D/g, "");
                        if (digitos === "") {
                          setQtdRemessa("");
                        } else {
                          const num = Math.min(estoqueVitrine, parseInt(digitos, 10));
                          setQtdRemessa(num);
                        }
                      }}
                      onBlur={() => {
                        if (qtdRemessa === "" || Number(qtdRemessa) <= 0) {
                          setQtdRemessa(Math.min(7, estoqueVitrine));
                        }
                      }}
                      className="rounded-xl font-bold"
                    />

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl px-2.5 font-bold"
                      onClick={() => setQtdRemessa(Math.min(7, estoqueVitrine))}
                    >
                      7 un
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-xl px-2.5 font-bold"
                      onClick={() => setQtdRemessa(Math.min(14, estoqueVitrine))}
                    >
                      14 un
                    </Button>
                    {estoqueVitrine > 0 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl px-2.5 font-bold text-sky-800 border-sky-300 bg-sky-50"
                        onClick={() => setQtdRemessa(estoqueVitrine)}
                      >
                        Tudo
                      </Button>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold text-slate-700">Observações (Opcional)</Label>
                  <Input
                    type="text"
                    placeholder="Ex: Entrega semanal no café parceiro"
                    value={obsRemessa}
                    onChange={(e) => setObsRemessa(e.target.value)}
                    className="mt-1 rounded-xl text-xs"
                  />
                </div>

                <div className="p-3 bg-sky-50/80 border border-sky-200 rounded-xl text-xs text-sky-950 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-sky-900">
                    <Truck className="size-4 text-sky-600" />
                    <span>Baixa Automática no Ateliê:</span>
                  </div>
                  <p className="text-[11px] text-sky-800 leading-relaxed">
                    Ao confirmar, as <strong>{qtdRemessa || 0} un</strong> serão debitadas da vitrine do ateliê e adicionadas ao estoque consignado do revendedor parceiro.
                  </p>
                </div>
              </div>
            );
          })()}

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setModalRemessa(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl font-bold bg-[#084463] text-white hover:bg-[#06344C] px-5"
              onClick={handleConfirmarRemessaRevendedor}
            >
              Confirmar Entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Estrutura>
  );
}

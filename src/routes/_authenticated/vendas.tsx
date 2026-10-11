import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Calendar,
  DollarSign,
  Filter,
  History,
  Minus,
  Pencil,
  Plus,
  Receipt,
  ShoppingCart,
  Store,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Estrutura } from "@/components/app/estrutura";
import { CartaoIndicador, Etiqueta, Painel, TituloSecao, Vazio } from "@/components/app/painel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl, dataHora, num } from "@/lib/format";
import {
  calcularComissaoEstimadaCarrinho,
  calcularComissaoRevendedora,
  custoProduto,
  useApagarPagamentoComissao,
  useApagarRevendedora,
  useApagarVenda,
  useAtualizarVenda,
  useCategorias,
  useClientes,
  useInsumos,
  usePagamentosComissao,
  useProdutos,
  useReceitas,
  useRegistrarVenda,
  useRevendedoras,
  useSalvarPagamentoComissao,
  useSalvarRevendedora,
  useVendas,
  type ItemCarrinho,
  type Produto,
  type Revendedora,
  type Venda,
} from "@/lib/dados";

export const Route = createFileRoute("/_authenticated/vendas")({
  head: () => ({
    meta: [
      { title: "Vendas — Meu Ateliê" },
      {
        name: "description",
        content: "Registre vendas diretas ou por revendedoras e acompanhe o histórico.",
      },
      { property: "og:title", content: "Vendas — Meu Ateliê" },
      {
        property: "og:description",
        content: "Registre vendas diretas ou por revendedoras e acompanhe o histórico.",
      },
    ],
  }),
  component: PaginaVendas,
});

const dataHoje = () => new Date().toISOString().split("T")[0] ?? "";

type FiltroPeriodo = "todos" | "hoje" | "7dias" | "mes_atual" | "mes_anterior";

function PaginaVendas() {
  const { data: produtos = [] } = useProdutos();
  const { data: clientes = [] } = useClientes();
  const { data: revendedoras = [] } = useRevendedoras();
  const { data: insumos = [] } = useInsumos();
  const { data: receitas = [] } = useReceitas();
  const { data: vendas = [] } = useVendas();
  const { data: pagamentosComissao = [] } = usePagamentosComissao();
  const { data: categoriasData = [] } = useCategorias();

  const registrar = useRegistrarVenda();
  const atualizar = useAtualizarVenda();
  const apagar = useApagarVenda();
  const salvarRevendedora = useSalvarRevendedora();
  const apagarRevendedora = useApagarRevendedora();
  const salvarPagamentoComissao = useSalvarPagamentoComissao();
  const apagarPagamentoComissao = useApagarPagamentoComissao();

  const [abertoModalVenda, setAbertoModalVenda] = useState(false);
  const [modalRevendedorasOpen, setModalRevendedorasOpen] = useState(false);
  const [modalCadastrarRevendedora, setModalCadastrarRevendedora] = useState(false);
  const [revendedoraDetalheId, setRevendedoraDetalheId] = useState<string | null>(null);
  const [modalPagamentoComissao, setModalPagamentoComissao] = useState(false);

  // Form states
  const [formRevendedora, setFormRevendedora] = useState<Partial<Revendedora>>({});
  const [formPagamentoValor, setFormPagamentoValor] = useState("");
  const [formPagamentoData, setFormPagamentoData] = useState(dataHoje());
  const [formPagamentoObs, setFormPagamentoObs] = useState("");

  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [clienteId, setClienteId] = useState<string>("sem");
  const [canal, setCanal] = useState<"propria" | "revendedora">("propria");
  const [revendedoraId, setRevendedoraId] = useState<string>("sem");
  const [dataVenda, setDataVenda] = useState<string>(dataHoje());
  const [pagamento, setPagamento] = useState<Venda["pagamento"]>("pix");
  const [status, setStatus] = useState<Venda["status"]>("pago");
  const [observacoes, setObservacoes] = useState("");
  const [busca, setBusca] = useState("");
  const [categoriaAtiva, setCategoriaAtiva] = useState<string>("todos");
  
  // Filtro de canal do histórico
  const [filtroCanal, setFiltroCanal] = useState<"todos" | "propria" | "revendedora">("todos");
  // Item 7: Filtro de período para histórico e mini dash
  const [filtroPeriodo, setFiltroPeriodo] = useState<FiltroPeriodo>("todos");

  // Lista de categorias unificada
  const categorias = useMemo(() => {
    const conjunto = new Set<string>();
    categoriasData.forEach((c) => {
      if (c?.nome) conjunto.add(c.nome.toLowerCase());
    });
    produtos.filter((p) => p.ativo).forEach((p) => {
      if (p.categoria) conjunto.add(p.categoria.toLowerCase());
    });
    return ["todos", ...Array.from(conjunto)];
  }, [categoriasData, produtos]);

  // Regra 1: Selecionar automaticamente se só tiver 1 revendedora
  const selecionarCanal = (novoCanal: "propria" | "revendedora") => {
    setCanal(novoCanal);
    if (novoCanal === "revendedora") {
      setStatus("pago"); // Item 4: padrão é sempre paga
      if (revendedoras.length === 1 && revendedoras[0]) {
        setRevendedoraId(revendedoras[0].id);
      } else if (revendedoraId === "sem" && revendedoras.length > 1) {
        setRevendedoraId("sem");
      }
    } else {
      setRevendedoraId("sem");
    }
  };

  const revendedoraSelecionadaModal = useMemo(() => {
    if (canal !== "revendedora") return null;
    if (revendedoras.length === 1) return revendedoras[0];
    return revendedoras.find((r) => r.id === revendedoraId) ?? null;
  }, [canal, revendedoras, revendedoraId]);

  // Cálculos do Carrinho da Nova Venda
  const totalCarrinho = carrinho.reduce((s, i) => s + Number(i.produto.preco) * i.quantidade, 0);
  const custoInsumosCarrinho = carrinho.reduce(
    (s, i) => s + custoProduto(i.produto.id, receitas, insumos) * i.quantidade,
    0
  );
  // Item 5: comissão no custo estimado
  const comissaoCarrinho = calcularComissaoEstimadaCarrinho(carrinho, revendedoraSelecionadaModal);
  const custoTotalCarrinho = custoInsumosCarrinho + comissaoCarrinho;
  const lucroEstimadoCarrinho = totalCarrinho - custoTotalCarrinho;

  const produtosFiltrados = useMemo(() => {
    return produtos
      .filter((p) => p.ativo)
      .filter((p) => {
        if (categoriaAtiva !== "todos" && p.categoria.toLowerCase() !== categoriaAtiva) {
          return false;
        }
        if (busca.trim() && !p.nome.toLowerCase().includes(busca.trim().toLowerCase())) {
          return false;
        }
        return true;
      });
  }, [produtos, categoriaAtiva, busca]);

  // Item 7: Filtragem de vendas por Período
  const vendasFiltradasPorPeriodo = useMemo(() => {
    const agora = new Date();
    const hojeStr = dataHoje();

    return vendas.filter((venda) => {
      const dataVendaObj = new Date(venda.data);
      if (filtroPeriodo === "hoje") {
        return venda.data.startsWith(hojeStr);
      }
      if (filtroPeriodo === "7dias") {
        const limite = new Date();
        limite.setDate(limite.getDate() - 7);
        return dataVendaObj >= limite;
      }
      if (filtroPeriodo === "mes_atual") {
        return (
          dataVendaObj.getMonth() === agora.getMonth() &&
          dataVendaObj.getFullYear() === agora.getFullYear()
        );
      }
      if (filtroPeriodo === "mes_anterior") {
        const mesPassado = new Date(agora.getFullYear(), agora.getMonth() - 1, 1);
        return (
          dataVendaObj.getMonth() === mesPassado.getMonth() &&
          dataVendaObj.getFullYear() === mesPassado.getFullYear()
        );
      }
      return true; // todos
    });
  }, [vendas, filtroPeriodo]);

  // Vendas exibidas na tabela (Período + Canal)
  const vendasExibidas = useMemo(
    () =>
      vendasFiltradasPorPeriodo.filter((v) => {
        if (filtroCanal === "propria") return v.canal !== "revendedora";
        if (filtroCanal === "revendedora") return v.canal === "revendedora";
        return true;
      }),
    [vendasFiltradasPorPeriodo, filtroCanal]
  );

  // Cálculos do Mini Dash (Baseados no Filtro de Período)
  const validasVendasPeriodo = vendasFiltradasPorPeriodo.filter((v) => v.status !== "cancelado");
  const totalFaturamento = validasVendasPeriodo.reduce((s, v) => s + Number(v.total), 0);
  
  // Lucro total considerando custo dos insumos e comissão das revendedoras
  const totalLucro = validasVendasPeriodo.reduce((s, v) => {
    const revendedora = v.canal === "revendedora" && v.revendedora_id ? revendedoras.find((r) => r.id === v.revendedora_id) : null;
    const comissao = calcularComissaoRevendedora(v, revendedora);
    return s + (Number(v.total) - Number(v.custo_total) - comissao);
  }, 0);

  const vendasProprias = validasVendasPeriodo.filter((v) => v.canal !== "revendedora");
  const vendasRevendedor = validasVendasPeriodo.filter((v) => v.canal === "revendedora");
  const faturadoRevendedor = vendasRevendedor.reduce((s, v) => s + Number(v.total), 0);

  // Item 3: comissão total no mini dash para "Via Revendedoras"
  const totalComissoesRevendedoras = vendasRevendedor.reduce((s, v) => {
    const rev = v.revendedora_id ? revendedoras.find((r) => r.id === v.revendedora_id) : null;
    return s + calcularComissaoRevendedora(v, rev);
  }, 0);

  const getQtdCarrinho = (produtoId: string) => {
    const item = carrinho.find((i) => i.produto.id === produtoId);
    return item ? item.quantidade : 0;
  };

  const setQtdCarrinho = (produto: Produto, quantidade: number) => {
    setCarrinho((atual) => {
      const existe = atual.find((i) => i.produto.id === produto.id);
      if (quantidade <= 0) {
        return atual.filter((i) => i.produto.id !== produto.id);
      }
      if (existe) {
        return atual.map((i) => (i.produto.id === produto.id ? { ...i, quantidade } : i));
      }
      return [...atual, { produto, quantidade }];
    });
  };

  const abrirNovaVenda = () => {
    setCarrinho([]);
    setObservacoes("");
    setCanal("propria");
    setRevendedoraId("sem");
    setDataVenda(dataHoje());
    setBusca("");
    setCategoriaAtiva("todos");
    setPagamento("pix");
    setStatus("pago");
    setAbertoModalVenda(true);
  };

  const salvar = async () => {
    if (carrinho.length === 0) {
      toast.error("Adicione pelo menos um produto ao carrinho.");
      return;
    }
    if (canal === "revendedora") {
      if (revendedoras.length === 0) {
        toast.error("Cadastre uma revendedora primeiro.");
        return;
      }
      if (revendedoras.length > 1 && revendedoraId === "sem") {
        toast.error("Selecione qual revendedora fez a venda.");
        return;
      }
    }

    try {
      const finalRevendedoraId =
        canal === "revendedora"
          ? revendedoras.length === 1 && revendedoras[0]
            ? revendedoras[0].id
            : revendedoraId !== "sem"
              ? revendedoraId
              : null
          : null;

      await registrar.mutateAsync({
        itens: carrinho,
        clienteId: clienteId === "sem" ? null : clienteId,
        canal,
        revendedoraId: finalRevendedoraId,
        data: dataVenda,
        pagamento: canal === "revendedora" ? "pix" : pagamento,
        status: canal === "revendedora" ? "pago" : status,
        observacoes,
        receitas,
        insumos,
      });

      toast.success("Venda registrada com sucesso!");
      setAbertoModalVenda(false);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar a venda.");
    }
  };

  const abrirFormNovaRevendedora = (r?: Revendedora) => {
    if (r) {
      setFormRevendedora({ ...r, cliente_ids: r.cliente_ids ? [...r.cliente_ids] : [] });
    } else {
      setFormRevendedora({
        tipo_comissao: "porcentagem",
        comissao_percentual: 15,
        comissao_fixa: 0,
        cliente_ids: [],
      });
    }
    setModalCadastrarRevendedora(true);
  };

  const salvarNovaRevendedora = async () => {
    if (!formRevendedora.nome?.trim()) {
      toast.error("Informe o nome da revendedora.");
      return;
    }
    try {
      await salvarRevendedora.mutateAsync({
        ...formRevendedora,
        tipo_comissao: formRevendedora.tipo_comissao ?? "porcentagem",
        comissao_percentual: Number(formRevendedora.comissao_percentual) || 0,
        comissao_fixa: Number(formRevendedora.comissao_fixa) || 0,
        cliente_ids: formRevendedora.cliente_ids ?? [],
      });
      toast.success("Revendedora salva!");
      setFormRevendedora({});
      setModalCadastrarRevendedora(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar.");
    }
  };

  const revendedoraEmDetalhes = useMemo(() => {
    if (!revendedoraDetalheId) return null;
    return revendedoras.find((r) => r.id === revendedoraDetalheId) ?? null;
  }, [revendedoras, revendedoraDetalheId]);

  // Vendas e pagamentos da revendedora em detalhes
  const vendasDaRevendedoraDetalhes = useMemo(() => {
    if (!revendedoraDetalheId) return [];
    return vendas.filter(
      (v) => v.canal === "revendedora" && v.revendedora_id === revendedoraDetalheId && v.status !== "cancelado"
    );
  }, [vendas, revendedoraDetalheId]);

  const pagamentosDaRevendedoraDetalhes = useMemo(() => {
    if (!revendedoraDetalheId) return [];
    return pagamentosComissao.filter((p) => p.revendedora_id === revendedoraDetalheId);
  }, [pagamentosComissao, revendedoraDetalheId]);

  const totalVendidoRevendedoraDetalhes = vendasDaRevendedoraDetalhes.reduce((s, v) => s + Number(v.total), 0);
  const totalComissaoAcumuladaRevendedora = vendasDaRevendedoraDetalhes.reduce((s, v) => {
    return s + calcularComissaoRevendedora(v, revendedoraEmDetalhes);
  }, 0);
  const totalComissaoPagaRevendedora = pagamentosDaRevendedoraDetalhes.reduce((s, p) => s + Number(p.valor), 0);
  const saldoAPagarRevendedora = Math.max(0, totalComissaoAcumuladaRevendedora - totalComissaoPagaRevendedora);

  const registrarPagamentoComissaoSubmit = async () => {
    const val = Number(formPagamentoValor);
    if (!revendedoraDetalheId || isNaN(val) || val <= 0) {
      toast.error("Informe um valor válido de pagamento.");
      return;
    }
    try {
      await salvarPagamentoComissao.mutateAsync({
        revendedora_id: revendedoraDetalheId,
        valor: val,
        data: formPagamentoData ? new Date(`${formPagamentoData}T12:00:00`).toISOString() : new Date().toISOString(),
        observacoes: formPagamentoObs || null,
      });
      toast.success("Pagamento de comissão registrado!");
      setModalPagamentoComissao(false);
      setFormPagamentoValor("");
      setFormPagamentoObs("");
    } catch {
      toast.error("Erro ao registrar pagamento.");
    }
  };

  return (
    <Estrutura
      titulo="Vendas"
      subtitulo="Registro e histórico por canal"
      acao={
        <div className="flex flex-wrap items-center gap-2">
          {/* Item 7: Select Filtro de Período */}
          <Select value={filtroPeriodo} onValueChange={(v) => setFiltroPeriodo(v as FiltroPeriodo)}>
            <SelectTrigger className="h-10 rounded-2xl bg-card text-xs font-medium border-border w-[160px]">
              <div className="flex items-center gap-1.5">
                <Filter className="size-3.5 text-muted-foreground" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-2xl">
              <SelectItem value="todos">Todo o histórico</SelectItem>
              <SelectItem value="hoje">Hoje</SelectItem>
              <SelectItem value="7dias">Últimos 7 dias</SelectItem>
              <SelectItem value="mes_atual">Este mês</SelectItem>
              <SelectItem value="mes_anterior">Mês passado</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" className="rounded-2xl" onClick={() => setModalRevendedorasOpen(true)}>
            <Store className="size-4" /> Revendedoras ({revendedoras.length})
          </Button>
          <Button className="rounded-2xl" onClick={abrirNovaVenda}>
            <Plus className="size-4" /> Nova venda
          </Button>
        </div>
      }
    >
      {/* Mini Dashboard de Vendas (Filtrado pelo Período) */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:gap-5 2xl:gap-6">
        <CartaoIndicador
          rotulo="Total de vendas"
          valor={String(validasVendasPeriodo.length)}
          detalhe={`${validasVendasPeriodo.length} vendas no período`}
          etiqueta="histórico"
          tom="brand"
        />
        <CartaoIndicador
          rotulo="Faturamento total"
          valor={brl(totalFaturamento)}
          detalhe={`Lucro líquido de ${brl(totalLucro)}`}
          etiqueta="receita"
          tom="blossom"
        />
        <CartaoIndicador
          rotulo="Vendas próprias (Ateliê)"
          valor={brl(vendasProprias.reduce((s, v) => s + Number(v.total), 0))}
          detalhe={`${vendasProprias.length} vendas diretas`}
          etiqueta="direta"
          tom="success"
        />
        {/* Item 3: Indicador de comissão nas vendas via revendedoras */}
        <CartaoIndicador
          rotulo="Via Revendedoras"
          valor={brl(faturadoRevendedor)}
          detalhe={`${brl(totalComissoesRevendedoras)} em comissão (${vendasRevendedor.length} vendas)`}
          etiqueta="parceiros"
          tom="warning"
        />
      </section>

      <Painel className="p-6">
        <TituloSecao
          titulo="Histórico de vendas"
          descricao={`${vendasExibidas.length} ${vendasExibidas.length === 1 ? "venda exibida" : "vendas exibidas"}`}
          acao={
            <Tabs value={filtroCanal} onValueChange={(v) => setFiltroCanal(v as typeof filtroCanal)}>
              <TabsList className="rounded-full">
                <TabsTrigger value="todos" className="rounded-full text-xs">
                  Todas
                </TabsTrigger>
                <TabsTrigger value="propria" className="rounded-full text-xs">
                  Próprias ({vendasProprias.length})
                </TabsTrigger>
                <TabsTrigger value="revendedora" className="rounded-full text-xs">
                  Revendedoras ({vendasRevendedor.length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          }
        />
        <div className="mt-4 space-y-2">
          {vendasExibidas.length === 0 ? (
            <Vazio texto="Nenhuma venda encontrada para este filtro." />
          ) : (
            vendasExibidas.map((venda) => {
              const revendedoraObj = venda.canal === "revendedora" && venda.revendedora_id ? revendedoras.find((r) => r.id === venda.revendedora_id) : null;
              // Item 8: Valor da comissão no histórico de vendas
              const comissao = calcularComissaoRevendedora(venda, revendedoraObj);
              const lucroLiquido = Number(venda.total) - Number(venda.custo_total) - comissao;

              return (
                <div
                  key={venda.id}
                  className="glass-inset grid gap-3 rounded-2xl px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="truncate text-sm font-medium">
                        {venda.venda_itens
                          .map((i) => `${num(i.quantidade, 0)}× ${i.nome_produto}`)
                          .join(", ") || "Venda"}
                      </p>
                      <Etiqueta tom={venda.canal === "revendedora" ? "blossom" : "brand"}>
                        {venda.canal === "revendedora"
                          ? `Revenda: ${venda.revendedoras?.nome ?? "Parceiro"}`
                          : "Venda própria"}
                      </Etiqueta>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {venda.canal === "revendedora"
                        ? `Via ${venda.revendedoras?.nome ?? "revendedora"}${venda.clientes?.nome ? ` · Cliente: ${venda.clientes.nome}` : ""}`
                        : (venda.clientes?.nome ?? "Sem cliente")}{" "}
                      · {dataHora(venda.data)} · {venda.pagamento}
                      {venda.observacoes ? ` · ${venda.observacoes}` : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold tabular-nums">
                      {brl(Number(venda.total))}
                    </span>

                    {/* Item 8: Exibe valor da comissão se for revendedora */}
                    {venda.canal === "revendedora" && comissao > 0 ? (
                      <Etiqueta tom="warning" className="text-[11px]">
                        comissão {brl(comissao)}
                      </Etiqueta>
                    ) : null}

                    <Etiqueta tom="brand" className="text-[11px]">
                      lucro {brl(lucroLiquido)}
                    </Etiqueta>

                    <Select
                      value={venda.status}
                      onValueChange={(valor) =>
                        atualizar.mutate({ id: venda.id, status: valor as Venda["status"] })
                      }
                    >
                      <SelectTrigger className="h-8 w-[130px] rounded-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pago">Pago</SelectItem>
                        <SelectItem value="pendente">Pendente</SelectItem>
                        <SelectItem value="cancelado">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-full text-muted-foreground"
                      aria-label="Apagar venda"
                      onClick={() => apagar.mutate(venda.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Painel>

      {/* MODAL NOVA VENDA */}
      <Dialog open={abertoModalVenda} onOpenChange={setAbertoModalVenda}>
        <DialogContent className="w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl flex items-center justify-between">
              <span>Nova Venda</span>
              {carrinho.length > 0 ? (
                <Etiqueta tom="brand" className="text-xs">
                  {carrinho.reduce((s, i) => s + i.quantidade, 0)} itens no carrinho
                </Etiqueta>
              ) : null}
            </DialogTitle>
            <DialogDescription>
              Selecione o canal de venda, a data, a categoria dos produtos e ajuste a quantidade.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* 1. Origem da Venda e Data (Item 6 fix: Layout Grid Alinhado) */}
            <div className="grid gap-4 sm:grid-cols-3 items-start">
              <div className="sm:col-span-2 glass-inset rounded-2xl p-3.5 space-y-3">
                <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider block">
                  1. Origem da Venda (Canal)
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => selecionarCanal("propria")}
                    className={`flex items-center justify-center gap-2 rounded-xl p-2.5 border text-xs transition-all ${
                      canal === "propria"
                        ? "border-brand bg-brand/15 font-semibold text-brand shadow-sm"
                        : "border-border text-muted-foreground hover:bg-card/60"
                    }`}
                  >
                    <Store className="size-4" />
                    <span>Venda Própria</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => selecionarCanal("revendedora")}
                    className={`flex items-center justify-center gap-2 rounded-xl p-2.5 border text-xs transition-all ${
                      canal === "revendedora"
                        ? "border-blossom bg-blossom/15 font-semibold text-blossom shadow-sm"
                        : "border-border text-muted-foreground hover:bg-card/60"
                    }`}
                  >
                    <Users className="size-4" />
                    <span>
                      {revendedoras.length === 1 && revendedoras[0] ? revendedoras[0].nome : "Revendedora"}
                    </span>
                  </button>
                </div>

                {canal === "revendedora" ? (
                  <>
                    {revendedoras.length > 1 ? (
                      <div className="space-y-1 pt-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Selecione a Revendedora</Label>
                          <button
                            type="button"
                            onClick={() => abrirFormNovaRevendedora()}
                            className="text-[11px] text-brand hover:underline font-medium"
                          >
                            + Cadastrar nova
                          </button>
                        </div>
                        <Select value={revendedoraId} onValueChange={setRevendedoraId}>
                          <SelectTrigger className="rounded-xl h-9 text-xs">
                            <SelectValue placeholder="Escolha a revendedora..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sem">Selecione uma revendedora...</SelectItem>
                            {revendedoras.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.nome} (
                                {r.tipo_comissao === "valor_fixo"
                                  ? `${brl(r.comissao_fixa)}/item`
                                  : `${r.comissao_percentual}% comissão`}
                                )
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : revendedoras.length === 0 ? (
                      <div className="flex items-center justify-between gap-2 rounded-xl bg-warning/15 px-3 py-2 text-xs text-warning border border-warning/20 pt-1">
                        <span>Nenhuma revendedora cadastrada.</span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 rounded-lg text-xs"
                          onClick={() => abrirFormNovaRevendedora()}
                        >
                          + Cadastrar
                        </Button>
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>

              {/* Data da Venda (Alinhamento limpo) */}
              <div className="glass-inset rounded-2xl p-3.5 space-y-2">
                <Label htmlFor="data-venda" className="font-semibold text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar className="size-3.5" /> Data da Venda
                </Label>
                <Input
                  id="data-venda"
                  type="date"
                  value={dataVenda}
                  onChange={(e) => setDataVenda(e.target.value)}
                  className="rounded-xl h-9 text-xs"
                />
              </div>
            </div>

            {/* 2. Seleção de Produtos por Categorias */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <Label className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                  2. Escolha os Produtos por Categoria
                </Label>
                <Input
                  placeholder="Filtrar por nome do produto..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="h-8 max-w-xs rounded-xl text-xs"
                />
              </div>

              {/* Categorias em Pílulas */}
              <div className="flex flex-wrap items-center gap-1.5">
                {categorias.map((cat) => {
                  const ativa = categoriaAtiva === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoriaAtiva(cat)}
                      className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-all border ${
                        ativa
                          ? "bg-brand text-primary-foreground border-brand shadow-sm font-semibold"
                          : "glass-inset text-muted-foreground border-border hover:bg-card/70"
                      }`}
                    >
                      {cat === "todos" ? "✨ Todas as categorias" : cat}
                    </button>
                  );
                })}
              </div>

              {/* Grid de Produtos */}
              <div className="grid gap-2.5 sm:grid-cols-2 max-h-60 overflow-y-auto pr-1">
                {produtosFiltrados.map((prod) => {
                  const qtd = getQtdCarrinho(prod.id);
                  const selecionado = qtd > 0;
                  return (
                    <div
                      key={prod.id}
                      className={`glass-inset rounded-2xl p-3 flex items-center justify-between gap-2 transition-all border ${
                        selecionado ? "border-brand/60 bg-brand/8" : "border-border hover:border-brand/30"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-medium text-xs truncate">{prod.nome}</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider rounded-md bg-foreground/5 px-1.5 py-0.5 capitalize">
                            {prod.categoria}
                          </span>
                        </div>
                        <p className="text-xs font-semibold tabular-nums mt-1 text-brand">
                          {brl(Number(prod.preco))}
                          <span className="text-[10px] font-normal text-muted-foreground ml-2">
                            ({num(Number(prod.estoque), 0)} un em estoque)
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 bg-card/80 rounded-xl p-1 border border-border">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 rounded-lg text-muted-foreground hover:text-foreground"
                          aria-label="Diminuir"
                          onClick={() => setQtdCarrinho(prod, qtd - 1)}
                          disabled={qtd <= 0}
                        >
                          <Minus className="size-3" />
                        </Button>
                        <span className="w-5 text-center text-xs font-semibold tabular-nums">
                          {qtd}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6 rounded-lg text-muted-foreground hover:text-brand"
                          aria-label="Aumentar"
                          onClick={() => setQtdCarrinho(prod, qtd + 1)}
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}

                {produtosFiltrados.length === 0 ? (
                  <div className="sm:col-span-2">
                    <Vazio texto="Nenhum produto nesta categoria." />
                  </div>
                ) : null}
              </div>
            </div>

            {/* 3. Detalhes da Venda (Cliente, Pagamento, Observações) */}
            <div className="pt-2 border-t border-border space-y-3">
              {canal === "revendedora" ? (
                <div className="rounded-2xl bg-blossom/10 border border-blossom/20 p-3 text-xs text-blossom flex items-center justify-between">
                  <span>
                    Venda via Revendedora: Os pagamentos e acertos de comissão são gerenciados no módulo de Revendedoras.
                  </span>
                  <Etiqueta tom="blossom">Situação: PAGA</Etiqueta>
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">
                    {canal === "revendedora" ? "Cliente Final (Opcional)" : "Cliente"}
                  </Label>
                  <Select value={clienteId} onValueChange={setClienteId}>
                    <SelectTrigger className="rounded-xl h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sem">
                        {canal === "revendedora" ? "Sem cliente específico" : "Sem cliente (Venda balcão)"}
                      </SelectItem>
                      {clientes.map((c) => {
                        const vinculado = revendedoraSelecionadaModal?.cliente_ids?.includes(c.id);
                        return (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome} {vinculado ? " (Cliente parceiro)" : ""}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                {canal === "propria" ? (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Forma de Pagamento</Label>
                      <Select
                        value={pagamento}
                        onValueChange={(v) => setPagamento(v as Venda["pagamento"])}
                      >
                        <SelectTrigger className="rounded-xl h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pix">PIX</SelectItem>
                          <SelectItem value="dinheiro">Dinheiro</SelectItem>
                          <SelectItem value="cartao">Cartão</SelectItem>
                          <SelectItem value="transferencia">Transferência</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">Situação do Pagamento</Label>
                      <Select value={status} onValueChange={(v) => setStatus(v as Venda["status"])}>
                        <SelectTrigger className="rounded-xl h-9 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pago">Pago</SelectItem>
                          <SelectItem value="pendente">Pendente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                ) : null}

                <div className={`space-y-1 ${canal === "revendedora" ? "sm:col-span-2" : "sm:col-span-3"}`}>
                  <Label htmlFor="obs" className="text-xs">Observações / Detalhes do pedido</Label>
                  <Textarea
                    id="obs"
                    rows={2}
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder={canal === "revendedora" ? "Ex: Cliente indicado pela parceira, lote de entrega..." : "Detalhes da entrega, recheio especial..."}
                    className="rounded-xl text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Item 5: Resumo Financeiro da Venda incluindo Valor da Comissão */}
            <div className="glass-inset rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  Custo dos insumos: <span className="tabular-nums font-medium text-foreground">{brl(custoInsumosCarrinho)}</span>
                  {canal === "revendedora" && comissaoCarrinho > 0 ? (
                    <>
                      {" · "}Comissão revendedora: <span className="tabular-nums font-medium text-warning">{brl(comissaoCarrinho)}</span>
                    </>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Custo total estimado: <span className="tabular-nums font-medium text-foreground">{brl(custoTotalCarrinho)}</span> · Lucro líquido:{" "}
                  <span className="font-semibold text-success tabular-nums">{brl(lucroEstimadoCarrinho)}</span>
                </p>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-muted-foreground block">Total a receber</span>
                <span className="font-display text-2xl font-bold tracking-tight tabular-nums text-brand">
                  {brl(totalCarrinho)}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" className="rounded-2xl" onClick={() => setAbertoModalVenda(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-2xl gap-2"
              onClick={salvar}
              disabled={registrar.isPending || carrinho.length === 0}
            >
              <ShoppingCart className="size-4" /> Finalizar e Registrar Venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Gerenciar Revendedoras (Item 2 fix: Botão X com espaço e sem sobreposição) */}
      <Dialog open={modalRevendedorasOpen} onOpenChange={setModalRevendedorasOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader className="pr-8">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <DialogTitle className="font-display text-xl">Revendedoras Cadastradas</DialogTitle>
              <Button
                size="sm"
                className="rounded-xl"
                onClick={() => abrirFormNovaRevendedora()}
              >
                <Plus className="size-3.5" /> Nova revendedora
              </Button>
            </div>
            <DialogDescription>
              Gerencie suas parceiras, acompanhe acertos de comissões e histórico de repasses.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 space-y-2 max-h-80 overflow-y-auto pr-1">
            {revendedoras.length === 0 ? (
              <Vazio texto="Nenhuma revendedora cadastrada ainda." />
            ) : (
              revendedoras.map((r) => {
                const vendasDaRev = vendas.filter(
                  (v) => v.canal === "revendedora" && v.revendedora_id === r.id && v.status !== "cancelado"
                );
                const totalVendido = vendasDaRev.reduce((s, v) => s + Number(v.total), 0);
                const comissaoTotal = vendasDaRev.reduce((s, v) => s + calcularComissaoRevendedora(v, r), 0);
                const comissaoPaga = pagamentosComissao
                  .filter((p) => p.revendedora_id === r.id)
                  .reduce((s, p) => s + Number(p.valor), 0);
                const saldoDev = Math.max(0, comissaoTotal - comissaoPaga);

                const clientesAssociados = clientes.filter((c) => r.cliente_ids?.includes(c.id));

                return (
                  <div key={r.id} className="glass-inset rounded-2xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{r.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {r.telefone ?? "Sem telefone"} ·{" "}
                          <span className="font-medium text-foreground">
                            {r.tipo_comissao === "valor_fixo"
                              ? `${brl(r.comissao_fixa)} / item`
                              : `${r.comissao_percentual}% comissão`}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="rounded-xl text-xs gap-1 h-8"
                          onClick={() => {
                            setRevendedoraDetalheId(r.id);
                          }}
                        >
                          <Receipt className="size-3.5" /> Acertos & Detalhes
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-full text-muted-foreground"
                          onClick={() => abrirFormNovaRevendedora(r)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-full text-muted-foreground"
                          onClick={() => apagarRevendedora.mutate(r.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Clientes habituais / associados à revendedora */}
                    {clientesAssociados.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-1 text-[11px] pt-0.5">
                        <span className="text-muted-foreground">Clientes parceiros:</span>
                        {clientesAssociados.map((c) => (
                          <span key={c.id} className="bg-card/80 border border-border/50 rounded-md px-1.5 py-0.5 font-medium text-foreground">
                            {c.nome}
                          </span>
                        ))}
                      </div>
                    ) : null}

                    {/* Resumo financeiro rápido da revendedora */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-border/50 text-muted-foreground">
                      <span>Vendas: <strong className="text-foreground">{brl(totalVendido)}</strong> ({vendasDaRev.length})</span>
                      <span>
                        Comissão devida:{" "}
                        <strong className={saldoDev > 0 ? "text-warning" : "text-success"}>
                          {brl(saldoDev)}
                        </strong>
                        {saldoDev === 0 && comissaoTotal > 0 ? " (Quitado)" : ""}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setModalRevendedorasOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Item 9: Controle de Pagamentos, Vendas e Acerto da Revendedora */}
      <Dialog
        open={Boolean(revendedoraDetalheId)}
        onOpenChange={(open) => {
          if (!open) setRevendedoraDetalheId(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          {revendedoraEmDetalhes ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-display text-xl flex items-center justify-between pr-6">
                  <span>Controle de Acerto: {revendedoraEmDetalhes.nome}</span>
                </DialogTitle>
                <DialogDescription>
                  {revendedoraEmDetalhes.tipo_comissao === "valor_fixo"
                    ? `Regra de Comissão: ${brl(revendedoraEmDetalhes.comissao_fixa)} fixo por item vendido`
                    : `Regra de Comissão: ${revendedoraEmDetalhes.comissao_percentual}% sobre o valor bruto`}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-5 py-2">
                {/* 4 Cards Financeiros da Revendedora */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="glass-inset rounded-2xl p-3 text-center">
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Total Vendido</span>
                    <span className="text-base font-bold tabular-nums text-foreground">{brl(totalVendidoRevendedoraDetalhes)}</span>
                  </div>
                  <div className="glass-inset rounded-2xl p-3 text-center">
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Comissão Acumulada</span>
                    <span className="text-base font-bold tabular-nums text-foreground">{brl(totalComissaoAcumuladaRevendedora)}</span>
                  </div>
                  <div className="glass-inset rounded-2xl p-3 text-center">
                    <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Comissão Paga</span>
                    <span className="text-base font-bold tabular-nums text-success">{brl(totalComissaoPagaRevendedora)}</span>
                  </div>
                  <div className="glass-inset rounded-2xl p-3 text-center bg-warning/10 border border-warning/20">
                    <span className="text-[10px] uppercase text-warning font-semibold block">Saldo a Pagar</span>
                    <span className="text-base font-bold tabular-nums text-warning">{brl(saldoAPagarRevendedora)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Histórico de Repasses de Comissão</h4>
                  <Button
                    size="sm"
                    className="rounded-xl text-xs gap-1.5"
                    onClick={() => {
                      setFormPagamentoValor(saldoAPagarRevendedora > 0 ? String(saldoAPagarRevendedora) : "");
                      setFormPagamentoData(dataHoje());
                      setFormPagamentoObs("");
                      setModalPagamentoComissao(true);
                    }}
                  >
                    <DollarSign className="size-3.5" /> + Registrar Pagamento
                  </Button>
                </div>

                {/* Tabela de Pagamentos efetuados a ela */}
                <div className="glass-inset rounded-2xl p-3">
                  <div className="space-y-2">
                    {pagamentosDaRevendedoraDetalhes.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        Nenhum repasse registrado para esta revendedora.
                      </p>
                    ) : (
                      pagamentosDaRevendedoraDetalhes.map((pag) => (
                        <div key={pag.id} className="flex items-center justify-between bg-card/60 rounded-xl p-2 px-3 text-xs">
                          <div>
                            <span className="font-semibold text-success tabular-nums">{brl(Number(pag.valor))}</span>
                            <span className="text-muted-foreground ml-2">em {dataHora(pag.data)}</span>
                            {pag.observacoes ? <span className="text-muted-foreground block text-[11px]">{pag.observacoes}</span> : null}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-muted-foreground hover:text-destructive"
                            onClick={() => apagarPagamentoComissao.mutate(pag.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Histórico de Vendas desta Revendedora */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">Vendas Realizadas por {revendedoraEmDetalhes.nome}</h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {vendasDaRevendedoraDetalhes.length === 0 ? (
                      <Vazio texto="Nenhuma venda registrada ainda." />
                    ) : (
                      vendasDaRevendedoraDetalhes.map((venda) => {
                        const com = calcularComissaoRevendedora(venda, revendedoraEmDetalhes);
                        return (
                          <div key={venda.id} className="glass-inset rounded-xl p-2.5 px-3 flex items-center justify-between text-xs">
                            <div>
                              <p className="font-medium">
                                {(venda.venda_itens || []).map((i) => `${num(i.quantidade, 0)}× ${i.nome_produto}`).join(", ")}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {dataHora(venda.data)}
                                {venda.clientes?.nome ? ` · Cliente: ${venda.clientes.nome}` : ""}
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="font-semibold tabular-nums block">{brl(Number(venda.total))}</span>
                              <span className="text-[11px] text-warning tabular-nums">Comissão: {brl(com)}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" className="rounded-2xl" onClick={() => setRevendedoraDetalheId(null)}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Modal Sub-registrar Pagamento de Comissão */}
      <Dialog open={modalPagamentoComissao} onOpenChange={setModalPagamentoComissao}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Registrar Pagamento de Comissão</DialogTitle>
            <DialogDescription>
              Informe o valor transferido/pago para a revendedora.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="valor-pag">Valor PAGO (R$)</Label>
              <Input
                id="valor-pag"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formPagamentoValor}
                onChange={(e) => setFormPagamentoValor(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="data-pag">Data do Pagamento</Label>
              <Input
                id="data-pag"
                type="date"
                value={formPagamentoData}
                onChange={(e) => setFormPagamentoData(e.target.value)}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="obs-pag">Observação / Comprovante</Label>
              <Input
                id="obs-pag"
                placeholder="Ex: Transferência via PIX no acerto da semana"
                value={formPagamentoObs}
                onChange={(e) => setFormPagamentoObs(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setModalPagamentoComissao(false)}>
              Cancelar
            </Button>
            <Button className="rounded-2xl" onClick={registrarPagamentoComissaoSubmit} disabled={salvarPagamentoComissao.isPending}>
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Criar / Editar Revendedora (Item 1: Porcentagem ou Valor Fixo por item) */}
      <Dialog open={modalCadastrarRevendedora} onOpenChange={setModalCadastrarRevendedora}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {formRevendedora.id ? "Editar Revendedora" : "Cadastrar Revendedora"}
            </DialogTitle>
            <DialogDescription>
              Cadastre parceiras e defina o modelo de comissão (% ou valor fixo por item).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="nome-revendedora">Nome da Parceira / Revendedora</Label>
              <Input
                id="nome-revendedora"
                value={formRevendedora.nome ?? ""}
                onChange={(e) => setFormRevendedora({ ...formRevendedora, nome: e.target.value })}
                placeholder="Ex: Camila Doces, Maria Clara..."
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tel-revendedora">Telefone / WhatsApp</Label>
              <Input
                id="tel-revendedora"
                value={formRevendedora.telefone ?? ""}
                onChange={(e) => setFormRevendedora({ ...formRevendedora, telefone: e.target.value })}
                placeholder="(11) 90000-0000"
                className="rounded-xl"
              />
            </div>

            {/* Item 1: Escolha do Tipo de Comissão (% ou Valor Fixo) */}
            <div className="space-y-1.5 glass-inset rounded-2xl p-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Modelo de Comissão
              </Label>
              <Select
                value={formRevendedora.tipo_comissao ?? "porcentagem"}
                onValueChange={(v) =>
                  setFormRevendedora({
                    ...formRevendedora,
                    tipo_comissao: v as "porcentagem" | "valor_fixo",
                  })
                }
              >
                <SelectTrigger className="rounded-xl h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="porcentagem">Porcentagem (%) sobre valor da venda</SelectItem>
                  <SelectItem value="valor_fixo">Valor fixo (R$) por item vendido</SelectItem>
                </SelectContent>
              </Select>

              {formRevendedora.tipo_comissao === "valor_fixo" ? (
                <div className="space-y-1 pt-2">
                  <Label htmlFor="comissao-fixa" className="text-xs">
                    Comissão fixa por item vendido (R$)
                  </Label>
                  <Input
                    id="comissao-fixa"
                    type="number"
                    step="0.50"
                    value={String(formRevendedora.comissao_fixa ?? 0)}
                    onChange={(e) =>
                      setFormRevendedora({
                        ...formRevendedora,
                        comissao_fixa: Number(e.target.value),
                      })
                    }
                    placeholder="Ex: 5.00"
                    className="rounded-xl h-9 text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    A revendedora receberá este valor fixo para cada unidade vendida.
                  </p>
                </div>
              ) : (
                <div className="space-y-1 pt-2">
                  <Label htmlFor="comissao-perc" className="text-xs">
                    Porcentagem de Comissão (%)
                  </Label>
                  <Input
                    id="comissao-perc"
                    type="number"
                    step="1"
                    value={String(formRevendedora.comissao_percentual ?? 0)}
                    onChange={(e) =>
                      setFormRevendedora({
                        ...formRevendedora,
                        comissao_percentual: Number(e.target.value),
                      })
                    }
                    placeholder="Ex: 15"
                    className="rounded-xl h-9 text-xs"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    A comissão será calculada como {formRevendedora.comissao_percentual ?? 0}% sobre o total da venda.
                  </p>
                </div>
              )}
            </div>

            {/* Clientes Vinculados / Atendidos por esta Revendedora (Opcional) */}
            <div className="space-y-1.5 glass-inset rounded-2xl p-3">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Clientes Habitual/Vinculados (Opcional)
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Selecione os clientes atendidos por esta parceira:
              </p>
              <div className="mt-2 space-y-1 max-h-32 overflow-y-auto pr-1 border border-border/40 rounded-xl p-2 bg-card/40">
                {clientes.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Nenhum cliente cadastrado.</p>
                ) : (
                  clientes.map((c) => {
                    const marcado = (formRevendedora.cliente_ids ?? []).includes(c.id);
                    return (
                      <label
                        key={c.id}
                        className="flex items-center gap-2 p-1 rounded-lg hover:bg-muted/50 cursor-pointer text-xs transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={(e) => {
                            const atuais = formRevendedora.cliente_ids ?? [];
                            const novos = e.target.checked
                              ? [...atuais, c.id]
                              : atuais.filter((id) => id !== c.id);
                            setFormRevendedora({ ...formRevendedora, cliente_ids: novos });
                          }}
                          className="rounded border-border accent-brand"
                        />
                        <span className="font-medium text-foreground">{c.nome}</span>
                        {c.telefone ? <span className="text-[11px] text-muted-foreground">({c.telefone})</span> : null}
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs-revendedora">Observações</Label>
              <Textarea
                id="obs-revendedora"
                rows={2}
                value={formRevendedora.observacoes ?? ""}
                onChange={(e) => setFormRevendedora({ ...formRevendedora, observacoes: e.target.value })}
                placeholder="Região de entrega, dia de acerto..."
                className="rounded-xl text-xs"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => setModalCadastrarRevendedora(false)}>
              Cancelar
            </Button>
            <Button className="rounded-2xl" onClick={salvarNovaRevendedora} disabled={salvarRevendedora.isPending}>
              Salvar Revendedora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Estrutura>
  );
}

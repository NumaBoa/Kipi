import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Factory,
  Flame,
  Layers,
  Package,
  PackageCheck,
  PackagePlus,
  Play,
  Plus,
  Snowflake,
  Sparkles,
  Trash2,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { Estrutura } from "@/components/app/estrutura";
import { CartaoIndicador, Etiqueta, Painel, TituloSecao, Vazio } from "@/components/app/painel";
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
import { brl, dataHora, num } from "@/lib/format";
import {
  calcularProducaoPossivel,
  useApagarVenda,
  useAtualizarStatusProducao,
  useCriarOrdemLoteOuFornada,
  useInsumos,
  useProdutos,
  useReceitas,
  useVendas,
  verificarCongeladoSuficiente,
  verificarIngredientesSuficientes,
  type Insumo,
  type Produto,
  type Venda,
} from "@/lib/dados";

export const Route = createFileRoute("/_authenticated/planejamento")({
  head: () => ({
    meta: [
      { title: "Produção & Fila de Trabalho — Meu Ateliê" },
      {
        name: "description",
        content: "Kanban visual de encomendas sob medida e fabricação de lotes para pronta-entrega.",
      },
      { property: "og:title", content: "Produção & Fila de Trabalho — Meu Ateliê" },
      {
        property: "og:description",
        content: "Kanban visual de encomendas sob medida e fabricação de lotes para pronta-entrega.",
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

  const atualizarStatus = useAtualizarStatusProducao();
  const criarOrdem = useCriarOrdemLoteOuFornada();
  const apagarVenda = useApagarVenda();

  const [modalLote, setModalLote] = useState(false);
  const [produtoLoteId, setProdutoLoteId] = useState("");
  const [quantidadeLote, setQuantidadeLote] = useState<number | "">(1);
  const [baixarInsumosLote, setBaixarInsumosLote] = useState(true);
  const [destinoLote, setDestinoLote] = useState<"pronto" | "congelado">("pronto");

  // Modal Assar Fornada do Freezer
  const [modalAssar, setModalAssar] = useState(false);
  const [produtoAssarId, setProdutoAssarId] = useState("");
  const [qtdAssar, setQtdAssar] = useState<number | "">(12);

  // Filtrar todos os itens da produção (encomendas de clientes + lotes de produção + fornadas do freezer)
  const itensProducao = useMemo(() => {
    return vendas.filter(
      (v) =>
        (v.tipo_pedido === "sob_encomenda" ||
          v.tipo_pedido === "producao_lote" ||
          v.tipo_pedido === "fornada_freezer") &&
        v.status !== "cancelado" &&
        v.status_producao !== "entregue"
    );
  }, [vendas]);

  // Colunas do Kanban
  const colAFazer = useMemo(() => {
    return itensProducao.filter((v) => !v.status_producao || v.status_producao === "a_fazer");
  }, [itensProducao]);

  const colFazendo = useMemo(() => {
    return itensProducao.filter((v) => v.status_producao === "fazendo");
  }, [itensProducao]);

  const colPronto = useMemo(() => {
    return itensProducao.filter((v) => v.status_producao === "pronto_retirada");
  }, [itensProducao]);

  // Checagem em tempo real de ingredientes para o modal de produzir lote
  const produtoSelecionadoLote = useMemo(
    () => produtos.find((p) => p.id === produtoLoteId),
    [produtos, produtoLoteId]
  );

  const checagemIngredientesLote = useMemo(() => {
    const qtdNum = Number(quantidadeLote) || 0;
    if (!produtoLoteId || qtdNum <= 0) return { suficiente: true, faltantes: [] };
    return verificarIngredientesSuficientes(
      produtoLoteId,
      qtdNum,
      receitas,
      insumos,
      produtoSelecionadoLote?.rendimento_unidades || 1
    );
  }, [produtoLoteId, quantidadeLote, receitas, insumos, produtoSelecionadoLote]);

  // Checagem em tempo real de congelados para o modal de assar fornada
  const produtoSelecionadoAssar = useMemo(
    () => produtos.find((p) => p.id === produtoAssarId),
    [produtos, produtoAssarId]
  );

  const checagemCongeladoAssar = useMemo(() => {
    const qtdNum = Number(qtdAssar) || 0;
    if (!produtoAssarId) {
      return { suficiente: false, disponivel: 0, necessario: qtdNum, falta: qtdNum };
    }
    return verificarCongeladoSuficiente(produtoAssarId, qtdNum, produtos);
  }, [produtoAssarId, qtdAssar, produtos]);

  const moverStatus = async (
    vendaId: string,
    novoStatus: "a_fazer" | "fazendo" | "pronto_retirada" | "entregue",
    baixarMateriais = false
  ) => {
    try {
      await atualizarStatus.mutateAsync({
        vendaId,
        novoStatus,
        baixarMateriais,
      });

      const venda = vendas.find((v) => v.id === vendaId);
      if (novoStatus === "fazendo") {
        toast.success(
          venda?.tipo_pedido === "fornada_freezer"
            ? "Fornada colocada no forno (Em Produção)!"
            : "Ordem movida para Em Produção!"
        );
      } else if (novoStatus === "pronto_retirada") {
        const dest = venda?.tipo_destino_lote === "congelado" ? "freezer" : "vitrine";
        toast.success(
          venda?.tipo_pedido === "fornada_freezer"
            ? "🔥 Fornada assada com sucesso e adicionada à vitrine pronta-entrega!"
            : venda?.tipo_pedido === "producao_lote"
            ? `🎉 Lote finalizado e adicionado ao estoque (${dest})!`
            : "Pedido pronto para entrega/retirada!"
        );
      } else if (novoStatus === "entregue") {
        toast.success("Ordem finalizada e arquivada do Kanban!");
      } else {
        toast.success("Status atualizado!");
      }
    } catch (err: any) {
      console.error("Erro ao mover status:", err);
      toast.error(err?.message || "Erro ao atualizar status da produção.");
    }
  };

  const handleProduzirLote = async () => {
    if (!produtoLoteId) {
      toast.error("Selecione o produto a ser produzido.");
      return;
    }
    const qtdNum = Math.max(1, Number(quantidadeLote) || 1);

    const prod = produtos.find((p) => p.id === produtoLoteId);
    if (!prod) return;

    if (baixarInsumosLote) {
      const checagem = verificarIngredientesSuficientes(
        produtoLoteId,
        qtdNum,
        receitas,
        insumos,
        prod.rendimento_unidades || 1
      );
      if (!checagem.suficiente) {
        const nomes = checagem.faltantes
          .map((f) => `${f.nomeInsumo} (falta ${f.falta.toFixed(1)}${f.unidade})`)
          .join(", ");
        toast.error(`Ingredientes insuficientes no estoque! Faltam: ${nomes}`);
        return;
      }
    }

    try {
      await criarOrdem.mutateAsync({
        tipo: "producao_lote",
        produtoId: produtoLoteId,
        produto: prod,
        quantidade: qtdNum,
        tipoDestino: destinoLote,
        baixarMateriais: baixarInsumosLote,
      });

      const dest = destinoLote === "congelado" ? "para congelar no freezer" : "para vitrine pronta";
      toast.success(
        `📦 Ordem criada no Kanban! Produzir ${qtdNum}x "${prod.nome}" (${dest}).`
      );
      setModalLote(false);
      setQuantidadeLote(1);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar ordem de produção do lote.");
    }
  };

  const handleConfirmarAssar = async () => {
    if (!produtoAssarId) {
      toast.error("Selecione um produto para assar.");
      return;
    }
    const prod = produtos.find((p) => p.id === produtoAssarId);
    if (!prod) return;
    const qtd = Math.max(1, Number(qtdAssar));

    const checagem = verificarCongeladoSuficiente(prod.id, qtd, produtos);
    if (!checagem.suficiente) {
      toast.error(
        `Estoque congelado insuficiente! Há apenas ${checagem.disponivel} massas de "${prod.nome}" no freezer (solicitado: ${qtd} un).`
      );
      return;
    }

    try {
      await criarOrdem.mutateAsync({
        tipo: "fornada_freezer",
        produtoId: prod.id,
        produto: prod,
        quantidade: qtd,
      });

      toast.success(
        `🔥 Fornada de ${qtd}x "${prod.nome}" enviada para o Kanban (A Fazer)!`
      );
      setModalAssar(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao registrar fornada para assar.");
    }
  };

  const calcularDiasRestantes = (dataPrometida?: string | null) => {
    if (!dataPrometida) return null;
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataAlvo = new Date(dataPrometida + "T00:00:00");
    const diffMs = dataAlvo.getTime() - hoje.getTime();
    return Math.round(diffMs / 86400000);
  };

  const renderCardProducao = (v: Venda, coluna: "a_fazer" | "fazendo" | "pronto") => {
    const isFornada = v.tipo_pedido === "fornada_freezer";
    const isLote = v.tipo_pedido === "producao_lote";
    const itemPrincipal = (v.venda_itens || [])[0];
    const prod = produtos.find((p) => p.id === itemPrincipal?.produto_id);

    const diasRestantes = calcularDiasRestantes(v.data_entrega_prometida);
    const urgente = diasRestantes !== null && diasRestantes <= 2;

    return (
      <div
        key={v.id}
        className={`p-4 rounded-2xl border shadow-xs transition-all space-y-2.5 ${
          isFornada
            ? "bg-amber-50/50 border-amber-300/90 hover:border-amber-400"
            : isLote
            ? v.tipo_destino_lote === "congelado"
              ? "bg-sky-50/50 border-sky-300/90 hover:border-sky-400"
              : "bg-emerald-50/50 border-emerald-300/90 hover:border-emerald-400"
            : "bg-white border-slate-200 hover:border-slate-300"
        }`}
      >
        {/* CABEÇALHO DO CARD */}
        <div className="flex items-start justify-between gap-2">
          <div>
            {isFornada ? (
              <div className="flex items-center gap-1.5 font-black text-amber-950 text-sm">
                <Flame className="size-4 text-amber-600 animate-pulse" />
                <span>Fornada do Freezer</span>
              </div>
            ) : isLote ? (
              <div className="flex items-center gap-1.5 font-black text-slate-900 text-sm">
                <Factory className="size-4 text-[#084463]" />
                <span>Lote de Produção</span>
              </div>
            ) : (
              <span className="font-bold text-slate-900 text-sm">
                {v.clientes?.nome || "Cliente Encomenda"}
              </span>
            )}
          </div>

          {/* TAG DE STATUS / PRAZO */}
          <div>
            {isFornada ? (
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                🔥 Assar p/ Vitrine
              </span>
            ) : isLote ? (
              <span
                className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${
                  v.tipo_destino_lote === "congelado"
                    ? "bg-sky-100 text-sky-900 border-sky-300"
                    : "bg-emerald-100 text-emerald-900 border-emerald-300"
                }`}
              >
                {v.tipo_destino_lote === "congelado" ? "❄️ Guardar no Freezer" : "🍪 Prontos na Vitrine"}
              </span>
            ) : (
              diasRestantes !== null && (
                <span
                  className={`text-[11px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 ${
                    urgente
                      ? "bg-rose-100 text-rose-800 border border-rose-200 animate-pulse"
                      : "bg-purple-100 text-purple-800"
                  }`}
                >
                  <Calendar className="size-3" />
                  {diasRestantes < 0
                    ? "Atrasado!"
                    : diasRestantes === 0
                    ? "Hoje!"
                    : `Em ${diasRestantes}d`}
                </span>
              )
            )}
          </div>
        </div>

        {/* ITENS DO CARD */}
        <div className="text-xs text-slate-700 bg-white/90 p-2.5 rounded-xl border border-slate-200/60 space-y-1">
          {(v.venda_itens || []).map((i) => (
            <div key={i.id} className="font-bold text-slate-900 flex items-center justify-between">
              <span>
                {i.quantidade}x {i.nome_produto}
              </span>
              {isFornada && prod && (
                <span className="text-[11px] font-normal text-slate-500">
                  (Freezer: {Number(prod.estoque_congelado || 0)} un)
                </span>
              )}
            </div>
          ))}
          {isLote && (
            <p className="text-[11px] text-slate-500 font-medium">
              {v.tipo_destino_lote === "congelado"
                ? "Bater receita e congelar massas para assar depois."
                : "Bater receita e disponibilizar direto na vitrine."}
            </p>
          )}
        </div>

        {v.observacoes && (
          <p className="text-[11px] text-slate-600 bg-slate-100/60 p-2 rounded-lg italic">
            "{v.observacoes}"
          </p>
        )}

        {/* RODAPÉ DO CARD COM AÇÕES DA COLUNA */}
        <div className="pt-2 flex items-center justify-between border-t border-slate-200/60">
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 rounded-lg"
              title="Cancelar / Excluir ordem"
              onClick={() => {
                if (confirm(`Deseja remover esta ordem do Kanban?`)) {
                  apagarVenda.mutate(v.id);
                  toast.success("Ordem removida do Kanban.");
                }
              }}
            >
              <Trash2 className="size-3.5" />
            </Button>
            {!isFornada && !isLote && (
              <span className="text-xs font-black text-slate-900">{brl(v.total)}</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            {coluna === "a_fazer" && (
              <Button
                size="sm"
                className={`h-8 text-xs font-bold gap-1 rounded-xl shadow-xs text-white ${
                  isFornada
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-[#084463] hover:bg-[#06344C]"
                }`}
                onClick={() => moverStatus(v.id, "fazendo")}
              >
                <Play className="size-3" />
                {isFornada ? "Colocar no Forno" : isLote ? "Iniciar Preparo" : "Iniciar"}
              </Button>
            )}

            {coluna === "fazendo" && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-slate-500 hover:text-slate-800 rounded-xl"
                  onClick={() => moverStatus(v.id, "a_fazer")}
                >
                  Voltar
                </Button>
                <Button
                  size="sm"
                  className={`h-8 text-xs font-bold gap-1 rounded-xl text-white ${
                    isFornada
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                  onClick={() => moverStatus(v.id, "pronto_retirada", true)}
                >
                  <CheckCircle2 className="size-3" />
                  {isFornada ? "Sinalizar que Assou" : isLote ? "Concluir Lote" : "Concluir"}
                </Button>
              </>
            )}

            {coluna === "pronto" && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-slate-500 hover:text-slate-800 rounded-xl"
                  onClick={() => moverStatus(v.id, "fazendo")}
                >
                  Retornar
                </Button>
                <Button
                  size="sm"
                  className="h-8 text-xs font-bold gap-1 bg-[#084463] text-white hover:bg-[#06344C] rounded-xl"
                  onClick={() => moverStatus(v.id, "entregue")}
                >
                  <PackageCheck className="size-3" />
                  {isFornada || isLote ? "Arquivar Concluído" : "Entregar"}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Estrutura
      titulo="Produção & Fila de Trabalho"
      subtitulo="Acompanhe o que precisa ser feito e produza lotes para a sua pronta-entrega"
    >
      {/* INDICADORES DE PRODUÇÃO */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CartaoIndicador
          rotulo="A Fazer"
          valor={String(colAFazer.length)}
          detalhe="Ordens na fila de espera"
          etiqueta="fila"
          tom={colAFazer.length > 0 ? "brand" : "neutro"}
        />
        <CartaoIndicador
          rotulo="Em Produção"
          valor={String(colFazendo.length)}
          detalhe="Itens sendo fabricados/assados agora"
          etiqueta="bancada"
          tom={colFazendo.length > 0 ? "warning" : "neutro"}
        />
        <CartaoIndicador
          rotulo="Prontos p/ Retirada"
          valor={String(colPronto.length)}
          detalhe="Finalizados e aguardando"
          etiqueta="concluído"
          tom={colPronto.length > 0 ? "success" : "neutro"}
        />
        <CartaoIndicador
          rotulo="Total no Kanban"
          valor={String(itensProducao.length)}
          detalhe="Encomendas + Lotes + Fornadas"
          etiqueta="geral"
          tom="neutro"
        />
      </section>

      {/* KANBAN VISUAL DE 3 COLUNAS */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-2 mb-1">
        <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-500">
          Fila de Encomendas & Produção
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-2xl gap-2 font-bold border-amber-300 bg-amber-50/80 text-amber-900 hover:bg-amber-100 shadow-xs px-4 h-10 text-xs"
            onClick={() => {
              const comCongelado = produtos.find((p) => Number(p.estoque_congelado || 0) > 0);
              setProdutoAssarId(comCongelado?.id || produtos[0]?.id || "");
              setQtdAssar(comCongelado ? Math.min(12, Number(comCongelado.estoque_congelado)) : 12);
              setModalAssar(true);
            }}
          >
            <Flame className="size-4 text-amber-600" /> 🔥 Assar Fornada do Freezer
          </Button>

          <Button
            className="rounded-2xl gap-2 font-bold bg-[#084463] text-white hover:bg-[#06344C] shadow-md shadow-[#084463]/25 px-5 h-10 shrink-0"
            onClick={() => {
              if (produtos.length > 0 && !produtoLoteId) {
                setProdutoLoteId(produtos[0]?.id ?? "");
              }
              setDestinoLote("pronto");
              setModalLote(true);
            }}
          >
            <Factory className="size-4" /> + Produzir Lote
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* COLUNA 1: A FAZER */}
        <div className="flex flex-col bg-slate-50/80 rounded-3xl p-4 border border-slate-200">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 mb-3">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-slate-400" />
              <h3 className="font-black text-slate-800 text-sm tracking-wide uppercase">
                A Fazer ({colAFazer.length})
              </h3>
            </div>
            <span className="text-xs text-slate-500 font-semibold">Na Fila</span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] pr-1">
            {colAFazer.length === 0 ? (
              <div className="p-8 text-center bg-white/70 rounded-2xl border border-dashed border-slate-200">
                <Clock className="size-8 mx-auto text-slate-300 mb-1" />
                <p className="text-xs text-slate-500">Nenhuma ordem aguardando início.</p>
              </div>
            ) : (
              colAFazer.map((v) => renderCardProducao(v, "a_fazer"))
            )}
          </div>
        </div>

        {/* COLUNA 2: FAZENDO */}
        <div className="flex flex-col bg-amber-50/50 rounded-3xl p-4 border border-amber-200/70">
          <div className="flex items-center justify-between pb-3 border-b border-amber-200/60 mb-3">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-amber-500 animate-ping" />
              <h3 className="font-black text-amber-900 text-sm tracking-wide uppercase">
                Em Produção ({colFazendo.length})
              </h3>
            </div>
            <span className="text-xs text-amber-700 font-semibold">Na Bancada</span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] pr-1">
            {colFazendo.length === 0 ? (
              <div className="p-8 text-center bg-white/70 rounded-2xl border border-dashed border-amber-200">
                <Factory className="size-8 mx-auto text-amber-300 mb-1" />
                <p className="text-xs text-amber-700">Nenhum item sendo produzido agora.</p>
              </div>
            ) : (
              colFazendo.map((v) => renderCardProducao(v, "fazendo"))
            )}
          </div>
        </div>

        {/* COLUNA 3: PRONTO PARA RETIRADA */}
        <div className="flex flex-col bg-emerald-50/50 rounded-3xl p-4 border border-emerald-200/70">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-200/60 mb-3">
            <div className="flex items-center gap-2">
              <span className="size-3 rounded-full bg-emerald-500" />
              <h3 className="font-black text-emerald-900 text-sm tracking-wide uppercase">
                Pronto p/ Retirada ({colPronto.length})
              </h3>
            </div>
            <span className="text-xs text-emerald-700 font-semibold">Finalizados</span>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto max-h-[600px] pr-1">
            {colPronto.length === 0 ? (
              <div className="p-8 text-center bg-white/70 rounded-2xl border border-dashed border-emerald-200">
                <PackageCheck className="size-8 mx-auto text-emerald-300 mb-1" />
                <p className="text-xs text-emerald-700">Nenhum item aguardando retirada.</p>
              </div>
            ) : (
              colPronto.map((v) => renderCardProducao(v, "pronto"))
            )}
          </div>
        </div>
      </div>

      {/* MODAL: PRODUZIR LOTE PARA ESTOQUE */}
      <Dialog open={modalLote} onOpenChange={setModalLote}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#084463] flex items-center gap-2">
              <Factory className="size-5" /> Produzir Lote de Produtos
            </DialogTitle>
            <DialogDescription>
              Bata a receita para criar unidades prontas para a vitrine ou massas pré-prontas no freezer.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* SELEÇÃO DO DESTINO DO LOTE */}
            <div>
              <Label className="text-xs font-bold text-slate-700 block mb-1.5">Destino da Produção</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                    destinoLote === "pronto"
                      ? "bg-amber-50 text-amber-950 border-amber-400 ring-2 ring-amber-300/40"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                  onClick={() => setDestinoLote("pronto")}
                >
                  <span className="text-lg">🍪</span>
                  <span>Prontos para Venda</span>
                  <span className="text-[10px] font-normal text-slate-500 text-center">
                    Vai direto para a vitrine pronta-entrega
                  </span>
                </button>

                <button
                  type="button"
                  className={`p-3 rounded-2xl border text-xs font-bold flex flex-col items-center gap-1.5 transition-all ${
                    destinoLote === "congelado"
                      ? "bg-sky-50 text-sky-950 border-sky-400 ring-2 ring-sky-300/40"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                  onClick={() => setDestinoLote("congelado")}
                >
                  <Snowflake className="size-5 text-sky-600" />
                  <span>Guardar no Freezer</span>
                  <span className="text-[10px] font-normal text-slate-500 text-center">
                    Fica como "Para Assar" pré-pronto
                  </span>
                </button>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Produto a Fabricar</Label>
              <Select value={produtoLoteId} onValueChange={setProdutoLoteId}>
                <SelectTrigger className="mt-1 rounded-xl">
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} (Prontos: {p.estoque} | Congelados: {p.estoque_congelado || 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Quantidade Produzida no Lote</Label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="1"
                value={quantidadeLote === "" ? "" : String(quantidadeLote)}
                onChange={(e) => {
                  const digitos = e.target.value.replace(/\D/g, "");
                  setQuantidadeLote(digitos === "" ? "" : parseInt(digitos, 10));
                }}
                onBlur={() => {
                  if (quantidadeLote === "" || Number(quantidadeLote) <= 0) {
                    setQuantidadeLote(1);
                  }
                }}
                className="mt-1 rounded-xl font-bold"
              />
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-3">
              <input
                type="checkbox"
                id="chkBaixar"
                checked={baixarInsumosLote}
                onChange={(e) => setBaixarInsumosLote(e.target.checked)}
                className="size-4 accent-[#084463] rounded"
              />
              <label htmlFor="chkBaixar" className="text-xs text-slate-700 font-semibold cursor-pointer">
                Dar baixa automática nos materiais/ingredientes da receita cadastrada
              </label>
            </div>

            {/* VERIFICAÇÃO E BLOQUEIO DE INGREDIENTES */}
            {baixarInsumosLote && produtoLoteId && (
              <div>
                {!checagemIngredientesLote.suficiente ? (
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-300 text-xs text-rose-900 space-y-1.5">
                    <div className="font-extrabold flex items-center gap-1.5 text-rose-800">
                      <AlertTriangle className="size-4 text-rose-600 shrink-0" />
                      <span>Ingredientes Insuficientes para este Lote:</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-1 text-[11px] text-rose-800">
                      {checagemIngredientesLote.faltantes.map((f) => (
                        <li key={f.nomeInsumo}>
                          <strong>{f.nomeInsumo}</strong>: necessário {f.necessario.toFixed(1)} {f.unidade}, estoque tem {f.disponivel} {f.unidade} (<span className="font-black text-rose-700">falta {f.falta.toFixed(1)} {f.unidade}</span>)
                        </li>
                      ))}
                    </ul>
                    <p className="text-[10px] font-bold text-rose-700 pt-0.5">
                      ⚠️ Bloqueado: Reponha os materiais no estoque para liberar a fabricação deste lote.
                    </p>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    <span>Ingredientes suficientes no estoque para fabricar este lote!</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setModalLote(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl font-bold bg-[#084463] text-white hover:bg-[#06344C] px-5 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={baixarInsumosLote && !checagemIngredientesLote.suficiente}
              onClick={handleProduzirLote}
            >
              Confirmar Produção
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: ASSAR FORNADA DO FREEZER */}
      <Dialog open={modalAssar} onOpenChange={setModalAssar}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-amber-900 flex items-center gap-2">
              <Flame className="size-5 text-amber-600" /> Assar Fornada do Freezer
            </DialogTitle>
            <DialogDescription>
              Tire massas congeladas do freezer, asse e disponibilize imediatamente para venda na vitrine.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-bold text-slate-700">Produto a Assar</Label>
              <Select value={produtoAssarId} onValueChange={setProdutoAssarId}>
                <SelectTrigger className="mt-1 rounded-xl">
                  <SelectValue placeholder="Selecione o produto congelado" />
                </SelectTrigger>
                <SelectContent>
                  {produtos.map((p) => {
                    const cong = Number(p.estoque_congelado || 0);
                    return (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} — {cong} {cong === 1 ? "massa no freezer" : "massas no freezer"} (Prontos: {p.estoque})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-700">Quantidade a Assar nesta Fornada</Label>
                {produtoSelecionadoAssar && (
                  <span className="text-xs text-sky-700 font-semibold">
                    Disponível: {Number(produtoSelecionadoAssar.estoque_congelado || 0)} un
                  </span>
                )}
              </div>
              <div className="flex gap-2 mt-1">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="1"
                  value={qtdAssar === "" ? "" : String(qtdAssar)}
                  onChange={(e) => {
                    const digitos = e.target.value.replace(/\D/g, "");
                    const max = Math.max(1, Number(produtoSelecionadoAssar?.estoque_congelado || 1));
                    if (digitos === "") {
                      setQtdAssar("");
                    } else {
                      const num = Math.min(max, parseInt(digitos, 10));
                      setQtdAssar(num);
                    }
                  }}
                  onBlur={() => {
                    if (qtdAssar === "" || Number(qtdAssar) <= 0) {
                      setQtdAssar(1);
                    }
                  }}
                  className="rounded-xl font-bold"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl px-3 font-bold"
                  onClick={() => setQtdAssar(6)}
                >
                  6 un
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl px-3 font-bold"
                  onClick={() => setQtdAssar(12)}
                >
                  12 un
                </Button>
                {Number(produtoSelecionadoAssar?.estoque_congelado || 0) > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-xl px-3 font-bold text-sky-700 border-sky-300 bg-sky-50"
                    onClick={() => setQtdAssar(Number(produtoSelecionadoAssar!.estoque_congelado))}
                  >
                    Tudo
                  </Button>
                )}
              </div>
            </div>

            {/* VERIFICAÇÃO E BLOQUEIO DE ESTOQUE CONGELADO */}
            {produtoSelecionadoAssar && (
              <div>
                {!checagemCongeladoAssar.suficiente ? (
                  <div className="p-3 rounded-2xl bg-rose-50 border border-rose-300 text-xs text-rose-900 space-y-1">
                    <div className="font-extrabold flex items-center gap-1.5 text-rose-800">
                      <AlertTriangle className="size-4 text-rose-600 shrink-0" />
                      <span>Estoque Congelado Insuficiente!</span>
                    </div>
                    <p className="text-[11px] text-rose-800">
                      Há apenas <strong>{checagemCongeladoAssar.disponivel} massas</strong> de "{produtoSelecionadoAssar.nome}" no freezer. Você escolheu assar <strong>{qtdAssar} un</strong>.
                    </p>
                    <p className="text-[10px] font-bold text-rose-700">
                      🚫 Bloqueado: Reduza a quantidade ou produza mais massas congeladas no botão "+ Produzir Lote".
                    </p>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    <span>Estoque congelado suficiente ({checagemCongeladoAssar.disponivel} un no freezer).</span>
                  </div>
                )}
              </div>
            )}

            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <span>💡 Como funciona a fornada:</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Ao confirmar, a fornada entra no <strong>Kanban na coluna "A Fazer"</strong>. Quando você colocar no forno, mova para "Em Produção". Ao sinalizar que assou, as <strong>{qtdAssar} un</strong> são subtraídas do freezer e somadas aos produtos prontos da vitrine.
              </p>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setModalAssar(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white px-5 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!checagemCongeladoAssar.suficiente}
              onClick={handleConfirmarAssar}
            >
              Confirmar Fornada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Estrutura>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CakeSlice,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Flame,
  FolderPlus,
  Layers,
  LayoutGrid,
  List,
  Minus,
  Package,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Snowflake,
  Tag,
  Trash2,
  TrendingUp,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { brl, num } from "@/lib/format";
import {
  calcularProducaoPossivel,
  custoInsumosFornada,
  custoMaoDeObraFornada,
  custoProduto,
  custoTotalFornada,
  gravarValorHoraPadrao,
  lerValorHoraPadrao,
  useApagarInsumo,
  useApagarProduto,
  useApagarReceitaItem,
  useCategorias,
  useInsumos,
  useProdutos,
  useReceitas,
  useSalvarCategoria,
  useSalvarInsumo,
  useSalvarProduto,
  useSalvarReceitaItem,
  type Insumo,
  type Produto,
} from "@/lib/dados";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({
    meta: [
      { title: "Catálogo & Estoque — Meu Ateliê" },
      {
        name: "description",
        content: "Gerencie seus produtos, disponibilidade e estoque de materiais e insumos.",
      },
      { property: "og:title", content: "Catálogo & Estoque — Meu Ateliê" },
      {
        property: "og:description",
        content: "Gerencie seus produtos, disponibilidade e estoque de materiais e insumos.",
      },
    ],
  }),
  component: PaginaCatalogoEstoque,
});

export function PaginaCatalogoEstoque() {
  const { data: produtos = [] } = useProdutos();
  const { data: insumos = [] } = useInsumos();
  const { data: receitas = [] } = useReceitas();
  const { data: categoriasData = [] } = useCategorias();

  const salvarProduto = useSalvarProduto();
  const apagarProduto = useApagarProduto();
  const salvarInsumo = useSalvarInsumo();
  const apagarInsumo = useApagarInsumo();
  const salvarCategoria = useSalvarCategoria();

  const [abaAtiva, setAbaAtiva] = useState<"produtos" | "materiais" | "receitas">(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("aba");
      if (p === "materiais" || p === "receitas" || p === "produtos") return p;
    }
    return "produtos";
  });

  // ESTADO RECEITAS / FICHAS TÉCNICAS
  const adicionarReceitaItem = useSalvarReceitaItem();
  const apagarReceitaItem = useApagarReceitaItem();

  const [produtoReceitaId, setProdutoReceitaId] = useState<string>("");
  const [insumoReceitaId, setInsumoReceitaId] = useState<string>("");
  const [quantidadeReceita, setQuantidadeReceita] = useState("");

  const [valorHoraPadrao, setValorHoraPadrao] = useState<number>(() => lerValorHoraPadrao());
  const [modalValorHora, setModalValorHora] = useState(false);
  const [novoValorHoraPadrao, setNovoValorHoraPadrao] = useState<number>(valorHoraPadrao);
  const [novoValorHoraPadraoTexto, setNovoValorHoraPadraoTexto] = useState<string>(() =>
    (lerValorHoraPadrao() || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );

  const [modalNovaReceita, setModalNovaReceita] = useState(false);
  const [precoNovaReceitaTexto, setPrecoNovaReceitaTexto] = useState<string>("0,00");
  const [formNovaReceita, setFormNovaReceita] = useState<Partial<Produto>>({
    nome: "",
    categoria: "Geral",
    preco: 0,
    estoque: 0,
    tempo_preparo_minutos: 45,
    rendimento_unidades: 1,
    ativo: true,
  });

  // ESTADO PRODUTOS
  const [modalProduto, setModalProduto] = useState(false);
  const [precoProdutoTexto, setPrecoProdutoTexto] = useState<string>("0,00");
  const [custoManualTexto, setCustoManualTexto] = useState<string>("");
  const [formProduto, setFormProduto] = useState<Partial<Produto>>({
    nome: "",
    categoria: "Geral",
    preco: 0,
    estoque: 0,
    ativo: true,
    disponibilidade: "hibrido",
    custo_manual: 0,
  });
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");
  const [buscaProduto, setBuscaProduto] = useState("");
  const [mostrarCustosAvancados, setMostrarCustosAvancados] = useState(false);
  const [modoVisualizacao, setModoVisualizacao] = useState<"lista" | "grade">("lista");

  // ESTADO MODAL ASSAR / FINALIZAR CONGELADOS
  const [modalAssar, setModalAssar] = useState(false);
  const [produtoAssando, setProdutoAssando] = useState<Produto | null>(null);
  const [qtdAssar, setQtdAssar] = useState(12);

  const abrirModalAssar = (p: Produto) => {
    setProdutoAssando(p);
    const congelado = Number(p.estoque_congelado || 0);
    setQtdAssar(congelado > 0 ? Math.min(12, congelado) : 12);
    setModalAssar(true);
  };

  const handleConfirmarAssar = async () => {
    if (!produtoAssando) return;
    const qtd = Math.max(1, Number(qtdAssar) || 1);
    const atualCongelado = Number(produtoAssando.estoque_congelado || 0);

    if (atualCongelado < qtd || atualCongelado <= 0) {
      toast.error(
        `Estoque congelado insuficiente! Há apenas ${atualCongelado} un de "${produtoAssando.nome}" no freezer.`
      );
      return;
    }

    const novoCongelado = Math.max(0, atualCongelado - qtd);
    const novoPronto = Number(produtoAssando.estoque || 0) + qtd;

    try {
      await salvarProduto.mutateAsync({
        ...produtoAssando,
        estoque: novoPronto,
        estoque_congelado: novoCongelado,
      });
      toast.success(`🔥 ${qtd} unidades de "${produtoAssando.nome}" assadas e adicionadas à vitrine!`);
      setModalAssar(false);
      setProdutoAssando(null);
    } catch {
      toast.error("Erro ao transferir produtos.");
    }
  };

  // ESTADO MODAL NOVA CATEGORIA
  const [modalNovaCategoria, setModalNovaCategoria] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState("");
  const [origemNovaCategoria, setOrigemNovaCategoria] = useState<"produto" | "receita">("produto");

  const handleSalvarNovaCategoria = async () => {
    if (!novaCategoriaNome.trim()) {
      toast.error("Informe o nome da categoria.");
      return;
    }
    const nomeFormatado = novaCategoriaNome.trim();
    try {
      await salvarCategoria.mutateAsync(nomeFormatado);
      if (origemNovaCategoria === "produto") {
        setFormProduto((prev) => ({ ...prev, categoria: nomeFormatado }));
      } else {
        setFormNovaReceita((prev) => ({ ...prev, categoria: nomeFormatado }));
      }
      toast.success(`Categoria "${nomeFormatado}" cadastrada com sucesso!`);
      setModalNovaCategoria(false);
      setNovaCategoriaNome("");
    } catch {
      toast.error("Erro ao cadastrar categoria.");
    }
  };

  // ESTADO MATERIAIS
  const [modalInsumo, setModalInsumo] = useState(false);
  const [custoInsumoTexto, setCustoInsumoTexto] = useState<string>("0,00");
  const [modalEntradaCompra, setModalEntradaCompra] = useState(false);
  const [materialEntradaId, setMaterialEntradaId] = useState("");
  const [qtdEntradaCompra, setQtdEntradaCompra] = useState(1);
  const [custoTotalEntradaCompra, setCustoTotalEntradaCompra] = useState(0);
  const [custoTotalEntradaCompraTexto, setCustoTotalEntradaCompraTexto] = useState<string>("");

  const [formInsumo, setFormInsumo] = useState<Partial<Insumo>>({
    nome: "",
    tipo: "materia_prima",
    unidade: "un",
    quantidade: 0,
    minimo: 5,
    custo_unitario: 0,
  });
  const [buscaMaterial, setBuscaMaterial] = useState("");

  useEffect(() => {
    if (!produtoReceitaId && produtos[0]) {
      setProdutoReceitaId(produtos[0].id);
    }
  }, [produtos, produtoReceitaId]);

  // Cálculos de Receita
  const produtoSelecionadoReceita = produtos.find((p) => p.id === produtoReceitaId);
  const itensReceita = receitas.filter((r) => r.produto_id === produtoReceitaId);

  const [localRendimento, setLocalRendimento] = useState<number>(1);
  const [localTempoPreparo, setLocalTempoPreparo] = useState<number>(45);
  const [localPreco, setLocalPreco] = useState<number>(0);

  const [rendimentoTexto, setRendimentoTexto] = useState<string>("1");
  const [tempoPreparoTexto, setTempoPreparoTexto] = useState<string>("45");
  const [precoReceitaTexto, setPrecoReceitaTexto] = useState<string>("0,00");
  const [lucroReceitaTexto, setLucroReceitaTexto] = useState<string>("0,00");

  useEffect(() => {
    if (produtoSelecionadoReceita) {
      const r = Math.max(1, Number(produtoSelecionadoReceita.rendimento_unidades || 1));
      const t = Math.max(0, Number(produtoSelecionadoReceita.tempo_preparo_minutos ?? 45));
      const p = Math.max(0, Number(produtoSelecionadoReceita.preco || 0));

      setLocalRendimento(r);
      setLocalTempoPreparo(t);
      setLocalPreco(p);

      setRendimentoTexto(String(r));
      setTempoPreparoTexto(t ? String(t) : "");
      setPrecoReceitaTexto(p.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  }, [produtoReceitaId, produtoSelecionadoReceita?.id]);

  const rendimentoReceita = Math.max(localRendimento, 1);
  const insumosFornada = produtoReceitaId ? custoInsumosFornada(produtoReceitaId, receitas, insumos) : 0;
  const maoObraFornada = produtoSelecionadoReceita
    ? (localTempoPreparo / 60) * valorHoraPadrao
    : 0;
  const totalFornada = insumosFornada + maoObraFornada;
  const custoUnitarioReal = totalFornada / rendimentoReceita;

  const precoReceita = localPreco;
  const lucroAtualReceita = Math.max(0, precoReceita - custoUnitarioReal);
  const margemReceita = precoReceita > 0 ? ((precoReceita - custoUnitarioReal) / precoReceita) * 100 : 0;

  useEffect(() => {
    const l = Math.max(0, localPreco - custoUnitarioReal);
    setLucroReceitaTexto(l.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  }, [localPreco, custoUnitarioReal]);

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const salvarAlteracaoDebounced = (patch: Partial<Produto>) => {
    if (!produtoSelecionadoReceita) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      try {
        await salvarProduto.mutateAsync({
          ...produtoSelecionadoReceita,
          rendimento_unidades: localRendimento,
          tempo_preparo_minutos: localTempoPreparo,
          preco: localPreco,
          ...patch,
        });
      } catch {
        // silencioso
      }
    }, 700);
  };

  const salvarAlteracaoImediata = async (patch?: Partial<Produto>) => {
    if (!produtoSelecionadoReceita) return;
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    try {
      await salvarProduto.mutateAsync({
        ...produtoSelecionadoReceita,
        rendimento_unidades: localRendimento,
        tempo_preparo_minutos: localTempoPreparo,
        preco: localPreco,
        ...(patch || {}),
      });
    } catch {
      // silencioso
    }
  };

  useEffect(() => {
    if (modalValorHora) {
      setNovoValorHoraPadrao(valorHoraPadrao);
      setNovoValorHoraPadraoTexto(
        valorHoraPadrao.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    }
  }, [modalValorHora, valorHoraPadrao]);

  const capacidadeReceita = produtoReceitaId
    ? calcularProducaoPossivel(produtoReceitaId, receitas, insumos, rendimentoReceita)
    : { possiveis: 0, gargaloInsumo: null };

  const totalComReceita = new Set(receitas.map((r) => r.produto_id)).size;
  const custosReceitas = produtos
    .map((p) => custoProduto(p.id, receitas, insumos, { ...p, valor_hora_trabalho: valorHoraPadrao }))
    .filter((c) => c > 0);
  const custoMedioReceitas = custosReceitas.length > 0 ? custosReceitas.reduce((s, c) => s + c, 0) / custosReceitas.length : 0;

  const incluirItemReceita = async () => {
    const qtd = Number(quantidadeReceita.replace(",", "."));
    if (!produtoReceitaId || !insumoReceitaId || !qtd) {
      toast.error("Escolha o item e a quantidade usada.");
      return;
    }
    await adicionarReceitaItem.mutateAsync({ produto_id: produtoReceitaId, insumo_id: insumoReceitaId, quantidade: qtd });
    setQuantidadeReceita("");
    toast.success("Item adicionado à receita.");
  };

  const salvarNovoValorHoraPadrao = () => {
    const v = Math.max(0, novoValorHoraPadrao);
    gravarValorHoraPadrao(v);
    setValorHoraPadrao(v);
    setModalValorHora(false);
    toast.success(`Hora fixada do ateliê atualizada para ${brl(v)}/h!`);
  };

  const salvarCriacaoReceita = async () => {
    if (!formNovaReceita.nome?.trim()) {
      toast.error("Informe o nome da receita/produto.");
      return;
    }
    try {
      const novoId = formNovaReceita.id ?? `prod_${Date.now()}`;
      await salvarProduto.mutateAsync({
        ...formNovaReceita,
        id: novoId,
        nome: formNovaReceita.nome.trim(),
        categoria: formNovaReceita.categoria || "Geral",
        preco: Number(formNovaReceita.preco) || 0,
        estoque: Number(formNovaReceita.estoque) || 0,
        tempo_preparo_minutos: Number(formNovaReceita.tempo_preparo_minutos) || 45,
        valor_hora_trabalho: valorHoraPadrao,
        rendimento_unidades: Number(formNovaReceita.rendimento_unidades) || 1,
        disponibilidade: "hibrido",
      });
      toast.success("Nova receita criada com a hora fixada do ateliê!");
      setModalNovaReceita(false);
      setProdutoReceitaId(novoId);
      setPrecoNovaReceitaTexto("0,00");
      setFormNovaReceita({
        nome: "",
        categoria: "Geral",
        preco: 0,
        estoque: 0,
        tempo_preparo_minutos: 45,
        rendimento_unidades: 1,
        ativo: true,
      });
    } catch {
      toast.error("Erro ao criar receita/produto.");
    }
  };

  // Categorias unificadas
  const categorias = useMemo(() => {
    const set = new Set<string>();
    categoriasData.forEach((c) => c?.nome && set.add(c.nome));
    produtos.forEach((p) => p.categoria && set.add(p.categoria));
    if (set.size === 0) set.add("Geral");
    return Array.from(set);
  }, [categoriasData, produtos]);

  // Produtos filtrados
  const produtosFiltrados = useMemo(() => {
    return produtos.filter((p) => {
      if (categoriaFiltro !== "todas" && p.categoria.toLowerCase() !== categoriaFiltro.toLowerCase()) {
        return false;
      }
      if (buscaProduto.trim()) {
        const termo = buscaProduto.toLowerCase();
        return p.nome.toLowerCase().includes(termo) || p.categoria.toLowerCase().includes(termo);
      }
      return true;
    });
  }, [produtos, categoriaFiltro, buscaProduto]);

  // Materiais filtrados
  const materiaisFiltrados = useMemo(() => {
    return insumos.filter((i) => {
      if (buscaMaterial.trim()) {
        const termo = buscaMaterial.toLowerCase();
        return i.nome.toLowerCase().includes(termo) || i.tipo.toLowerCase().includes(termo);
      }
      return true;
    });
  }, [insumos, buscaMaterial]);

  // Ações de ajuste rápido de estoque do produto (+1 / -1)
  const ajustarEstoqueProduto = async (p: Produto, delta: number) => {
    const novoEstoque = Math.max(0, (Number(p.estoque) || 0) + delta);
    try {
      await salvarProduto.mutateAsync({
        ...p,
        estoque: novoEstoque,
      });
      toast.success(`Estoque de "${p.nome}" atualizado para ${novoEstoque} un.`);
    } catch {
      toast.error("Erro ao atualizar estoque.");
    }
  };

  // Abrir modal produto
  const abrirModalProduto = (p?: Produto) => {
    if (p) {
      setFormProduto({ ...p, estoque_congelado: p.estoque_congelado ?? 0 });
      setPrecoProdutoTexto(
        p.preco != null
          ? Number(p.preco).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : "0,00"
      );
      setCustoManualTexto(
        p.custo_manual != null && Number(p.custo_manual) > 0
          ? Number(p.custo_manual).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : ""
      );
      setMostrarCustosAvancados(Boolean(p.custo_manual && p.custo_manual > 0));
    } else {
      setFormProduto({
        nome: "",
        categoria: categorias[0] || "Geral",
        preco: 0,
        estoque: 0,
        estoque_congelado: 0,
        ativo: true,
        disponibilidade: "hibrido",
        custo_manual: 0,
      });
      setPrecoProdutoTexto("0,00");
      setCustoManualTexto("");
      setMostrarCustosAvancados(false);
    }
    setModalProduto(true);
  };

  const handleSalvarProduto = async () => {
    if (!formProduto.nome?.trim()) {
      toast.error("Informe o nome do produto.");
      return;
    }
    try {
      await salvarProduto.mutateAsync({
        ...formProduto,
        nome: formProduto.nome.trim(),
        preco: Number(formProduto.preco) || 0,
        estoque: Number(formProduto.estoque) || 0,
        estoque_congelado: Number(formProduto.estoque_congelado) || 0,
        custo_manual: formProduto.custo_manual ? Number(formProduto.custo_manual) : 0,
      });
      toast.success("Produto salvo com sucesso no catálogo!");
      setModalProduto(false);
    } catch {
      toast.error("Erro ao salvar produto.");
    }
  };

  // Abrir modal insumo
  const abrirModalInsumo = (i?: Insumo) => {
    if (i) {
      setFormInsumo({ ...i });
      const c = Number(i.custo_unitario || 0);
      setCustoInsumoTexto(
        c.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      );
    } else {
      setFormInsumo({
        nome: "",
        tipo: "materia_prima",
        unidade: "un",
        quantidade: 0,
        minimo: 5,
        custo_unitario: 0,
      });
      setCustoInsumoTexto("0,00");
    }
    setModalInsumo(true);
  };

  const handleSalvarInsumo = async () => {
    if (!formInsumo.nome?.trim()) {
      toast.error("Informe o nome do material.");
      return;
    }
    try {
      const custoNum = typeof formInsumo.custo_unitario === "string"
        ? Number(String(formInsumo.custo_unitario).replace(",", ".")) || 0
        : Number(formInsumo.custo_unitario) || 0;
      const qtdNum = typeof formInsumo.quantidade === "string"
        ? Number(String(formInsumo.quantidade).replace(",", ".")) || 0
        : Number(formInsumo.quantidade) || 0;
      const minNum = typeof formInsumo.minimo === "string"
        ? Number(String(formInsumo.minimo).replace(",", ".")) || 0
        : Number(formInsumo.minimo) || 0;

      await salvarInsumo.mutateAsync({
        ...formInsumo,
        nome: formInsumo.nome.trim(),
        quantidade: qtdNum,
        minimo: minNum,
        custo_unitario: custoNum,
      });
      toast.success("Material salvo no inventário!");
      setModalInsumo(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar material.");
    }
  };

  // Entrada de compra rápida
  const handleEntradaCompra = async () => {
    if (!materialEntradaId) {
      toast.error("Selecione o material.");
      return;
    }
    const material = insumos.find((i) => i.id === materialEntradaId);
    if (!material) return;

    const qtdNova = (Number(material.quantidade) || 0) + Number(qtdEntradaCompra);
    let novoCustoUnit = material.custo_unitario;

    if (custoTotalEntradaCompra > 0 && qtdEntradaCompra > 0) {
      // Recalcular custo médio ponderado
      const custoAtualTotal = (Number(material.quantidade) || 0) * material.custo_unitario;
      const novoTotal = custoAtualTotal + Number(custoTotalEntradaCompra);
      novoCustoUnit = Number((novoTotal / qtdNova).toFixed(2));
    }

    try {
      await salvarInsumo.mutateAsync({
        ...material,
        quantidade: qtdNova,
        custo_unitario: novoCustoUnit,
      });
      toast.success(`+${qtdEntradaCompra} ${material.unidade} adicionados a "${material.nome}"!`);
      setModalEntradaCompra(false);
      setQtdEntradaCompra(1);
      setCustoTotalEntradaCompra(0);
    } catch {
      toast.error("Erro ao dar entrada na compra.");
    }
  };

  // Indicadores
  const materiaisCriticos = insumos.filter((i) => Number(i.quantidade) < Number(i.minimo));
  const totalPrateleira = produtos.reduce((s, p) => s + (Number(p.estoque) || 0), 0);
  const totalCongelado = produtos.reduce((s, p) => s + (Number(p.estoque_congelado) || 0), 0);
  const valorTotalPrateleira = produtos.reduce((s, p) => s + (Number(p.preco) || 0) * (Number(p.estoque) || 0), 0);
  const valorTotalCongelado = produtos.reduce((s, p) => s + (Number(p.preco) || 0) * (Number(p.estoque_congelado) || 0), 0);
  const valorTotalMateriais = insumos.reduce((s, i) => s + (Number(i.quantidade) || 0) * (Number(i.custo_unitario) || 0), 0);

  return (
    <Estrutura
      titulo="Catálogo & Estoque"
      subtitulo="Gerencie seus produtos vendáveis e o estoque de materiais e insumos"
    >
      {/* NAVEGAÇÃO DE ABAS INTERNAS COM BOTÕES NA MESMA LINHA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex items-center overflow-x-auto no-scrollbar -mx-3.5 px-3.5 sm:mx-0 sm:px-0">
          <button
            type="button"
            className={`py-2 px-3.5 sm:px-5 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              abaAtiva === "produtos"
                ? "border-[#084463] text-[#084463]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setAbaAtiva("produtos")}
          >
            <Tag className="size-4" />
            Meus Produtos ({produtos.length})
          </button>

          <button
            type="button"
            className={`py-2 px-3.5 sm:px-5 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              abaAtiva === "materiais"
                ? "border-[#084463] text-[#084463]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setAbaAtiva("materiais")}
          >
            <Package className="size-4" />
            Insumos & Materiais ({insumos.length})
            {materiaisCriticos.length > 0 && (
              <span className="bg-rose-100 text-rose-700 text-xs px-2 py-0.5 rounded-full font-black">
                {materiaisCriticos.length} em falta
              </span>
            )}
          </button>

          <button
            type="button"
            className={`py-2 px-3.5 sm:px-5 font-bold text-xs sm:text-sm border-b-2 transition-all flex items-center gap-2 whitespace-nowrap ${
              abaAtiva === "receitas"
                ? "border-[#084463] text-[#084463]"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setAbaAtiva("receitas")}
          >
            <CakeSlice className="size-4" />
            Receitas & Fichas ({totalComReceita})
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
          {abaAtiva === "produtos" ? (
            <Button
              className="rounded-xl sm:rounded-2xl gap-1.5 font-bold bg-[#084463] text-white hover:bg-[#06344C] shadow-md shadow-[#084463]/25 px-4 sm:px-5 h-9 sm:h-10 text-xs sm:text-sm"
              onClick={() => abrirModalProduto()}
            >
              <Plus className="size-4" /> Novo Produto
            </Button>
          ) : abaAtiva === "materiais" ? (
            <>
              <Button
                variant="outline"
                className="rounded-xl sm:rounded-2xl gap-1.5 font-bold border-slate-300 text-slate-700 h-9 sm:h-10 text-xs px-3 sm:px-4"
                onClick={() => {
                  if (insumos.length > 0 && !materialEntradaId) {
                    setMaterialEntradaId(insumos[0]?.id ?? "");
                  }
                  setModalEntradaCompra(true);
                }}
              >
                <Plus className="size-4" /> Entrada de Compra
              </Button>
              <Button
                className="rounded-xl sm:rounded-2xl gap-1.5 font-bold bg-[#084463] text-white hover:bg-[#06344C] shadow-md shadow-[#084463]/25 px-4 sm:px-5 h-9 sm:h-10 text-xs sm:text-sm"
                onClick={() => abrirModalInsumo()}
              >
                <Plus className="size-4" /> Novo Material
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="rounded-xl sm:rounded-2xl gap-1.5 text-xs border-[#084463]/40 text-[#084463] bg-[#084463]/5 hover:bg-[#084463]/10 font-bold h-9 sm:h-10 px-3 sm:px-4"
                onClick={() => {
                  setNovoValorHoraPadrao(valorHoraPadrao);
                  setNovoValorHoraPadraoTexto(
                    valorHoraPadrao.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                  );
                  setModalValorHora(true);
                }}
              >
                <Clock className="size-3.5" /> Hora: {brl(valorHoraPadrao)}/h
              </Button>

              <Button
                className="rounded-xl sm:rounded-2xl gap-1.5 font-bold bg-[#084463] text-white hover:bg-[#06344C] shadow-md shadow-[#084463]/25 px-4 sm:px-5 h-9 sm:h-10 text-xs sm:text-sm"
                onClick={() => {
                  setFormNovaReceita({
                    nome: "",
                    categoria: categorias[0] || "Geral",
                    preco: 0,
                    estoque: 0,
                    tempo_preparo_minutos: 45,
                    rendimento_unidades: 1,
                    ativo: true,
                  });
                  setPrecoNovaReceitaTexto("0,00");
                  setModalNovaReceita(true);
                }}
              >
                <Plus className="size-4" /> Nova Receita / Produto
              </Button>
            </>
          )}
        </div>
      </div>

      {/* CONTEÚDO DA ABA 1: MEUS PRODUTOS */}
      {abaAtiva === "produtos" && (
        <div className="space-y-4 pt-2">
          {/* CARDS INDICADORES */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <CartaoIndicador
              rotulo="Total de Produtos"
              valor={String(produtos.length)}
              detalhe="Peças e itens cadastrados"
              etiqueta="catálogo"
              tom="brand"
            />
            <CartaoIndicador
              rotulo="Em Prateleira / Prontos"
              valor={String(totalPrateleira) + " un"}
              detalhe={`+ ${totalCongelado} un congeladas / p/ assar`}
              etiqueta="saldo"
              tom="neutro"
            />
            <CartaoIndicador
              rotulo="Valor em Vitrine"
              valor={brl(valorTotalPrateleira)}
              detalhe={`Potencial c/ congelados: ${brl(valorTotalPrateleira + valorTotalCongelado)}`}
              etiqueta="estoque"
              tom="saffron"
            />
            <CartaoIndicador
              rotulo="Sob Encomenda"
              valor={String(produtos.filter((p) => p.disponibilidade === "sob_encomenda" || p.disponibilidade === "hibrido").length)}
              detalhe="Itens personalizáveis"
              etiqueta="produção"
              tom="neutro"
            />
          </section>

          {/* FILTROS E BUSCA */}
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={categoriaFiltro === "todas" ? "default" : "outline"}
                className={categoriaFiltro === "todas" ? "bg-[#084463] text-white font-bold" : "rounded-xl"}
                onClick={() => setCategoriaFiltro("todas")}
              >
                Todas as categorias
              </Button>
              {categorias.map((cat) => (
                <Button
                  key={cat}
                  size="sm"
                  variant={categoriaFiltro.toLowerCase() === cat.toLowerCase() ? "default" : "outline"}
                  className={categoriaFiltro.toLowerCase() === cat.toLowerCase() ? "bg-[#084463] text-white font-bold" : "rounded-xl"}
                  onClick={() => setCategoriaFiltro(cat)}
                >
                  {cat}
                </Button>
              ))}
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="w-full md:w-72">
                <Input
                  placeholder="Buscar produto por nome..."
                  value={buscaProduto}
                  onChange={(e) => setBuscaProduto(e.target.value)}
                  className="rounded-xl border-slate-300"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl shrink-0">
                <button
                  type="button"
                  className={`p-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                    modoVisualizacao === "lista"
                      ? "bg-white text-[#084463] shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  onClick={() => setModoVisualizacao("lista")}
                  title="Visualização em Lista"
                >
                  <List className="size-4" />
                  <span className="hidden sm:inline">Lista</span>
                </button>
                <button
                  type="button"
                  className={`p-1.5 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-all ${
                    modoVisualizacao === "grade"
                      ? "bg-white text-[#084463] shadow-xs"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  onClick={() => setModoVisualizacao("grade")}
                  title="Visualização em Cards"
                >
                  <LayoutGrid className="size-4" />
                  <span className="hidden sm:inline">Cards</span>
                </button>
              </div>
            </div>
          </div>

          {/* VISUALIZAÇÃO EM LISTA (EXATAMENTE COMO NO ANEXO) */}
          {modoVisualizacao === "lista" ? (
            <Painel className="p-0 overflow-hidden">
              {produtosFiltrados.length === 0 ? (
                <div className="p-12 text-center">
                  <Tag className="size-12 mx-auto text-slate-300 mb-2" />
                  <h3 className="font-bold text-slate-700">Nenhum produto cadastrado</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Cadastre produtos em 20 segundos para começar a registrar pedidos.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {produtosFiltrados.map((p) => {
                    const custo = p.custo_manual || custoProduto(p.id, receitas, insumos);
                    const margem = p.preco > 0 ? Math.round(((p.preco - custo) / p.preco) * 100) : 0;
                    const estoqueQtd = Number(p.estoque || 0);
                    const critico = estoqueQtd <= 3;
                    const totalValorVitrine = estoqueQtd * Number(p.preco || 0);

                    return (
                      <div
                        key={p.id}
                        className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black text-slate-900 text-base">{p.nome}</span>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase">
                              {p.categoria || "Geral"}
                            </span>
                            {critico && (
                              <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 flex items-center gap-1">
                                <AlertTriangle className="size-3" /> {estoqueQtd <= 0 ? "Esgotado" : "Estoque baixo"}
                              </span>
                            )}
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                              p.disponibilidade === "pronta_entrega"
                                ? "bg-blue-100 text-blue-800"
                                : p.disponibilidade === "sob_encomenda"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}>
                              {p.disponibilidade === "pronta_entrega"
                                ? "🛍️ Pronta-Entrega"
                                : p.disponibilidade === "sob_encomenda"
                                ? "📅 Sob Encomenda"
                                : "✨ Híbrido"}
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span>Preço de venda: <strong className="text-slate-700">{brl(p.preco)}</strong></span>
                            <span>•</span>
                            {custo > 0 && (
                              <>
                                <span>Custo unitário: <strong className="text-slate-700">{brl(custo)}</strong> ({margem}% margem)</span>
                                <span>•</span>
                              </>
                            )}
                            <span className="flex items-center gap-1">
                              <Snowflake className="size-3 text-sky-600 inline" /> Massas p/ assar / congelados: <strong className="text-sky-900 font-bold">{Number(p.estoque_congelado || 0)} un</strong>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4">
                          <div className="text-right">
                            <div className={`text-lg font-black ${critico ? "text-rose-600" : "text-slate-900"}`}>
                              {num(estoqueQtd)} un
                            </div>
                            <div className="text-xs text-slate-400">
                              Total: {brl(totalValorVitrine)}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Controle rápido de ajuste de estoque pronto */}
                            <div className="flex items-center gap-0.5 bg-slate-100 rounded-xl p-0.5 border border-slate-200">
                              <button
                                type="button"
                                className="size-7 flex items-center justify-center rounded-lg bg-white text-slate-700 font-black shadow-xs hover:bg-slate-50 active:scale-95 disabled:opacity-40"
                                onClick={() => ajustarEstoqueProduto(p, -1)}
                                disabled={estoqueQtd <= 0}
                                title="Diminuir 1 pronto"
                              >
                                <Minus className="size-3" />
                              </button>
                              <button
                                type="button"
                                className="size-7 flex items-center justify-center rounded-lg bg-white text-slate-700 font-black shadow-xs hover:bg-slate-50 active:scale-95"
                                onClick={() => ajustarEstoqueProduto(p, 1)}
                                title="Adicionar 1 pronto"
                              >
                                <Plus className="size-3" />
                              </button>
                            </div>

                            {/* Botão de assar fornada */}
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={Number(p.estoque_congelado || 0) <= 0}
                              className={`h-8 text-xs font-bold rounded-lg border-amber-300 gap-1 px-2.5 ${
                                Number(p.estoque_congelado || 0) <= 0
                                  ? "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed opacity-60"
                                  : "bg-amber-50 text-amber-900 hover:bg-amber-100"
                              }`}
                              onClick={() => {
                                if (Number(p.estoque_congelado || 0) <= 0) {
                                  toast.error(`Não há massas congeladas de "${p.nome}" no freezer para assar.`);
                                  return;
                                }
                                abrirModalAssar(p);
                              }}
                              title={
                                Number(p.estoque_congelado || 0) <= 0
                                  ? "Sem massas no freezer para assar"
                                  : "Assar massas congeladas e transferir para vitrine"
                              }
                            >
                              <Flame className="size-3.5 text-amber-600" /> Assar
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-slate-400 hover:text-slate-800 rounded-lg"
                              onClick={() => abrirModalProduto(p)}
                              title="Editar produto"
                            >
                              <Pencil className="size-4" />
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 rounded-lg"
                              onClick={() => {
                                if (confirm(`Excluir "${p.nome}" do catálogo?`)) {
                                  apagarProduto.mutate(p.id);
                                }
                              }}
                              title="Excluir produto"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Painel>
          ) : (
            /* VISUALIZAÇÃO EM GRADE DE CARDS */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {produtosFiltrados.length === 0 ? (
                <div className="col-span-full p-12 text-center bg-white rounded-3xl border border-slate-200">
                  <Tag className="size-12 mx-auto text-slate-300 mb-2" />
                  <h3 className="font-bold text-slate-700">Nenhum produto cadastrado</h3>
                  <p className="text-sm text-slate-500 mt-1">
                    Cadastre produtos em 20 segundos para começar a registrar pedidos.
                  </p>
                </div>
              ) : (
                produtosFiltrados.map((p) => {
                  const custo = p.custo_manual || custoProduto(p.id, receitas, insumos);
                  const margem = p.preco > 0 ? Math.round(((p.preco - custo) / p.preco) * 100) : 0;

                  return (
                    <div
                      key={p.id}
                      className="p-5 bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                              {p.categoria || "Geral"}
                            </span>
                            <h4 className="font-black text-slate-900 text-base leading-tight mt-0.5">
                              {p.nome}
                            </h4>
                          </div>
                          <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full shrink-0 ${
                            p.disponibilidade === "pronta_entrega"
                              ? "bg-blue-100 text-blue-800"
                              : p.disponibilidade === "sob_encomenda"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}>
                            {p.disponibilidade === "pronta_entrega"
                              ? "🛍️ Pronta-Entrega"
                              : p.disponibilidade === "sob_encomenda"
                              ? "📅 Sob Encomenda"
                              : "✨ Híbrido"}
                          </span>
                        </div>

                        <div className="flex items-baseline justify-between pt-1">
                          <div>
                            <span className="text-2xl font-black text-slate-900">{brl(p.preco)}</span>
                            {custo > 0 && (
                              <span className="text-xs text-slate-500 block">
                                Custo: {brl(custo)} ({margem}% margem)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* SALDOS DUPLOS: PRONTOS VS CONGELADOS/P/ ASSAR */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <div className="flex items-center gap-1.5 font-bold text-xs px-2.5 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200/80">
                          <span>🍪</span>
                          <span>{Number(p.estoque || 0)} prontos</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-bold text-xs px-2.5 py-1 rounded-xl bg-sky-50 text-sky-900 border border-sky-200/80">
                          <Snowflake className="size-3 text-sky-600" />
                          <span>{Number(p.estoque_congelado || 0)} p/ assar / congelados</span>
                        </div>
                      </div>

                      {/* AJUSTE RÁPIDO E AÇÃO DE ASSAR */}
                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 rounded-xl p-1">
                            <button
                              type="button"
                              className="size-7 flex items-center justify-center rounded-lg bg-white text-slate-700 font-black shadow-xs hover:bg-slate-100 active:scale-95"
                              onClick={() => ajustarEstoqueProduto(p, -1)}
                              title="Diminuir 1 pronto"
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <span className="px-2 text-center font-black text-xs text-slate-800" title="Prontos em vitrine">
                              {p.estoque} prontos
                            </span>
                            <button
                              type="button"
                              className="size-7 flex items-center justify-center rounded-lg bg-white text-slate-700 font-black shadow-xs hover:bg-slate-100 active:scale-95"
                              onClick={() => ajustarEstoqueProduto(p, 1)}
                              title="Adicionar 1 pronto"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>

                          {/* BOTÃO ASSAR / FINALIZAR */}
                          <Button
                            size="sm"
                            disabled={Number(p.estoque_congelado || 0) <= 0}
                            className={`h-9 gap-1.5 rounded-xl font-bold shadow-xs text-xs px-3 ${
                              Number(p.estoque_congelado || 0) <= 0
                                ? "bg-slate-200 text-slate-400 cursor-not-allowed opacity-60"
                                : "bg-amber-500 hover:bg-amber-600 text-white"
                            }`}
                            onClick={() => {
                              if (Number(p.estoque_congelado || 0) <= 0) {
                                toast.error(`Não há massas congeladas de "${p.nome}" no freezer para assar.`);
                                return;
                              }
                              abrirModalAssar(p);
                            }}
                            title={
                              Number(p.estoque_congelado || 0) <= 0
                                ? "Sem massas no freezer para assar"
                                : "Assar / finalizar unidades do freezer"
                            }
                          >
                            <Flame className="size-3.5" /> Assar
                          </Button>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-800 rounded-lg"
                            onClick={() => abrirModalProduto(p)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 rounded-lg"
                            onClick={() => {
                              if (confirm(`Excluir "${p.nome}" do catálogo?`)) {
                                apagarProduto.mutate(p.id);
                              }
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* CONTEÚDO DA ABA 2: MATERIAIS & EMBALAGENS */}
      {abaAtiva === "materiais" && (
        <div className="space-y-4 pt-2">
          {/* CARDS INDICADORES */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <CartaoIndicador
              rotulo="Total de Itens"
              valor={String(insumos.length)}
              detalhe="Matérias-primas e embalagens"
              etiqueta="inventário"
              tom="brand"
            />
            <CartaoIndicador
              rotulo="Estoque Crítico"
              valor={String(materiaisCriticos.length)}
              detalhe="Abaixo do limite de segurança"
              etiqueta="atenção"
              tom={materiaisCriticos.length > 0 ? "warning" : "success"}
            />
            <CartaoIndicador
              rotulo="Valor em Almoxarifado"
              valor={brl(valorTotalMateriais)}
              detalhe="Custo do material estocado"
              etiqueta="financeiro"
              tom="saffron"
            />
            <CartaoIndicador
              rotulo="Status de Compra"
              valor={materiaisCriticos.length === 0 ? "100% Ok" : "Comprar"}
              detalhe="Sugestões na aba Início"
              etiqueta="reposição"
              tom="neutro"
            />
          </section>

          {/* BUSCA */}
          <div className="flex justify-end">
            <div className="w-full md:w-72">
              <Input
                placeholder="Buscar material ou embalagem..."
                value={buscaMaterial}
                onChange={(e) => setBuscaMaterial(e.target.value)}
                className="rounded-xl border-slate-300"
              />
            </div>
          </div>

          {/* LISTA DE MATERIAIS */}
          <Painel className="p-0 overflow-hidden">
            {materiaisFiltrados.length === 0 ? (
              <div className="p-12 text-center">
                <Package className="size-12 mx-auto text-slate-300 mb-2" />
                <h3 className="font-bold text-slate-700">Nenhum material cadastrado</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Cadastre seus tecidos, fitas, embalagens ou ingredientes para controlar o saldo.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {materiaisFiltrados.map((i) => {
                  const critico = Number(i.quantidade) < Number(i.minimo);

                  return (
                    <div
                      key={i.id}
                      className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-900 text-base">{i.nome}</span>
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase">
                            {i.tipo}
                          </span>
                          {critico && (
                            <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 flex items-center gap-1">
                              <AlertTriangle className="size-3" /> Estoque baixo
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-3">
                          <span>Unidade de medida: <strong className="text-slate-700">{i.unidade}</strong></span>
                          <span>•</span>
                          <span>Custo unitário: <strong className="text-slate-700">{brl(i.custo_unitario)}</strong></span>
                          <span>•</span>
                          <span>Mínimo de segurança: {i.minimo} {i.unidade}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4">
                        <div className="text-right">
                          <div className={`text-lg font-black ${critico ? "text-rose-600" : "text-slate-900"}`}>
                            {num(i.quantidade)} {i.unidade}
                          </div>
                          <div className="text-xs text-slate-400">
                            Total: {brl(i.quantidade * i.custo_unitario)}
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs font-bold rounded-lg border-slate-300"
                            onClick={() => {
                              setMaterialEntradaId(i.id);
                              setModalEntradaCompra(true);
                            }}
                          >
                            + Entrada
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-800"
                            onClick={() => abrirModalInsumo(i)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                            onClick={() => {
                              if (confirm(`Excluir o material "${i.nome}"?`)) {
                                apagarInsumo.mutate(i.id);
                              }
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Painel>
        </div>
      )}

      {/* CONTEÚDO DA ABA 3: RECEITAS & FICHAS TÉCNICAS */}
      {abaAtiva === "receitas" && (
        <div className="space-y-4 pt-2">
          {/* CARDS INDICADORES */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            <CartaoIndicador
              rotulo="Fichas ativas"
              valor={String(totalComReceita)}
              detalhe={`de ${produtos.length} produtos no catálogo`}
              etiqueta="fichas"
              tom="brand"
            />
            <CartaoIndicador
              rotulo="Hora Fixada (Salário)"
              valor={`${brl(valorHoraPadrao)}/h`}
              detalhe="Valor global aplicado nas receitas"
              etiqueta="fixado"
              tom="neutro"
            />
            <CartaoIndicador
              rotulo="Custo médio p/ unidade"
              valor={brl(custoMedioReceitas)}
              detalhe="Insumos + Mão de Obra"
              etiqueta="custo unitário"
              tom="warning"
            />
            <CartaoIndicador
              rotulo="Margem real (selecionado)"
              valor={`${num(margemReceita, 0)}%`}
              detalhe={produtoSelecionadoReceita ? produtoSelecionadoReceita.nome : "Escolha um produto"}
              etiqueta={margemReceita >= 40 ? "lucrativo" : "atenção"}
              tom={margemReceita >= 40 ? "success" : "danger"}
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:gap-6">
            {/* PAINEL PRINCIPAL: INGREDIENTES E MATERIAIS */}
            <Painel className="p-6 lg:col-span-2 xl:col-span-3 space-y-6">
              <TituloSecao
                titulo="Ficha Técnica & Composição"
                descricao="Ingredientes e embalagens consumidos por receita/fornada"
                acao={
                  <Select value={produtoReceitaId} onValueChange={setProdutoReceitaId}>
                    <SelectTrigger className="w-[280px] rounded-full text-xs font-semibold">
                      <SelectValue placeholder="Escolha o produto" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl max-h-[300px]">
                      {produtos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.nome} ({brl(p.preco)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
              />

              {/* CAPACIDADE DE PRODUÇÃO COM O ESTOQUE ATUAL DE INSUMOS */}
              {produtoSelecionadoReceita && (
                <div className="glass-inset rounded-2xl p-4 border border-[#084463]/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#084463]/5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Package className="size-4 text-[#084463]" />
                      <p className="font-semibold text-sm">Capacidade de Produção Atual</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Estoque pronto: <strong className="text-foreground">{produtoSelecionadoReceita.estoque} un</strong> | Produção adicional possível:{" "}
                      <strong className="text-[#084463] font-bold">+{capacidadeReceita.possiveis} un</strong> (com os insumos do estoque)
                    </p>
                  </div>

                  {capacidadeReceita.gargaloInsumo ? (
                    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl text-xs text-amber-700 dark:text-amber-300 shrink-0">
                      <AlertTriangle className="size-4 shrink-0" />
                      <span>
                        Gargalo de Estoque: <strong>{capacidadeReceita.gargaloInsumo.nome}</strong> ({capacidadeReceita.gargaloInsumo.quantidade} {capacidadeReceita.gargaloInsumo.unidade})
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs text-emerald-700 dark:text-emerald-300 shrink-0">
                      <CheckCircle2 className="size-4 shrink-0" />
                      <span>Insumos suficientes</span>
                    </div>
                  )}
                </div>
              )}

              {/* LISTA DE INGREDIENTES DA RECEITA */}
              <div className="space-y-2">
                {itensReceita.length === 0 ? (
                  <Vazio texto="Essa receita ainda não tem ingredientes adicionados." />
                ) : (
                  itensReceita.map((item) => {
                    const insumo = insumos.find((i) => i.id === item.insumo_id);
                    const subtotal = insumo
                      ? Number(insumo.custo_unitario) * Number(item.quantidade)
                      : 0;
                    return (
                      <div
                        key={item.id}
                        className="glass-inset grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl px-4 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{insumo?.nome ?? "Item"}</p>
                          <p className="text-xs text-muted-foreground">
                            {num(Number(item.quantidade))} {insumo?.unidade} por fornada · {insumo?.tipo}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-sm tabular-nums font-semibold">{brl(subtotal)}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-full text-muted-foreground hover:text-destructive"
                            aria-label="Remover"
                            onClick={() => apagarReceitaItem.mutate(item.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* ADICIONAR NOVO INGREDIENTE */}
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px_auto] sm:items-end pt-3 border-t border-border/50">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Ingrediente ou material do estoque</Label>
                  <Select value={insumoReceitaId} onValueChange={setInsumoReceitaId}>
                    <SelectTrigger className="rounded-xl h-10 text-xs">
                      <SelectValue placeholder="Escolha um item" />
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl max-h-[250px]">
                      {insumos.map((i) => (
                        <SelectItem key={i.id} value={i.id} className="text-xs">
                          {i.nome} ({i.unidade}) - {brl(i.custo_unitario)}/{i.unidade} (Disponível: {i.quantidade})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="qtd-receita" className="text-xs font-semibold">Quantidade p/ fornada</Label>
                  <Input
                    id="qtd-receita"
                    inputMode="decimal"
                    value={quantidadeReceita}
                    onChange={(e) => setQuantidadeReceita(e.target.value)}
                    placeholder="0,5"
                    className="rounded-xl h-10 text-xs"
                  />
                </div>
                <Button className="rounded-2xl h-10 text-xs gap-1.5 bg-[#084463] text-white hover:bg-[#06344C]" onClick={incluirItemReceita} disabled={adicionarReceitaItem.isPending}>
                  <Plus className="size-4" /> Adicionar
                </Button>
              </div>
            </Painel>

            {/* PAINEL LATERAL: MÃO DE OBRA, RENDIMENTO E LUCRO REAL */}
            <Painel className="p-6 space-y-4">
              <TituloSecao titulo="Custo Real & Salário" descricao={produtoSelecionadoReceita?.nome ?? "Escolha um produto"} />

              {produtoSelecionadoReceita ? (
                <div className="space-y-4 text-sm">
                  {/* RENDIMENTO DA FORNADA */}
                  <div className="space-y-1.5 glass-inset rounded-2xl p-3">
                    <Label htmlFor="rendimento-input" className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <Package className="size-3.5 text-[#084463]" /> Rendimento por Receita (unidades)
                    </Label>
                    <Input
                      id="rendimento-input"
                      type="text"
                      inputMode="numeric"
                      placeholder="1"
                      value={rendimentoTexto}
                      onChange={(e) => {
                        const digitos = e.target.value.replace(/\D/g, "");
                        setRendimentoTexto(digitos);
                        const num = digitos === "" ? 1 : Math.max(1, parseInt(digitos, 10));
                        setLocalRendimento(num);
                        salvarAlteracaoDebounced({ rendimento_unidades: num });
                      }}
                      onBlur={() => {
                        const num = rendimentoTexto === "" ? 1 : Math.max(1, parseInt(rendimentoTexto, 10));
                        setRendimentoTexto(String(num));
                        setLocalRendimento(num);
                        salvarAlteracaoImediata({ rendimento_unidades: num });
                      }}
                      className="rounded-xl font-bold text-sm h-9"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Quantas unidades de produto esta receita produz por fornada.
                    </p>
                  </div>

                  {/* TEMPO DE PREPARO (MINUTOS) */}
                  <div className="space-y-1.5 glass-inset rounded-2xl p-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="tempo-input" className="text-xs font-semibold flex items-center gap-1">
                        <Clock className="size-3.5 text-[#084463]" /> Tempo de Preparo (min)
                      </Label>
                      <button
                        type="button"
                        onClick={() => {
                          setNovoValorHoraPadrao(valorHoraPadrao);
                          setNovoValorHoraPadraoTexto(
                            valorHoraPadrao.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          );
                          setModalValorHora(true);
                        }}
                        className="text-[10px] text-[#084463] hover:underline font-semibold"
                      >
                        Hora: {brl(valorHoraPadrao)}/h ⚙️
                      </button>
                    </div>
                    <Input
                      id="tempo-input"
                      type="text"
                      inputMode="numeric"
                      placeholder="45"
                      value={tempoPreparoTexto}
                      onChange={(e) => {
                        const digitos = e.target.value.replace(/\D/g, "");
                        setTempoPreparoTexto(digitos);
                        const num = digitos === "" ? 0 : parseInt(digitos, 10);
                        setLocalTempoPreparo(num);
                        salvarAlteracaoDebounced({ tempo_preparo_minutos: num });
                      }}
                      onBlur={() => {
                        const num = tempoPreparoTexto === "" ? 0 : parseInt(tempoPreparoTexto, 10);
                        setTempoPreparoTexto(num ? String(num) : "");
                        setLocalTempoPreparo(num);
                        salvarAlteracaoImediata({ tempo_preparo_minutos: num });
                      }}
                      className="rounded-xl font-bold text-sm h-9"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Sua mão de obra nesta receita: <strong>{brl(maoObraFornada)}</strong> por fornada.
                    </p>
                  </div>

                  {/* DETALHAMENTO DE CUSTOS DA FORNADA */}
                  <div className="glass-inset rounded-2xl p-3 space-y-1.5 border border-border/40">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Insumos por fornada:</span>
                      <span className="font-semibold text-foreground">{brl(insumosFornada)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Mão de Obra (Seu Salário):</span>
                      <span className="font-semibold text-[#084463]">{brl(maoObraFornada)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold pt-1.5 border-t border-border/40">
                      <span>Custo Total da Fornada:</span>
                      <span>{brl(totalFornada)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-amber-600 dark:text-amber-400 pt-1">
                      <span>Custo Real por Unidade:</span>
                      <span>{brl(custoUnitarioReal)}</span>
                    </div>
                  </div>

                  {/* INPUT EDITÁVEL DE PREÇO DE VENDA */}
                  <div className="space-y-1.5 glass-inset rounded-2xl p-3">
                    <Label htmlFor="preco-venda-edit" className="text-xs font-semibold text-[#084463]">
                      Preço de Venda Unitário (R$)
                    </Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        R$
                      </span>
                      <Input
                        id="preco-venda-edit"
                        type="text"
                        inputMode="numeric"
                        placeholder="0,00"
                        value={precoReceitaTexto}
                        onChange={(e) => {
                          const digitos = e.target.value.replace(/\D/g, "");
                          const numValor = digitos ? Number(digitos) / 100 : 0;
                          setPrecoReceitaTexto(
                            digitos
                              ? numValor.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : ""
                          );
                          setLocalPreco(numValor);
                          salvarAlteracaoDebounced({ preco: numValor });
                        }}
                        onBlur={() => {
                          salvarAlteracaoImediata({ preco: localPreco });
                        }}
                        className="pl-9 rounded-xl font-bold text-base h-10"
                      />
                    </div>
                  </div>

                  {/* INPUT EDITÁVEL DE LUCRO DESEJADO POR UNIDADE */}
                  <div className="space-y-1.5 glass-inset rounded-2xl p-3">
                    <Label htmlFor="lucro-edit" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      Lucro Líquido Real p/ Unidade (R$)
                    </Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        R$
                      </span>
                      <Input
                        id="lucro-edit"
                        type="text"
                        inputMode="numeric"
                        placeholder="0,00"
                        value={lucroReceitaTexto}
                        onChange={(e) => {
                          const digitos = e.target.value.replace(/\D/g, "");
                          const numValor = digitos ? Number(digitos) / 100 : 0;
                          setLucroReceitaTexto(
                            digitos
                              ? numValor.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : ""
                          );
                          const novoPreco = Number((custoUnitarioReal + numValor).toFixed(2));
                          setLocalPreco(novoPreco);
                          setPrecoReceitaTexto(
                            novoPreco.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          );
                          salvarAlteracaoDebounced({ preco: novoPreco });
                        }}
                        onBlur={() => {
                          salvarAlteracaoImediata({ preco: localPreco });
                        }}
                        className="pl-9 rounded-xl font-bold text-base h-10 text-emerald-600 dark:text-emerald-400"
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Já descontando insumos + sua hora trabalhada ({brl(valorHoraPadrao)}/h).
                    </p>
                  </div>

                  <div className="flex items-center justify-between px-2 pt-1">
                    <span className="text-xs text-muted-foreground">Margem Real de Lucro</span>
                    <Etiqueta tom={margemReceita >= 40 ? "success" : margemReceita > 0 ? "warning" : "danger"}>
                      {num(margemReceita, 0)}%
                    </Etiqueta>
                  </div>
                </div>
              ) : (
                <Vazio texto="Selecione um produto para ajustar preço e lucro." />
              )}
            </Painel>
          </div>
        </div>
      )}

      {/* MODAL: NOVO PRODUTO */}
      <Dialog open={modalProduto} onOpenChange={setModalProduto}>
        <DialogContent className="w-[95vw] sm:max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl sm:rounded-3xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#084463]">
              {formProduto.id ? "Editar Produto" : "Novo Produto no Catálogo"}
            </DialogTitle>
            <DialogDescription>
              Cadastro rápido em menos de 20 segundos para iniciar suas vendas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-bold text-slate-700">Nome da Peça ou Produto</Label>
              <Input
                placeholder="Ex: Bolo Cenoura, Boneca de Feltro, Laço Infantil..."
                value={formProduto.nome || ""}
                onChange={(e) => setFormProduto({ ...formProduto, nome: e.target.value })}
                className="mt-1 rounded-xl font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between h-5">
                  <Label className="text-xs font-bold text-slate-700">Categoria</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setOrigemNovaCategoria("produto");
                      setNovaCategoriaNome("");
                      setModalNovaCategoria(true);
                    }}
                    className="text-[11px] font-semibold text-[#084463] hover:underline flex items-center gap-1"
                  >
                    <Plus className="size-3" /> Nova Categoria
                  </button>
                </div>
                <Select
                  value={formProduto.categoria || categorias[0] || "Geral"}
                  onValueChange={(v) => setFormProduto({ ...formProduto, categoria: v })}
                >
                  <SelectTrigger className="mt-1.5 rounded-xl h-10">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl max-h-[260px]">
                    {categorias.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between h-5">
                  <Label className="text-xs font-bold text-slate-700">Preço de Venda (R$)</Label>
                </div>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    R$
                  </span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={precoProdutoTexto}
                    onChange={(e) => {
                      const digitos = e.target.value.replace(/\D/g, "");
                      const numValor = digitos ? Number(digitos) / 100 : 0;
                      setFormProduto({ ...formProduto, preco: numValor });
                      setPrecoProdutoTexto(
                        digitos
                          ? numValor.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : ""
                      );
                    }}
                    className="pl-9 rounded-xl font-black text-slate-900 h-10"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Tipo de Disponibilidade</Label>
              <Select
                value={formProduto.disponibilidade || "hibrido"}
                onValueChange={(v: any) => setFormProduto({ ...formProduto, disponibilidade: v })}
              >
                <SelectTrigger className="mt-1.5 rounded-xl h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hibrido">Ambos (Pronta & Encomenda)</SelectItem>
                  <SelectItem value="pronta_entrega">Apenas Pronta-Entrega</SelectItem>
                  <SelectItem value="sob_encomenda">Apenas Sob Encomenda</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700 h-5 flex items-center">Prontos na Vitrine (un)</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={formProduto.estoque ? String(formProduto.estoque) : ""}
                  onChange={(e) => {
                    const digitos = e.target.value.replace(/\D/g, "");
                    const num = digitos === "" ? 0 : parseInt(digitos, 10);
                    setFormProduto({ ...formProduto, estoque: num });
                  }}
                  className="mt-1.5 rounded-xl h-10 font-semibold"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700 h-5 flex items-center gap-1">
                  <Snowflake className="size-3 text-sky-600" /> Congelados / P/ Assar (un)
                </Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={formProduto.estoque_congelado ? String(formProduto.estoque_congelado) : ""}
                  onChange={(e) => {
                    const digitos = e.target.value.replace(/\D/g, "");
                    const num = digitos === "" ? 0 : parseInt(digitos, 10);
                    setFormProduto({ ...formProduto, estoque_congelado: num });
                  }}
                  className="mt-1.5 rounded-xl h-10 font-semibold"
                />
              </div>
            </div>

            <p className="text-[11px] text-slate-400">
              💡 <strong>Dica operacional:</strong> Cadastre massas no freezer ou peças pré-prontas em "Congelados / P/ Assar". Quando for assar uma fornada, use o botão "Assar" no card para transferir automaticamente para a vitrine.
            </p>

          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setModalProduto(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl font-bold bg-[#084463] text-white hover:bg-[#06344C] px-5"
              onClick={handleSalvarProduto}
            >
              Salvar Produto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: NOVO MATERIAL / INSUMO */}
      <Dialog open={modalInsumo} onOpenChange={setModalInsumo}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[85vh] overflow-y-auto rounded-2xl sm:rounded-3xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#084463]">
              {formInsumo.id ? "Editar Material" : "Cadastrar Material / Embalagem"}
            </DialogTitle>
            <DialogDescription>
              Matérias-primas, fitas, tecidos, caixas ou ingredientes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-bold text-slate-700">Nome do Material</Label>
              <Input
                placeholder="Ex: Tecido Linho Cru, Fita Cetim 22mm, Caixa Kraft..."
                value={formInsumo.nome || ""}
                onChange={(e) => setFormInsumo({ ...formInsumo, nome: e.target.value })}
                className="mt-1 rounded-xl font-semibold"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">Tipo</Label>
                <Select
                  value={formInsumo.tipo || "materia_prima"}
                  onValueChange={(v: any) => setFormInsumo({ ...formInsumo, tipo: v })}
                >
                  <SelectTrigger className="mt-1 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="materia_prima">Matéria-Prima</SelectItem>
                    <SelectItem value="embalagem">Embalagem</SelectItem>
                    <SelectItem value="acessorio">Acessório</SelectItem>
                    <SelectItem value="ingrediente">Ingrediente</SelectItem>
                    <SelectItem value="material">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Unidade de Medida</Label>
                <Select
                  value={formInsumo.unidade || "un"}
                  onValueChange={(v: any) => setFormInsumo({ ...formInsumo, unidade: v })}
                >
                  <SelectTrigger className="mt-1 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="un">un (Unidade)</SelectItem>
                    <SelectItem value="m">m (Metros)</SelectItem>
                    <SelectItem value="cm">cm (Centímetros)</SelectItem>
                    <SelectItem value="folha">folha</SelectItem>
                    <SelectItem value="rolo">rolo</SelectItem>
                    <SelectItem value="par">par</SelectItem>
                    <SelectItem value="kg">kg (Quilogramas)</SelectItem>
                    <SelectItem value="g">g (Gramas)</SelectItem>
                    <SelectItem value="ml">ml (Mililitros)</SelectItem>
                    <SelectItem value="L">L (Litros)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs font-bold text-slate-700">Qtd Atual</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={formInsumo.quantidade ? String(formInsumo.quantidade) : ""}
                  onChange={(e) => {
                    const v = e.target.value.replace(",", ".");
                    const num = v === "" ? 0 : parseFloat(v) || 0;
                    setFormInsumo({ ...formInsumo, quantidade: num });
                  }}
                  className="mt-1 rounded-xl"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Mínimo</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={formInsumo.minimo ? String(formInsumo.minimo) : ""}
                  onChange={(e) => {
                    const v = e.target.value.replace(",", ".");
                    const num = v === "" ? 0 : parseFloat(v) || 0;
                    setFormInsumo({ ...formInsumo, minimo: num });
                  }}
                  className="mt-1 rounded-xl"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Custo Unit.</Label>
                <div className="relative mt-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    R$
                  </span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={custoInsumoTexto}
                    onChange={(e) => {
                      const digitos = e.target.value.replace(/\D/g, "");
                      const numValor = digitos ? Number(digitos) / 100 : 0;
                      setFormInsumo((prev) => ({ ...prev, custo_unitario: numValor }));
                      setCustoInsumoTexto(
                        numValor.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })
                      );
                    }}
                    className="mt-0 pl-8 rounded-xl font-bold text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setModalInsumo(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl font-bold bg-[#084463] text-white hover:bg-[#06344C] px-5"
              onClick={handleSalvarInsumo}
            >
              Salvar Material
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: ENTRADA DE COMPRA */}
      <Dialog open={modalEntradaCompra} onOpenChange={setModalEntradaCompra}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[85vh] overflow-y-auto rounded-2xl sm:rounded-3xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#084463] flex items-center gap-2">
              <Plus className="size-5" /> Entrada de Compra de Materiais
            </DialogTitle>
            <DialogDescription>
              Adicione estoque rapidamente quando comprar materiais novos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-bold text-slate-700">Material Comprado</Label>
              <Select value={materialEntradaId} onValueChange={setMaterialEntradaId}>
                <SelectTrigger className="mt-1 rounded-xl">
                  <SelectValue placeholder="Selecione o material" />
                </SelectTrigger>
                <SelectContent>
                  {insumos.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.nome} (Atual: {i.quantidade} {i.unidade})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">Quantidade Comprada</Label>
                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="1"
                  value={qtdEntradaCompra ? String(qtdEntradaCompra) : ""}
                  onChange={(e) => {
                    const v = e.target.value.replace(",", ".");
                    const num = v === "" ? 0 : parseFloat(v) || 0;
                    setQtdEntradaCompra(num);
                  }}
                  className="mt-1 rounded-xl font-bold"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Valor Total Pago (R$)</Label>
                <div className="relative mt-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    R$
                  </span>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={custoTotalEntradaCompraTexto}
                    onChange={(e) => {
                      const digitos = e.target.value.replace(/\D/g, "");
                      const numValor = digitos ? Number(digitos) / 100 : 0;
                      setCustoTotalEntradaCompra(numValor);
                      setCustoTotalEntradaCompraTexto(
                        digitos
                          ? numValor.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : ""
                      );
                    }}
                    className="mt-0 pl-8 rounded-xl font-bold text-slate-900"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setModalEntradaCompra(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl font-bold bg-[#084463] text-white hover:bg-[#06344C] px-5"
              onClick={handleEntradaCompra}
            >
              Confirmar Entrada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* MODAL EDITAR VALOR DA HORA PADRÃO DO ATELIÊ */}
      <Dialog open={modalValorHora} onOpenChange={setModalValorHora}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold text-slate-800">Sua Hora Fixada (Padrão do Ateliê)</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Defina quanto vale a sua hora de trabalho. Esse valor é fixado globalmente e aplicado em todas as receitas automaticamente, sem precisar digitar ao criar novas receitas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="valor-hora-global-input" className="text-xs font-semibold">Valor da Hora Trabalhada (R$/h)</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  R$
                </span>
                <Input
                  id="valor-hora-global-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={novoValorHoraPadraoTexto}
                  onChange={(e) => {
                    const digitos = e.target.value.replace(/\D/g, "");
                    const numValor = digitos ? Number(digitos) / 100 : 0;
                    setNovoValorHoraPadrao(numValor);
                    setNovoValorHoraPadraoTexto(
                      digitos
                        ? numValor.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : ""
                    );
                  }}
                  className="pl-9 rounded-xl font-bold text-base h-10"
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Exemplo: Para uma meta de salário de R$ 3.000/mês trabalhando 160h, o valor ideal é R$ 18,75/h.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => setModalValorHora(false)}>
              Cancelar
            </Button>
            <Button className="rounded-2xl bg-[#084463] text-white hover:bg-[#06344C]" onClick={salvarNovoValorHoraPadrao}>
              Fixar Valor da Hora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL CRIAR NOVA RECEITA / PRODUTO */}
      <Dialog open={modalNovaReceita} onOpenChange={setModalNovaReceita}>
        <DialogContent className="w-[95vw] sm:max-w-md rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-bold text-slate-800">Criar Nova Receita / Produto</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Cadastre o produto. O valor da sua hora ({brl(valorHoraPadrao)}/h) será aplicado automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="nome-prod-rec" className="text-xs font-semibold">Nome da Receita / Produto</Label>
              <Input
                id="nome-prod-rec"
                placeholder="Ex: Torta de Limão Gourmet"
                value={formNovaReceita.nome ?? ""}
                onChange={(e) => setFormNovaReceita({ ...formNovaReceita, nome: e.target.value })}
                className="rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between h-5">
                  <Label htmlFor="cat-prod-rec" className="text-xs font-semibold">Categoria</Label>
                  <button
                    type="button"
                    onClick={() => {
                      setOrigemNovaCategoria("receita");
                      setNovaCategoriaNome("");
                      setModalNovaCategoria(true);
                    }}
                    className="text-[11px] font-semibold text-[#084463] hover:underline flex items-center gap-1"
                  >
                    <Plus className="size-3" /> Nova Categoria
                  </button>
                </div>
                <Select
                  value={formNovaReceita.categoria || categorias[0] || "Geral"}
                  onValueChange={(v) => setFormNovaReceita({ ...formNovaReceita, categoria: v })}
                >
                  <SelectTrigger id="cat-prod-rec" className="mt-1.5 rounded-xl h-10">
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl max-h-[260px]">
                    {categorias.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center justify-between h-5">
                  <Label htmlFor="preco-prod-rec" className="text-xs font-semibold">Preço Sugerido (R$)</Label>
                </div>
                <div className="relative mt-1.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                    R$
                  </span>
                  <Input
                    id="preco-prod-rec"
                    type="text"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={precoNovaReceitaTexto}
                    onChange={(e) => {
                      const digitos = e.target.value.replace(/\D/g, "");
                      const numValor = digitos ? Number(digitos) / 100 : 0;
                      setFormNovaReceita({ ...formNovaReceita, preco: numValor });
                      setPrecoNovaReceitaTexto(
                        digitos
                          ? numValor.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          : ""
                      );
                    }}
                    className="pl-9 rounded-xl font-bold h-10"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="tempo-prod-rec" className="text-xs font-semibold">Tempo de Preparo (min)</Label>
                <Input
                  id="tempo-prod-rec"
                  type="text"
                  inputMode="numeric"
                  placeholder="45"
                  value={formNovaReceita.tempo_preparo_minutos ? String(formNovaReceita.tempo_preparo_minutos) : ""}
                  onChange={(e) => {
                    const digitos = e.target.value.replace(/\D/g, "");
                    const num = digitos === "" ? 0 : parseInt(digitos, 10);
                    setFormNovaReceita({ ...formNovaReceita, tempo_preparo_minutos: num });
                  }}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="rendimento-prod-rec" className="text-xs font-semibold">Rendimento (unidades)</Label>
                <Input
                  id="rendimento-prod-rec"
                  type="text"
                  inputMode="numeric"
                  placeholder="1"
                  value={formNovaReceita.rendimento_unidades === 0 ? "" : (formNovaReceita.rendimento_unidades ? String(formNovaReceita.rendimento_unidades) : "")}
                  onChange={(e) => {
                    const digitos = e.target.value.replace(/\D/g, "");
                    setFormNovaReceita({ ...formNovaReceita, rendimento_unidades: digitos === "" ? 0 : parseInt(digitos, 10) });
                  }}
                  onBlur={() => {
                    if (!formNovaReceita.rendimento_unidades || formNovaReceita.rendimento_unidades <= 0) {
                      setFormNovaReceita({ ...formNovaReceita, rendimento_unidades: 1 });
                    }
                  }}
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => setModalNovaReceita(false)}>
              Cancelar
            </Button>
            <Button className="rounded-2xl bg-[#084463] text-white hover:bg-[#06344C]" onClick={salvarCriacaoReceita}>
              Criar Receita & Produto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: NOVA CATEGORIA */}
      <Dialog open={modalNovaCategoria} onOpenChange={setModalNovaCategoria}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[85vh] overflow-y-auto rounded-2xl sm:rounded-3xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#084463] flex items-center gap-2">
              <Plus className="size-5" /> Cadastrar Nova Categoria
            </DialogTitle>
            <DialogDescription>
              Cadastre uma nova categoria para organizar seus produtos e receitas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="nome-nova-cat" className="text-xs font-semibold">Nome da Categoria</Label>
              <Input
                id="nome-nova-cat"
                placeholder="Ex: Bolos & Tortas, Artesanato, Costura, Velas..."
                value={novaCategoriaNome}
                onChange={(e) => setNovaCategoriaNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleSalvarNovaCategoria();
                  }
                }}
                className="rounded-xl font-semibold"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setModalNovaCategoria(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl font-bold bg-[#084463] text-white hover:bg-[#06344C] px-5"
              onClick={handleSalvarNovaCategoria}
              disabled={salvarCategoria.isPending}
            >
              Salvar Categoria
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* MODAL: ASSAR / FINALIZAR CONGELADO */}
      <Dialog open={modalAssar} onOpenChange={setModalAssar}>
        <DialogContent className="w-[95vw] sm:max-w-md max-h-[85vh] overflow-y-auto rounded-2xl sm:rounded-3xl p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
              <span className="p-2 rounded-2xl bg-amber-100 text-amber-700">
                <Flame className="size-5" />
              </span>
              Assar / Finalizar Fornada
            </DialogTitle>
            <DialogDescription>
              Transfira unidades do freezer / pré-prontas direto para a vitrine de pronta-entrega.
            </DialogDescription>
          </DialogHeader>

          {produtoAssando && (
            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  {produtoAssando.categoria}
                </span>
                <h4 className="font-black text-slate-900 text-lg leading-tight">
                  {produtoAssando.nome}
                </h4>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/80 text-xs">
                  <div className="p-2.5 rounded-xl bg-sky-50 border border-sky-200/70">
                    <span className="text-slate-500 block">No freezer / p/ assar</span>
                    <strong className="text-sky-900 font-black text-base">
                      {Number(produtoAssando.estoque_congelado || 0)} un
                    </strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200/70">
                    <span className="text-slate-500 block">Prontos na vitrine</span>
                    <strong className="text-amber-900 font-black text-base">
                      {Number(produtoAssando.estoque || 0)} un
                    </strong>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="qtd-assar-input" className="text-xs font-bold text-slate-700">
                  Quantas unidades você está assando / finalizando agora?
                </Label>
                <Input
                  id="qtd-assar-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="1"
                  value={qtdAssar === 0 ? "" : (qtdAssar ? String(qtdAssar) : "")}
                  onChange={(e) => {
                    const digitos = e.target.value.replace(/\D/g, "");
                    setQtdAssar(digitos === "" ? 0 : parseInt(digitos, 10));
                  }}
                  onBlur={() => {
                    if (!qtdAssar || qtdAssar <= 0) {
                      setQtdAssar(1);
                    }
                  }}
                  className="rounded-xl h-11 text-lg font-black text-amber-600"
                />

                <div className="flex gap-1.5 pt-1">
                  {[6, 12, 24].map((n) => (
                    <Button
                      key={n}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-xl text-xs h-7 px-2.5 font-bold"
                      onClick={() => setQtdAssar(n)}
                    >
                      +{n} un
                    </Button>
                  ))}
                  {Number(produtoAssando.estoque_congelado || 0) > 0 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-xl text-xs h-7 px-2.5 font-bold text-sky-700 border-sky-200"
                      onClick={() => setQtdAssar(Number(produtoAssando.estoque_congelado))}
                    >
                      Tudo ({produtoAssando.estoque_congelado} un)
                    </Button>
                  )}
                </div>
              </div>

              {/* ALERTA DE BLOQUEIO QUANDO NÃO HÁ CONGELADO SUFICIENTE */}
              {Number(produtoAssando.estoque_congelado || 0) <= 0 ? (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-300 text-xs text-rose-900 flex items-center gap-2">
                  <AlertTriangle className="size-4 text-rose-600 shrink-0" />
                  <span>Não há massas congeladas no freezer para assar este produto.</span>
                </div>
              ) : qtdAssar > Number(produtoAssando.estoque_congelado || 0) ? (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-300 text-xs text-rose-900 flex items-center gap-2">
                  <AlertTriangle className="size-4 text-rose-600 shrink-0" />
                  <span>
                    Quantidade ({qtdAssar} un) excede o que há no freezer ({produtoAssando.estoque_congelado} un).
                  </span>
                </div>
              ) : (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                  <span className="font-bold block">✨ Prévia após assar:</span>
                  <p>
                    • Freezer: <strong>{Math.max(0, Number(produtoAssando.estoque_congelado || 0) - qtdAssar)} un</strong>
                  </p>
                  <p>
                    • Vitrine Pronta: <strong>{Number(produtoAssando.estoque || 0) + qtdAssar} un</strong>
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setModalAssar(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white px-5 shadow-md shadow-amber-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                Number(produtoAssando?.estoque_congelado || 0) <= 0 ||
                qtdAssar > Number(produtoAssando?.estoque_congelado || 0)
              }
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

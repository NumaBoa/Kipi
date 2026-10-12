import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
  UserPlus,
  Sparkles,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  MessageCircle,
  Package,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
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
import { brl, dataHora, formatarTelefone, num } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import {
  calcularComissaoEstimadaCarrinho,
  calcularComissaoRevendedora,
  calcularEstoqueConsignadoRevendedor,
  custoProduto,
  useApagarPagamentoComissao,
  useApagarRevendedora,
  useApagarVenda,
  useAtualizarVenda,
  useAtualizarStatusProducao,
  useCategorias,
  useClientes,
  useInsumos,
  usePagamentosComissao,
  useProdutos,
  useReceitas,
  useRegistrarVenda,
  useRemessasConsignacao,
  useRevendedoras,
  useSalvarCliente,
  useSalvarPagamentoComissao,
  useSalvarRevendedora,
  useVendas,
  type ItemCarrinho,
  type ItemEstoqueConsignado,
  type Produto,
  type Revendedora,
  type Venda,
} from "@/lib/dados";

type VendasSearch = {
  nova?: boolean;
};

export const Route = createFileRoute("/_authenticated/vendas")({
  validateSearch: (search: Record<string, unknown>): VendasSearch => {
    return {
      nova: search["nova"] === true || search["nova"] === "true" || search["nova"] === "1",
    };
  },
  head: () => ({
    meta: [
      { title: "Pedidos & Vendas — Meu Ateliê" },
      {
        name: "description",
        content: "Controle de pronta-entrega e encomendas sob medida com sinal e saldo na entrega.",
      },
      { property: "og:title", content: "Pedidos & Vendas — Meu Ateliê" },
      {
        property: "og:description",
        content: "Controle de pronta-entrega e encomendas sob medida com sinal e saldo na entrega.",
      },
    ],
  }),
  component: PaginaVendas,
});

const dataHoje = () => new Date().toISOString().split("T")[0] ?? "";

export function PaginaVendas() {
  const { data: produtos = [] } = useProdutos();
  const { data: clientes = [] } = useClientes();
  const { data: revendedoras = [] } = useRevendedoras();
  const { data: receitas = [] } = useReceitas();
  const { data: insumos = [] } = useInsumos();
  const { data: vendas = [] } = useVendas();
  const { data: remessas = [] } = useRemessasConsignacao();

  const { usuario } = useAuth();
  const revendedorVinculado = useMemo(() => {
    return (
      revendedoras.find(
        (r) =>
          (r.usuario_id && r.usuario_id === usuario?.id) ||
          (r.email && usuario?.email && r.email.toLowerCase() === usuario.email.toLowerCase()) ||
          (r.nome && usuario?.nome && r.nome.toLowerCase() === usuario.nome.toLowerCase())
      ) ?? null
    );
  }, [revendedoras, usuario]);

  // Se o usuário possui vínculo de revendedora nesta loja ou seu papel for revendedor,
  // sua visão é SEMPRE e EXCLUSIVAMENTE de Revendedor (protegendo a privacidade dos dados do ateliê do cliente)
  const ehRevendedor = usuario?.papel === "revendedor" || Boolean(revendedorVinculado);

  const revendedorLogado = useMemo(() => {
    if (!ehRevendedor) return null;
    return revendedorVinculado ?? revendedoras[0] ?? null;
  }, [ehRevendedor, revendedorVinculado, revendedoras]);

  const registrarVenda = useRegistrarVenda();
  const atualizarVenda = useAtualizarVenda();
  const atualizarStatusProd = useAtualizarStatusProducao();
  const apagarVenda = useApagarVenda();

  const search = Route.useSearch();
  const [modalNovoPedido, setModalNovoPedido] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<"todos" | "pronta_entrega" | "sob_encomenda" | "saldo_pendente">("todos");
  const [busca, setBusca] = useState("");

  // Abrir direto via atalho de busca
  useEffect(() => {
    if (search.nova) {
      setModalNovoPedido(true);
    }
  }, [search.nova]);

  // FORMULÁRIO DE NOVO PEDIDO
  const [tipoPedido, setTipoPedido] = useState<"pronta_entrega" | "sob_encomenda">("pronta_entrega");
  const [clienteId, setClienteId] = useState<string>("avulso");
  const [canal, setCanal] = useState<"propria" | "revendedora">("propria");
  const [revendedoraId, setRevendedoraId] = useState<string>("");
  const [pagamento, setPagamento] = useState<"pix" | "dinheiro" | "cartao" | "transferencia">("pix");
  const [dataEntrega, setDataEntrega] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split("T")[0] ?? "";
  });
  const [personalizacao, setPersonalizacao] = useState("");
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>([]);
  const [sinalPago, setSinalPago] = useState<number>(0);
  const [sinalPagoTexto, setSinalPagoTexto] = useState<string>("0,00");
  const [sinalCustomizado, setSinalCustomizado] = useState(false);

  // Estados para filtro e busca de produtos por categoria (ID Visual solicitada)
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");
  const [buscaProduto, setBuscaProduto] = useState<string>("");

  // Categorias extraídas dinamicamente dos produtos
  const categoriasDisponiveis = useMemo(() => {
    const cats = new Set<string>();
    produtos.forEach((p) => {
      if (p.categoria?.trim()) cats.add(p.categoria.trim());
    });
    return Array.from(cats);
  }, [produtos]);

  const produtosFiltradosParaSelecao = useMemo(() => {
    return produtos.filter((p) => {
      if (!p.ativo) return false;
      if (categoriaFiltro !== "todas" && p.categoria?.trim() !== categoriaFiltro) return false;
      if (buscaProduto.trim()) {
        const termo = buscaProduto.toLowerCase();
        const nome = p.nome.toLowerCase();
        const cat = p.categoria?.toLowerCase() || "";
        if (!nome.includes(termo) && !cat.includes(termo)) return false;
      }
      return true;
    });
  }, [produtos, categoriaFiltro, buscaProduto]);

  // Modal para cadastro rápido de novo cliente durante a venda
  const [modalNovoCliente, setModalNovoCliente] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState("");
  const [novoClienteTelefone, setNovoClienteTelefone] = useState("");
  const [novoClienteBairro, setNovoClienteBairro] = useState("");
  const [novoClienteObs, setNovoClienteObs] = useState("");

  const salvarCliente = useSalvarCliente();

  const handleSalvarNovoCliente = async () => {
    if (!novoClienteNome.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    try {
      const novoId = `cli_${Date.now()}`;
      await salvarCliente.mutateAsync({
        id: novoId,
        nome: novoClienteNome.trim(),
        telefone: novoClienteTelefone.trim() || null,
        bairro: novoClienteBairro.trim() || null,
        observacoes: novoClienteObs.trim() || null,
        tipo_contato: "cliente",
        revendedora_id: ehRevendedor && revendedorLogado ? revendedorLogado.id : null,
      });

      setClienteId(novoId);
      setModalNovoCliente(false);
      setNovoClienteNome("");
      setNovoClienteTelefone("");
      setNovoClienteBairro("");
      setNovoClienteObs("");
      toast.success(`Cliente "${novoClienteNome.trim()}" cadastrado e selecionado!`);
    } catch {
      toast.error("Erro ao cadastrar novo cliente.");
    }
  };

  // Clientes do revendedor
  const clientesDoRevendedor = useMemo(() => {
    if (!ehRevendedor || !revendedorLogado) return [];
    return clientes.filter((c) => c.revendedora_id === revendedorLogado.id);
  }, [ehRevendedor, revendedorLogado, clientes]);

  // Se for revendedor logado, trava canal na revendedora correspondente
  useEffect(() => {
    if (ehRevendedor && revendedorLogado) {
      setCanal("revendedora");
      setRevendedoraId(revendedorLogado.id);
    } else if (revendedorVinculado && !revendedoraId) {
      setRevendedoraId(revendedorVinculado.id);
    }
  }, [ehRevendedor, revendedorLogado, revendedorVinculado, modalNovoPedido]);

  // Vendas válidas (filtradas para a loja do revendedor caso logado como revendedor)
  const validas = useMemo(() => {
    const list = vendas.filter((v) => v.status !== "cancelado");
    if (ehRevendedor && revendedorLogado) {
      return list.filter((v) => v.canal === "revendedora" && v.revendedora_id === revendedorLogado.id);
    }
    return list;
  }, [vendas, ehRevendedor, revendedorLogado]);

  // Indicadores e estoque específicos do revendedor logado
  const comissaoTotalRevendedor = useMemo(() => {
    if (!ehRevendedor || !revendedorLogado) return 0;
    return validas.reduce((acc, v) => acc + calcularComissaoRevendedora(v, revendedorLogado), 0);
  }, [ehRevendedor, revendedoras, revendedorLogado, validas]);

  const estoqueConsignadoRevendedor = useMemo(() => {
    if (!ehRevendedor || !revendedorLogado) return [];
    return calcularEstoqueConsignadoRevendedor(revendedorLogado.id, remessas, validas, produtos);
  }, [ehRevendedor, revendedorLogado, remessas, validas, produtos]);

  const totalPecasEstoqueRevendedor = useMemo(() => {
    return estoqueConsignadoRevendedor.reduce((s, i) => s + i.saldo_atual, 0);
  }, [estoqueConsignadoRevendedor]);

  // Modais de detalhes para os KPIs clicáveis (Estoque do PDV e Saldos a Baixar)
  const [modalEstoquePdv, setModalEstoquePdv] = useState(false);
  const [buscaEstoqueModal, setBuscaEstoqueModal] = useState("");

  const [modalSaldosPendentes, setModalSaldosPendentes] = useState(false);
  const [buscaSaldosModal, setBuscaSaldosModal] = useState("");

  const produtosEstoqueModal = useMemo(() => {
    if (!buscaEstoqueModal.trim()) return estoqueConsignadoRevendedor;
    const t = buscaEstoqueModal.toLowerCase();
    return estoqueConsignadoRevendedor.filter((i) =>
      i.nome_produto.toLowerCase().includes(t)
    );
  }, [estoqueConsignadoRevendedor, buscaEstoqueModal]);

  const valorTotalEstoqueRevendedor = useMemo(() => {
    return estoqueConsignadoRevendedor.reduce(
      (sum, i) => sum + i.saldo_atual * i.preco_unitario,
      0
    );
  }, [estoqueConsignadoRevendedor]);

  const pedidosComSaldoPendente = useMemo(() => {
    return validas.filter((v) => Number(v.saldo_na_entrega || 0) > 0);
  }, [validas]);

  const pedidosComSaldoFiltrados = useMemo(() => {
    if (!buscaSaldosModal.trim()) return pedidosComSaldoPendente;
    const t = buscaSaldosModal.toLowerCase();
    return pedidosComSaldoPendente.filter((v) => {
      const cli = v.clientes?.nome?.toLowerCase() || "";
      const obs = v.observacoes?.toLowerCase() || "";
      const itens = (v.venda_itens || []).map((i) => i.nome_produto.toLowerCase()).join(" ");
      return cli.includes(t) || obs.includes(t) || itens.includes(t);
    });
  }, [pedidosComSaldoPendente, buscaSaldosModal]);

  // Saldo de estoque em posse do revendedor selecionado
  const estoquePdvAtual = useMemo(() => {
    if (canal !== "revendedora" || !revendedoraId) return [];
    return calcularEstoqueConsignadoRevendedor(revendedoraId, remessas, validas, produtos);
  }, [canal, revendedoraId, remessas, validas, produtos]);

  // Cálculos do Carrinho
  const totalPedido = useMemo(() => {
    return carrinho.reduce((sum, item) => sum + item.produto.preco * item.quantidade, 0);
  }, [carrinho]);

  const custoTotalEstimado = useMemo(() => {
    return carrinho.reduce((sum, item) => {
      const c = item.produto.custo_manual || custoProduto(item.produto.id, receitas, insumos);
      return sum + c * item.quantidade;
    }, 0);
  }, [carrinho, receitas, insumos]);

  // Se for sob encomenda e o usuário não digitou sinal customizado, sugerimos 50%
  useEffect(() => {
    if (tipoPedido === "sob_encomenda" && !sinalCustomizado) {
      const v = Number((totalPedido * 0.5).toFixed(2));
      setSinalPago(v);
      setSinalPagoTexto(
        v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      );
    } else if (tipoPedido === "pronta_entrega") {
      setSinalPago(totalPedido);
      setSinalPagoTexto(
        totalPedido.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      );
    }
  }, [totalPedido, tipoPedido, sinalCustomizado]);

  const saldoNaEntrega = useMemo(() => {
    if (tipoPedido === "pronta_entrega") return 0;
    return Math.max(0, totalPedido - (Number(sinalPago) || 0));
  }, [totalPedido, sinalPago, tipoPedido]);

  // Ações de Carrinho
  const adicionarAoCarrinho = (p: Produto) => {
    setCarrinho((prev) => {
      const existe = prev.find((i) => i.produto.id === p.id);
      if (existe) {
        return prev.map((i) => (i.produto.id === p.id ? { ...i, quantidade: i.quantidade + 1 } : i));
      }
      return [...prev, { produto: p, quantidade: 1 }];
    });
  };

  const alterarQtd = (produtoId: string, delta: number) => {
    setCarrinho((prev) =>
      prev
        .map((i) => {
          if (i.produto.id === produtoId) {
            const nova = i.quantidade + delta;
            return nova > 0 ? { ...i, quantidade: nova } : null;
          }
          return i;
        })
        .filter(Boolean) as ItemCarrinho[]
    );
  };

  const salvarPedido = async () => {
    if (carrinho.length === 0) {
      toast.error("Adicione ao menos um produto ou serviço ao pedido.");
      return;
    }

    try {


      await registrarVenda.mutateAsync({
        itens: carrinho,
        clienteId: clienteId === "avulso" ? null : clienteId,
        canal,
        revendedoraId: canal === "revendedora" && revendedoraId ? revendedoraId : null,
        data: new Date().toISOString(),
        tipo_pedido: tipoPedido,
        data_entrega_prometida: tipoPedido === "sob_encomenda" ? dataEntrega : null,
        valor_sinal_pago: tipoPedido === "sob_encomenda" ? Number(sinalPago) || 0 : totalPedido,
        saldo_na_entrega: saldoNaEntrega,
        status_producao: tipoPedido === "sob_encomenda" ? "a_fazer" : undefined,
        pagamento,
        status: saldoNaEntrega > 0 ? "pendente" : "pago",
        observacoes: personalizacao || "",
        receitas,
        insumos,
      });

      toast.success(
        tipoPedido === "sob_encomenda"
          ? "Encomenda registrada! Enviada para a fila de Produção."
          : "Venda de pronta-entrega concluída com sucesso!"
      );
      setModalNovoPedido(false);
      setCarrinho([]);
      setPersonalizacao("");
      setSinalCustomizado(false);
      setSinalPago(0);
      setSinalPagoTexto("0,00");
    } catch {
      toast.error("Erro ao registrar pedido.");
    }
  };

  // Quitar saldo devedor de um pedido
  const quitarSaldo = async (v: Venda) => {
    try {
      await atualizarVenda.mutateAsync({
        ...v,
        saldo_na_entrega: 0,
        status: "pago",
      });
      toast.success("Saldo quitado com sucesso!");
    } catch {
      toast.error("Erro ao atualizar pagamento.");
    }
  };

  // Filtragem de pedidos
  const pedidosFiltrados = useMemo(() => {
    return validas.filter((v) => {
      // Filtro tipo
      if (filtroTipo === "pronta_entrega" && v.tipo_pedido !== "pronta_entrega") return false;
      if (filtroTipo === "sob_encomenda" && v.tipo_pedido !== "sob_encomenda") return false;
      if (filtroTipo === "saldo_pendente" && !(Number(v.saldo_na_entrega) > 0)) return false;

      // Filtro busca
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const nomeCli = v.clientes?.nome?.toLowerCase() || "";
        const obs = v.observacoes?.toLowerCase() || "";
        const itens = v.venda_itens?.map((i) => i.nome_produto.toLowerCase()).join(" ") || "";
        if (!nomeCli.includes(termo) && !obs.includes(termo) && !itens.includes(termo)) {
          return false;
        }
      }
      return true;
    });
  }, [validas, filtroTipo, busca]);

  // Indicadores
  const totalFaturado = validas.reduce((s, v) => s + Number(v.total || 0), 0);
  const totalAReceber = validas.reduce((s, v) => s + Number(v.saldo_na_entrega || 0), 0);
  const qtdProntaEntrega = validas.filter((v) => v.tipo_pedido === "pronta_entrega").length;
  const qtdEncomendasAtivas = validas.filter(
    (v) => v.tipo_pedido === "sob_encomenda" && v.status_producao !== "entregue"
  ).length;

  const copiarComprovanteWhatsApp = (v: Venda) => {
    const nome = v.clientes?.nome || "Cliente";
    const itens = (v.venda_itens || []).map((i) => `- ${i.quantidade}x ${i.nome_produto} (${brl(i.preco_unitario * i.quantidade)})`).join("\n");
    const prazo = v.data_entrega_prometida ? new Date(v.data_entrega_prometida).toLocaleDateString("pt-BR") : "Pronta-entrega";
    const financeiro = v.saldo_na_entrega && v.saldo_na_entrega > 0
      ? `*Total:* ${brl(v.total)}\n*Sinal pago:* ${brl(v.valor_sinal_pago || 0)}\n*Saldo a acertar na entrega:* ${brl(v.saldo_na_entrega)}`
      : `*Total pago:* ${brl(v.total)} (${v.pagamento.toUpperCase()})`;

    const texto = [
      `✨ *COMPROVANTE DE PEDIDO - MEU ATELIÊ*`,
      `Olá, ${nome}! Seu pedido foi registrado com carinho:\n`,
      `📦 *Itens:*`,
      itens,
      `\n🗓️ *Previsão de Entrega:* ${prazo}`,
      financeiro,
      v.observacoes ? `\n📝 *Detalhes:* ${v.observacoes}` : "",
      `\nMuito obrigado pela confiança!`
    ].filter(Boolean).join("\n");

    navigator.clipboard.writeText(texto);
    toast.success("Resumo do pedido copiado! Pronto para colar no WhatsApp.");
  };

  return (
    <Estrutura
      titulo={ehRevendedor ? "Painel do Revendedor" : "Pedidos & Vendas"}
      subtitulo={
        ehRevendedor
          ? `Ponto de Venda: ${revendedorLogado?.nome || "Revenda Autorizada"} — Suas vendas, comissões, baixas de recebimento e estoque`
          : "Pronta-entrega e encomendas sob medida com controle de prazos e pagamentos"
      }
    >
      {/* CARDS DE INDICADORES */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <CartaoIndicador
          rotulo={ehRevendedor ? "Minhas Vendas Realizadas" : "Total Vendido"}
          valor={brl(totalFaturado)}
          detalhe={`${validas.length} pedidos ${ehRevendedor ? "no meu ponto de venda" : "no total"}`}
          etiqueta="faturamento"
          tom="brand"
        />
        <CartaoIndicador
          rotulo={ehRevendedor ? "Minha Comissão" : "A Receber na Entrega"}
          valor={ehRevendedor ? brl(comissaoTotalRevendedor) : brl(totalAReceber)}
          detalhe={
            ehRevendedor
              ? revendedorLogado?.tipo_comissao === "valor_fixo"
                ? `${brl(revendedorLogado.comissao_fixa)} por unidade vendida`
                : `${revendedorLogado?.comissao_percentual || 0}% sobre o total vendido`
              : totalAReceber > 0
              ? "👉 Clique para ver clientes pendentes"
              : "Saldos pendentes de encomendas"
          }
          etiqueta={ehRevendedor ? "comissão" : "saldo"}
          tom={ehRevendedor ? "brand" : totalAReceber > 0 ? "warning" : "neutro"}
          onClick={!ehRevendedor && totalAReceber > 0 ? () => setModalSaldosPendentes(true) : undefined}
        />
        <CartaoIndicador
          rotulo={ehRevendedor ? "Saldos a Baixar / Receber" : "Encomendas em Fila"}
          valor={ehRevendedor ? brl(totalAReceber) : String(qtdEncomendasAtivas)}
          detalhe={
            ehRevendedor
              ? totalAReceber > 0
                ? "👉 Clique para ver quem falta pagar"
                : "Todos pagamentos em dia"
              : "Sob encomenda em produção"
          }
          etiqueta={ehRevendedor ? "baixa de pagamento" : "produção"}
          tom={ehRevendedor && totalAReceber > 0 ? "warning" : "neutro"}
          onClick={ehRevendedor ? () => setModalSaldosPendentes(true) : undefined}
        />
        <CartaoIndicador
          rotulo={ehRevendedor ? "Estoque no Balcão (PDV)" : "Pronta-Entrega"}
          valor={ehRevendedor ? `${totalPecasEstoqueRevendedor} un` : String(qtdProntaEntrega)}
          detalhe={
            ehRevendedor
              ? "👉 Clique para ver estoque detalhado"
              : "Vendas imediatas de estoque"
          }
          etiqueta="estoque"
          tom={ehRevendedor && totalPecasEstoqueRevendedor > 0 ? "brand" : "neutro"}
          onClick={ehRevendedor ? () => setModalEstoquePdv(true) : undefined}
        />
      </section>

      {/* FILTROS E BUSCA */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between mt-2">
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={filtroTipo === "todos" ? "default" : "outline"}
            className={filtroTipo === "todos" ? "bg-[#084463] text-white font-bold" : "rounded-xl"}
            onClick={() => setFiltroTipo("todos")}
          >
            Todos ({validas.length})
          </Button>
          <Button
            size="sm"
            variant={filtroTipo === "pronta_entrega" ? "default" : "outline"}
            className={filtroTipo === "pronta_entrega" ? "bg-[#084463] text-white font-bold" : "rounded-xl"}
            onClick={() => setFiltroTipo("pronta_entrega")}
          >
            🛍️ Pronta-Entrega ({qtdProntaEntrega})
          </Button>
          <Button
            size="sm"
            variant={filtroTipo === "sob_encomenda" ? "default" : "outline"}
            className={filtroTipo === "sob_encomenda" ? "bg-[#084463] text-white font-bold" : "rounded-xl"}
            onClick={() => setFiltroTipo("sob_encomenda")}
          >
            📅 Sob Encomenda ({validas.filter((v) => v.tipo_pedido === "sob_encomenda").length})
          </Button>
          <Button
            size="sm"
            variant={filtroTipo === "saldo_pendente" ? "default" : "outline"}
            className={filtroTipo === "saldo_pendente" ? "bg-amber-600 text-white font-bold" : "rounded-xl text-amber-700 border-amber-300"}
            onClick={() => setFiltroTipo("saldo_pendente")}
          >
            ⚠️ Saldo a Receber ({validas.filter((v) => Number(v.saldo_na_entrega) > 0).length})
          </Button>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="w-full md:w-64">
            <Input
              placeholder="Buscar por cliente ou item..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="rounded-xl border-slate-300"
            />
          </div>
          <Button
            className="rounded-xl gap-1.5 font-bold bg-[#084463] text-white hover:bg-[#06344C] shadow-md shadow-[#084463]/25 px-4 h-10 shrink-0"
            onClick={() => setModalNovoPedido(true)}
          >
            <Plus className="size-4" /> Novo Pedido
          </Button>
        </div>
      </div>

      {/* LISTAGEM DE PEDIDOS */}
      <Painel className="p-0 overflow-hidden">
        {pedidosFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="size-12 mx-auto text-slate-300 mb-3" />
            <h3 className="font-bold text-slate-700 text-lg">Nenhum pedido encontrado</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
              {busca ? "Tente buscar com outro termo." : "Clique em 'Novo Pedido' para registrar sua primeira venda pronta-entrega ou encomenda personalizada."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {pedidosFiltrados.map((v) => {
              const eEncomenda = v.tipo_pedido === "sob_encomenda";
              const temSaldo = Number(v.saldo_na_entrega || 0) > 0;
              const dataFormatada = new Date(v.data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
              const entregaFormatada = v.data_entrega_prometida ? new Date(v.data_entrega_prometida).toLocaleDateString("pt-BR") : null;

              return (
                <div key={v.id} className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-base">
                        {v.clientes?.nome || "Venda Balcão / Avulsa"}
                      </span>
                      {eEncomenda ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">
                          <Calendar className="size-3" /> Sob Encomenda
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          <Package className="size-3" /> Pronta-Entrega
                        </span>
                      )}

                      {eEncomenda && v.status_producao && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          v.status_producao === "a_fazer" ? "bg-slate-100 text-slate-700" :
                          v.status_producao === "fazendo" ? "bg-amber-100 text-amber-800" :
                          v.status_producao === "pronto_retirada" ? "bg-emerald-100 text-emerald-800" :
                          "bg-slate-200 text-slate-600"
                        }`}>
                          {v.status_producao === "a_fazer" ? "A Fazer" :
                           v.status_producao === "fazendo" ? "Produzindo" :
                           v.status_producao === "pronto_retirada" ? "Pronto" : "Entregue"}
                        </span>
                      )}

                      {temSaldo ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          <AlertCircle className="size-3" /> A receber: {brl(v.saldo_na_entrega || 0)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="size-3" /> Pago
                        </span>
                      )}
                    </div>

                    <div className="text-sm text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span>{dataFormatada}</span>
                      {entregaFormatada && (
                        <span className="font-semibold text-purple-900 bg-purple-50 px-2 py-0.5 rounded">
                          🗓️ Entrega prevista: {entregaFormatada}
                        </span>
                      )}
                      <span>Pagamento: <strong className="uppercase">{v.pagamento}</strong></span>
                      {v.canal === "revendedora" && (
                        <span className="text-indigo-800 font-semibold bg-indigo-50 px-2 py-0.5 rounded">
                          🏪 {v.revendedoras?.nome || "Revendedor"} · {v.tipo_pedido === "sob_encomenda" ? "📅 Encomenda" : "🛍️ Pronta-Entrega (Consignado)"}
                        </span>
                      )}
                    </div>

                    {/* ITENS */}
                    <div className="text-xs text-slate-500 pt-1">
                      <span className="font-semibold text-slate-700">Itens: </span>
                      {(v.venda_itens || []).map((i) => `${i.quantidade}x ${i.nome_produto}`).join(", ")}
                    </div>

                    {v.observacoes && (
                      <p className="text-xs text-amber-900 bg-amber-50/70 border border-amber-200/60 p-2 rounded-lg mt-1 italic">
                        "{v.observacoes}"
                      </p>
                    )}
                  </div>

                  <div className="flex md:flex-col items-end justify-between md:justify-center gap-2 border-t md:border-t-0 pt-3 md:pt-0">
                    <div className="text-right">
                      <div className="text-lg font-black text-slate-900">{brl(v.total)}</div>
                      {temSaldo && (
                        <div className="text-xs text-amber-700 font-semibold">
                          Sinal: {brl(v.valor_sinal_pago || 0)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {temSaldo && (
                        <Button
                          size="sm"
                          className="h-8 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg"
                          onClick={() => quitarSaldo(v)}
                        >
                          Receber Saldo
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1 rounded-lg text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                        onClick={() => copiarComprovanteWhatsApp(v)}
                        title="Copiar comprovante para WhatsApp"
                      >
                        <MessageCircle className="size-3.5" /> WhatsApp
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600"
                        onClick={() => {
                          if (confirm("Excluir este pedido?")) {
                            apagarVenda.mutate(v.id);
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

      {/* MODAL: NOVO PEDIDO */}
      <Dialog open={modalNovoPedido} onOpenChange={setModalNovoPedido}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#084463]">Registrar Novo Pedido</DialogTitle>
            <DialogDescription>
              Venda pronta-entrega imediata ou encomenda sob medida com sinal e prazo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* SELETOR DE MODALIDADE */}
            <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-2xl">
              <button
                type="button"
                className={`py-2.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  tipoPedido === "pronta_entrega"
                    ? "bg-white text-[#084463] shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                onClick={() => setTipoPedido("pronta_entrega")}
              >
                <Package className="size-4" />
                🛍️ Pronta-Entrega
              </button>
              <button
                type="button"
                className={`py-2.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  tipoPedido === "sob_encomenda"
                    ? "bg-white text-purple-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                onClick={() => setTipoPedido("sob_encomenda")}
              >
                <Calendar className="size-4" />
                📅 Sob Encomenda
              </button>
            </div>

            {/* CAMPOS ESPECÍFICOS DE SOB ENCOMENDA */}
            {tipoPedido === "sob_encomenda" && (
              <div className="p-4 bg-purple-50/60 border border-purple-200/80 rounded-2xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-bold text-purple-950">Data Prometida de Entrega</Label>
                    <Input
                      type="date"
                      value={dataEntrega}
                      onChange={(e) => setDataEntrega(e.target.value)}
                      className="mt-1 bg-white rounded-xl border-purple-200"
                    />
                  </div>
                  <div>
                    <Label className="text-xs font-bold text-purple-950">Atalhos de Prazo</Label>
                    <div className="flex gap-1.5 mt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-xs bg-white text-purple-900 h-9"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 1);
                          setDataEntrega(d.toISOString().split("T")[0] ?? "");
                        }}
                      >
                        Amanhã
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-xs bg-white text-purple-900 h-9"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 3);
                          setDataEntrega(d.toISOString().split("T")[0] ?? "");
                        }}
                      >
                        +3 Dias
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-xs bg-white text-purple-900 h-9"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + 7);
                          setDataEntrega(d.toISOString().split("T")[0] ?? "");
                        }}
                      >
                        +7 Dias
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-xs font-bold text-purple-950">Personalizações / Detalhes da Peça</Label>
                  <Textarea
                    placeholder="Ex: Nome da criança bordado, tema safari, sem lactose, tamanho GG..."
                    value={personalizacao}
                    onChange={(e) => setPersonalizacao(e.target.value)}
                    className="mt-1 bg-white rounded-xl border-purple-200 min-h-[60px]"
                  />
                </div>
              </div>
            )}

            {/* CLIENTE E CANAL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-bold text-slate-700">Cliente</Label>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1">
                    <Select value={clienteId} onValueChange={setClienteId}>
                      <SelectTrigger className="rounded-xl h-10">
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60 rounded-2xl">
                        <SelectItem value="avulso">🛍️ Venda Balcão / Cliente Rápido</SelectItem>
                        {ehRevendedor ? (
                          clientesDoRevendedor.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              👤 {c.nome} {c.telefone ? `(${formatarTelefone(c.telefone)})` : ""}
                            </SelectItem>
                          ))
                        ) : (
                          clientes.map((c) => {
                            const revNome = c.revendedora_id
                              ? revendedoras.find((r) => r.id === c.revendedora_id)?.nome
                              : null;
                            return (
                              <SelectItem key={c.id} value={c.id}>
                                👤 {c.nome} {c.telefone ? `(${formatarTelefone(c.telefone)})` : ""}
                                {revNome ? ` · 🏪 ${revNome}` : ""}
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setModalNovoCliente(true)}
                    className="rounded-xl font-bold gap-1 text-[#084463] border-[#084463]/30 hover:bg-[#084463]/10 h-10 px-3 shrink-0"
                    title="Cadastrar novo cliente agora"
                  >
                    <UserPlus className="size-4" />
                    <span className="hidden sm:inline">Novo</span>
                  </Button>
                </div>
              </div>

              {!ehRevendedor ? (
                <div>
                  <Label className="text-xs font-bold text-slate-700">Canal de Venda</Label>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={canal === "propria" ? "default" : "outline"}
                      className={canal === "propria" ? "bg-[#084463] text-white font-bold" : "rounded-xl"}
                      onClick={() => setCanal("propria")}
                    >
                      Venda Direta
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={canal === "revendedora" ? "default" : "outline"}
                      className={canal === "revendedora" ? "bg-[#084463] text-white font-bold" : "rounded-xl"}
                      onClick={() => {
                        setCanal("revendedora");
                        if (!revendedoraId && revendedoras.length > 0) {
                          setRevendedoraId(revendedorVinculado?.id || revendedoras[0]?.id || "");
                        }
                      }}
                    >
                      Via Parceiro
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <Label className="text-xs font-bold text-slate-700">Ponto de Revenda (PDV)</Label>
                  <div className="mt-1 p-2 rounded-xl bg-purple-100/70 border border-purple-200 text-xs font-bold text-purple-900 flex items-center gap-1.5 h-9">
                    <Store className="size-3.5 text-purple-700 shrink-0" />
                    <span className="truncate">🏪 {revendedorLogado?.nome || usuario?.nome}</span>
                  </div>
                </div>
              )}
            </div>

            {canal === "revendedora" && (
              <div className="space-y-3">
                {!ehRevendedor && (
                  <div>
                    <Label className="text-xs font-bold text-slate-700">Origem: Revendedor ou Parceiro</Label>
                    <Select value={revendedoraId} onValueChange={setRevendedoraId}>
                      <SelectTrigger className="mt-1 rounded-xl">
                        <SelectValue placeholder="Selecione o revendedor ou parceiro" />
                      </SelectTrigger>
                      <SelectContent>
                        {revendedoras.map((r) => {
                          const ehParceiro = r.categoria_parceria === "parceiro";
                          return (
                            <SelectItem key={r.id} value={r.id}>
                              {ehParceiro ? "🤝 Parceiro: " : "🏪 Revendedor: "}
                              {r.nome} ({r.tipo_comissao === "porcentagem" ? `${r.comissao_percentual}%` : brl(r.comissao_fixa)})
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className={`p-3 rounded-2xl border text-xs flex items-start gap-2.5 ${
                  tipoPedido === "sob_encomenda"
                    ? "bg-purple-50/80 border-purple-200 text-purple-900"
                    : "bg-blue-50/80 border-blue-200 text-blue-900"
                }`}>
                  {tipoPedido === "sob_encomenda" ? (
                    <>
                      <Calendar className="size-4 text-purple-700 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold">Sob Encomenda pelo Revendedor:</strong>
                        <span>O revendedor captou a encomenda. Ela irá para a fila de Produção do ateliê (com prazo e sinal) e <strong>não desconta</strong> do estoque consignado dele.</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <Package className="size-4 text-blue-700 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold">Pronta-Entrega Consignada:</strong>
                        <span>A venda dará baixa diretamente nas unidades entregues que estão na posse deste revendedor.</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* PRODUTOS / ITENS: CATEGORIAS E SELEÇÃO VISUAL (CONFORME SOLICITADO) */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200/60 pb-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-[#084463] dark:text-foreground">
                  2. Escolha os Produtos por Categoria
                </h3>
                <div className="w-full sm:w-64">
                  <Input
                    placeholder="Filtrar por nome do produto..."
                    value={buscaProduto}
                    onChange={(e) => setBuscaProduto(e.target.value)}
                    className="rounded-full h-9 text-xs bg-slate-50 border-slate-200 pl-3"
                  />
                </div>
              </div>

              {/* ABAS / PÍLULAS DE CATEGORIA */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setCategoriaFiltro("todas")}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer",
                    categoriaFiltro === "todas"
                      ? "bg-[#6366F1] text-white shadow-xs"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                  )}
                >
                  <Sparkles className="size-3.5 text-amber-300" />
                  <span>Todas As Categorias</span>
                </button>
                {categoriasDisponiveis.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoriaFiltro(cat)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer",
                      categoriaFiltro === cat
                        ? "bg-[#6366F1] text-white shadow-xs"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* GRID DE PRODUTOS NO MODELO DA IMAGEM */}
              {produtosFiltradosParaSelecao.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500">
                  Nenhum produto encontrado nesta categoria ou busca.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[340px] overflow-y-auto p-1 pr-1.5">
                  {produtosFiltradosParaSelecao.map((p) => {
                    const itemNoCarrinho = carrinho.find((i) => i.produto.id === p.id);
                    const qtd = itemNoCarrinho?.quantidade ?? 0;

                    // Saldo em estoque
                    const itemPdv = estoquePdvAtual.find((i: ItemEstoqueConsignado) => i.produto_id === p.id);
                    const saldoPdv = itemPdv ? itemPdv.saldo_atual : 0;
                    const ehRevendaPronta = canal === "revendedora" && tipoPedido === "pronta_entrega" && revendedoraId;

                    return (
                      <div
                        key={p.id}
                        className={cn(
                          "p-3.5 rounded-2xl bg-white border transition-all flex items-center justify-between gap-3 shadow-xs",
                          qtd > 0
                            ? "border-[#6366F1] ring-1 ring-[#6366F1]/20 bg-[#6366F1]/[0.02]"
                            : "border-slate-200/90 hover:border-slate-300"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-800 text-sm truncate">
                            {p.nome}
                          </p>
                          <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full mt-1">
                            {p.categoria || "Geral"}
                          </span>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-sm font-extrabold text-[#6366F1]">
                              {brl(p.preco)}
                            </span>
                            <span className="text-xs text-slate-400 font-normal">
                              {ehRevendaPronta
                                ? `(${saldoPdv} un no PDV)`
                                : `(${p.estoque ?? 0} un em estoque)`}
                            </span>
                          </div>
                        </div>

                        {/* CONTADOR / STEPPER PILL */}
                        <div className="flex items-center bg-slate-50 border border-slate-200 rounded-full p-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => alterarQtd(p.id, -1)}
                            disabled={qtd === 0}
                            className={cn(
                              "size-7 rounded-full flex items-center justify-center font-bold text-slate-600 transition-colors",
                              qtd === 0
                                ? "opacity-30 cursor-not-allowed text-slate-400"
                                : "hover:bg-white hover:text-slate-900 cursor-pointer shadow-2xs"
                            )}
                          >
                            -
                          </button>
                          <span className="w-6 text-center font-black text-sm text-slate-800">
                            {qtd}
                          </span>
                          <button
                            type="button"
                            onClick={() => adicionarAoCarrinho(p)}
                            className="size-7 rounded-full flex items-center justify-center font-bold text-slate-600 hover:bg-white hover:text-slate-900 transition-colors cursor-pointer shadow-2xs"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* RESUMO DO CARRINHO */}
              {carrinho.length > 0 && (
                <div className="p-3 bg-purple-50/60 border border-purple-200/80 rounded-2xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="size-4 text-purple-700" />
                    <span className="font-bold text-purple-950">
                      Carrinho: {carrinho.reduce((s, i) => s + i.quantidade, 0)} itens selecionados
                    </span>
                  </div>
                  <span className="font-black text-sm text-purple-950">
                    Subtotal: {brl(totalPedido)}
                  </span>
                </div>
              )}
            </div>

            {/* FORMA DE PAGAMENTO E SINAL */}
            <div className="p-4 bg-slate-50 rounded-2xl space-y-3 border border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bold text-slate-700">Forma de Pagamento</Label>
                  <Select value={pagamento} onValueChange={(v: any) => setPagamento(v)}>
                    <SelectTrigger className="mt-1 rounded-xl bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="cartao">Cartão de Crédito/Débito</SelectItem>
                      <SelectItem value="transferencia">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {tipoPedido === "sob_encomenda" ? (
                  <div>
                    <Label className="text-xs font-bold text-slate-700">Valor do Sinal Pago Agora</Label>
                    <div className="relative mt-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        R$
                      </span>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="0,00"
                        value={sinalPagoTexto}
                        onChange={(e) => {
                          const digitos = e.target.value.replace(/\D/g, "");
                          const numValor = digitos ? Number(digitos) / 100 : 0;
                          setSinalPago(numValor);
                          setSinalPagoTexto(
                            digitos
                              ? numValor.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              : ""
                          );
                          setSinalCustomizado(true);
                        }}
                        className="pl-9 rounded-xl bg-white font-bold"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center pt-5 text-xs text-slate-500 font-semibold">
                    ✓ Pagamento total imediato na entrega
                  </div>
                )}
              </div>

              {/* RESUMO FINANCEIRO DO PEDIDO */}
              <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <span className="text-xs text-slate-500 block">Total do Pedido:</span>
                  <span className="text-2xl font-black text-slate-900">{brl(totalPedido)}</span>
                </div>
                {tipoPedido === "sob_encomenda" && (
                  <div className="text-left sm:text-right">
                    <span className="text-xs font-bold text-amber-700 block">
                      Saldo a Acertar na Entrega:
                    </span>
                    <span className="text-xl font-black text-amber-600">{brl(saldoNaEntrega)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setModalNovoPedido(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl font-bold bg-[#084463] text-white hover:bg-[#06344C] px-6"
              onClick={salvarPedido}
            >
              Salvar Pedido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: CADASTRO RÁPIDO DE CLIENTE */}
      <Dialog open={modalNovoCliente} onOpenChange={setModalNovoCliente}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-[#084463] flex items-center gap-2">
              <UserPlus className="size-5 text-[#084463]" />
              Cadastrar Novo Cliente
            </DialogTitle>
            <DialogDescription>
              {ehRevendedor
                ? `Cadastre o cliente para a sua carteira (${revendedorLogado?.nome || "Revenda"}).`
                : "Cadastre rapidamente um novo cliente sem sair da tela de venda."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            <div>
              <Label className="text-xs font-bold text-slate-700">Nome Completo *</Label>
              <Input
                placeholder="Ex: Maria Clara Silva"
                value={novoClienteNome}
                onChange={(e) => setNovoClienteNome(e.target.value)}
                className="mt-1 rounded-xl"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold text-slate-700">WhatsApp / Telefone</Label>
                <Input
                  placeholder="(00) 00000-0000"
                  value={novoClienteTelefone}
                  onChange={(e) => setNovoClienteTelefone(formatarTelefone(e.target.value))}
                  maxLength={15}
                  className="mt-1 rounded-xl"
                />
              </div>
              <div>
                <Label className="text-xs font-bold text-slate-700">Bairro / Região</Label>
                <Input
                  placeholder="Ex: Centro"
                  value={novoClienteBairro}
                  onChange={(e) => setNovoClienteBairro(e.target.value)}
                  className="mt-1 rounded-xl"
                />
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Observações / Preferências</Label>
              <Textarea
                placeholder="Ex: Gosta de bolos recheados com ninho..."
                value={novoClienteObs}
                onChange={(e) => setNovoClienteObs(e.target.value)}
                className="mt-1 rounded-xl min-h-[70px]"
              />
            </div>

            {ehRevendedor && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 flex items-center gap-2">
                <Store className="size-4 text-purple-700 shrink-0" />
                <span>
                  Este cliente ficará vinculado ao seu ponto: <strong>{revendedorLogado?.nome}</strong>. O estabelecimento também poderá visualizá-lo.
                </span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setModalNovoCliente(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              className="rounded-xl font-bold bg-[#084463] text-white hover:bg-[#06344C]"
              disabled={salvarCliente.isPending}
              onClick={handleSalvarNovoCliente}
            >
              {salvarCliente.isPending ? "Cadastrando..." : "Cadastrar e Selecionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: DETALHES DO ESTOQUE DO REVENDEDOR (ABERTO VIA KPI) */}
      <Dialog open={modalEstoquePdv} onOpenChange={setModalEstoquePdv}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center text-purple-700 dark:text-purple-300 shrink-0 shadow-xs">
                <Store className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-slate-900 dark:text-foreground">
                  Estoque no Balcão (PDV)
                </DialogTitle>
                <DialogDescription>
                  {revendedorLogado?.nome || "Ponto de Venda"} — Produtos entregues pelo ateliê para venda imediata.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* METRICAS DO MODAL */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 rounded-2xl bg-purple-50/70 border border-purple-100 dark:bg-purple-950/30 dark:border-purple-900/40">
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 block">
                  Disponíveis no Balcão
                </span>
                <span className="text-2xl font-black text-purple-950 dark:text-purple-100 mt-0.5 block">
                  {totalPecasEstoqueRevendedor} un
                </span>
                <span className="text-[11px] text-purple-600/80">Prontos para venda imediata</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-900/40">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300 block">
                  Valor Estimado em Estoque
                </span>
                <span className="text-2xl font-black text-emerald-950 dark:text-emerald-100 mt-0.5 block">
                  {brl(valorTotalEstoqueRevendedor)}
                </span>
                <span className="text-[11px] text-emerald-600/80">Preço final de balcão</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 dark:bg-slate-900/40 dark:border-slate-800">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                  Variedade de Itens
                </span>
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5 block">
                  {estoqueConsignadoRevendedor.length} tipos
                </span>
                <span className="text-[11px] text-slate-500">Sabores e produtos</span>
              </div>
            </div>

            {/* BUSCA RÁPIDA NO ESTOQUE */}
            <div className="relative">
              <Search className="size-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Filtrar por nome do produto..."
                value={buscaEstoqueModal}
                onChange={(e) => setBuscaEstoqueModal(e.target.value)}
                className="pl-10 rounded-xl h-10 border-slate-200"
              />
            </div>

            {/* LISTA / GRID DE PRODUTOS */}
            {produtosEstoqueModal.length === 0 ? (
              <div className="p-10 text-center bg-slate-50 rounded-2xl border border-slate-200/80 text-slate-500">
                <Package className="size-10 mx-auto text-slate-300 mb-2" />
                <p className="font-bold text-sm text-slate-700">Nenhum produto encontrado</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {buscaEstoqueModal
                    ? "Nenhum produto coincide com a busca."
                    : "Nenhuma remessa foi entregue ao seu ponto de venda até o momento."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-1">
                {produtosEstoqueModal.map((item) => {
                  const percVendido =
                    item.total_entregue > 0
                      ? Math.min(100, Math.round((item.total_vendido / item.total_entregue) * 100))
                      : 0;

                  return (
                    <div
                      key={item.produto_id}
                      className="p-4 bg-white dark:bg-card border border-slate-200/80 dark:border-border/60 rounded-2xl shadow-xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-sm text-slate-900 dark:text-foreground truncate">
                            {item.nome_produto}
                          </h4>
                          <span className="inline-block text-[10px] font-extrabold uppercase tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full mt-1">
                            {item.categoria || "Geral"}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "inline-block px-2.5 py-1 rounded-full text-xs font-black shrink-0",
                            item.saldo_atual <= 0
                              ? "bg-rose-100 text-rose-700"
                              : item.saldo_atual <= item.minimo_alerta
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          )}
                        >
                          {item.saldo_atual} un
                        </span>
                      </div>

                      {/* DETALHES DE PREÇO E VALOR */}
                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-900/30 p-2.5 rounded-xl">
                        <div>
                          <span className="text-[10px] text-slate-500 block">Preço unitário:</span>
                          <span className="font-bold text-slate-800 dark:text-foreground">
                            {brl(item.preco_unitario)}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-slate-500 block">Subtotal em balcão:</span>
                          <span className="font-bold text-purple-700 dark:text-purple-400">
                            {brl(item.saldo_atual * item.preco_unitario)}
                          </span>
                        </div>
                      </div>

                      {/* BARRA DE PROGRESSO ENTREGUE VS VENDIDO */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                          <span>
                            Entregue: <strong>{item.total_entregue} un</strong>
                          </span>
                          <span>
                            Vendido: <strong>{item.total_vendido} un</strong> ({percVendido}%)
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className="bg-purple-600 h-full rounded-full transition-all"
                            style={{ width: `${percVendido}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setModalEstoquePdv(false)}
            >
              Fechar
            </Button>
            <Button
              type="button"
              className="rounded-xl font-bold bg-[#084463] text-white hover:bg-[#06344C] gap-1.5"
              onClick={() => {
                setModalEstoquePdv(false);
                setModalNovoPedido(true);
              }}
            >
              <Plus className="size-4" /> Realizar Venda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: QUEM FALTA PAGAR (ABERTO VIA KPI) */}
      <Dialog open={modalSaldosPendentes} onOpenChange={setModalSaldosPendentes}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-2xl bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center text-amber-700 dark:text-amber-300 shrink-0 shadow-xs">
                <Wallet className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-black text-slate-900 dark:text-foreground">
                  Quem Falta Pagar — Saldos a Baixar
                </DialogTitle>
                <DialogDescription>
                  {ehRevendedor
                    ? `Clientes com valores pendentes de acerto na entrega no seu ponto de venda.`
                    : "Clientes com valores pendentes de acerto na entrega em todo o ateliê."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* RESUMO NO TOPO DO MODAL */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 dark:bg-amber-950/30 dark:border-amber-900/40">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300 block">
                  Total Pendente a Receber
                </span>
                <span className="text-2xl font-black text-amber-900 dark:text-amber-200 mt-0.5 block">
                  {brl(totalAReceber)}
                </span>
                <span className="text-[11px] text-amber-700/80">Soma de todos os saldos em aberto</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 dark:bg-slate-900/40 dark:border-slate-800">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 block">
                  Pedidos com Saldo Pendente
                </span>
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100 mt-0.5 block">
                  {pedidosComSaldoPendente.length} pedidos
                </span>
                <span className="text-[11px] text-slate-500">Aguardando quitação ou entrega</span>
              </div>
            </div>

            {/* BUSCA RÁPIDA POR CLIENTE OU ITEM */}
            <div className="relative">
              <Search className="size-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Filtrar por nome do cliente ou item comprado..."
                value={buscaSaldosModal}
                onChange={(e) => setBuscaSaldosModal(e.target.value)}
                className="pl-10 rounded-xl h-10 border-slate-200"
              />
            </div>

            {/* LISTAGEM DE QUEM FALTA PAGAR */}
            {pedidosComSaldoFiltrados.length === 0 ? (
              <div className="p-10 text-center bg-emerald-50/60 rounded-2xl border border-emerald-200/70 text-emerald-900">
                <CheckCircle2 className="size-10 mx-auto text-emerald-600 mb-2" />
                <p className="font-bold text-base">Tudo em dia!</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  {buscaSaldosModal
                    ? "Nenhum pedido pendente coincide com a busca."
                    : "Nenhum cliente possui saldo em aberto no momento. Todos os pagamentos foram quitados!"}
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {pedidosComSaldoFiltrados.map((v) => {
                  const dataFormatada = new Date(v.data).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const entregaFormatada = v.data_entrega_prometida
                    ? new Date(v.data_entrega_prometida).toLocaleDateString("pt-BR")
                    : null;
                  const eEncomenda = v.tipo_pedido === "sob_encomenda";
                  const cliCadastrado = clientes.find((c) => c.id === v.cliente_id);
                  const telefoneCliente = cliCadastrado?.telefone;

                  return (
                    <div
                      key={v.id}
                      className="p-4 bg-white dark:bg-card border border-amber-200/90 rounded-2xl shadow-xs space-y-3"
                    >
                      {/* TOPO DO CARD */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-base text-slate-900 dark:text-foreground">
                              {v.clientes?.nome || "Venda Balcão / Avulsa"}
                            </h4>
                            {eEncomenda ? (
                              <span className="text-[10px] font-extrabold uppercase bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">
                                Sob Encomenda
                              </span>
                            ) : (
                              <span className="text-[10px] font-extrabold uppercase bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                Pronta-Entrega
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500 mt-1">
                            <span>📅 Pedido: {dataFormatada}</span>
                            {entregaFormatada && (
                              <span className="font-semibold text-purple-900 bg-purple-50 px-2 py-0.5 rounded">
                                🗓️ Entrega prevista: {entregaFormatada}
                              </span>
                            )}
                            {telefoneCliente && (
                              <span className="font-medium text-slate-700">📞 {formatarTelefone(telefoneCliente)}</span>
                            )}
                          </div>
                        </div>

                        {/* VALORES */}
                        <div className="text-left sm:text-right bg-amber-50/80 sm:bg-transparent p-2.5 sm:p-0 rounded-xl">
                          <span className="text-[11px] font-bold text-amber-800 uppercase block">
                            Saldo a Receber:
                          </span>
                          <span className="text-xl font-black text-amber-600 block">
                            {brl(v.saldo_na_entrega || 0)}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Total: {brl(v.total)} | Sinal: {brl(v.valor_sinal_pago || 0)}
                          </span>
                        </div>
                      </div>

                      {/* DETALHES DOS ITENS DA COMPRA */}
                      <div className="text-xs bg-slate-50 p-2.5 rounded-xl space-y-1">
                        <span className="font-bold text-slate-700 block">Itens da Compra:</span>
                        <p className="text-slate-600">
                          {(v.venda_itens || [])
                            .map(
                              (i) =>
                                `${i.quantidade}x ${i.nome_produto} (${brl(i.preco_unitario * i.quantidade)})`
                            )
                            .join(" · ")}
                        </p>
                        {v.observacoes && (
                          <p className="text-amber-900 font-medium italic pt-1 border-t border-slate-200/60 mt-1">
                            Notas: "{v.observacoes}"
                          </p>
                        )}
                      </div>

                      {/* AÇÕES DE QUITAÇÃO E WHATSAPP */}
                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl text-xs gap-1 text-emerald-700 border-emerald-300 hover:bg-emerald-50 h-9"
                          onClick={() => copiarComprovanteWhatsApp(v)}
                        >
                          <MessageCircle className="size-3.5" /> Cobrança WhatsApp
                        </Button>
                        <Button
                          size="sm"
                          className="rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white gap-1 h-9 shadow-xs"
                          onClick={() => quitarSaldo(v)}
                        >
                          <CheckCircle2 className="size-3.5" /> Receber Saldo / Dar Baixa
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              className="rounded-xl"
              onClick={() => setModalSaldosPendentes(false)}
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Estrutura>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  DollarSign,
  Handshake,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Store,
  Trash2,
  User,
  Users,
  Wallet,
  Sparkles,
  PackagePlus,
  PackageCheck,
  AlertTriangle,
  History,
  Boxes,
  CheckCircle2,
  KeyRound,
  ChevronDown,
  ChevronUp,
  Minus,
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
import { brl, num, formatarTelefone } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import {
  calcularComissaoRevendedora,
  calcularEstoqueConsignadoRevendedor,
  obterAlertasReposicaoRevendedores,
  useApagarCliente,
  useApagarPagamentoComissao,
  useApagarRemessaConsignacao,
  useApagarRevendedora,
  useClientes,
  usePagamentosComissao,
  useProdutos,
  useRemessasConsignacao,
  useRevendedoras,
  useSalvarCliente,
  useSalvarPagamentoComissao,
  useSalvarRemessaConsignacao,
  useSalvarRevendedora,
  useVendas,
  type Cliente,
  type ItemEstoqueConsignado,
  type RemessaConsignacao,
  type Revendedora,
} from "@/lib/dados";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Contatos — Meu Ateliê" },
      {
        name: "description",
        content: "Agenda separada de clientes, revendedores e parceiros comerciais.",
      },
      { property: "og:title", content: "Contatos — Meu Ateliê" },
      {
        property: "og:description",
        content: "Agenda separada de clientes, revendedores e parceiros comerciais.",
      },
    ],
  }),
  component: PaginaContatos,
});

type PerfilContato = "cliente" | "revendedor" | "parceiro";

type ItemRemessaAdicionado = {
  produtoId: string;
  quantidade: number;
};

export function PaginaContatos() {
  const { data: clientes = [] } = useClientes();
  const { data: revendedoras = [] } = useRevendedoras();
  const { data: vendas = [] } = useVendas();
  const { data: pagamentosComissao = [] } = usePagamentosComissao();
  const { data: produtos = [] } = useProdutos();
  const { data: remessas = [] } = useRemessasConsignacao();

  const { listaUsuarios, salvarUsuario, empresaAtual, usuario } = useAuth();
  const ehRevendedor = usuario?.papel === "revendedor";
  const revendedorLogado = useMemo(() => {
    if (!ehRevendedor) return null;
    return (
      revendedoras.find(
        (r) =>
          (r.usuario_id && r.usuario_id === usuario?.id) ||
          (r.email && r.email.toLowerCase() === usuario?.email.toLowerCase()) ||
          r.nome.toLowerCase() === usuario?.nome.toLowerCase()
      ) ?? revendedoras[0] ?? null
    );
  }, [ehRevendedor, revendedoras, usuario]);

  const salvarCliente = useSalvarCliente();
  const apagarCliente = useApagarCliente();
  const salvarRevendedora = useSalvarRevendedora();
  const apagarRevendedora = useApagarRevendedora();
  const salvarPagamentoComissao = useSalvarPagamentoComissao();
  const apagarPagamentoComissao = useApagarPagamentoComissao();
  const salvarRemessa = useSalvarRemessaConsignacao();
  const apagarRemessa = useApagarRemessaConsignacao();

  // ESTADOS PARA REMESSA / ENTREGA DE PRODUTOS AO REVENDEDOR (MÚLTIPLOS SABORES)
  const [modalRemessa, setModalRemessa] = useState(false);
  const [revendedorRemessa, setRevendedorRemessa] = useState<Revendedora | null>(null);
  const [itensRemessa, setItensRemessa] = useState<ItemRemessaAdicionado[]>([]);
  const [produtoRemessaId, setProdutoRemessaId] = useState<string>("");
  const [qtdRemessa, setQtdRemessa] = useState<number>(7);
  const [dataRemessa, setDataRemessa] = useState<string>(new Date().toISOString().split("T")[0] || "");
  const [obsRemessa, setObsRemessa] = useState<string>("");
  const [baixarDoAtelie, setBaixarDoAtelie] = useState<boolean>(true);

  // ESTADO PARA HISTÓRICO DE REMESSAS
  const [modalHistorico, setModalHistorico] = useState(false);
  const [revendedorHistorico, setRevendedorHistorico] = useState<Revendedora | null>(null);

  // CONTROLE DE EXPANSÃO / RECOLHIMENTO DOS DETALHES DE CADA REVENDEDOR (REDUÇÃO DE SCROLL)
  const [revendedoresExpandidos, setRevendedoresExpandidos] = useState<Record<string, boolean>>({});

  const alternarExpandirRevendedor = (id: string) => {
    setRevendedoresExpandidos((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const [filtroTipo, setFiltroTipo] = useState<"todos" | "clientes" | "revendedores" | "parceiros">("todos");
  const [busca, setBusca] = useState("");

  // MODAL DE CONTATO
  const [modalContato, setModalContato] = useState(false);
  const [perfilSelecionado, setPerfilSelecionado] = useState<PerfilContato>("cliente");
  const [formCliente, setFormCliente] = useState<Partial<Cliente>>({});
  const [tipoComissao, setTipoComissao] = useState<"porcentagem" | "valor_fixo">("porcentagem");
  const [comissaoPercentual, setComissaoPercentual] = useState<number>(15);
  const [comissaoFixa, setComissaoFixa] = useState<number>(0);
  const [comissaoFixaTexto, setComissaoFixaTexto] = useState<string>("0,00");
  const [subtipoParceria, setSubtipoParceria] = useState<string>("Cerimonialista");
  const [emailRevendedor, setEmailRevendedor] = useState<string>("");
  const [senhaRevendedor, setSenhaRevendedor] = useState<string>("");

  // MODAL DE ACERTO DE CONTAS COM REVENDEDOR
  const [modalComissao, setModalComissao] = useState(false);
  const [parceiroAcerto, setParceiroAcerto] = useState<Revendedora | null>(null);
  const [valorAcerto, setValorAcerto] = useState<number>(0);
  const [valorAcertoTexto, setValorAcertoTexto] = useState<string>("0,00");
  const [formaPagamentoAcerto, setFormaPagamentoAcerto] = useState<string>("Pix");
  const [dataAcerto, setDataAcerto] = useState<string>(new Date().toISOString().split("T")[0] || "");
  const [obsAcerto, setObsAcerto] = useState<string>("");

  // Vendas válidas
  const validas = useMemo(() => vendas.filter((v) => v.status !== "cancelado"), [vendas]);

  // Alertas de reposição de estoque consignado nos revendedores
  const alertasReposicao = useMemo(
    () => obterAlertasReposicaoRevendedores(revendedoras, remessas, validas, produtos),
    [revendedoras, remessas, validas, produtos]
  );

  // Lista combinada e enriquecida de contatos
  const contatosCombinados = useMemo(() => {
    const list: Array<{
      id: string;
      nome: string;
      telefone: string | null;
      rua: string | null;
      numero: string | null;
      bairro: string | null;
      complemento: string | null;
      observacoes: string | null;
      perfil: PerfilContato;
      clienteObj?: Cliente | undefined;
      revendedoraObj?: Revendedora | undefined;
      revendedorVinculado?: Revendedora | null | undefined;
      totalGasto: number;
      totalItensComprados: number;
      qtdPedidos: number;
      comissaoPendente: number;
    }> = [];

    // 1. Clientes
    clientes.forEach((c) => {
      const pedidosCli = validas.filter(
        (v) => v.cliente_id === c.id || (v.clientes?.nome && v.clientes.nome.toLowerCase() === c.nome.toLowerCase())
      );
      const totalGasto = pedidosCli.reduce((s, v) => s + Number(v.total || 0), 0);
      const totalItensComprados = pedidosCli.reduce(
        (s, v) => s + (v.venda_itens || []).reduce((sum, item) => sum + Number(item.quantidade || 0), 0),
        0
      );

      // Identificar se o cliente é vinculado a um revendedor (pelo cadastro ou histórico de pedidos)
      let revendedorVinculado: Revendedora | null = null;
      if (c.revendedora_id) {
        revendedorVinculado = revendedoras.find((r) => r.id === c.revendedora_id) || null;
      }
      if (!revendedorVinculado) {
        const pedidoComRev = pedidosCli.find((v) => v.canal === "revendedora" && v.revendedora_id);
        if (pedidoComRev?.revendedora_id) {
          revendedorVinculado = revendedoras.find((r) => r.id === pedidoComRev.revendedora_id) || null;
        }
      }

      const rev = revendedoras.find((r) => r.nome.toLowerCase() === c.nome.toLowerCase());

      let comissaoPendente = 0;
      if (rev) {
        const totalCom = validas
          .filter((v) => v.revendedora_id === rev.id)
          .reduce((s, v) => s + calcularComissaoRevendedora(v, rev), 0);
        const totalPago = pagamentosComissao
          .filter((p) => p.revendedora_id === rev.id)
          .reduce((s, p) => s + Number(p.valor || 0), 0);
        comissaoPendente = Math.max(0, totalCom - totalPago);
      }

      const perfil: PerfilContato = rev
        ? (rev.categoria_parceria === "parceiro" ? "parceiro" : "revendedor")
        : (c.tipo_contato || "cliente");

      list.push({
        id: c.id,
        nome: c.nome,
        telefone: c.telefone,
        rua: c.rua,
        numero: c.numero,
        bairro: c.bairro,
        complemento: c.complemento,
        observacoes: c.observacoes,
        perfil,
        clienteObj: c,
        revendedoraObj: rev,
        revendedorVinculado,
        totalGasto,
        totalItensComprados,
        qtdPedidos: pedidosCli.length,
        comissaoPendente,
      });
    });

    // 2. Revendedoras & Parceiros que não estão na lista de clientes
    revendedoras.forEach((r) => {
      const jaExiste = list.find((item) => item.nome.toLowerCase() === r.nome.toLowerCase());
      if (!jaExiste) {
        const vendasParceiro = validas.filter((v) => v.revendedora_id === r.id);
        const totalVendas = vendasParceiro.reduce((s, v) => s + Number(v.total || 0), 0);
        const totalItens = vendasParceiro.reduce(
          (s, v) => s + (v.venda_itens || []).reduce((sum, item) => sum + Number(item.quantidade || 0), 0),
          0
        );
        const totalCom = vendasParceiro.reduce((s, v) => s + calcularComissaoRevendedora(v, r), 0);
        const totalPago = pagamentosComissao
          .filter((p) => p.revendedora_id === r.id)
          .reduce((s, p) => s + Number(p.valor || 0), 0);
        const comissaoPendente = Math.max(0, totalCom - totalPago);

        const perfil: PerfilContato = r.categoria_parceria === "parceiro" ? "parceiro" : "revendedor";

        list.push({
          id: r.id,
          nome: r.nome,
          telefone: r.telefone,
          rua: null,
          numero: null,
          bairro: null,
          complemento: null,
          observacoes: r.observacoes,
          perfil,
          revendedoraObj: r,
          revendedorVinculado: null,
          totalGasto: totalVendas,
          totalItensComprados: totalItens,
          qtdPedidos: vendasParceiro.length,
          comissaoPendente,
        });
      }
    });

    return list;
  }, [clientes, revendedoras, validas, pagamentosComissao]);

  // Contagens por perfil
  const qtdClientes = contatosCombinados.filter((c) => c.perfil === "cliente").length;
  const qtdRevendedores = contatosCombinados.filter((c) => c.perfil === "revendedor").length;
  const qtdParceiros = contatosCombinados.filter((c) => c.perfil === "parceiro").length;

  // Filtragem
  const contatosFiltrados = useMemo(() => {
    return contatosCombinados.filter((c) => {
      if (ehRevendedor && revendedorLogado) {
        const eDele =
          c.clienteObj?.revendedora_id === revendedorLogado.id ||
          c.revendedorVinculado?.id === revendedorLogado.id;
        if (!eDele) return false;
      } else {
        if (filtroTipo === "clientes" && c.perfil !== "cliente") return false;
        if (filtroTipo === "revendedores" && c.perfil !== "revendedor") return false;
        if (filtroTipo === "parceiros" && c.perfil !== "parceiro") return false;
      }

      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const nome = c.nome.toLowerCase();
        const tel = c.telefone?.toLowerCase() || "";
        const bairro = c.bairro?.toLowerCase() || "";
        const revNome = c.revendedorVinculado?.nome.toLowerCase() || "";
        return nome.includes(termo) || tel.includes(termo) || bairro.includes(termo) || revNome.includes(termo);
      }
      return true;
    });
  }, [contatosCombinados, filtroTipo, busca, ehRevendedor, revendedorLogado]);

  // Abertura do modal
  const abrirModalNovo = (item?: any) => {
    if (ehRevendedor && revendedorLogado) {
      if (item?.clienteObj) {
        setFormCliente({ ...item.clienteObj, revendedora_id: revendedorLogado.id });
      } else {
        setFormCliente({ tipo_contato: "cliente", revendedora_id: revendedorLogado.id });
      }
      setPerfilSelecionado("cliente");
      setModalContato(true);
      return;
    }
    if (item?.clienteObj) {
      setFormCliente({ ...item.clienteObj, telefone: item.clienteObj.telefone ? formatarTelefone(item.clienteObj.telefone) : "" });
      if (item.revendedoraObj) {
        const cat = item.revendedoraObj.categoria_parceria || "revendedor";
        setPerfilSelecionado(cat === "parceiro" ? "parceiro" : "revendedor");
        setTipoComissao(item.revendedoraObj.tipo_comissao);
        setComissaoPercentual(item.revendedoraObj.comissao_percentual);
        setComissaoFixa(item.revendedoraObj.comissao_fixa);
        setComissaoFixaTexto((item.revendedoraObj.comissao_fixa || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        setSubtipoParceria(item.revendedoraObj.subtipo_parceria || "Cerimonialista");
        setEmailRevendedor(item.revendedoraObj.email || "");
        const user = listaUsuarios.find(
          (u) =>
            u.papel === "revendedor" &&
            (u.id === item.revendedoraObj.usuario_id ||
              (item.revendedoraObj.email && u.email.toLowerCase() === item.revendedoraObj.email.toLowerCase()))
        );
        setSenhaRevendedor(user?.senha || "");
      } else {
        setPerfilSelecionado(item.clienteObj.tipo_contato || "cliente");
        setComissaoFixaTexto("0,00");
        setEmailRevendedor("");
        setSenhaRevendedor("");
      }
    } else if (item?.revendedoraObj) {
      setFormCliente({
        nome: item.revendedoraObj.nome,
        telefone: item.revendedoraObj.telefone ? formatarTelefone(item.revendedoraObj.telefone) : "",
        observacoes: item.revendedoraObj.observacoes,
      });
      const cat = item.revendedoraObj.categoria_parceria || "revendedor";
      setPerfilSelecionado(cat === "parceiro" ? "parceiro" : "revendedor");
      setTipoComissao(item.revendedoraObj.tipo_comissao);
      setComissaoPercentual(item.revendedoraObj.comissao_percentual);
      setComissaoFixa(item.revendedoraObj.comissao_fixa);
      setComissaoFixaTexto((item.revendedoraObj.comissao_fixa || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setSubtipoParceria(item.revendedoraObj.subtipo_parceria || "Cerimonialista");
      setEmailRevendedor(item.revendedoraObj.email || "");
      const user = listaUsuarios.find(
        (u) =>
          u.papel === "revendedor" &&
          (u.id === item.revendedoraObj.usuario_id ||
            (item.revendedoraObj.email && u.email.toLowerCase() === item.revendedoraObj.email.toLowerCase()))
      );
      setSenhaRevendedor(user?.senha || "");
    } else {
      setFormCliente({});
      setPerfilSelecionado(filtroTipo === "revendedores" ? "revendedor" : filtroTipo === "parceiros" ? "parceiro" : "cliente");
      setTipoComissao("porcentagem");
      setComissaoPercentual(15);
      setComissaoFixa(0);
      setComissaoFixaTexto("0,00");
      setSubtipoParceria("Cerimonialista");
      setEmailRevendedor("");
      setSenhaRevendedor("");
    }
    setModalContato(true);
  };

  const abrirModalRemessa = (rev: Revendedora, produtoIdPre?: string) => {
    setRevendedorRemessa(rev);
    const prodInicial = produtoIdPre || (produtos[0]?.id || "");
    setProdutoRemessaId(prodInicial);
    setQtdRemessa(7);
    setDataRemessa(new Date().toISOString().split("T")[0] || "");
    setObsRemessa("");
    setBaixarDoAtelie(true);

    if (produtoIdPre) {
      const prod = produtos.find((p) => p.id === produtoIdPre);
      const estAssado = Math.max(0, Number(prod?.estoque || 0));
      if (estAssado <= 0) {
        toast.warning(`Atenção: "${prod?.nome}" não possui cookies assados/prontos no ateliê (0 un).`);
      }
      setItensRemessa([{ produtoId: produtoIdPre, quantidade: estAssado > 0 ? Math.min(7, estAssado) : 7 }]);
    } else {
      setItensRemessa([]);
    }
    setModalRemessa(true);
  };

  const handleAdicionarItemRemessa = () => {
    if (!produtoRemessaId) {
      toast.error("Selecione um produto.");
      return;
    }
    const prod = produtos.find((p) => p.id === produtoRemessaId);
    if (!prod) {
      toast.error("Produto não encontrado.");
      return;
    }
    const estoqueAssado = Math.max(0, Number(prod.estoque || 0));

    // BLOQUEIO RIGOROSO: SE NÃO TIVER ASSADO, BLOQUEIA!
    if (estoqueAssado <= 0) {
      toast.error(
        `Bloqueio: "${prod.nome}" não está assado/pronto no ateliê (Estoque: 0 un). Asse uma fornada antes de entregar!`
      );
      return;
    }

    const qtd = Math.max(1, Number(qtdRemessa) || 1);
    const itemExistente = itensRemessa.find((it) => it.produtoId === prod.id);
    const qtdTotal = (itemExistente ? itemExistente.quantidade : 0) + qtd;

    // BLOQUEIO RIGOROSO: SE QUANTIDADE EXCEDER ESTOQUE ASSADO, BLOQUEIA!
    if (qtdTotal > estoqueAssado) {
      toast.error(
        `Bloqueio: Estoque assado insuficiente de "${prod.nome}". Há apenas ${estoqueAssado} un prontas no ateliê (tentativa: ${qtdTotal} un).`
      );
      return;
    }

    if (itemExistente) {
      setItensRemessa((prev) =>
        prev.map((it) => (it.produtoId === prod.id ? { ...it, quantidade: qtdTotal } : it))
      );
    } else {
      setItensRemessa((prev) => [...prev, { produtoId: prod.id, quantidade: qtd }]);
    }

    toast.success(`${qtd} un de "${prod.nome}" adicionadas à remessa!`);
  };

  const handleRemoverItemRemessa = (prodId: string) => {
    setItensRemessa((prev) => prev.filter((it) => it.produtoId !== prodId));
  };

  const handleAlterarQtdItemRemessa = (prodId: string, novaQtd: number) => {
    const prod = produtos.find((p) => p.id === prodId);
    const estoqueAssado = Math.max(0, Number(prod?.estoque || 0));
    if (novaQtd <= 0) {
      handleRemoverItemRemessa(prodId);
      return;
    }
    if (novaQtd > estoqueAssado) {
      toast.error(`Bloqueio: Só há ${estoqueAssado} un assadas/prontas de "${prod?.nome}" no ateliê!`);
      return;
    }
    setItensRemessa((prev) =>
      prev.map((it) => (it.produtoId === prodId ? { ...it, quantidade: novaQtd } : it))
    );
  };

  const handlePreencher7DeCadaSabor = () => {
    const adicionados: ItemRemessaAdicionado[] = [];
    const bloqueadosSemEstoque: string[] = [];

    produtos.forEach((prod) => {
      const estoqueAssado = Math.max(0, Number(prod.estoque || 0));
      if (estoqueAssado <= 0) {
        bloqueadosSemEstoque.push(prod.nome);
      } else {
        const qtd = Math.min(7, estoqueAssado);
        adicionados.push({ produtoId: prod.id, quantidade: qtd });
      }
    });

    if (adicionados.length === 0) {
      toast.error("Nenhum produto possui estoque assado/pronto no ateliê no momento!");
      return;
    }

    setItensRemessa(adicionados);
    if (bloqueadosSemEstoque.length > 0) {
      toast.info(
        `Preenchido com ${adicionados.length} sabores prontos! ${bloqueadosSemEstoque.length} sabor(es) sem estoque assado foram bloqueados.`
      );
    } else {
      toast.success(`Preenchido com 7 un de todos os ${adicionados.length} sabores disponíveis!`);
    }
  };

  const handleSalvarRemessa = async () => {
    if (!revendedorRemessa) {
      toast.error("Selecione um revendedor.");
      return;
    }
    if (itensRemessa.length === 0) {
      toast.error("Adicione ao menos um produto à remessa antes de confirmar a entrega.");
      return;
    }

    // BLOQUEIO RIGOROSO FINAL ANTES DE GRAVAR
    for (const item of itensRemessa) {
      const prod = produtos.find((p) => p.id === item.produtoId);
      if (!prod) continue;
      const estoqueAssado = Math.max(0, Number(prod.estoque || 0));
      if (estoqueAssado <= 0) {
        toast.error(
          `Bloqueio de Entrega: "${prod.nome}" não possui cookies assados/prontos (0 un)! Asse uma fornada antes.`
        );
        return;
      }
      if (item.quantidade > estoqueAssado) {
        toast.error(
          `Bloqueio de Entrega: "${prod.nome}" tem apenas ${estoqueAssado} un prontas, mas a remessa pede ${item.quantidade} un! Ajuste a quantidade.`
        );
        return;
      }
    }

    try {
      const dataIso = dataRemessa ? new Date(dataRemessa).toISOString() : new Date().toISOString();
      const obs = obsRemessa.trim() || null;
      let totalPecas = 0;

      for (const item of itensRemessa) {
        const prod = produtos.find((p) => p.id === item.produtoId);
        if (!prod) continue;
        await salvarRemessa.mutateAsync({
          revendedora_id: revendedorRemessa.id,
          produto_id: prod.id,
          nome_produto: prod.nome,
          quantidade: item.quantidade,
          data: dataIso,
          observacoes: obs,
          baixar_estoque_atelie: baixarDoAtelie,
        });
        totalPecas += item.quantidade;
      }

      toast.success(
        `Remessa registrada com sucesso! ${totalPecas} un (${itensRemessa.length} sabores) entregues para ${revendedorRemessa.nome}.`
      );
      setModalRemessa(false);
      setItensRemessa([]);
    } catch (err) {
      console.error("Erro ao salvar remessa:", err);
      toast.error("Erro ao registrar remessa de produtos.");
    }
  };

  const abrirHistoricoRemessas = (rev: Revendedora) => {
    setRevendedorHistorico(rev);
    setModalHistorico(true);
  };

  const handleSalvarContato = async () => {
    if (!formCliente.nome?.trim()) {
      toast.error("Informe o nome do contato.");
      return;
    }

    try {
      if (perfilSelecionado === "revendedor") {
        if (!emailRevendedor.trim()) {
          toast.error("Informe o e-mail de acesso para o revendedor.");
          return;
        }
        if (!senhaRevendedor.trim()) {
          toast.error("Informe uma senha de acesso para o revendedor.");
          return;
        }

        const emailLimpo = emailRevendedor.trim().toLowerCase();
        const ehContaCamila = emailLimpo === "camila.c.lima08@gmail.com";

        // 1. Bloquear uso de e-mail de administrador ou da dona do ateliê (exceto conta Camila Master que é revendedora da Fatiô)
        if (!ehContaCamila) {
          const ehAdmin =
            emailLimpo === "master@kipi.com.br" ||
            listaUsuarios.some(
              (u) =>
                u.email.toLowerCase() === emailLimpo &&
                (u.papel === "admin" || u.papel === "super_admin" || u.id === "usr_dono")
            );
          if (ehAdmin) {
            toast.error("Este e-mail pertence à administração do ateliê. Por favor, cadastre um e-mail exclusivo para o acesso do revendedor.");
            return;
          }
        }

        // 2. Localizar revendedora existente
        const revIdExistente = formCliente.revendedora_id || formCliente.id;
        const revExistente = revendedoras.find(
          (r) =>
            (revIdExistente && r.id === revIdExistente) ||
            r.nome.toLowerCase() === formCliente.nome?.trim().toLowerCase() ||
            (r.email && r.email.toLowerCase() === emailLimpo)
        );

        // 3. Buscar ou vincular usuário de acesso
        let novoUserId: string;
        if (ehContaCamila) {
          novoUserId = "usr_dono";
          // Para Camila: NUNCA rebaixa o papel de super_admin! Apenas vincula a empresa ativa
          const userCamila = listaUsuarios.find((u) => u.id === "usr_dono" || u.email.toLowerCase() === emailLimpo);
          const empresasAtuais = userCamila?.empresaIds || [];
          const empAtualId = empresaAtual?.id ?? "emp_fatio";
          const novasEmpresas = empresasAtuais.includes(empAtualId) ? empresasAtuais : [...empresasAtuais, empAtualId];
          await salvarUsuario({
            id: "usr_dono",
            nome: userCamila?.nome || formCliente.nome.trim(),
            email: emailLimpo,
            senha: userCamila?.senha || "P&ix1nh0!",
            papel: "super_admin",
            status: "ativo",
            empresaIds: novasEmpresas,
            empresaAtivaId: empAtualId,
          });
        } else {
          const idUsuarioExistente = revExistente?.usuario_id;
          const userExistente = listaUsuarios.find(
            (u) =>
              u.papel === "revendedor" &&
              ((idUsuarioExistente && u.id === idUsuarioExistente) || u.email.toLowerCase() === emailLimpo)
          );
          novoUserId =
            userExistente?.id && userExistente.id !== "usr_dono" && userExistente.id !== "usr_super"
              ? userExistente.id
              : (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `usr_rev_${Date.now()}`);

          await salvarUsuario({
            id: novoUserId,
            nome: formCliente.nome.trim(),
            email: emailLimpo,
            senha: senhaRevendedor.trim(),
            papel: "revendedor",
            status: "ativo",
            empresaIds: [empresaAtual?.id ?? "emp_1"],
            empresaAtivaId: empresaAtual?.id ?? "emp_1",
          });
        }

        // Salvar Revendedora
        await salvarRevendedora.mutateAsync({
          ...(revExistente?.id ? { id: revExistente.id } : {}),
          nome: formCliente.nome.trim(),
          telefone: formCliente.telefone || null,
          tipo_comissao: tipoComissao,
          comissao_percentual: Number(comissaoPercentual) || 0,
          comissao_fixa: Number(comissaoFixa) || 0,
          observacoes: formCliente.observacoes || null,
          categoria_parceria: "revendedor",
          email: emailLimpo,
          usuario_id: novoUserId,
        });

        // Se existia em clientes com mesmo nome (por cadastros anteriores), ajusta perfil para não duplicar
        const clienteComMesmoNome = clientes.find(
          (c) => c.nome.toLowerCase() === formCliente.nome?.trim().toLowerCase()
        );
        if (clienteComMesmoNome) {
          await salvarCliente.mutateAsync({
            ...clienteComMesmoNome,
            tipo_contato: "revendedor",
          });
        }

        toast.success(`Revendedor "${formCliente.nome.trim()}" cadastrado com sucesso! Acesso exclusivo para vendas liberado.`);
        setModalContato(false);
        return;
      }

      if (perfilSelecionado === "parceiro") {
        const revExistente = revendedoras.find(
          (r) => r.nome.toLowerCase() === formCliente.nome?.trim().toLowerCase()
        );

        await salvarRevendedora.mutateAsync({
          ...(revExistente?.id ? { id: revExistente.id } : {}),
          nome: formCliente.nome.trim(),
          telefone: formCliente.telefone || null,
          tipo_comissao: tipoComissao,
          comissao_percentual: Number(comissaoPercentual) || 0,
          comissao_fixa: Number(comissaoFixa) || 0,
          observacoes: formCliente.observacoes || null,
          categoria_parceria: "parceiro",
          subtipo_parceria: subtipoParceria,
        });

        // Se existia em clientes, ajusta tipo_contato
        const clienteComMesmoNome = clientes.find(
          (c) => c.nome.toLowerCase() === formCliente.nome?.trim().toLowerCase()
        );
        if (clienteComMesmoNome) {
          await salvarCliente.mutateAsync({
            ...clienteComMesmoNome,
            tipo_contato: "parceiro",
          });
        }

        toast.success(`Parceiro comercial "${formCliente.nome.trim()}" cadastrado com sucesso!`);
        setModalContato(false);
        return;
      }

      // Perfil Cliente
      const revIdFinal =
        ehRevendedor && revendedorLogado
          ? revendedorLogado.id
          : formCliente.revendedora_id || null;

      await salvarCliente.mutateAsync({
        ...formCliente,
        nome: formCliente.nome.trim(),
        tipo_contato: "cliente",
        revendedora_id: revIdFinal,
      });

      const revNome = revIdFinal
        ? revendedoras.find((r) => r.id === revIdFinal)?.nome
        : null;

      toast.success(
        revNome
          ? `Cliente "${formCliente.nome.trim()}" salvo e vinculado a ${revNome}!`
          : "Cliente cadastrado com sucesso!"
      );
      setModalContato(false);
    } catch (err) {
      console.error("Erro ao salvar contato:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao salvar contato.");
    }
  };

  const abrirModalAcerto = (rev: Revendedora) => {
    setParceiroAcerto(rev);
    const vendasRev = validas.filter((v) => v.revendedora_id === rev.id);
    const totalCom = vendasRev.reduce((s, v) => s + calcularComissaoRevendedora(v, rev), 0);
    const totalPago = pagamentosComissao
      .filter((p) => p.revendedora_id === rev.id)
      .reduce((s, p) => s + Number(p.valor || 0), 0);
    const pendente = Math.max(0, totalCom - totalPago);

    setValorAcerto(pendente);
    setValorAcertoTexto(
      pendente > 0
        ? pendente.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "0,00"
    );
    setFormaPagamentoAcerto("Pix");
    setDataAcerto(new Date().toISOString().split("T")[0] || "");
    setObsAcerto("");
    setModalComissao(true);
  };

  const handlePagarComissao = async () => {
    if (!parceiroAcerto || valorAcerto <= 0) {
      toast.error("Informe um valor maior que zero para o acerto.");
      return;
    }

    try {
      const partesObs: string[] = [];
      if (formaPagamentoAcerto) partesObs.push(`Forma: ${formaPagamentoAcerto}`);
      if (obsAcerto.trim()) partesObs.push(obsAcerto.trim());
      const obsFinal = partesObs.join(" · ") || "Acerto de contas / repasse de vendas";

      await salvarPagamentoComissao.mutateAsync({
        revendedora_id: parceiroAcerto.id,
        valor: Number(valorAcerto),
        data: dataAcerto ? new Date(dataAcerto).toISOString() : new Date().toISOString(),
        observacoes: obsFinal,
      });

      toast.success(`Acerto de ${brl(valorAcerto)} registrado para ${parceiroAcerto.nome}!`);
      setModalComissao(false);
      setValorAcerto(0);
      setValorAcertoTexto("0,00");
      setObsAcerto("");
      setParceiroAcerto(null);
    } catch {
      toast.error("Erro ao registrar pagamento de acerto.");
    }
  };

  const abrirWhatsApp = (telefone?: string | null) => {
    if (!telefone) {
      toast.info("Este contato não tem telefone cadastrado.");
      return;
    }
    const limpo = telefone.replace(/\D/g, "");
    const ddi = limpo.length <= 11 ? `55${limpo}` : limpo;
    window.open(`https://wa.me/${ddi}`, "_blank");
  };

  // Indicadores
  const totalComissaoPendente = revendedoras.reduce((s, r) => {
    const totalCom = validas
      .filter((v) => v.revendedora_id === r.id)
      .reduce((sum, v) => sum + calcularComissaoRevendedora(v, r), 0);
    const totalPago = pagamentosComissao
      .filter((p) => p.revendedora_id === r.id)
      .reduce((sum, p) => sum + Number(p.valor || 0), 0);
    return s + Math.max(0, totalCom - totalPago);
  }, 0);

  return (
    <Estrutura
      titulo={ehRevendedor ? "Meus Clientes" : "Contatos"}
      subtitulo={
        ehRevendedor
          ? `Ponto de Venda: ${revendedorLogado?.nome || "Revenda Autorizada"} — Cadastre e gerencie os clientes atendidos pelo seu ponto de venda`
          : "Gestão separada de Clientes, Revendedores e Parceiros comerciais"
      }
    >
      {/* INDICADORES */}
      {ehRevendedor ? (
        <section className="grid gap-4 sm:grid-cols-3">
          <CartaoIndicador
            rotulo="Clientes na Minha Carteira"
            valor={String(contatosFiltrados.length)}
            detalhe="Clientes atendidos no seu PDV"
            etiqueta="clientes"
            tom="brand"
          />
          <CartaoIndicador
            rotulo="Pedidos Realizados"
            valor={String(contatosFiltrados.reduce((s, c) => s + c.qtdPedidos, 0))}
            detalhe="Total de pedidos desses clientes"
            etiqueta="pedidos"
            tom="blossom"
          />
          <CartaoIndicador
            rotulo="Total Comprado"
            valor={brl(contatosFiltrados.reduce((s, c) => s + c.totalGasto, 0))}
            detalhe="Faturamento acumulado desses clientes"
            etiqueta="vendas"
            tom="success"
          />
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <CartaoIndicador
            rotulo="Total Geral"
            valor={String(contatosCombinados.length)}
            detalhe="Todos os contatos cadastrados"
            etiqueta="agenda"
            tom="brand"
          />
          <CartaoIndicador
            rotulo="Clientes Finais"
            valor={String(qtdClientes)}
            detalhe="Consumidores diretos e de revenda"
            etiqueta="clientes"
            tom="neutro"
          />
          <CartaoIndicador
            rotulo="Revendedores (PDV)"
            valor={String(qtdRevendedores)}
            detalhe="Lojas, cafés e consignação"
            etiqueta="revenda"
            tom="saffron"
          />
          <CartaoIndicador
            rotulo="Parceiros"
            valor={String(qtdParceiros)}
            detalhe="Cerimonialistas e colabs"
            etiqueta="parcerias"
            tom="brand"
          />
          <CartaoIndicador
            rotulo="Comissões Pendentes"
            valor={brl(totalComissaoPendente)}
            detalhe="Saldos a acertar"
            etiqueta="financeiro"
            tom={totalComissaoPendente > 0 ? "warning" : "success"}
          />
        </section>
      )}

      {/* BANNER DE ALERTAS DE REPOSIÇÃO PARA A DONA */}
      {!ehRevendedor && alertasReposicao.length > 0 && (
        <div className="p-4 bg-amber-50 border-2 border-amber-300/80 rounded-2xl shadow-xs space-y-2">
          <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
            <AlertTriangle className="size-5 text-amber-600 animate-pulse shrink-0" />
            <span>
              Atenção para Reposição: {alertasReposicao.length} {alertasReposicao.length === 1 ? "sabor precisa" : "sabores precisam"} de entrega urgente para manter o estoque do revendedor!
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
            {alertasReposicao.map((alerta) => (
              <div
                key={`${alerta.revendedora_id}_${alerta.produto_id}`}
                className="bg-white p-2.5 rounded-xl border border-amber-200 flex items-center justify-between gap-2 shadow-2xs"
              >
                <div>
                  <div className="font-bold text-xs text-slate-800">{alerta.nome_revendedora}</div>
                  <div className="text-xs font-semibold text-amber-800">
                    {alerta.nome_produto}: <span className="font-black underline">{alerta.saldo_atual} un restantes</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Sugerido entregar: +{alerta.qtd_sugerida_reposicao} un
                  </div>
                </div>
                <Button
                  size="sm"
                  className="h-8 text-[11px] font-bold bg-[#084463] hover:bg-[#06344C] text-white rounded-lg shrink-0 px-2.5"
                  onClick={() => {
                    const rev = revendedoras.find((r) => r.id === alerta.revendedora_id);
                    if (rev) abrirModalRemessa(rev, alerta.produto_id);
                  }}
                >
                  <PackagePlus className="size-3.5 mr-1" /> Entregar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FILTROS SEPARADOS (CLIENTES, REVENDEDORES, PARCEIROS) */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between mt-2">
        {ehRevendedor ? (
          <div className="flex items-center gap-2">
            <span className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-[#084463] text-white shadow-xs">
              👤 Meus Clientes ({contatosFiltrados.length})
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={filtroTipo === "todos" ? "default" : "outline"}
              className={filtroTipo === "todos" ? "bg-[#084463] text-white font-bold" : "rounded-xl"}
              onClick={() => setFiltroTipo("todos")}
            >
              Todos ({contatosCombinados.length})
            </Button>
            <Button
              size="sm"
              variant={filtroTipo === "clientes" ? "default" : "outline"}
              className={filtroTipo === "clientes" ? "bg-blue-700 text-white font-bold" : "rounded-xl text-blue-700 border-blue-200"}
              onClick={() => setFiltroTipo("clientes")}
            >
              👤 Clientes ({qtdClientes})
            </Button>
            <Button
              size="sm"
              variant={filtroTipo === "revendedores" ? "default" : "outline"}
              className={filtroTipo === "revendedores" ? "bg-purple-700 text-white font-bold" : "rounded-xl text-purple-700 border-purple-200"}
              onClick={() => setFiltroTipo("revendedores")}
            >
              🏪 Revendedores ({qtdRevendedores})
            </Button>
            <Button
              size="sm"
              variant={filtroTipo === "parceiros" ? "default" : "outline"}
              className={filtroTipo === "parceiros" ? "bg-emerald-700 text-white font-bold" : "rounded-xl text-emerald-700 border-emerald-200"}
              onClick={() => setFiltroTipo("parceiros")}
            >
              🤝 Parceiros ({qtdParceiros})
            </Button>
          </div>
        )}

        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="w-full md:w-64">
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="rounded-xl border-slate-300"
            />
          </div>
          <Button
            className="rounded-xl gap-1.5 font-bold bg-[#084463] text-white hover:bg-[#06344C] shadow-md shadow-[#084463]/25 px-4 h-10 shrink-0"
            onClick={() => abrirModalNovo()}
          >
            <Plus className="size-4" /> {ehRevendedor ? "Novo Cliente" : "Novo Contato"}
          </Button>
        </div>
      </div>

      {/* LISTAGEM DE CONTATOS */}
      <Painel className="p-0 overflow-hidden">
        {contatosFiltrados.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="size-12 mx-auto text-slate-300 mb-2" />
            <h3 className="font-bold text-slate-700">Nenhum contato encontrado</h3>
            <p className="text-sm text-slate-500 mt-1">
              Cadastre novos clientes, revendedores ou parceiros para manter seus contatos organizados.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {contatosFiltrados.map((item) => {
              const temWhatsApp = Boolean(item.telefone);
              const estaExpandido = Boolean(revendedoresExpandidos[item.id]);

              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 hover:bg-slate-50/80 transition-colors flex flex-col justify-between gap-3"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-slate-900 text-base">{item.nome}</span>
                      
                      {item.perfil === "cliente" && (
                        <>
                          {item.revendedorVinculado ? (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-300">
                              <Store className="size-3 text-purple-700" /> Cliente de: <strong>{item.revendedorVinculado.nome}</strong>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                              <User className="size-3" /> Cliente Direto (Ateliê)
                            </span>
                          )}
                        </>
                      )}

                      {item.perfil === "revendedor" && (
                        <>
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 border border-purple-200">
                            <Store className="size-3" /> Revendedor (PDV / Consignado)
                          </span>

                          {item.revendedoraObj && (() => {
                            const estoquePdv = calcularEstoqueConsignadoRevendedor(item.revendedoraObj.id, remessas, validas, produtos);
                            const totalEmPosse = estoquePdv.reduce((s, p) => s + p.saldo_atual, 0);
                            return (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-900 border border-purple-200">
                                <Boxes className="size-3 text-purple-600" /> {totalEmPosse} {totalEmPosse === 1 ? "un em posse" : "un em posse"}
                              </span>
                            );
                          })()}
                        </>
                      )}

                      {item.perfil === "parceiro" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <Handshake className="size-3" /> Parceiro Comercial
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1">
                      {item.telefone && (
                        <span className="flex items-center gap-1 font-semibold text-slate-700">
                          <Phone className="size-3 text-slate-400" /> {formatarTelefone(item.telefone)}
                        </span>
                      )}
                      {item.rua && (
                        <span className="flex items-center gap-1">
                          <MapPin className="size-3 text-slate-400" /> {item.rua}, {item.numero} {item.bairro ? `- ${item.bairro}` : ""}
                        </span>
                      )}
                      {item.revendedoraObj && (
                        <span className="text-slate-600 font-medium">
                          Comissão: {item.revendedoraObj.tipo_comissao === "porcentagem" ? `${item.revendedoraObj.comissao_percentual}%` : brl(item.revendedoraObj.comissao_fixa)}
                        </span>
                      )}
                    </div>

                    {/* MÉTRICAS DE COMPRAS: VALOR EM DINHEIRO (R$) E SOMA TOTAL DE PRODUTOS COMPRADOS */}
                    {item.perfil === "cliente" && (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 text-xs font-semibold">
                          <DollarSign className="size-3.5 text-emerald-600 shrink-0" />
                          <span>Total Comprado: <strong className="font-black text-emerald-950 dark:text-emerald-100">{brl(item.totalGasto)}</strong></span>
                        </div>

                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border border-blue-200 text-xs font-semibold">
                          <Boxes className="size-3.5 text-blue-600 shrink-0" />
                          <span>Total de Produtos: <strong className="font-black text-blue-950 dark:text-blue-100">{item.totalItensComprados} {item.totalItensComprados === 1 ? "peça" : "peças"}</strong></span>
                          {item.qtdPedidos > 0 && (
                            <span className="text-slate-500 font-normal">({item.qtdPedidos} {item.qtdPedidos === 1 ? "pedido" : "pedidos"})</span>
                          )}
                        </div>

                        {item.revendedorVinculado && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 text-xs font-medium">
                            <Store className="size-3.5 text-purple-600 shrink-0" />
                            <span>Ponto: <strong>{item.revendedorVinculado.nome}</strong></span>
                          </div>
                        )}
                      </div>
                    )}

                    {item.observacoes && (
                      <p className="text-xs text-slate-500 italic mt-0.5">"{item.observacoes}"</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0">
                    {item.revendedoraObj && (
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <span className="text-[11px] text-slate-500 block">Saldo a Pagar</span>
                          <span className={`text-xs font-black block ${item.comissaoPendente > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                            {brl(item.comissaoPendente)}
                          </span>
                        </div>
                        <Button
                          size="sm"
                          className={`h-8 text-xs font-bold rounded-xl shadow-xs gap-1 ${
                            item.comissaoPendente > 0
                              ? "bg-amber-600 hover:bg-amber-700 text-white"
                              : "bg-[#084463] hover:bg-[#06344C] text-white"
                          }`}
                          onClick={() => abrirModalAcerto(item.revendedoraObj!)}
                        >
                          <DollarSign className="size-3.5" /> Acerto de Contas
                        </Button>
                      </div>
                    )}

                    <div className="flex items-center gap-1.5">
                      {item.perfil === "revendedor" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => alternarExpandirRevendedor(item.id)}
                          className={`h-8 text-xs font-bold gap-1 rounded-xl transition-all shadow-2xs ${
                            estaExpandido
                              ? "bg-purple-100 text-purple-900 border-purple-300 hover:bg-purple-200"
                              : "bg-white text-purple-800 border-purple-200 hover:bg-purple-50 hover:border-purple-300"
                          }`}
                          title={estaExpandido ? "Recolher detalhes do ponto" : "Ver estoque e detalhes do ponto"}
                        >
                          <span>{estaExpandido ? "Recolher" : "Ver Detalhes"}</span>
                          {estaExpandido ? (
                            <ChevronUp className="size-3.5 text-purple-700" />
                          ) : (
                            <ChevronDown className="size-3.5 text-purple-700" />
                          )}
                        </Button>
                      )}

                      {temWhatsApp && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs font-bold gap-1 rounded-xl text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                          onClick={() => abrirWhatsApp(item.telefone)}
                        >
                          <MessageCircle className="size-3.5" /> WhatsApp
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-slate-800 rounded-xl"
                        onClick={() => abrirModalNovo(item)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 rounded-xl"
                        onClick={() => {
                          if (confirm(`Excluir o contato "${item.nome}"?`)) {
                            if (item.clienteObj) apagarCliente.mutate(item.clienteObj.id);
                            if (item.revendedoraObj) apagarRevendedora.mutate(item.revendedoraObj.id);
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                  {/* SEÇÃO EXCLUSIVA DE ESTOQUE CONSIGNADO E FINANCEIRO PARA REVENDEDORES (EXPANSÍVEL) */}
                  {item.perfil === "revendedor" && item.revendedoraObj && estaExpandido && (() => {
                    const rev = item.revendedoraObj;
                    const estoquePdv = calcularEstoqueConsignadoRevendedor(rev.id, remessas, validas, produtos);
                    const totalEmPosse = estoquePdv.reduce((s, p) => s + p.saldo_atual, 0);
                    const temCritico = estoquePdv.some((p) => p.precisa_reposicao);

                    const vendasRev = validas.filter((v) => v.revendedora_id === rev.id);
                    const totalVendidoRev = vendasRev.reduce((s, v) => s + Number(v.total || 0), 0);
                    const totalItensVendidos = vendasRev.reduce(
                      (s, v) => s + (v.venda_itens || []).reduce((sum, it) => sum + Number(it.quantidade || 0), 0),
                      0
                    );
                    const totalComissaoRev = vendasRev.reduce((s, v) => s + calcularComissaoRevendedora(v, rev), 0);
                    const totalPagoRev = pagamentosComissao
                      .filter((p) => p.revendedora_id === rev.id)
                      .reduce((s, p) => s + Number(p.valor || 0), 0);
                    const saldoPendenteRev = Math.max(0, totalComissaoRev - totalPagoRev);

                    return (
                      <div className="mt-2 pt-3 border-t border-purple-100 bg-purple-50/50 -mx-4 -mb-4 sm:-mx-5 sm:-mb-5 p-4 rounded-b-2xl space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-xs text-purple-950 flex items-center gap-1.5">
                              <Boxes className="size-4 text-purple-700" /> Estoque em Consignação no Ponto:
                            </span>
                            <span className="text-xs font-black px-2 py-0.5 rounded-full bg-purple-200/80 text-purple-900">
                              {totalEmPosse} {totalEmPosse === 1 ? "unidade em posse" : "unidades em posse"}
                            </span>
                            {temCritico && (
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 border border-amber-300 flex items-center gap-1">
                                <AlertTriangle className="size-3 text-amber-700" /> Reposição necessária
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            <Button
                              size="sm"
                              className={`h-7 text-xs font-bold rounded-lg shadow-xs ${
                                saldoPendenteRev > 0
                                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                                  : "bg-[#084463] hover:bg-[#06344C] text-white"
                              }`}
                              onClick={() => abrirModalAcerto(rev)}
                            >
                              <DollarSign className="size-3.5 mr-1" /> Acerto de Contas
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs font-semibold rounded-lg bg-white border-purple-200 text-purple-900 hover:bg-purple-100"
                              onClick={() => abrirHistoricoRemessas(rev)}
                            >
                              <History className="size-3.5 mr-1" /> Histórico de Remessas
                            </Button>
                            <Button
                              size="sm"
                              className="h-7 text-xs font-bold rounded-lg bg-[#084463] hover:bg-[#06344C] text-white shadow-xs"
                              onClick={() => abrirModalRemessa(rev)}
                            >
                              <PackagePlus className="size-3.5 mr-1" /> + Entregar Produtos
                            </Button>
                          </div>
                        </div>

                        {/* FAIXA FINANCEIRA DO PONTO / REVENDEDOR */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-white/90 rounded-xl border border-purple-200/80 shadow-2xs">
                          <div className="space-y-0.5">
                            <span className="text-[11px] font-semibold text-slate-500 block">Total Vendido no Ponto</span>
                            <span className="font-black text-slate-900 text-sm block">{brl(totalVendidoRev)}</span>
                            <span className="text-[10px] text-slate-400 font-medium block">
                              {totalItensVendidos} {totalItensVendidos === 1 ? "item vendido" : "itens vendidos"}
                            </span>
                          </div>

                          <div className="space-y-0.5">
                            <span className="text-[11px] font-semibold text-purple-900 block">Comissão Acumulada</span>
                            <span className="font-black text-purple-950 text-sm block">{brl(totalComissaoRev)}</span>
                            <span className="text-[10px] text-purple-700/80 font-medium block">
                              {rev.tipo_comissao === "porcentagem" ? `${rev.comissao_percentual}% sobre vendas` : `${brl(rev.comissao_fixa)} por unidade`}
                            </span>
                          </div>

                          <div className="space-y-0.5">
                            <span className="text-[11px] font-semibold text-emerald-800 block">Já Pago / Repassado</span>
                            <span className="font-black text-emerald-900 text-sm block">{brl(totalPagoRev)}</span>
                            <span className="text-[10px] text-emerald-700/80 font-medium block">em acertos anteriores</span>
                          </div>

                          <div className="space-y-0.5 border-l border-purple-200 pl-3">
                            <span className="text-[11px] font-bold text-slate-600 block">Saldo a Pagar</span>
                            <span className={`font-black text-sm block ${saldoPendenteRev > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                              {brl(saldoPendenteRev)}
                            </span>
                            <span className={`text-[10px] font-bold block ${saldoPendenteRev > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                              {saldoPendenteRev > 0 ? "● Aguardando Acerto" : "✓ 100% Quitado"}
                            </span>
                          </div>
                        </div>

                        {estoquePdv.length === 0 ? (
                          <div className="p-3 bg-white/70 border border-dashed border-purple-200 rounded-xl text-xs text-purple-800 flex items-center justify-between">
                            <span>Nenhum produto entregue a este revendedor ainda. Entregue uma remessa para iniciar as vendas em consignação.</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 text-xs font-bold text-purple-900 underline"
                              onClick={() => abrirModalRemessa(rev)}
                            >
                              Registrar 1ª Remessa
                            </Button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {estoquePdv.map((p) => (
                              <div
                                key={p.produto_id}
                                className={`p-2.5 rounded-xl border bg-white shadow-2xs space-y-1.5 ${
                                  p.status === "esgotado"
                                    ? "border-rose-300 ring-1 ring-rose-200 bg-rose-50/20"
                                    : p.status === "critico"
                                    ? "border-amber-300 ring-1 ring-amber-200 bg-amber-50/20"
                                    : "border-purple-100"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-xs text-slate-900 line-clamp-1">{p.nome_produto}</span>
                                  {p.status === "esgotado" && (
                                    <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-200">
                                      Esgotado
                                    </span>
                                  )}
                                  {p.status === "critico" && (
                                    <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                      Baixo
                                    </span>
                                  )}
                                  {p.status === "ok" && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                                      Abastecido
                                    </span>
                                  )}
                                </div>

                                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                                  <span>Entregue: <strong className="text-slate-700">{p.total_entregue}</strong></span>
                                  <span>Vendido: <strong className="text-slate-700">{p.total_vendido}</strong></span>
                                  <span className="text-purple-950 font-bold">
                                    Saldo: <strong className="text-sm font-black text-slate-900">{p.saldo_atual} un</strong>
                                  </span>
                                </div>

                                {p.precisa_reposicao && (
                                  <div className="pt-1 border-t border-slate-100 flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-amber-700">
                                      Repor +{p.qtd_sugerida_reposicao} un
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 text-[11px] font-bold text-[#084463] hover:bg-slate-100 p-1"
                                      onClick={() => abrirModalRemessa(rev, p.produto_id)}
                                    >
                                      + Entregar Mais
                                    </Button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        )}
      </Painel>

      {/* MODAL: NOVO / EDITAR CONTATO COM SEPARAÇÃO EXPLÍCITA */}
      <Dialog open={modalContato} onOpenChange={setModalContato}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#084463]">
              {formCliente.id ? "Editar Contato" : "Novo Contato"}
            </DialogTitle>
            <DialogDescription>
              Selecione o perfil da pessoa ou empresa para aplicar as regras corretas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* SELEÇÃO DO PERFIL DO CONTATO */}
            <div>
              <Label className="text-xs font-bold text-slate-700 block mb-1.5">Perfil do Contato</Label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all ${
                    perfilSelecionado === "cliente"
                      ? "bg-blue-50 text-blue-900 border-blue-500 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                  onClick={() => setPerfilSelecionado("cliente")}
                >
                  <User className="size-4 text-blue-600" />
                  <span>👤 Cliente</span>
                  <span className="text-[10px] font-normal text-slate-400">Consumo próprio</span>
                </button>

                <button
                  type="button"
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all ${
                    perfilSelecionado === "revendedor"
                      ? "bg-purple-50 text-purple-900 border-purple-500 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                  onClick={() => setPerfilSelecionado("revendedor")}
                >
                  <Store className="size-4 text-purple-600" />
                  <span>🏪 Revendedor</span>
                  <span className="text-[10px] font-normal text-slate-400">Loja / Consignação</span>
                </button>

                <button
                  type="button"
                  className={`py-2.5 px-2 rounded-xl text-xs font-bold flex flex-col items-center justify-center gap-1 border transition-all ${
                    perfilSelecionado === "parceiro"
                      ? "bg-emerald-50 text-emerald-900 border-emerald-500 shadow-xs"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                  onClick={() => setPerfilSelecionado("parceiro")}
                >
                  <Handshake className="size-4 text-emerald-600" />
                  <span>🤝 Parceiro</span>
                  <span className="text-[10px] font-normal text-slate-400">Indicação / Colab</span>
                </button>
              </div>
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">
                {perfilSelecionado === "cliente"
                  ? "Nome Completo do Cliente"
                  : perfilSelecionado === "revendedor"
                  ? "Nome do Ponto de Revenda / Loja / Revendedor"
                  : "Nome do Parceiro / Empresa Parceira"}
              </Label>
              <Input
                placeholder={
                  perfilSelecionado === "cliente"
                    ? "Ex: Mariana Souza"
                    : perfilSelecionado === "revendedor"
                    ? "Ex: Café & Bistrô Central ou Ana Revendedora"
                    : "Ex: Juliana Cerimonialista ou Espaço Jardins"
                }
                value={formCliente.nome || ""}
                onChange={(e) => setFormCliente({ ...formCliente, nome: e.target.value })}
                className="mt-1 rounded-xl font-semibold"
              />
            </div>

            <div>
              <Label className="text-xs font-bold text-slate-700">Telefone / WhatsApp</Label>
              <Input
                placeholder="(11) 99999-9999"
                value={formCliente.telefone || ""}
                onChange={(e) => setFormCliente({ ...formCliente, telefone: formatarTelefone(e.target.value) })}
                maxLength={15}
                className="mt-1 rounded-xl"
              />
            </div>

            {/* CAMPOS ESPECÍFICOS DE REVENDEDOR */}
            {perfilSelecionado === "revendedor" && (
              <>
                {/* 1. ACESSO AO SISTEMA (LOGIN DO REVENDEDOR - RESTRITO A VENDAS) */}
                <div className="p-4 bg-purple-50/90 border border-purple-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-purple-950 font-bold text-xs">
                    <KeyRound className="size-4 text-purple-700" />
                    Acesso do Revendedor ao Sistema (Apenas Tela de Vendas)
                  </div>
                  <p className="text-[11px] text-purple-800 leading-relaxed">
                    Informe o e-mail e uma senha de acesso. O revendedor poderá entrar no sistema e terá permissão <strong>exclusivamente para a tela de Pedidos & Vendas</strong>, para registrar saídas e pedidos do seu ponto comercial.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <Label className="text-[11px] font-bold text-purple-900">E-mail de Login</Label>
                      <Input
                        type="email"
                        placeholder="revendedor@email.com"
                        value={emailRevendedor}
                        onChange={(e) => setEmailRevendedor(e.target.value)}
                        className="mt-1 rounded-xl bg-white font-semibold text-xs h-10"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] font-bold text-purple-900">Senha de Acesso</Label>
                      <Input
                        type="text"
                        placeholder="Ex: 123456"
                        value={senhaRevendedor}
                        onChange={(e) => setSenhaRevendedor(e.target.value)}
                        className="mt-1 rounded-xl bg-white font-mono font-semibold text-xs h-10"
                      />
                    </div>
                  </div>
                </div>

                {/* 2. REGRAS DE REVENDA E COMISSÃO */}
                <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-purple-950 font-bold text-xs">
                    <Store className="size-4 text-purple-700" />
                    Regras de Revenda & Consignação
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[11px] font-bold text-purple-900">Formato da Comissão</Label>
                      <Select
                        value={tipoComissao}
                        onValueChange={(v: any) => {
                          setTipoComissao(v);
                          if (v === "valor_fixo") {
                            setComissaoFixaTexto((comissaoFixa || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                          }
                        }}
                      >
                        <SelectTrigger className="mt-1 rounded-xl bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="porcentagem">Porcentagem (%)</SelectItem>
                          <SelectItem value="valor_fixo">Valor Fixo por Peça (R$)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-[11px] font-bold text-purple-900">
                        {tipoComissao === "porcentagem" ? "% de Comissão da Loja" : "R$ de Comissão por Peça"}
                      </Label>
                      {tipoComissao === "porcentagem" ? (
                        <div className="relative mt-1">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={comissaoPercentual}
                            onChange={(e) => setComissaoPercentual(Number(e.target.value))}
                            className="rounded-xl bg-white font-bold pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                            %
                          </span>
                        </div>
                      ) : (
                        <div className="relative mt-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                            R$
                          </span>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="0,00"
                            value={comissaoFixaTexto}
                            onChange={(e) => {
                              const digitos = e.target.value.replace(/\D/g, "");
                              const numValor = digitos ? Number(digitos) / 100 : 0;
                              setComissaoFixa(numValor);
                              setComissaoFixaTexto(
                                numValor.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              );
                            }}
                            className="rounded-xl bg-white font-bold pl-9"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-purple-800">
                    Aplicada automaticamente quando uma venda for feita pelo canal deste revendedor.
                  </p>
                </div>
              </>
            )}

            {/* CAMPOS ESPECÍFICOS DE PARCEIRO */}
            {perfilSelecionado === "parceiro" && (
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-3">
                <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs">
                  <Handshake className="size-4 text-emerald-700" />
                  Regras de Parceria & Indicação Comercial
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] font-bold text-emerald-900">Tipo de Parceiro</Label>
                    <Input
                      placeholder="Ex: Cerimonialista, Fotógrafo, Decoradora..."
                      value={subtipoParceria}
                      onChange={(e) => setSubtipoParceria(e.target.value)}
                      className="mt-1 rounded-xl bg-white text-xs font-semibold"
                    />
                  </div>

                  <div>
                    <Label className="text-[11px] font-bold text-emerald-900">Comissão de Indicação</Label>
                    <div className="flex gap-2 mt-1">
                      <Select
                        value={tipoComissao}
                        onValueChange={(v: any) => {
                          setTipoComissao(v);
                          if (v === "valor_fixo") {
                            setComissaoFixaTexto((comissaoFixa || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
                          }
                        }}
                      >
                        <SelectTrigger className="rounded-xl bg-white w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="porcentagem">%</SelectItem>
                          <SelectItem value="valor_fixo">R$</SelectItem>
                        </SelectContent>
                      </Select>
                      {tipoComissao === "porcentagem" ? (
                        <div className="relative flex-1">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            step="0.5"
                            value={comissaoPercentual}
                            onChange={(e) => setComissaoPercentual(Number(e.target.value))}
                            className="rounded-xl bg-white font-bold pr-8"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                            %
                          </span>
                        </div>
                      ) : (
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                            R$
                          </span>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="0,00"
                            value={comissaoFixaTexto}
                            onChange={(e) => {
                              const digitos = e.target.value.replace(/\D/g, "");
                              const numValor = digitos ? Number(digitos) / 100 : 0;
                              setComissaoFixa(numValor);
                              setComissaoFixaTexto(
                                numValor.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              );
                            }}
                            className="rounded-xl bg-white font-bold pl-9"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ORIGEM DO CLIENTE: VÍNCULO COM REVENDEDOR (APENAS PARA CLIENTES) */}
            {perfilSelecionado === "cliente" && (
              <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-2xl space-y-2">
                <Label className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                  <Store className="size-3.5 text-purple-700" />
                  Origem do Cliente: É cliente de algum revendedor?
                </Label>
                <Select
                  value={formCliente.revendedora_id || "direto"}
                  onValueChange={(val) =>
                    setFormCliente({
                      ...formCliente,
                      revendedora_id: val === "direto" ? null : val,
                    })
                  }
                >
                  <SelectTrigger className="bg-white rounded-xl text-xs h-10 font-semibold border-purple-200">
                    <SelectValue placeholder="Selecione a origem do cliente" />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl">
                    <SelectItem value="direto">
                      🏠 Cliente Direto do Ateliê (Sem Revendedor)
                    </SelectItem>
                    {revendedoras.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        🏪 Cliente do Revendedor: {r.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-purple-800">
                  Indique se este cliente consome através de uma loja ou revendedor parceiro para aplicar a tag de identificação.
                </p>
              </div>
            )}

            {/* ENDEREÇO (APENAS PARA CLIENTES, REVENDEDOR E PARCEIRO NÃO PRECISAM) */}
            {perfilSelecionado === "cliente" && (
              <div className="space-y-2 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                <Label className="text-xs font-bold text-slate-700 block">Endereço de Entrega</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Input
                      placeholder="Rua / Avenida"
                      value={formCliente.rua || ""}
                      onChange={(e) => setFormCliente({ ...formCliente, rua: e.target.value })}
                      className="bg-white rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <Input
                      placeholder="Número"
                      value={formCliente.numero || ""}
                      onChange={(e) => setFormCliente({ ...formCliente, numero: e.target.value })}
                      className="bg-white rounded-xl text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Input
                      placeholder="Bairro"
                      value={formCliente.bairro || ""}
                      onChange={(e) => setFormCliente({ ...formCliente, bairro: e.target.value })}
                      className="bg-white rounded-xl text-xs"
                    />
                  </div>
                  <div>
                    <Input
                      placeholder="Complemento / Apt"
                      value={formCliente.complemento || ""}
                      onChange={(e) => setFormCliente({ ...formCliente, complemento: e.target.value })}
                      className="bg-white rounded-xl text-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs font-bold text-slate-700">Observações Gerais</Label>
              <Textarea
                placeholder="Preferências, dias de entrega, detalhes da parceria..."
                value={formCliente.observacoes || ""}
                onChange={(e) => setFormCliente({ ...formCliente, observacoes: e.target.value })}
                className="mt-1 rounded-xl min-h-[60px]"
              />
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setModalContato(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl font-bold bg-[#084463] text-white hover:bg-[#06344C] px-5"
              onClick={handleSalvarContato}
            >
              Salvar Contato
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: ACERTO DE CONTAS COM REVENDEDOR */}
      <Dialog open={modalComissao} onOpenChange={setModalComissao}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto rounded-3xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#084463] flex items-center gap-2">
              <DollarSign className="size-5 text-emerald-600" />
              Acerto de Contas — {parceiroAcerto?.nome}
            </DialogTitle>
            <DialogDescription>
              Faça o acerto e repasse das comissões pelas vendas de produtos entregues em consignação.
            </DialogDescription>
          </DialogHeader>

          {parceiroAcerto && (() => {
            const vendasRev = validas.filter((v) => v.revendedora_id === parceiroAcerto.id);
            const totalVendido = vendasRev.reduce((s, v) => s + Number(v.total || 0), 0);
            const totalItens = vendasRev.reduce(
              (s, v) => s + (v.venda_itens || []).reduce((sum, item) => sum + Number(item.quantidade || 0), 0),
              0
            );
            const totalCom = vendasRev.reduce((s, v) => s + calcularComissaoRevendedora(v, parceiroAcerto), 0);
            const pagamentosRev = pagamentosComissao.filter((p) => p.revendedora_id === parceiroAcerto.id);
            const totalPago = pagamentosRev.reduce((s, p) => s + Number(p.valor || 0), 0);
            const saldoPendente = Math.max(0, totalCom - totalPago);

            return (
              <div className="space-y-4 pt-2">
                {/* 1. QUADRO RESUMO FINANCEIRO DO REVENDEDOR */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 block">Total Vendido</span>
                    <strong className="text-slate-900 font-black text-base block">{brl(totalVendido)}</strong>
                    <span className="text-[10px] text-slate-400 block">{totalItens} un vendidas</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-purple-900 block">Comissão Apurada</span>
                    <strong className="text-purple-950 font-black text-base block">{brl(totalCom)}</strong>
                    <span className="text-[10px] text-purple-700/80 block">
                      {parceiroAcerto.tipo_comissao === "porcentagem"
                        ? `${parceiroAcerto.comissao_percentual}% sobre vendas`
                        : `${brl(parceiroAcerto.comissao_fixa)}/un`}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-semibold text-emerald-800 block">Total Já Pago</span>
                    <strong className="text-emerald-900 font-black text-base block">{brl(totalPago)}</strong>
                    <span className="text-[10px] text-emerald-700/80 block">{pagamentosRev.length} acertos feitos</span>
                  </div>
                  <div className="border-l border-slate-200 pl-3">
                    <span className="text-[11px] font-bold text-slate-700 block">Saldo a Pagar</span>
                    <strong className={`text-base font-black block ${saldoPendente > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                      {brl(saldoPendente)}
                    </strong>
                    <span className={`text-[10px] font-bold block ${saldoPendente > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                      {saldoPendente > 0 ? "Pendente" : "Quitado"}
                    </span>
                  </div>
                </div>

                {/* 2. FORMULÁRIO DE NOVO ACERTO */}
                <div className="p-4 bg-amber-50/60 border border-amber-200/80 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
                      <Wallet className="size-4 text-amber-700" /> Registrar Novo Pagamento / Repasse
                    </span>
                    {saldoPendente > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 text-[11px] font-bold text-amber-800 border-amber-300 bg-white hover:bg-amber-100 px-2 rounded-lg"
                        onClick={() => {
                          setValorAcerto(saldoPendente);
                          setValorAcertoTexto(
                            saldoPendente.toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })
                          );
                        }}
                      >
                        ⚡ Quitar Saldo Total ({brl(saldoPendente)})
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs font-bold text-slate-700">Valor a Pagar (R$)</Label>
                      <div className="relative mt-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-black text-slate-400">
                          R$
                        </span>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0,00"
                          value={valorAcertoTexto}
                          onChange={(e) => {
                            const digitos = e.target.value.replace(/\D/g, "");
                            const numValor = digitos ? Number(digitos) / 100 : 0;
                            setValorAcerto(numValor);
                            setValorAcertoTexto(
                              numValor.toLocaleString("pt-BR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })
                            );
                          }}
                          className="pl-9 rounded-xl font-black text-slate-900 bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-bold text-slate-700">Forma de Pagamento</Label>
                      <Select value={formaPagamentoAcerto} onValueChange={setFormaPagamentoAcerto}>
                        <SelectTrigger className="mt-1 rounded-xl bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pix">📱 Pix</SelectItem>
                          <SelectItem value="Dinheiro">💵 Dinheiro</SelectItem>
                          <SelectItem value="Transferência Bancária">🏦 Transferência Bancária</SelectItem>
                          <SelectItem value="Outro">📄 Outro</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs font-bold text-slate-700">Data do Pagamento</Label>
                      <Input
                        type="date"
                        value={dataAcerto}
                        onChange={(e) => setDataAcerto(e.target.value)}
                        className="mt-1 rounded-xl bg-white text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-bold text-slate-700">Observações / Detalhes</Label>
                    <Input
                      placeholder="Ex: Acerto referente às vendas do final de semana, comprovante enviado..."
                      value={obsAcerto}
                      onChange={(e) => setObsAcerto(e.target.value)}
                      className="mt-1 rounded-xl bg-white text-xs"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <Button
                      type="button"
                      className="font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl px-5 h-9"
                      onClick={handlePagarComissao}
                    >
                      <CheckCircle2 className="size-4 mr-1.5" /> Confirmar Pagamento do Acerto
                    </Button>
                  </div>
                </div>

                {/* 3. HISTÓRICO DE ACERTOS ANTERIORES REALIZADOS */}
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                      <History className="size-3.5 text-slate-500" /> Histórico de Acertos Realizados ({pagamentosRev.length})
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Total repassado: <strong className="text-slate-800">{brl(totalPago)}</strong>
                    </span>
                  </div>

                  {pagamentosRev.length === 0 ? (
                    <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                      Nenhum acerto de contas registrado ainda para este revendedor.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                      {pagamentosRev.map((pag) => {
                        const dataFormatada = new Date(pag.data).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        });
                        return (
                          <div key={pag.id} className="p-2.5 flex items-center justify-between gap-2 text-xs">
                            <div>
                              <div className="font-bold text-slate-900">{brl(pag.valor)}</div>
                              <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                                <span>📅 {dataFormatada}</span>
                                {pag.observacoes && <span>· {pag.observacoes}</span>}
                              </div>
                            </div>

                            <Button
                              size="sm"
                              variant="ghost"
                              className="size-7 p-0 text-slate-400 hover:text-rose-600 rounded-lg"
                              title="Excluir lançamento deste pagamento"
                              onClick={() => {
                                if (confirm(`Deseja excluir o registro de pagamento de ${brl(pag.valor)}?`)) {
                                  apagarPagamentoComissao.mutate(pag.id);
                                  toast.success("Registro de pagamento removido.");
                                }
                              }}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          <DialogFooter className="mt-4">
            <Button variant="outline" className="rounded-xl w-full" onClick={() => setModalComissao(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* MODAL: ENTREGAR PRODUTOS / NOVA REMESSA EM CONSIGNAÇÃO (MÚLTIPLOS SABORES COM BLOQUEIO DE ESTOQUE ASSADO) */}
      <Dialog open={modalRemessa} onOpenChange={setModalRemessa}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-[#084463] flex items-center gap-2">
              <PackagePlus className="size-5" /> Entregar Produtos ao Revendedor
            </DialogTitle>
            <DialogDescription>
              {revendedorRemessa
                ? `Monte a grade de produtos entregues nesta remessa para abastecer a vitrine de ${revendedorRemessa.nome}.`
                : "Selecione o revendedor e os produtos enviados."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div>
              <Label className="text-xs font-bold text-slate-700">Revendedor / Ponto de Venda</Label>
              <Select
                value={revendedorRemessa?.id || ""}
                onValueChange={(val) => {
                  const rev = revendedoras.find((r) => r.id === val);
                  if (rev) setRevendedorRemessa(rev);
                }}
              >
                <SelectTrigger className="mt-1 rounded-xl">
                  <SelectValue placeholder="Selecione o revendedor" />
                </SelectTrigger>
                <SelectContent>
                  {revendedoras
                    .filter((r) => r.categoria_parceria !== "parceiro")
                    .map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        🏪 {r.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {/* SEÇÃO PARA ESCOLHER E ADICIONAR PRODUTOS À REMESSA */}
            <div className="p-3.5 bg-purple-50/60 border border-purple-200/80 rounded-2xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-purple-950 flex items-center gap-1.5">
                  <Boxes className="size-4 text-purple-700" /> Escolha os Sabores / Produtos
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handlePreencher7DeCadaSabor}
                  className="h-7 text-[11px] font-bold text-purple-900 border-purple-300 bg-white hover:bg-purple-100 rounded-lg px-2.5 gap-1"
                >
                  <Sparkles className="size-3 text-purple-600" /> Preencher 7 de cada sabor pronto
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                <div className="sm:col-span-7">
                  <Label className="text-[11px] font-bold text-slate-700">Produto / Sabor</Label>
                  <Select value={produtoRemessaId} onValueChange={setProdutoRemessaId}>
                    <SelectTrigger className="mt-1 rounded-xl bg-white text-xs">
                      <SelectValue placeholder="Selecione o sabor" />
                    </SelectTrigger>
                    <SelectContent>
                      {produtos.map((p) => {
                        const est = Math.max(0, Number(p.estoque || 0));
                        const semEstoque = est <= 0;
                        return (
                          <SelectItem
                            key={p.id}
                            value={p.id}
                            className={semEstoque ? "text-slate-400" : "font-medium"}
                          >
                            {p.nome} — ({brl(p.preco)}) · {semEstoque ? "⚠️ Sem estoque assado (0 un)" : `Assado: ${est} un`}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="sm:col-span-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-bold text-slate-700">Qtd</Label>
                    <div className="flex gap-1 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setQtdRemessa(7)}
                        className="font-black text-purple-700 underline cursor-pointer"
                        title="Definir 7 unidades"
                      >
                        7 un
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <Input
                      type="number"
                      min="1"
                      value={qtdRemessa}
                      onChange={(e) => setQtdRemessa(Math.max(1, Number(e.target.value)))}
                      className="bg-white rounded-xl text-center font-bold text-xs h-9"
                    />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    onClick={handleAdicionarItemRemessa}
                    className="w-full h-9 rounded-xl font-bold text-xs bg-[#084463] hover:bg-[#06344C] text-white shadow-xs"
                  >
                    <Plus className="size-3.5 mr-1" /> Adicionar
                  </Button>
                </div>
              </div>
            </div>

            {/* GRADE / LISTA DOS ITENS ADICIONADOS À REMESSA */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                  <PackageCheck className="size-4 text-emerald-600" />
                  Itens nesta Remessa ({itensRemessa.length} {itensRemessa.length === 1 ? "sabor" : "sabores"})
                </span>
                {itensRemessa.length > 0 && (
                  <span className="text-xs font-black text-purple-900 bg-purple-100 px-2.5 py-0.5 rounded-full">
                    Total: {itensRemessa.reduce((s, it) => s + it.quantidade, 0)} unidades
                  </span>
                )}
              </div>

              {itensRemessa.length === 0 ? (
                <div className="p-5 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-400">
                  Nenhum produto adicionado à remessa ainda. Escolha o sabor acima e clique em "+ Adicionar" (ou use o atalho de 7 un de cada).
                </div>
              ) : (
                <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs max-h-56 overflow-y-auto">
                  {itensRemessa.map((item) => {
                    const prod = produtos.find((p) => p.id === item.produtoId);
                    const estoqueAssado = Math.max(0, Number(prod?.estoque || 0));
                    const estInsuficiente = item.quantidade > estoqueAssado;
                    const semEstoqueAssado = estoqueAssado <= 0;

                    return (
                      <div
                        key={item.produtoId}
                        className={`p-3 flex items-center justify-between gap-3 text-xs ${
                          estInsuficiente || semEstoqueAssado ? "bg-rose-50/50" : ""
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-bold text-slate-900 flex items-center gap-2">
                            <span>{prod?.nome || "Produto"}</span>
                            <span className="text-[11px] font-semibold text-slate-500">
                              ({brl(prod?.preco || 0)})
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                            {semEstoqueAssado ? (
                              <span className="text-rose-700 font-extrabold flex items-center gap-1">
                                <AlertTriangle className="size-3 text-rose-600" /> Sem cookies assados no Ateliê (0 un)
                              </span>
                            ) : estInsuficiente ? (
                              <span className="text-rose-700 font-extrabold flex items-center gap-1">
                                <AlertTriangle className="size-3 text-rose-600" /> Excede estoque assado (disponível: {estoqueAssado} un)
                              </span>
                            ) : (
                              <span className="text-emerald-700 font-semibold">
                                ✓ Estoque assado: {estoqueAssado} un (restarão {estoqueAssado - item.quantidade} un)
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                            <button
                              type="button"
                              onClick={() => handleAlterarQtdItemRemessa(item.produtoId, item.quantidade - 1)}
                              className="size-7 flex items-center justify-center hover:bg-slate-200 text-slate-700 transition-colors"
                              title="Diminuir 1 un"
                            >
                              <Minus className="size-3" />
                            </button>
                            <span className="px-2.5 font-black text-slate-900 text-xs min-w-[28px] text-center">
                              {item.quantidade}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAlterarQtdItemRemessa(item.produtoId, item.quantidade + 1)}
                              className="size-7 flex items-center justify-center hover:bg-slate-200 text-slate-700 transition-colors"
                              title="Aumentar 1 un"
                            >
                              <Plus className="size-3" />
                            </button>
                          </div>

                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="size-8 p-0 text-slate-400 hover:text-rose-600 rounded-xl"
                            onClick={() => handleRemoverItemRemessa(item.produtoId)}
                            title="Remover produto da remessa"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* DATA DA ENTREGA E OBSERVAÇÕES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <Label className="text-xs font-bold text-slate-700">Data da Entrega</Label>
                <Input
                  type="date"
                  value={dataRemessa}
                  onChange={(e) => setDataRemessa(e.target.value)}
                  className="mt-1 rounded-xl text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-bold text-slate-700">Observações da Remessa</Label>
                <Input
                  placeholder="Ex: Abastecimento matinal vitrine, 7 cookies cada..."
                  value={obsRemessa}
                  onChange={(e) => setObsRemessa(e.target.value)}
                  className="mt-1 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* CAIXA DE BAIXA DE ESTOQUE */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Baixar do estoque pronto / assado do meu Ateliê
                </span>
                <span className="text-[11px] text-slate-500 block">
                  Desconta automaticamente {itensRemessa.reduce((s, it) => s + it.quantidade, 0)} un dos produtos do estoque próprio do ateliê para transferir ao revendedor.
                </span>
              </div>
              <input
                type="checkbox"
                checked={baixarDoAtelie}
                onChange={(e) => setBaixarDoAtelie(e.target.checked)}
                className="size-5 accent-[#084463] rounded cursor-pointer"
              />
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" className="rounded-xl" onClick={() => setModalRemessa(false)}>
              Cancelar
            </Button>
            <Button
              className="rounded-xl font-bold bg-[#084463] text-white hover:bg-[#06344C] px-5"
              onClick={handleSalvarRemessa}
              disabled={itensRemessa.length === 0}
            >
              Confirmar Entrega ({itensRemessa.reduce((s, it) => s + it.quantidade, 0)} un)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: HISTÓRICO DE REMESSAS ENTREGUES */}
      <Dialog open={modalHistorico} onOpenChange={setModalHistorico}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto rounded-3xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-[#084463] flex items-center gap-2">
              <History className="size-5" /> Histórico de Remessas — {revendedorHistorico?.nome}
            </DialogTitle>
            <DialogDescription>
              Registro de todas as entregas realizadas para este revendedor.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {(() => {
              if (!revendedorHistorico) return null;
              const remessasRev = remessas.filter((r) => r.revendedora_id === revendedorHistorico.id);
              if (remessasRev.length === 0) {
                return (
                  <p className="text-xs text-slate-500 p-6 text-center">
                    Nenhuma remessa registrada para este revendedor ainda.
                  </p>
                );
              }
              return (
                <div className="divide-y divide-slate-100 bg-white border border-slate-200 rounded-2xl overflow-hidden">
                  {remessasRev.map((r) => {
                    const dataFormatada = new Date(r.data).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    });
                    return (
                      <div key={r.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{r.nome_produto}</div>
                          <div className="text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>📅 Entregue em: {dataFormatada}</span>
                            {r.observacoes && <span>· "{r.observacoes}"</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="font-black text-sm px-2.5 py-1 bg-purple-100 text-purple-900 rounded-lg">
                            +{r.quantidade} un
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="size-7 p-0 text-slate-400 hover:text-rose-600 rounded-lg"
                            title="Excluir lançamento desta remessa"
                            onClick={() => {
                              if (confirm(`Excluir o registro de entrega de ${r.quantidade} un de "${r.nome_produto}"?`)) {
                                apagarRemessa.mutate(r.id);
                              }
                            }}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" className="rounded-xl w-full" onClick={() => setModalHistorico(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Estrutura>
  );
}

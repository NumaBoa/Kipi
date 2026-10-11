import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Trash2, CakeSlice, Clock, DollarSign, Package, AlertTriangle, CheckCircle2, Settings2 } from "lucide-react";
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
import { brl, num } from "@/lib/format";
import {
  custoProduto,
  custoInsumosFornada,
  custoMaoDeObraFornada,
  custoTotalFornada,
  calcularProducaoPossivel,
  lerValorHoraPadrao,
  gravarValorHoraPadrao,
  useApagarReceitaItem,
  useCategorias,
  useInsumos,
  useProdutos,
  useReceitas,
  useSalvarProduto,
  useSalvarReceitaItem,
  type Produto,
} from "@/lib/dados";

export const Route = createFileRoute("/_authenticated/receitas")({
  head: () => ({
    meta: [
      { title: "Receitas — Meu Ateliê" },
      {
        name: "description",
        content:
          "Fichas técnicas: quais ingredientes e materiais cada bolo ou cookie consome, tempo de mão de obra e lucro real com hora fixada.",
      },
      { property: "og:title", content: "Receitas — Meu Ateliê" },
      {
        property: "og:description",
        content:
          "Fichas técnicas: quais ingredientes e materiais cada bolo ou cookie consome, tempo de mão de obra e lucro real com hora fixada.",
      },
    ],
  }),
  component: PaginaReceitas,
});

function PaginaReceitas() {
  const { data: produtos = [] } = useProdutos();
  const { data: insumos = [] } = useInsumos();
  const { data: receitas = [] } = useReceitas();
  const { data: categorias = [] } = useCategorias();

  const adicionar = useSalvarReceitaItem();
  const apagar = useApagarReceitaItem();
  const salvarProduto = useSalvarProduto();

  const [produtoId, setProdutoId] = useState<string>("");
  const [insumoId, setInsumoId] = useState<string>("");
  const [quantidade, setQuantidade] = useState("");

  // Valor da Hora de Trabalho Fixado Globalmente no Ateliê
  const [valorHoraPadrao, setValorHoraPadrao] = useState<number>(() => lerValorHoraPadrao());
  const [modalValorHora, setModalValorHora] = useState(false);
  const [novoValorHoraPadrao, setNovoValorHoraPadrao] = useState<number>(valorHoraPadrao);

  // Modal para criar nova receita/produto
  const [modalNovoProduto, setModalNovoProduto] = useState(false);
  const [formProduto, setFormProduto] = useState<Partial<Produto>>({
    nome: "",
    categoria: "bolo",
    preco: 0,
    estoque: 0,
    tempo_preparo_minutos: 45,
    rendimento_unidades: 1,
    ativo: true,
  });

  useEffect(() => {
    const primeiro = produtos[0];
    if (!produtoId && primeiro) setProdutoId(primeiro.id);
  }, [produtos, produtoId]);

  const produto = produtos.find((p) => p.id === produtoId);
  const itens = receitas.filter((r) => r.produto_id === produtoId);

  // Cálculos Avançados de Custo e Mão de Obra (Usando Hora Fixada)
  const rendimento = Math.max(Number(produto?.rendimento_unidades ?? 1), 1);
  const insumosFornada = produtoId ? custoInsumosFornada(produtoId, receitas, insumos) : 0;
  const maoObraFornada = produto ? custoMaoDeObraFornada(produto, valorHoraPadrao) : 0;
  const totalFornada = insumosFornada + maoObraFornada;

  const custoUnitarioReal = produtoId
    ? custoProduto(produtoId, receitas, insumos, { ...produto, valor_hora_trabalho: valorHoraPadrao })
    : 0;

  const preco = Number(produto?.preco ?? 0);
  const lucroAtual = preco - custoUnitarioReal;
  const margem = preco > 0 ? (lucroAtual / preco) * 100 : 0;

  // Capacidade de Produção Possível com Estoque Atual de Insumos
  const capacidade = produtoId
    ? calcularProducaoPossivel(produtoId, receitas, insumos, rendimento)
    : { possiveis: 0, gargaloInsumo: null };

  const incluir = async () => {
    const qtd = Number(quantidade.replace(",", "."));
    if (!produtoId || !insumoId || !qtd) {
      toast.error("Escolha o item e a quantidade usada.");
      return;
    }
    await adicionar.mutateAsync({ produto_id: produtoId, insumo_id: insumoId, quantidade: qtd });
    setQuantidade("");
    toast.success("Item adicionado à receita.");
  };

  const atualizarCampoProduto = async (campo: keyof Produto, valor: number) => {
    if (!produto) return;
    try {
      await salvarProduto.mutateAsync({
        ...produto,
        [campo]: Math.max(0, valor),
      });
      toast.success("Dados da receita atualizados!");
    } catch {
      toast.error("Erro ao atualizar dados.");
    }
  };

  const atualizarLucroDesejado = async (lucroDesejado: number) => {
    if (!produto) return;
    const novoPreco = custoUnitarioReal + Math.max(0, lucroDesejado);
    await atualizarCampoProduto("preco", novoPreco);
  };

  const salvarNovoValorHoraPadrao = () => {
    const v = Math.max(0, novoValorHoraPadrao);
    gravarValorHoraPadrao(v);
    setValorHoraPadrao(v);
    setModalValorHora(false);
    toast.success(`Hora fixada do ateliê atualizada para ${brl(v)}/h!`);
  };

  const salvarCriacaoProduto = async () => {
    if (!formProduto.nome?.trim()) {
      toast.error("Informe o nome do produto/receita.");
      return;
    }
    try {
      await salvarProduto.mutateAsync({
        ...formProduto,
        categoria: (formProduto.categoria || "bolo").toLowerCase(),
        preco: Number(formProduto.preco) || 0,
        estoque: Number(formProduto.estoque) || 0,
        tempo_preparo_minutos: Number(formProduto.tempo_preparo_minutos) || 45,
        valor_hora_trabalho: valorHoraPadrao, // VALOR DA HORA FIXADO AUTOMATICAMENTE!
        rendimento_unidades: Number(formProduto.rendimento_unidades) || 1,
      });
      toast.success("Nova receita/produto criada com a hora fixada do ateliê!");
      setModalNovoProduto(false);
      setFormProduto({
        nome: "",
        categoria: "bolo",
        preco: 0,
        estoque: 0,
        tempo_preparo_minutos: 45,
        rendimento_unidades: 1,
        ativo: true,
      });
    } catch {
      toast.error("Erro ao criar produto.");
    }
  };

  const totalComReceita = new Set(receitas.map((r) => r.produto_id)).size;
  const custos = produtos
    .map((p) => custoProduto(p.id, receitas, insumos, { ...p, valor_hora_trabalho: valorHoraPadrao }))
    .filter((c) => c > 0);
  const custoMedio = custos.length > 0 ? custos.reduce((s, c) => s + c, 0) / custos.length : 0;

  return (
    <Estrutura
      titulo="Receitas & Fichas Técnicas"
      subtitulo="Ingredientes, tempo de mão de obra (salário) e cálculo de lucro unitário"
      acao={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="rounded-2xl gap-1.5 text-xs border-brand/40 text-brand bg-brand/5 hover:bg-brand/10 font-bold"
            onClick={() => {
              setNovoValorHoraPadrao(valorHoraPadrao);
              setModalValorHora(true);
            }}
          >
            <Clock className="size-3.5" /> Hora Fixada: {brl(valorHoraPadrao)}/h
          </Button>

          <Button className="rounded-2xl gap-1.5 shadow-lg shadow-brand/20" onClick={() => setModalNovoProduto(true)}>
            <Plus className="size-4" /> Nova Receita / Produto
          </Button>
        </div>
      }
    >
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:gap-5 2xl:gap-6">
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
          valor={brl(custoMedio)}
          detalhe="Insumos + Mão de Obra"
          etiqueta="custo unitário"
          tom="warning"
        />
        <CartaoIndicador
          rotulo="Margem real (selecionado)"
          valor={`${num(margem, 0)}%`}
          detalhe={produto ? produto.nome : "Escolha um produto"}
          etiqueta={margem >= 40 ? "lucrativo" : "atenção"}
          tom={margem >= 40 ? "success" : "danger"}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:gap-6">
        {/* PAINEL PRINCIPAL: INGREDIENTES E MATERIAIS */}
        <Painel className="p-6 lg:col-span-2 xl:col-span-3 space-y-6">
          <TituloSecao
            titulo="Ficha Técnica & Composição"
            descricao="Ingredientes e embalagens consumidos por receita/fornada"
            acao={
              <Select value={produtoId} onValueChange={setProdutoId}>
                <SelectTrigger className="w-[240px] rounded-full text-xs font-semibold">
                  <SelectValue placeholder="Escolha o produto" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
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
          {produto && (
            <div className="glass-inset rounded-2xl p-4 border border-brand/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-brand/5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Package className="size-4 text-brand" />
                  <p className="font-semibold text-sm">Capacidade de Produção Atual</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Estoque pronto: <strong className="text-foreground">{produto.estoque} un</strong> | Produção adicional possível:{" "}
                  <strong className="text-brand font-bold">+{capacidade.possiveis} un</strong> (com os insumos do estoque)
                </p>
              </div>

              {capacidade.gargaloInsumo ? (
                <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 px-3 py-1.5 rounded-xl text-xs text-amber-700 dark:text-amber-300 shrink-0">
                  <AlertTriangle className="size-4 shrink-0" />
                  <span>
                    Gargalo de Estoque: <strong>{capacidade.gargaloInsumo.nome}</strong> ({capacidade.gargaloInsumo.quantidade} {capacidade.gargaloInsumo.unidade})
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
            {itens.length === 0 ? (
              <Vazio texto="Essa receita ainda não tem ingredientes adicionados." />
            ) : (
              itens.map((item) => {
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
                        onClick={() => apagar.mutate(item.id)}
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
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-end pt-3 border-t border-border/50">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Ingrediente ou material do estoque</Label>
              <Select value={insumoId} onValueChange={setInsumoId}>
                <SelectTrigger className="rounded-xl h-10 text-xs">
                  <SelectValue placeholder="Escolha um item" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
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
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                placeholder="0,5"
                className="rounded-xl h-10 text-xs"
              />
            </div>
            <Button className="rounded-2xl h-10 text-xs gap-1.5" onClick={incluir} disabled={adicionar.isPending}>
              <Plus className="size-4" /> Adicionar
            </Button>
          </div>
        </Painel>

        {/* PAINEL LATERAL: MÃO DE OBRA, RENDIMENTO E LUCRO REAL */}
        <Painel className="p-6 space-y-4">
          <TituloSecao titulo="Custo Real & Salário" descricao={produto?.nome ?? "Escolha um produto"} />

          {produto ? (
            <div className="space-y-4 text-sm">
              {/* RENDIMENTO DA FORNADA */}
              <div className="space-y-1.5 glass-inset rounded-2xl p-3">
                <Label htmlFor="rendimento-input" className="text-xs font-semibold text-foreground flex items-center gap-1">
                  <Package className="size-3.5 text-brand" /> Rendimento por Receita (unidades)
                </Label>
                <Input
                  id="rendimento-input"
                  type="number"
                  min="1"
                  value={String(produto.rendimento_unidades ?? 1)}
                  onChange={(e) => atualizarCampoProduto("rendimento_unidades", Number(e.target.value))}
                  className="rounded-xl font-bold text-sm h-9"
                />
                <p className="text-[10px] text-muted-foreground">
                  Quantas unidades de produto esta receita produz por fornada.
                </p>
              </div>

              {/* TEMPO DE PREPARO (MINUTOS) - HORA É FIXADA AUTOMATICAMENTE */}
              <div className="space-y-1.5 glass-inset rounded-2xl p-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="tempo-input" className="text-xs font-semibold flex items-center gap-1">
                    <Clock className="size-3.5 text-brand" /> Tempo de Preparo (min)
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      setNovoValorHoraPadrao(valorHoraPadrao);
                      setModalValorHora(true);
                    }}
                    className="text-[10px] text-brand hover:underline font-semibold"
                  >
                    Hora: {brl(valorHoraPadrao)}/h ⚙️
                  </button>
                </div>
                <Input
                  id="tempo-input"
                  type="number"
                  value={String(produto.tempo_preparo_minutos ?? 45)}
                  onChange={(e) => atualizarCampoProduto("tempo_preparo_minutos", Number(e.target.value))}
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
                  <span className="font-semibold text-brand">{brl(maoObraFornada)}</span>
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
                <Label htmlFor="preco-venda-edit" className="text-xs font-semibold text-brand">
                  Preço de Venda Unitário (R$)
                </Label>
                <Input
                  id="preco-venda-edit"
                  type="number"
                  step="0.50"
                  value={String(produto.preco)}
                  onChange={(e) => atualizarCampoProduto("preco", Number(e.target.value))}
                  className="rounded-xl font-bold text-base h-10"
                />
              </div>

              {/* INPUT EDITÁVEL DE LUCRO DESEJADO POR UNIDADE */}
              <div className="space-y-1.5 glass-inset rounded-2xl p-3">
                <Label htmlFor="lucro-edit" className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Lucro Líquido Real p/ Unidade (R$)
                </Label>
                <Input
                  id="lucro-edit"
                  type="number"
                  step="0.50"
                  value={String(lucroAtual.toFixed(2))}
                  onChange={(e) => atualizarLucroDesejado(Number(e.target.value))}
                  className="rounded-xl font-bold text-base h-10 text-emerald-600 dark:text-emerald-400"
                />
                <p className="text-[10px] text-muted-foreground">
                  Já descontando insumos + sua hora trabalhada ({brl(valorHoraPadrao)}/h).
                </p>
              </div>

              <div className="flex items-center justify-between px-2 pt-1">
                <span className="text-xs text-muted-foreground">Margem Real de Lucro</span>
                <Etiqueta tom={margem >= 40 ? "success" : margem > 0 ? "warning" : "danger"}>
                  {num(margem, 0)}%
                </Etiqueta>
              </div>
            </div>
          ) : (
            <Vazio texto="Selecione um produto para ajustar preço e lucro." />
          )}
        </Painel>
      </div>

      {/* MODAL EDITAR VALOR DA HORA PADRÃO DO ATELIÊ */}
      <Dialog open={modalValorHora} onOpenChange={setModalValorHora}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Sua Hora Fixada (Padrão do Ateliê)</DialogTitle>
            <DialogDescription className="text-xs">
              Defina quanto vale a sua hora de trabalho. Esse valor é fixado globalmente e aplicado em todas as receitas automaticamente, sem precisar digitar ao criar novas receitas.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="valor-hora-global-input" className="text-xs font-semibold">Valor da Hora Trabalhada (R$/h)</Label>
              <Input
                id="valor-hora-global-input"
                type="number"
                step="5"
                value={String(novoValorHoraPadrao)}
                onChange={(e) => setNovoValorHoraPadrao(Number(e.target.value))}
                className="rounded-xl font-bold text-base h-10"
              />
              <p className="text-[11px] text-muted-foreground">
                Exemplo: Para uma meta de salário de R$ 3.000/mês trabalhando 160h, o valor ideal é R$ 18,75/h.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => setModalValorHora(false)}>
              Cancelar
            </Button>
            <Button className="rounded-2xl" onClick={salvarNovoValorHoraPadrao}>
              Fixar Valor da Hora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Criar Nova Receita / Produto */}
      <Dialog open={modalNovoProduto} onOpenChange={setModalNovoProduto}>
        <DialogContent className="sm:max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Criar Nova Receita / Produto</DialogTitle>
            <DialogDescription className="text-xs">
              Cadastre o produto. O valor da sua hora ({brl(valorHoraPadrao)}/h) será aplicado automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="nome-prod-rec" className="text-xs font-semibold">Nome da Receita / Produto</Label>
              <Input
                id="nome-prod-rec"
                placeholder="Ex: Torta de Limão Gourmet"
                value={formProduto.nome ?? ""}
                onChange={(e) => setFormProduto({ ...formProduto, nome: e.target.value })}
                className="rounded-xl text-xs h-10"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="cat-rec" className="text-xs font-semibold">Categoria</Label>
              <Select
                value={formProduto.categoria?.toLowerCase() ?? "bolo"}
                onValueChange={(val) => setFormProduto({ ...formProduto, categoria: val })}
              >
                <SelectTrigger className="rounded-xl h-10 text-xs capitalize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {categorias.map((c) => (
                    <SelectItem key={c.id} value={c.nome} className="capitalize text-xs">
                      {c.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="preco-rec" className="text-xs font-semibold">Preço Venda (R$)</Label>
                <Input
                  id="preco-rec"
                  type="number"
                  step="0.50"
                  value={String(formProduto.preco ?? 0)}
                  onChange={(e) => setFormProduto({ ...formProduto, preco: Number(e.target.value) })}
                  className="rounded-xl text-xs h-10"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="rend-rec" className="text-xs font-semibold">Rendimento (un)</Label>
                <Input
                  id="rend-rec"
                  type="number"
                  value={String(formProduto.rendimento_unidades ?? 1)}
                  onChange={(e) => setFormProduto({ ...formProduto, rendimento_unidades: Number(e.target.value) })}
                  className="rounded-xl text-xs h-10"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="tempo-rec" className="text-xs font-semibold">Tempo de Preparo (minutos)</Label>
              <Input
                id="tempo-rec"
                type="number"
                value={String(formProduto.tempo_preparo_minutos ?? 45)}
                onChange={(e) => setFormProduto({ ...formProduto, tempo_preparo_minutos: Number(e.target.value) })}
                className="rounded-xl text-xs h-10"
              />
              <p className="text-[10px] text-muted-foreground">
                A hora será calculada com base no seu valor fixado de <strong>{brl(valorHoraPadrao)}/h</strong>.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => setModalNovoProduto(false)}>
              Cancelar
            </Button>
            <Button className="rounded-2xl" onClick={salvarCriacaoProduto} disabled={salvarProduto.isPending}>
              Salvar Receita
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Estrutura>
  );
}

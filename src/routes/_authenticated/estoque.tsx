import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Minus, PackagePlus, Pencil, Plus, Trash2, CakeSlice, Boxes, Store, AlertTriangle, ArrowRight } from "lucide-react";
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
  calcularEstoqueConsignadoRevendedor,
  obterAlertasReposicaoRevendedores,
  statusInsumo,
  useApagarInsumo,
  useEntradaEstoque,
  useInsumos,
  useProdutos,
  useRemessasConsignacao,
  useRevendedoras,
  useSalvarInsumo,
  useSalvarProduto,
  useVendas,
  type Insumo,
} from "@/lib/dados";

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({
    meta: [
      { title: "Estoque — Meu Ateliê" },
      {
        name: "description",
        content: "Controle separado de estoque de ingredientes/materiais e de produtos prontos.",
      },
      { property: "og:title", content: "Estoque — Meu Ateliê" },
      {
        property: "og:description",
        content: "Controle separado de estoque de ingredientes/materiais e de produtos prontos.",
      },
    ],
  }),
  component: PaginaEstoque,
});

const vazio = {
  nome: "",
  tipo: "ingrediente",
  unidade: "kg",
  quantidade: 0,
  minimo: 0,
  custo_unitario: 0,
} as Partial<Insumo>;

type AbaEstoque = "insumos" | "produtos" | "consignado";

function PaginaEstoque() {
  const { data: insumos = [] } = useInsumos();
  const { data: produtos = [] } = useProdutos();
  const { data: revendedoras = [] } = useRevendedoras();
  const { data: remessas = [] } = useRemessasConsignacao();
  const { data: vendas = [] } = useVendas();
  const salvar = useSalvarInsumo();
  const apagar = useApagarInsumo();
  const entrada = useEntradaEstoque();
  const salvarProduto = useSalvarProduto();

  const [abaEstoque, setAbaEstoque] = useState<AbaEstoque>("insumos");
  const [filtroInsumo, setFiltroInsumo] = useState<"todos" | "ingrediente" | "material">("todos");
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<Partial<Insumo>>(vazio);
  const [custoTexto, setCustoTexto] = useState("0,00");
  const [compra, setCompra] = useState<{ insumo: Insumo; quantidade: string } | null>(null);

  const validas = useMemo(() => vendas.filter((v) => v.status !== "cancelado"), [vendas]);
  const alertasReposicao = useMemo(
    () => obterAlertasReposicaoRevendedores(revendedoras, remessas, validas, produtos),
    [revendedoras, remessas, validas, produtos]
  );

  // Consolidado por revendedor
  const revendedoresComEstoque = useMemo(() => {
    return revendedoras
      .filter((r) => r.categoria_parceria !== "parceiro")
      .map((r) => {
        const itens = calcularEstoqueConsignadoRevendedor(r.id, remessas, validas, produtos);
        const totalPosse = itens.reduce((s, i) => s + i.saldo_atual, 0);
        const valorPosse = itens.reduce((s, i) => s + i.saldo_atual * i.preco_unitario, 0);
        const temAlerta = itens.some((i) => i.precisa_reposicao);
        return { revendedora: r, itens, totalPosse, valorPosse, temAlerta };
      });
  }, [revendedoras, remessas, validas, produtos]);

  const totalGeralConsignado = revendedoresComEstoque.reduce((s, r) => s + r.totalPosse, 0);
  const valorTotalConsignado = revendedoresComEstoque.reduce((s, r) => s + r.valorPosse, 0);

  const totalEstoquePronto = produtos.reduce((s, p) => s + Number(p.estoque || 0), 0);
  const valorEstoquePronto = produtos.reduce((s, p) => s + Number(p.estoque || 0) * Number(p.preco || 0), 0);
  const produtosComProntaEntrega = produtos.filter((p) => Number(p.estoque) > 0).length;

  const ajustarEstoqueProduto = async (p: any, delta: number) => {
    try {
      const novaQtd = Math.max(0, Number(p.estoque || 0) + delta);
      await salvarProduto.mutateAsync({ ...p, estoque: novaQtd });
      toast.success(`Estoque de ${p.nome}: ${novaQtd} un`);
    } catch {
      toast.error("Erro ao atualizar estoque.");
    }
  };

  const listaInsumos = useMemo(
    () => insumos.filter((i) => filtroInsumo === "todos" || i.tipo === filtroInsumo),
    [insumos, filtroInsumo],
  );

  const valorEstoqueInsumos = insumos.reduce(
    (s, i) => s + Number(i.quantidade) * Number(i.custo_unitario),
    0,
  );
  const repor = insumos.filter((i) => statusInsumo(i) !== "ok");

  const confirmar = async () => {
    if (!form.nome?.trim()) {
      toast.error("Dê um nome ao item.");
      return;
    }
    try {
      await salvar.mutateAsync({
        ...form,
        quantidade: Number(form.quantidade) || 0,
        minimo: Number(form.minimo) || 0,
        custo_unitario: Number(form.custo_unitario) || 0,
      });
      toast.success("Item salvo.");
      setAberto(false);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar.");
    }
  };

  const registrarCompra = async () => {
    if (!compra) return;
    const qtd = Number(compra.quantidade.replace(",", "."));
    if (!qtd) {
      toast.error("Informe a quantidade comprada.");
      return;
    }
    await entrada.mutateAsync({ insumo: compra.insumo, quantidade: qtd, motivo: "Compra" });
    toast.success(`${compra.insumo.nome} reabastecido.`);
    setCompra(null);
  };

  return (
    <Estrutura
      titulo={
        abaEstoque === "insumos"
          ? "Estoque de Matérias & Insumos"
          : abaEstoque === "produtos"
          ? "Estoque de Produtos Prontos"
          : "Estoque em Consignação nos Revendedores"
      }
      subtitulo={
        abaEstoque === "insumos"
          ? "Ingredientes e embalagens para controle de custo e reposição"
          : abaEstoque === "produtos"
          ? "Unidades finalizadas e disponíveis para pronta entrega ou encomenda"
          : "Produtos entregues aos revendedores, vendas realizadas e alertas de reposição"
      }
      acao={
        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Tipo de Estoque */}
          <Tabs value={abaEstoque} onValueChange={(v) => setAbaEstoque(v as AbaEstoque)}>
            <TabsList className="rounded-full bg-muted/60 p-1 border border-border/50">
              <TabsTrigger value="insumos" className="rounded-full text-xs font-bold gap-1.5 px-3">
                <Boxes className="size-3.5" /> Insumos ({insumos.length})
              </TabsTrigger>
              <TabsTrigger value="produtos" className="rounded-full text-xs font-bold gap-1.5 px-3">
                <CakeSlice className="size-3.5" /> Pronta Entrega ({totalEstoquePronto} un)
              </TabsTrigger>
              <TabsTrigger value="consignado" className="rounded-full text-xs font-bold gap-1.5 px-3">
                <Store className="size-3.5" /> Em Revendedores ({totalGeralConsignado} un)
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {abaEstoque === "insumos" && (
            <Button
              className="rounded-2xl gap-1.5 font-bold bg-[#084463] text-white hover:bg-[#06344C] shadow-md shadow-[#084463]/25"
              onClick={() => {
                setForm(vazio);
                setCustoTexto("0,00");
                setAberto(true);
              }}
            >
              <Plus className="size-4" /> Novo ingrediente/material
            </Button>
          )}
          {abaEstoque === "produtos" && (
            <Button
              asChild
              className="rounded-2xl gap-1.5 font-bold bg-[#084463] text-white hover:bg-[#06344C] shadow-md shadow-[#084463]/25"
            >
              <Link to="/produtos">
                <Plus className="size-4" /> Cadastrar Produto
              </Link>
            </Button>
          )}
          {abaEstoque === "consignado" && (
            <Button
              asChild
              className="rounded-2xl gap-1.5 font-bold bg-[#084463] text-white hover:bg-[#06344C] shadow-md shadow-[#084463]/25"
            >
              <Link to="/clientes">
                <PackagePlus className="size-4" /> Entregar Produtos / Remessa
              </Link>
            </Button>
          )}
        </div>
      }
    >
      {abaEstoque === "insumos" ? (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <CartaoIndicador
              rotulo="Insumos cadastrados"
              valor={String(insumos.length)}
              detalhe={`${insumos.filter((i) => i.tipo === "ingrediente").length} ingredientes · ${insumos.filter((i) => i.tipo === "material").length} materiais`}
              tom="brand"
            />
            <CartaoIndicador
              rotulo="Valor investido em insumos"
              valor={brl(valorEstoqueInsumos)}
              detalhe="Com base no custo por unidade"
              etiqueta="investido"
              tom="blossom"
            />
            <CartaoIndicador
              rotulo="Precisa repor"
              valor={String(repor.length)}
              detalhe={repor.map((i) => i.nome).slice(0, 3).join(", ") || "Tudo abastecido"}
              etiqueta={repor.length ? "atenção" : "ok"}
              tom={repor.length ? "danger" : "success"}
            />
          </section>

          <Painel className="p-6">
            <TituloSecao
              titulo="Matérias-Primas & Embalagens"
              descricao="Abaixo do estoque mínimo o item é sinalizado para reposição"
              acao={
                <Tabs value={filtroInsumo} onValueChange={(v) => setFiltroInsumo(v as typeof filtroInsumo)}>
                  <TabsList className="rounded-full">
                    <TabsTrigger value="todos" className="rounded-full text-xs">
                      Todos
                    </TabsTrigger>
                    <TabsTrigger value="ingrediente" className="rounded-full text-xs">
                      Ingredientes
                    </TabsTrigger>
                    <TabsTrigger value="material" className="rounded-full text-xs">
                      Materiais
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              }
            />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] tracking-wider text-muted-foreground uppercase">
                    <th className="py-2 pr-4 text-left font-medium">Item</th>
                    <th className="py-2 pr-4 text-left font-medium">Tipo</th>
                    <th className="py-2 pr-4 text-right font-medium">Quantidade</th>
                    <th className="py-2 pr-4 text-right font-medium">Mínimo</th>
                    <th className="py-2 pr-4 text-right font-medium">Custo/unid.</th>
                    <th className="py-2 pr-4 text-right font-medium">Situação</th>
                    <th className="py-2 text-right font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {listaInsumos.map((insumo) => {
                    const situacao = statusInsumo(insumo);
                    return (
                      <tr key={insumo.id} className="transition-colors hover:bg-card/50">
                        <td className="py-2.5 pr-4 font-medium">{insumo.nome}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground capitalize">{insumo.tipo}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums font-semibold">
                          {num(Number(insumo.quantidade))} {insumo.unidade}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-muted-foreground tabular-nums">
                          {num(Number(insumo.minimo))}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">
                          {brl(Number(insumo.custo_unitario))}
                        </td>
                        <td className="py-2.5 pr-4 text-right">
                          <Etiqueta
                            tom={
                              situacao === "ok" ? "success" : situacao === "baixo" ? "warning" : "danger"
                            }
                          >
                            {situacao === "ok" ? "ok" : situacao === "baixo" ? "baixo" : "acabou"}
                          </Etiqueta>
                        </td>
                        <td className="py-2.5 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-full text-brand"
                            aria-label="Registrar compra"
                            onClick={() => setCompra({ insumo, quantidade: "" })}
                          >
                            <PackagePlus className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-full"
                            aria-label="Editar"
                            onClick={() => {
                              setForm({ ...insumo });
                              const c = Number(insumo.custo_unitario || 0);
                              setCustoTexto(
                                c.toLocaleString("pt-BR", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })
                              );
                              setAberto(true);
                            }}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 rounded-full text-muted-foreground"
                            aria-label="Apagar"
                            onClick={() => apagar.mutate(insumo.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {listaInsumos.length === 0 ? <Vazio texto="Nenhum insumo encontrado." /> : null}
            </div>
          </Painel>
        </>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-3">
            <CartaoIndicador
              rotulo="Unidades Prontas em Estoque"
              valor={`${num(totalEstoquePronto, 0)} un`}
              detalhe="Disponíveis para pronta entrega"
              tom="brand"
            />
            <CartaoIndicador
              rotulo="Valor do Estoque Pronto"
              valor={brl(valorEstoquePronto)}
              detalhe="Valor potencial de venda"
              etiqueta="potencial"
              tom="blossom"
            />
            <CartaoIndicador
              rotulo="Produtos com Pronta Entrega"
              valor={`${produtosComProntaEntrega} de ${produtos.length}`}
              detalhe="Itens disponíveis para venda imediata"
              etiqueta={produtosComProntaEntrega > 0 ? "em dia" : "sem estoque"}
              tom={produtosComProntaEntrega > 0 ? "success" : "warning"}
            />
          </section>

          <Painel className="p-6">
            <TituloSecao
              titulo="Produtos Finalizados (Pronta Entrega)"
              descricao="Ajuste rápido de unidades produzidas e disponíveis para retirada ou entrega"
              acao={
                <Button asChild variant="outline" className="rounded-full text-xs font-semibold gap-1.5">
                  <Link to="/produtos">
                    <Pencil className="size-3.5" /> Ir ao Catálogo de Produtos
                  </Link>
                </Button>
              }
            />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-border text-[11px] tracking-wider text-muted-foreground uppercase">
                    <th className="py-2 pr-4 text-left font-medium">Produto</th>
                    <th className="py-2 pr-4 text-left font-medium">Categoria</th>
                    <th className="py-2 pr-4 text-right font-medium">Preço de Venda</th>
                    <th className="py-2 pr-4 text-center font-medium">Ajuste de Estoque Pronto</th>
                    <th className="py-2 pr-4 text-right font-medium">Valor Total Pronto</th>
                    <th className="py-2 text-right font-medium">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {produtos.map((prod) => {
                    const qtd = Number(prod.estoque || 0);
                    const preco = Number(prod.preco || 0);
                    return (
                      <tr key={prod.id} className="transition-colors hover:bg-card/50">
                        <td className="py-2.5 pr-4 font-semibold text-foreground">{prod.nome}</td>
                        <td className="py-2.5 pr-4 text-muted-foreground capitalize">{prod.categoria || "Geral"}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums font-medium">{brl(preco)}</td>
                        <td className="py-2.5 pr-4 text-center">
                          <div className="inline-flex items-center gap-2 bg-muted/50 p-1 rounded-xl border border-border/50">
                            <button
                              type="button"
                              onClick={() => ajustarEstoqueProduto(prod, -1)}
                              disabled={qtd <= 0}
                              className="size-7 rounded-lg bg-card grid place-items-center text-foreground hover:bg-muted font-bold disabled:opacity-40 transition-colors"
                              title="Diminuir 1 unidade"
                            >
                              <Minus className="size-3.5" />
                            </button>
                            <span className="font-display font-extrabold px-2 tabular-nums text-sm text-[#084463] dark:text-foreground">
                              {qtd} un
                            </span>
                            <button
                              type="button"
                              onClick={() => ajustarEstoqueProduto(prod, 1)}
                              className="size-7 rounded-lg bg-[#084463] grid place-items-center text-white hover:bg-[#06344C] font-bold shadow-sm transition-colors"
                              title="Adicionar 1 unidade pronta"
                            >
                              <Plus className="size-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums font-bold text-foreground">
                          {brl(qtd * preco)}
                        </td>
                        <td className="py-2.5 text-right">
                          <Etiqueta tom={qtd > 0 ? "success" : "warning"}>
                            {qtd > 0 ? `${qtd} prontas` : "esgotado"}
                          </Etiqueta>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {produtos.length === 0 ? <Vazio texto="Nenhum produto cadastrado no catálogo ainda." /> : null}
            </div>
          </Painel>
        </>
      )}

      {abaEstoque === "consignado" && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <CartaoIndicador
              rotulo="Total em Consignação"
              valor={`${totalGeralConsignado} un`}
              detalhe="Unidades em posse dos revendedores"
              etiqueta="consignado"
              tom="brand"
            />
            <CartaoIndicador
              rotulo="Valor de Venda em Campo"
              valor={brl(valorTotalConsignado)}
              detalhe="Potencial de faturamento nos PDVs"
              etiqueta="faturamento"
              tom="saffron"
            />
            <CartaoIndicador
              rotulo="Pontos Abastecidos"
              valor={`${revendedoresComEstoque.filter((r) => r.totalPosse > 0).length} de ${revendedoresComEstoque.length}`}
              detalhe="Revendedores com mercadoria ativa"
              etiqueta="parceiros"
              tom="success"
            />
            <CartaoIndicador
              rotulo="Alertas de Reposição"
              valor={`${alertasReposicao.length} sabores`}
              detalhe="Estoque baixo ou esgotado em PDV"
              etiqueta="atenção"
              tom={alertasReposicao.length > 0 ? "danger" : "success"}
            />
          </section>

          {alertasReposicao.length > 0 && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex items-center justify-between gap-3 shadow-xs">
              <div className="flex items-center gap-2.5 text-amber-900 font-bold text-xs sm:text-sm">
                <AlertTriangle className="size-5 text-amber-600 shrink-0" />
                <span>
                  Existem {alertasReposicao.length} sabores que precisam de entrega urgente para manter o estoque dos revendedores abastecido!
                </span>
              </div>
              <Button asChild size="sm" className="bg-[#084463] text-white hover:bg-[#06344C] font-bold rounded-xl shrink-0">
                <Link to="/clientes">
                  Ver e Entregar <ArrowRight className="size-3.5 ml-1" />
                </Link>
              </Button>
            </div>
          )}

          <div className="space-y-4">
            {revendedoresComEstoque.map(({ revendedora, itens, totalPosse, valorPosse, temAlerta }) => (
              <Painel key={revendedora.id} className="p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-900 text-base">🏪 {revendedora.nome}</span>
                      {temAlerta && (
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                          Reposição Necessária
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {revendedora.telefone ? `WhatsApp: ${revendedora.telefone} · ` : ""}
                      Comissão: {revendedora.tipo_comissao === "porcentagem" ? `${revendedora.comissao_percentual}%` : brl(revendedora.comissao_fixa)}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-xs text-muted-foreground block">Em posse atual</span>
                      <strong className="text-base font-black text-[#084463] dark:text-foreground">
                        {totalPosse} un ({brl(valorPosse)})
                      </strong>
                    </div>

                    <Button asChild size="sm" className="bg-[#084463] text-white hover:bg-[#06344C] font-bold rounded-xl h-8 px-3">
                      <Link to="/clientes">
                        <PackagePlus className="size-3.5 mr-1" /> Entregar Produtos
                      </Link>
                    </Button>
                  </div>
                </div>

                {itens.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2 italic">
                    Nenhum produto entregue para este revendedor ainda.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                    {itens.map((p) => (
                      <div
                        key={p.produto_id}
                        className={`p-3 rounded-xl border text-xs space-y-1.5 bg-card ${
                          p.status === "esgotado"
                            ? "border-rose-300 ring-1 ring-rose-200"
                            : p.status === "critico"
                            ? "border-amber-300 ring-1 ring-amber-200"
                            : "border-border/60"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground line-clamp-1">{p.nome_produto}</span>
                          <span
                            className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                              p.status === "esgotado"
                                ? "bg-rose-100 text-rose-800"
                                : p.status === "critico"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {p.status === "esgotado" ? "Esgotado" : p.status === "critico" ? "Baixo" : "Abastecido"}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                          <span>Entregue: <strong className="text-foreground">{p.total_entregue}</strong></span>
                          <span>Vendido: <strong className="text-foreground">{p.total_vendido}</strong></span>
                          <span>
                            Saldo: <strong className="text-sm font-black text-foreground">{p.saldo_atual} un</strong>
                          </span>
                        </div>

                        {p.precisa_reposicao && (
                          <div className="pt-1 border-t border-border/40 text-[11px] font-bold text-amber-700">
                            ⚠️ Entregar mais +{p.qtd_sugerida_reposicao} un para manter o estoque
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Painel>
            ))}
          </div>
        </>
      )}

      {/* Modal Cadastro/Edição de Insumo */}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {form.id ? "Editar item" : "Novo item"}
            </DialogTitle>
            <DialogDescription>
              Ingredientes e materiais usados na produção, com o mínimo que você quer ter em casa.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nome-insumo">Nome do Item</Label>
              <Input
                id="nome-insumo"
                value={form.nome ?? ""}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Chocolate 60%"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select
                value={form.tipo ?? "ingrediente"}
                onValueChange={(v) => setForm({ ...form, tipo: v as Insumo["tipo"] })}
              >
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="ingrediente">Ingrediente</SelectItem>
                  <SelectItem value="material">Material / Embalagem</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unidade de Medida</Label>
              <Select
                value={form.unidade ?? "kg"}
                onValueChange={(v) => setForm({ ...form, unidade: v })}
              >
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="g">g</SelectItem>
                  <SelectItem value="l">l</SelectItem>
                  <SelectItem value="ml">ml</SelectItem>
                  <SelectItem value="un">un</SelectItem>
                  <SelectItem value="m">m</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="qtd">Quantidade Atual</Label>
              <Input
                id="qtd"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={form.quantidade ? String(form.quantidade) : ""}
                onChange={(e) => {
                  const v = e.target.value.replace(",", ".");
                  const num = v === "" ? 0 : parseFloat(v) || 0;
                  setForm({ ...form, quantidade: num });
                }}
                className="rounded-xl font-semibold"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="min">Estoque Mínimo</Label>
              <Input
                id="min"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={form.minimo ? String(form.minimo) : ""}
                onChange={(e) => {
                  const v = e.target.value.replace(",", ".");
                  const num = v === "" ? 0 : parseFloat(v) || 0;
                  setForm({ ...form, minimo: num });
                }}
                className="rounded-xl font-semibold"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="custo">Custo por unidade (R$)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  R$
                </span>
                <Input
                  id="custo"
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={custoTexto}
                  onChange={(e) => {
                    const digitos = e.target.value.replace(/\D/g, "");
                    const numValor = digitos ? Number(digitos) / 100 : 0;
                    setForm({ ...form, custo_unitario: numValor });
                    setCustoTexto(
                      numValor.toLocaleString("pt-BR", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    );
                  }}
                  className="pl-9 rounded-xl font-bold"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button className="rounded-2xl" onClick={confirmar} disabled={salvar.isPending}>
              Salvar Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Entrada de Estoque */}
      <Dialog open={compra !== null} onOpenChange={(v) => !v && setCompra(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Registrar compra</DialogTitle>
            <DialogDescription>
              Quanto de {compra?.insumo.nome} entrou no estoque?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="entrada">Quantidade em {compra?.insumo.unidade}</Label>
            <Input
              id="entrada"
              inputMode="decimal"
              value={compra?.quantidade ?? ""}
              onChange={(e) =>
                setCompra((atual) => (atual ? { ...atual, quantidade: e.target.value } : atual))
              }
              placeholder="Ex: 2.5"
              className="rounded-xl"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setCompra(null)}>
              Cancelar
            </Button>
            <Button className="rounded-2xl" onClick={registrarCompra} disabled={entrada.isPending}>
              Adicionar ao estoque
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Estrutura>
  );
}

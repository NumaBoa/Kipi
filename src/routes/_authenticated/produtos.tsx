import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, FolderPlus } from "lucide-react";
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
  calcularProducaoPossivel,
  useApagarProduto,
  useCategorias,
  useInsumos,
  useProdutos,
  useReceitas,
  useSalvarCategoria,
  useSalvarProduto,
  type Produto,
} from "@/lib/dados";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({
    meta: [
      { title: "Produtos — Meu Ateliê" },
      {
        name: "description",
        content: "Cadastro de bolos, cookies e peças de artesanato com preço, custo e margem.",
      },
      { property: "og:title", content: "Produtos — Meu Ateliê" },
      {
        property: "og:description",
        content: "Cadastro de bolos, cookies e peças de artesanato com preço, custo e margem.",
      },
    ],
  }),
  component: PaginaProdutos,
});

const vazio = { nome: "", categoria: "bolo", preco: 0, estoque: 0, ativo: true } as Partial<Produto>;

function PaginaProdutos() {
  const { data: produtos = [] } = useProdutos();
  const { data: receitas = [] } = useReceitas();
  const { data: insumos = [] } = useInsumos();
  const { data: categoriasData = [] } = useCategorias();
  const salvar = useSalvarProduto();
  const apagar = useApagarProduto();
  const salvarCategoria = useSalvarCategoria();

  const [aberto, setAberto] = useState(false);
  const [modalNovaCategoria, setModalNovaCategoria] = useState(false);
  const [novaCategoriaNome, setNovaCategoriaNome] = useState("");
  const [form, setForm] = useState<Partial<Produto>>(vazio);
  
  // Item 7: filtro de categoria via pílulas/tags
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("todas");

  // Lista unificada de categorias (do banco + existentes nos produtos)
  const listaCategorias = useMemo(() => {
    const conjunto = new Set<string>();
    categoriasData.forEach((c) => c?.nome && conjunto.add(c.nome.toLowerCase()));
    produtos.forEach((p) => {
      if (p.categoria) conjunto.add(p.categoria.toLowerCase());
    });
    if (conjunto.size === 0) {
      ["bolo", "cookie", "artesanato", "doces", "salgados"].forEach((c) => conjunto.add(c));
    }
    return Array.from(conjunto);
  }, [categoriasData, produtos]);

  const produtosExibidos = useMemo(() => {
    if (categoriaFiltro === "todas") return produtos;
    return produtos.filter((p) => p.categoria.toLowerCase() === categoriaFiltro.toLowerCase());
  }, [produtos, categoriaFiltro]);

  const abrir = (produto?: Produto) => {
    setForm(produto ? { ...produto } : { ...vazio, categoria: listaCategorias[0] ?? "bolo" });
    setAberto(true);
  };

  const confirmar = async () => {
    if (!form.nome?.trim()) {
      toast.error("Dê um nome ao produto.");
      return;
    }
    try {
      await salvar.mutateAsync({
        ...form,
        categoria: (form.categoria || "bolo").toLowerCase(),
        preco: Number(form.preco) || 0,
        estoque: Number(form.estoque) || 0,
      });
      toast.success("Produto salvo.");
      setAberto(false);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar.");
    }
  };

  const cadastrarCategoria = async () => {
    const nomeLimpo = novaCategoriaNome.trim().toLowerCase();
    if (!nomeLimpo) {
      toast.error("Informe o nome da categoria.");
      return;
    }
    try {
      await salvarCategoria.mutateAsync(nomeLimpo);
      toast.success("Categoria cadastrada!");
      setForm((f) => ({ ...f, categoria: nomeLimpo }));
      setNovaCategoriaNome("");
      setModalNovaCategoria(false);
    } catch {
      toast.error("Erro ao salvar categoria.");
    }
  };

  const totalEstoqueUnidades = produtos.reduce((s, p) => s + Number(p.estoque), 0);
  const valorEstoqueProdutos = produtos.reduce((s, p) => s + Number(p.preco) * Number(p.estoque), 0);
  const ativosCount = produtos.filter((p) => p.ativo).length;

  return (
    <Estrutura
      titulo="Produtos"
      subtitulo="Catálogo e preços"
      acao={
        <Button className="rounded-2xl" onClick={() => abrir()}>
          <Plus className="size-4" /> Novo produto
        </Button>
      }
    >
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:gap-5 2xl:gap-6">
        <CartaoIndicador
          rotulo="Produtos no catálogo"
          valor={String(produtos.length)}
          detalhe={`${ativosCount} produtos ativos`}
          etiqueta="catálogo"
          tom="brand"
        />
        <CartaoIndicador
          rotulo="Unidades prontas"
          valor={`${num(totalEstoqueUnidades, 0)} un`}
          detalhe="Prontas para entrega/venda"
          etiqueta="pronta entrega"
          tom="blossom"
        />
        <CartaoIndicador
          rotulo="Valor do estoque pronto"
          valor={brl(valorEstoqueProdutos)}
          detalhe="Potencial bruto em estoque"
          etiqueta="potencial"
          tom="success"
        />
        <CartaoIndicador
          rotulo="Categorias ativas"
          valor={String(listaCategorias.length)}
          detalhe="Categorias cadastradas"
          etiqueta="variedade"
          tom="neutro"
        />
      </section>

      <Painel className="p-6">
        <TituloSecao
          titulo="Catálogo"
          descricao="O custo vem da ficha técnica de cada receita"
          acao={
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl text-xs gap-1.5"
              onClick={() => {
                setNovaCategoriaNome("");
                setModalNovaCategoria(true);
              }}
            >
              <FolderPlus className="size-3.5" /> + Nova Categoria
            </Button>
          }
        />

        {/* Item 7: Tags de filtro por categoria */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 pb-3 border-b border-border/50">
          <button
            type="button"
            onClick={() => setCategoriaFiltro("todas")}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all border ${
              categoriaFiltro === "todas"
                ? "bg-brand text-primary-foreground border-brand font-semibold shadow-sm"
                : "glass-inset text-muted-foreground border-border hover:bg-card/70"
            }`}
          >
            ✨ Todas ({produtos.length})
          </button>
          {listaCategorias.map((cat) => {
            const ativa = categoriaFiltro === cat;
            const qtd = produtos.filter((p) => p.categoria.toLowerCase() === cat.toLowerCase()).length;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoriaFiltro(cat)}
                className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-all border ${
                  ativa
                    ? "bg-brand text-primary-foreground border-brand font-semibold shadow-sm"
                    : "glass-inset text-muted-foreground border-border hover:bg-card/70"
                }`}
              >
                {cat} ({qtd})
              </button>
            );
          })}
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-border text-[11px] tracking-wider text-muted-foreground uppercase">
                <th className="py-2 pr-4 text-left font-medium">Produto</th>
                <th className="py-2 pr-4 text-left font-medium">Categoria</th>
                <th className="py-2 pr-4 text-right font-medium">Preço</th>
                <th className="py-2 pr-4 text-right font-medium">Custo Insumos</th>
                <th className="py-2 pr-4 text-right font-medium">Margem</th>
                <th className="py-2 pr-4 text-right font-medium">Estoque</th>
                <th className="py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {produtosExibidos.map((produto) => {
                const custo = custoProduto(produto.id, receitas, insumos, produto);
                const preco = Number(produto.preco);
                const margem = preco > 0 ? ((preco - custo) / preco) * 100 : 0;
                const cap = calcularProducaoPossivel(produto.id, receitas, insumos, produto.rendimento_unidades);
                return (
                  <tr key={produto.id} className="transition-colors hover:bg-card/50">
                    <td className="py-2.5 pr-4 font-medium">
                      {produto.nome}
                      {!produto.ativo ? (
                        <Etiqueta tom="neutro" className="ml-2">
                          inativo
                        </Etiqueta>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-4 text-muted-foreground capitalize">{produto.categoria}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums font-semibold">{brl(preco)}</td>
                    <td className="py-2.5 pr-4 text-right text-muted-foreground tabular-nums">
                      {custo > 0 ? brl(custo) : "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <Etiqueta tom={margem >= 40 ? "success" : margem > 0 ? "warning" : "neutro"}>
                        {custo > 0 ? `${num(margem, 0)}%` : "sem receita"}
                      </Etiqueta>
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">
                      <div className="flex flex-col items-end">
                        <span className="font-semibold text-foreground">{num(Number(produto.estoque), 0)} pronto</span>
                        <span className="text-[10px] text-brand font-medium">+{cap.possiveis} un insumos</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-full"
                        aria-label="Editar"
                        onClick={() => abrir(produto)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 rounded-full text-muted-foreground"
                        aria-label="Apagar"
                        onClick={() => apagar.mutate(produto.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {produtosExibidos.length === 0 ? <Vazio texto="Nenhum produto nesta categoria." /> : null}
        </div>
      </Painel>

      {/* Modal Cadastro/Edição de Produto */}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {form.id ? "Editar produto" : "Novo produto"}
            </DialogTitle>
            <DialogDescription>
              Ajuste as unidades prontas em estoque, nome, categoria e visibilidade no catálogo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="nome">Nome do Produto</Label>
              <Input
                id="nome"
                value={form.nome ?? ""}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Bolo de cenoura com brigadeiro"
                className="rounded-xl"
              />
            </div>

            {/* Categoria com Select limpo */}
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="categoria-select">Categoria</Label>
                <button
                  type="button"
                  onClick={() => {
                    setNovaCategoriaNome("");
                    setModalNovaCategoria(true);
                  }}
                  className="text-xs text-brand hover:underline font-medium flex items-center gap-1"
                >
                  <Plus className="size-3" /> Nova Categoria
                </button>
              </div>
              <Select
                value={form.categoria?.toLowerCase() ?? listaCategorias[0] ?? "bolo"}
                onValueChange={(val) => setForm({ ...form, categoria: val })}
              >
                <SelectTrigger className="rounded-xl h-10 w-full capitalize">
                  <SelectValue placeholder="Selecione uma categoria..." />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  {listaCategorias.map((cat) => (
                    <SelectItem key={cat} value={cat} className="capitalize text-sm">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Unidades Prontas em Estoque (Foco Principal) */}
            <div className="space-y-1.5">
              <Label htmlFor="estoque" className="font-bold text-foreground">
                Quantidade Pronta (un)
              </Label>
              <Input
                id="estoque"
                type="number"
                step="1"
                value={String(form.estoque ?? 0)}
                onChange={(e) => setForm({ ...form, estoque: Number(e.target.value) })}
                className="rounded-xl border-brand/40 focus:border-brand font-semibold"
                placeholder="0"
              />
            </div>

            {/* Preço de Venda com explicação da conexão com Receitas */}
            <div className="space-y-1.5">
              <Label htmlFor="preco">Preço de Venda (R$)</Label>
              <Input
                id="preco"
                type="number"
                step="0.01"
                value={String(form.preco ?? 0)}
                onChange={(e) => setForm({ ...form, preco: Number(e.target.value) })}
                className="rounded-xl"
              />
            </div>

            <div className="sm:col-span-2 glass-inset rounded-xl p-3 text-[11px] text-muted-foreground flex items-center gap-2">
              <span className="text-brand font-bold text-xs">💡 Dica:</span>
              <span>
                O custo unitário e o preço ideal deste produto são calculados automaticamente em{" "}
                <strong>Receitas</strong> com base nos insumos e no seu tempo de mão de obra.
              </span>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Situação no Catálogo</Label>
              <Select
                value={form.ativo === false ? "inativo" : "ativo"}
                onValueChange={(v) => setForm({ ...form, ativo: v === "ativo" })}
              >
                <SelectTrigger className="rounded-xl h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="ativo">Ativo (visível para vendas)</SelectItem>
                  <SelectItem value="inativo">Inativo (oculto das vendas)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button className="rounded-2xl" onClick={confirmar} disabled={salvar.isPending}>
              Salvar Produto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Adicionar Nova Categoria */}
      <Dialog open={modalNovaCategoria} onOpenChange={setModalNovaCategoria}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Nova Categoria</DialogTitle>
            <DialogDescription>
              Cadastre uma nova categoria para organizar seus produtos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="nova-cat">Nome da Categoria</Label>
            <Input
              id="nova-cat"
              placeholder="Ex: Tortas, Trufas, Bebidas..."
              value={novaCategoriaNome}
              onChange={(e) => setNovaCategoriaNome(e.target.value)}
              className="rounded-xl"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setModalNovaCategoria(false)}>
              Cancelar
            </Button>
            <Button className="rounded-2xl" onClick={cadastrarCategoria} disabled={salvarCategoria.isPending}>
              Salvar Categoria
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Estrutura>
  );
}

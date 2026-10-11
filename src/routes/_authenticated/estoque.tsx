import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Minus, PackagePlus, Pencil, Plus, Trash2, CakeSlice, Boxes } from "lucide-react";
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
  statusInsumo,
  useApagarInsumo,
  useEntradaEstoque,
  useInsumos,
  useProdutos,
  useSalvarInsumo,
  useSalvarProduto,
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

type AbaEstoque = "insumos" | "produtos";

function PaginaEstoque() {
  const { data: insumos = [] } = useInsumos();
  const salvar = useSalvarInsumo();
  const apagar = useApagarInsumo();
  const entrada = useEntradaEstoque();

  const [filtroInsumo, setFiltroInsumo] = useState<"todos" | "ingrediente" | "material">("todos");
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<Partial<Insumo>>(vazio);
  const [compra, setCompra] = useState<{ insumo: Insumo; quantidade: string } | null>(null);

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
      titulo="Estoque de Insumos"
      subtitulo="Ingredientes e materiais de embalagem para produção"
      acao={
        <Button
          className="rounded-2xl"
          onClick={() => {
            setForm(vazio);
            setAberto(true);
          }}
        >
          <Plus className="size-4" /> Novo ingrediente/material
        </Button>
      }
    >
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
                type="number"
                step="0.01"
                value={String(form.quantidade ?? 0)}
                onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="min">Estoque Mínimo</Label>
              <Input
                id="min"
                type="number"
                step="0.01"
                value={String(form.minimo ?? 0)}
                onChange={(e) => setForm({ ...form, minimo: Number(e.target.value) })}
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="custo">Custo por unidade (R$)</Label>
              <Input
                id="custo"
                type="number"
                step="0.01"
                value={String(form.custo_unitario ?? 0)}
                onChange={(e) => setForm({ ...form, custo_unitario: Number(e.target.value) })}
                className="rounded-xl"
              />
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

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Pencil, Plus, Trash2 } from "lucide-react";
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
import { brl } from "@/lib/format";
import {
  useApagarCliente,
  useClientes,
  useSalvarCliente,
  useVendas,
  type Cliente,
} from "@/lib/dados";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({
    meta: [
      { title: "Clientes — Meu Ateliê" },
      {
        name: "description",
        content: "Lista de clientes da confeitaria com contato, endereço e histórico de compras.",
      },
      { property: "og:title", content: "Clientes — Meu Ateliê" },
      {
        property: "og:description",
        content: "Lista de clientes da confeitaria com contato, endereço e histórico de compras.",
      },
    ],
  }),
  component: PaginaClientes,
});

function PaginaClientes() {
  const { data: clientes = [] } = useClientes();
  const { data: vendas = [] } = useVendas();
  const salvar = useSalvarCliente();
  const apagar = useApagarCliente();

  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState<Partial<Cliente>>({});

  const confirmar = async () => {
    if (!form.nome?.trim()) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    await salvar.mutateAsync(form);
    toast.success("Cliente salvo.");
    setAberto(false);
  };

  const comprasTotais = vendas.filter((v) => v.cliente_id && v.status !== "cancelado");
  const faturamentoClientes = comprasTotais.reduce((s, v) => s + Number(v.total), 0);
  const clientesAtivos = new Set(comprasTotais.map((v) => v.cliente_id)).size;

  const formatarEndereco = (c: Cliente) => {
    const partes = [];
    if (c.rua) partes.push(c.rua);
    if (c.numero) partes.push(`nº ${c.numero}`);
    if (c.complemento) partes.push(`(${c.complemento})`);
    if (c.bairro) partes.push(`- ${c.bairro}`);
    return partes.length > 0 ? partes.join(" ") : null;
  };

  return (
    <Estrutura
      titulo="Clientes"
      subtitulo="Quem compra com você"
      acao={
        <Button
          className="rounded-2xl"
          onClick={() => {
            setForm({});
            setAberto(true);
          }}
        >
          <Plus className="size-4" /> Novo cliente
        </Button>
      }
    >
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:gap-5 2xl:gap-6">
        <CartaoIndicador
          rotulo="Total de clientes"
          valor={String(clientes.length)}
          detalhe={`${clientesAtivos} clientes já compraram`}
          etiqueta="carteira"
          tom="brand"
        />
        <CartaoIndicador
          rotulo="Clientes ativos"
          valor={String(clientesAtivos)}
          detalhe="Possuem compras registradas"
          etiqueta="recorrentes"
          tom="success"
        />
        <CartaoIndicador
          rotulo="Faturamento de clientes"
          valor={brl(faturamentoClientes)}
          detalhe="Em vendas identificadas"
          etiqueta="faturamento"
          tom="blossom"
        />
        <CartaoIndicador
          rotulo="Média por cliente"
          valor={brl(clientesAtivos > 0 ? faturamentoClientes / clientesAtivos : 0)}
          detalhe="Gasto médio por cliente ativo"
          etiqueta="ticket"
          tom="warning"
        />
      </section>

      <Painel className="p-6">
        <TituloSecao
          titulo="Lista de clientes"
          descricao={`${clientes.length} ${clientes.length === 1 ? "cliente" : "clientes"}`}
        />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {clientes.length === 0 ? (
            <div className="sm:col-span-2">
              <Vazio texto="Nenhum cliente cadastrado ainda." />
            </div>
          ) : (
            clientes.map((cliente) => {
              const compras = vendas.filter(
                (v) => v.cliente_id === cliente.id && v.status !== "cancelado"
              );
              const total = compras.reduce((s, v) => s + Number(v.total), 0);
              const endereco = formatarEndereco(cliente);

              return (
                <div key={cliente.id} className="glass-inset rounded-2xl p-4 flex flex-col justify-between">
                  <div>
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-sm">{cliente.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {cliente.telefone ?? "Sem telefone"}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-full"
                          aria-label="Editar"
                          onClick={() => {
                            setForm({ ...cliente });
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
                          onClick={() => apagar.mutate(cliente.id)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>

                    {endereco ? (
                      <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="size-3 shrink-0 text-brand" />
                        <span className="truncate">{endereco}</span>
                      </p>
                    ) : null}

                    {cliente.observacoes ? (
                      <p className="mt-1.5 text-xs text-muted-foreground/80 line-clamp-2">
                        {cliente.observacoes}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 pt-2 border-t border-border/50">
                    <Etiqueta tom="brand" className="text-[11px]">{compras.length} compras</Etiqueta>
                    <Etiqueta tom="success" className="text-[11px]">{brl(total)} total</Etiqueta>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Painel>

      {/* Modal Cadastro/Edição de Cliente */}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">
              {form.id ? "Editar cliente" : "Novo cliente"}
            </DialogTitle>
            <DialogDescription>Dados de contato, endereço para entrega e observações.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="nome-cliente">Nome Completo</Label>
              <Input
                id="nome-cliente"
                value={form.nome ?? ""}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex: Marina Lopes"
                className="rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefone">Telefone / WhatsApp</Label>
              <Input
                id="telefone"
                value={form.telefone ?? ""}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                placeholder="(11) 90000-0000"
                className="rounded-xl"
              />
            </div>

            {/* Endereço Detalhado (Item 9) */}
            <div className="glass-inset rounded-2xl p-3 space-y-2.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                Endereço de Entrega
              </Label>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <Label htmlFor="rua" className="text-[11px]">Rua / Logradouro</Label>
                  <Input
                    id="rua"
                    value={form.rua ?? ""}
                    onChange={(e) => setForm({ ...form, rua: e.target.value })}
                    placeholder="Rua das Flores"
                    className="rounded-xl h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="numero" className="text-[11px]">Número</Label>
                  <Input
                    id="numero"
                    value={form.numero ?? ""}
                    onChange={(e) => setForm({ ...form, numero: e.target.value })}
                    placeholder="123"
                    className="rounded-xl h-8 text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="bairro" className="text-[11px]">Bairro</Label>
                  <Input
                    id="bairro"
                    value={form.bairro ?? ""}
                    onChange={(e) => setForm({ ...form, bairro: e.target.value })}
                    placeholder="Jardins"
                    className="rounded-xl h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="comp" className="text-[11px]">Bloco / Ap / Comp.</Label>
                  <Input
                    id="comp"
                    value={form.complemento ?? ""}
                    onChange={(e) => setForm({ ...form, complemento: e.target.value })}
                    placeholder="Apto 42 Bloco B"
                    className="rounded-xl h-8 text-xs"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="obs-cliente">Observações / Preferências</Label>
              <Textarea
                id="obs-cliente"
                rows={2}
                value={form.observacoes ?? ""}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                placeholder="Prefere bolo menos doce, retira no ateliê..."
                className="rounded-xl text-xs"
              />
            </div>
          </div>
          <DialogFooter className="mt-2">
            <Button variant="outline" className="rounded-2xl" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
            <Button className="rounded-2xl" onClick={confirmar} disabled={salvar.isPending}>
              Salvar Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Estrutura>
  );
}

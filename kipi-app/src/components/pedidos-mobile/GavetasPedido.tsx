import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { atualizarPedido, cancelarPedido, pedidoBaixouEstoque, type Pedido } from '@/lib/clientesPedidos';
import { Botao, Gaveta, Opcao, T } from '@/components/mobile/ui';
import { brl, cor, fonte, numeros } from '@/components/mobile/tema';
import { calcularBaixa, lerValor, valorParaCampo } from './acoes';

// ============================================================================
// GAVETAS COMPARTILHADAS ENTRE A LISTA E O DETALHE DO PEDIDO
// ============================================================================

const FORMAS_BAIXA: { id: Pedido['formaPagamento']; label: string }[] = [
  { id: 'pix', label: 'Pix' },
  { id: 'dinheiro', label: 'Dinheiro' },
  { id: 'cartao_credito', label: 'Crédito' },
  { id: 'cartao_debito', label: 'Débito' },
];

// RECEBER PAGAMENTO (dar baixa). Valor menor que o saldo vira recebimento parcial.
export function GavetaReceber({ pedido, aoFechar, avisar }: { pedido: Pedido | null; aoFechar: () => void; avisar: (m: string) => void }) {
  const [forma, setForma] = useState<Pedido['formaPagamento']>('pix');
  const [valor, setValor] = useState('');
  const saldo = pedido ? (pedido.saldoNaEntrega > 0 ? pedido.saldoNaEntrega : pedido.total - pedido.valorSinalPago) : 0;

  useEffect(() => {
    if (pedido) {
      setForma('pix');
      setValor(valorParaCampo(saldo));
    }
  }, [pedido?.id]);

  if (!pedido) return null;
  const recebido = lerValor(valor);
  const parcial = recebido > 0 && recebido < saldo - 0.005;
  const pct = pedido.total > 0 ? Math.round((pedido.valorSinalPago / pedido.total) * 100) : 0;

  const confirmar = () => {
    if (recebido <= 0) {
      avisar('Informe o valor recebido.');
      return;
    }
    const { pago, quitado, falta } = calcularBaixa(pedido, recebido);
    atualizarPedido({
      ...pedido,
      status: quitado ? 'pago' : 'pendente',
      formaPagamento: forma,
      valorSinalPago: pago,
      saldoNaEntrega: quitado ? 0 : falta,
    });
    aoFechar();
    avisar(quitado ? `Pedido ${pedido.codigoDisplay} quitado!` : `Recebido ${brl(recebido)} de ${pedido.codigoDisplay} · faltam ${brl(falta)}`);
  };

  return (
    <Gaveta aberta={!!pedido} aoFechar={aoFechar} titulo="Receber pagamento" subtitulo={`${pedido.clienteNome} · ${pedido.codigoDisplay}`}>
      <View style={{ gap: 8 }}>
        <View style={s.linhaEntre}>
          <T style={s.rotulo}>Falta receber</T>
          <T titulo style={[s.valorGrande, numeros]}>{brl(saldo)}</T>
        </View>
        <View style={s.trilho}>
          <View style={[s.trilhoCheio, { width: `${pct}%` }]} />
        </View>
        <T style={[s.dica, numeros]}>Total {brl(pedido.total)} · Já pago {brl(pedido.valorSinalPago)}</T>
      </View>

      <View style={{ gap: 8 }}>
        <T style={s.rotulo}>Como recebeu?</T>
        <View style={s.grade4}>
          {FORMAS_BAIXA.map((f) => (
            <Opcao key={f.id} rotulo={f.label} ativo={forma === f.id} aoTocar={() => setForma(f.id)} style={s.celula} />
          ))}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <View style={s.linhaEntre}>
          <T style={s.rotulo}>Valor recebido</T>
          <TouchableOpacity style={s.atalho} onPress={() => setValor(valorParaCampo(saldo))} accessibilityRole="button">
            <T style={s.atalhoTexto}>Valor total</T>
          </TouchableOpacity>
        </View>
        <View style={s.campoValor}>
          <T style={s.prefixo}>R$</T>
          <TextInput
            value={valor}
            onChangeText={(t) => setValor(t.replace(/[^\d,.]/g, ''))}
            keyboardType="decimal-pad"
            style={[s.inputValor, { fontFamily: fonte.titulo }]}
            accessibilityLabel="Valor recebido"
          />
        </View>
        <T style={[s.dica, { color: parcial ? cor.ambar : cor.verde, fontWeight: '600' }]}>
          {parcial ? `Recebimento parcial: continuam ${brl(saldo - recebido)} em aberto.` : 'Com esse valor o pedido fica quitado.'}
        </T>
      </View>

      <Botao rotulo="Confirmar recebimento" aoTocar={confirmar} />
    </Gaveta>
  );
}

// CANCELAR (exclusão lógica: fica guardado como cancelado e devolve o estoque)
export function GavetaCancelar({
  pedido,
  aoFechar,
  aoCancelado,
  avisar,
}: {
  pedido: Pedido | null;
  aoFechar: () => void;
  aoCancelado?: () => void;
  avisar: (m: string) => void;
}) {
  if (!pedido) return null;
  return (
    <Gaveta aberta={!!pedido} aoFechar={aoFechar} titulo="Cancelar pedido?" subtitulo="Exclusão lógica">
      <T style={s.texto}>
        O pedido <T style={{ fontWeight: '800' }}>{pedido.codigoDisplay}</T> fica guardado como cancelado.
        {pedidoBaixouEstoque(pedido) ? ' Os itens que saíram da vitrine voltam para o estoque.' : ''}
      </T>
      <Botao
        rotulo="Sim, cancelar pedido"
        variante="perigo"
        aoTocar={() => {
          cancelarPedido(pedido.id);
          aoFechar();
          aoCancelado?.();
          avisar(`Pedido ${pedido.codigoDisplay} cancelado.${pedidoBaixouEstoque(pedido) ? ' Os itens voltaram ao estoque.' : ''}`);
        }}
      />
      <Botao rotulo="Voltar" variante="sutil" aoTocar={aoFechar} altura={46} />
    </Gaveta>
  );
}

// MENU "…" DO PEDIDO
export type AcaoPedido = 'receber' | 'comprovante' | 'detalhes' | 'editar' | 'cancelar';
export function GavetaAcoes({
  pedido,
  aoFechar,
  aoEscolher,
  comDetalhes = true,
}: {
  pedido: Pedido | null;
  aoFechar: () => void;
  aoEscolher: (a: AcaoPedido) => void;
  comDetalhes?: boolean;
}) {
  if (!pedido) return null;
  const itens: { id: AcaoPedido; label: string; icone: keyof typeof Feather.glyphMap; cor: string }[] = [
    ...(pedido.status === 'pendente' ? [{ id: 'receber' as const, label: 'Dar baixa de pagamento', icone: 'check-circle' as const, cor: cor.azulBotao }] : []),
    { id: 'comprovante', label: 'Copiar comprovante para WhatsApp', icone: 'message-circle', cor: cor.verde },
    ...(comDetalhes ? [{ id: 'detalhes' as const, label: 'Ver detalhes', icone: 'file-text' as const, cor: cor.textoMedio }] : []),
    { id: 'editar', label: 'Editar pedido', icone: 'edit-2', cor: cor.textoMedio },
  ];
  return (
    <Gaveta aberta={!!pedido} aoFechar={aoFechar} titulo={pedido.clienteNome} subtitulo={`${pedido.codigoDisplay} · ${brl(pedido.total)}`}>
      <View style={s.menu}>
        {itens.map((it, i) => (
          <TouchableOpacity key={it.id} style={[s.menuItem, i > 0 && s.menuBorda]} onPress={() => aoEscolher(it.id)} accessibilityRole="button">
            <Feather name={it.icone} size={20} color={it.cor} />
            <T style={s.menuTexto}>{it.label}</T>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={[s.menuItem, s.menuPerigo]} onPress={() => aoEscolher('cancelar')} accessibilityRole="button">
        <Feather name="trash-2" size={20} color={cor.vermelho} />
        <T style={[s.menuTexto, { color: cor.vermelho }]}>Cancelar pedido</T>
      </TouchableOpacity>
    </Gaveta>
  );
}

const s = StyleSheet.create({
  linhaEntre: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rotulo: { fontSize: 13, fontWeight: '800', color: cor.textoMedio },
  valorGrande: { fontSize: 26, fontWeight: '700', color: cor.vermelho },
  trilho: { height: 8, borderRadius: 4, backgroundColor: cor.cinzaClaro, overflow: 'hidden' },
  trilhoCheio: { height: '100%', backgroundColor: cor.pistache, borderRadius: 4 },
  dica: { fontSize: 12, color: cor.textoSuave },
  grade4: { flexDirection: 'row', gap: 6 },
  celula: { flex: 1, minHeight: 48, borderRadius: 14, paddingHorizontal: 4 },
  atalho: { height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: cor.azulClaro, justifyContent: 'center' },
  atalhoTexto: { fontSize: 12, fontWeight: '800', color: cor.azulTexto },
  campoValor: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 60, paddingHorizontal: 16, borderRadius: 18, borderWidth: 1.5, borderColor: cor.azul },
  prefixo: { fontWeight: '800', color: cor.textoSuave },
  inputValor: { flex: 1, minWidth: 0, fontSize: 24, fontWeight: '700', color: cor.texto, padding: 0 },
  texto: { fontSize: 15, lineHeight: 22, color: cor.textoMedio },
  menu: { borderRadius: 18, backgroundColor: cor.fundo, overflow: 'hidden' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 56, paddingHorizontal: 16 },
  menuBorda: { borderTopWidth: 1, borderTopColor: cor.borda },
  menuTexto: { fontSize: 15, fontWeight: '700' },
  menuPerigo: { borderRadius: 18, backgroundColor: cor.vermelhoClaro },
});

import { Linking, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { linkWhatsAppDoPedido, mensagemWhatsAppDoPedido, type Pedido } from '@/lib/clientesPedidos';
import type { ConfigLoja } from '@/lib/configuracoes';

// ============================================================================
// AÇÕES DE PEDIDO USADAS NAS TELAS DO CELULAR (mesmas regras da versão de computador)
// ============================================================================

export const textoWhatsApp = (p: Pedido, config: ConfigLoja) => mensagemWhatsAppDoPedido(p, config);

export const copiarComprovante = async (p: Pedido, config: ConfigLoja) => {
  await Clipboard.setStringAsync(textoWhatsApp(p, config));
};

// Abre a conversa com o cliente (ou o WhatsApp sem contato, se não tiver telefone)
export const abrirWhatsApp = (p: Pedido, config: ConfigLoja) => {
  const url = linkWhatsAppDoPedido(p, textoWhatsApp(p, config));
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank');
  else Linking.openURL(url).catch(() => {});
};

export const ligar = (telefone?: string | null) => {
  const tel = (telefone ?? '').replace(/\D/g, '');
  if (tel) Linking.openURL(`tel:${tel}`).catch(() => {});
};

// Recebimento parcial soma ao já pago; só quita quando cobre o total
export const calcularBaixa = (p: Pedido, recebido: number) => {
  const pago = Math.min(p.valorSinalPago + recebido, p.total);
  const quitado = pago >= p.total - 0.005;
  return { pago, quitado, falta: p.total - pago };
};

// "1.234,56" ou "89,50" (com vírgula) e também "89.50" (teclado com ponto)
export const lerValor = (t: string) => {
  const s = String(t || '').trim();
  return (s.includes(',') ? parseFloat(s.replace(/\./g, '').replace(',', '.')) : parseFloat(s)) || 0;
};
export const valorParaCampo = (v: number) => v.toFixed(2).replace('.', ',');

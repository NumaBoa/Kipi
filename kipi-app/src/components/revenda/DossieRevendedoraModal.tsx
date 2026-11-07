import { paraCelular } from '@/lib/responsivo';
import React, { useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  Revendedora,
  VendaRevenda,
  EntregaRevenda,
  PagamentoRevenda,
  resumoFinanceiro,
  comissaoDaVenda,
  saboresComRevendedora,
  descreverComissao,
  formatMoney,
  formatarDataBR,
} from '@/lib/revenda';
import {
  estilosRevenda as s,
  FONT_DISPLAY,
  FONT_SANS,
  KIPI_BLUE_ACCENT,
  KIPI_BLUE_TINT,
  SUCCESS_GREEN,
  SUCCESS_TINT,
  WARNING_AMBER,
  WARNING_TINT,
  DANGER_RED,
  DANGER_TINT,
} from './estilos';

interface Props {
  visible: boolean;
  revendedora: Revendedora | null;
  vendas: VendaRevenda[];
  entregas: EntregaRevenda[];
  pagamentos: PagamentoRevenda[];
  onClose: () => void;
  onEntregar: () => void;
  onAcerto: () => void;
  onEditar: () => void;
  onRepor: (preencher: Record<string, number>) => void; // abre a entrega já com o sabor e a quantidade sugerida
  onExcluirEntrega: (entregaId: string) => void;
}

// Confirmação simples (web usa o confirm do navegador)
export const confirmarExclusao = (mensagem: string) =>
  typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(mensagem) : true;

const STATUS_SABOR = {
  esgotado: { label: 'Esgotado', cor: DANGER_RED, fundo: DANGER_TINT },
  baixo: { label: 'Baixo', cor: WARNING_AMBER, fundo: WARNING_TINT },
  abastecido: { label: 'Abastecido', cor: SUCCESS_GREEN, fundo: SUCCESS_TINT },
};

const STATUS_VENDA = {
  pago: { label: 'Pago', cor: SUCCESS_GREEN, fundo: SUCCESS_TINT },
  pendente: { label: 'Pendente', cor: WARNING_AMBER, fundo: WARNING_TINT },
  cancelado: { label: 'Cancelado', cor: DANGER_RED, fundo: DANGER_TINT },
};

export default function DossieRevendedoraModal({
  visible,
  revendedora,
  vendas,
  entregas,
  pagamentos,
  onClose,
  onEntregar,
  onAcerto,
  onEditar,
  onRepor,
  onExcluirEntrega,
}: Props) {
  const dados = useMemo(() => {
    if (!revendedora) return null;
    const ordenarPorData = <T extends { data: string }>(lista: T[]) =>
      [...lista].sort((a, b) => b.data.localeCompare(a.data));
    return {
      resumo: resumoFinanceiro(revendedora, vendas, pagamentos),
      vendas: ordenarPorData(vendas.filter((v) => v.revendedoraId === revendedora.id)),
      entregas: ordenarPorData(entregas.filter((e) => e.revendedoraId === revendedora.id)),
      sabores: saboresComRevendedora(revendedora.id, entregas, vendas),
    };
  }, [revendedora, vendas, entregas, pagamentos]);

  if (!revendedora || !dados) return null;
  const { resumo } = dados;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalBox}>
          {/* CABEÇALHO */}
          <View style={s.modalHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{revendedora.nome.substring(0, 2).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={s.modalTitle} numberOfLines={1}>{revendedora.nome}</Text>
                {revendedora.tag ? (
                  <View style={styles.tagPill}>
                    <Text style={styles.tagPillText}>{revendedora.tag}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={s.modalSubtitle}>
                {revendedora.telefone} • Comissão: {descreverComissao(revendedora)}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={20} color="#6B615A" />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.modalScroll} contentContainerStyle={s.modalScrollContent}>
            {/* AÇÕES */}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={[s.btnPrimary, styles.actionBtn]} onPress={onEntregar}>
                <Feather name="truck" size={15} color="#FFFDFA" />
                <Text style={s.btnPrimaryText}>Entregar produtos</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnPrimary, styles.actionBtn, { backgroundColor: SUCCESS_GREEN }]} onPress={onAcerto}>
                <Feather name="dollar-sign" size={15} color="#FFFDFA" />
                <Text style={s.btnPrimaryText}>Acerto de contas</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnSecondary} onPress={onEditar}>
                <Feather name="edit-2" size={14} color="#4A3E37" />
                <Text style={s.btnSecondaryText}>Editar cadastro</Text>
              </TouchableOpacity>
            </View>

            {/* KPIs */}
            <View style={[s.kpiGrid, { marginTop: 16 }]}>
              <View style={s.kpiCard}>
                <Text style={s.kpiLabel}>TOTAL VENDIDO</Text>
                <Text style={s.kpiValue}>{formatMoney(resumo.totalVendido)}</Text>
                <Text style={s.kpiSub}>{resumo.qtdVendas} vendas</Text>
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiLabel}>COMISSÃO ACUMULADA</Text>
                <Text style={[s.kpiValue, { color: KIPI_BLUE_ACCENT }]}>{formatMoney(resumo.comissao)}</Text>
                <Text style={s.kpiSub}>{descreverComissao(revendedora)}</Text>
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiLabel}>JÁ PAGO / REPASSADO</Text>
                <Text style={[s.kpiValue, { color: SUCCESS_GREEN }]}>{formatMoney(resumo.pago)}</Text>
              </View>
              <View style={[s.kpiCard, resumo.saldo > 0 && styles.kpiSaldoAberto]}>
                <Text style={s.kpiLabel}>SALDO A PAGAR</Text>
                <Text style={[s.kpiValue, { color: resumo.saldo > 0 ? WARNING_AMBER : '#2E211A' }]}>
                  {formatMoney(resumo.saldo)}
                </Text>
                <Text style={s.kpiSub}>{resumo.saldo > 0 ? 'Em aberto' : 'Tudo acertado'}</Text>
              </View>
            </View>

            {/* RESUMO DAS VENDAS */}
            <Text style={s.sectionTitle}>RESUMO DAS VENDAS</Text>
            <View style={styles.summaryRow}>
              <View style={styles.summaryItem}>
                <Feather name="package" size={14} color="#6B615A" />
                <Text style={styles.summaryText}>
                  <Text style={styles.summaryStrong}>{resumo.qtdItens}</Text> produtos vendidos
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Feather name="trending-up" size={14} color="#6B615A" />
                <Text style={styles.summaryText}>
                  Ticket médio <Text style={styles.summaryStrong}>{formatMoney(resumo.ticketMedio)}</Text>
                </Text>
              </View>
              {resumo.produtoMaisVendido && (
                <View style={styles.summaryItem}>
                  <Text style={{ fontSize: 13 }}>🏆</Text>
                  <Text style={styles.summaryText} numberOfLines={1}>
                    Mais vendido: <Text style={styles.summaryStrong}>{resumo.produtoMaisVendido}</Text>
                  </Text>
                </View>
              )}
            </View>

            {/* ESTOQUE NAS MÃOS DA REVENDEDORA */}
            <Text style={s.sectionTitle}>
              ESTOQUE COM A REVENDEDORA · {dados.sabores.reduce((acc, p) => acc + p.saldo, 0)} UN
            </Text>
            {dados.sabores.length === 0 ? (
              <Text style={[s.emptyText, { textAlign: 'left', paddingVertical: 0 }]}>
                Nenhum produto entregue ainda.
              </Text>
            ) : (
              <View style={s.listCard}>
                {dados.sabores.map((p, idx) => {
                  const st = STATUS_SABOR[p.status];
                  return (
                    <View key={p.produtoId || p.nome} style={[s.listRow, idx % 2 === 0 && s.listRowEven]}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.listMain} numberOfLines={1}>{p.nome}</Text>
                        <Text style={s.listSub}>
                          Entregue {p.entregue} · Vendido {p.vendido} · Saldo <Text style={{ fontWeight: '800', color: '#2E211A' }}>{p.saldo} un</Text>
                        </Text>
                      </View>
                      <View style={[s.statusPill, { backgroundColor: st.fundo }]}>
                        <Text style={[s.statusPillText, { color: st.cor }]}>{st.label}</Text>
                      </View>
                      {p.sugestao > 0 && p.produtoId ? (
                        <TouchableOpacity style={styles.reporBtn} onPress={() => onRepor({ [p.produtoId]: p.sugestao })}>
                          <Text style={styles.reporBtnText}>Repor +{p.sugestao}</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}

            {/* HISTÓRICO DE VENDAS */}
            <Text style={s.sectionTitle}>HISTÓRICO DE VENDAS</Text>
            <View style={s.listCard}>
              {dados.vendas.length === 0 ? (
                <Text style={s.emptyText}>Nenhuma venda registrada ainda.</Text>
              ) : (
                dados.vendas.map((v, idx) => {
                  const status = STATUS_VENDA[v.status];
                  return (
                    <View key={v.id} style={[s.listRow, idx % 2 === 0 && s.listRowEven]}>
                      <View style={{ width: 74 }}>
                        <Text style={s.listSub}>{formatarDataBR(v.data)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.listMain} numberOfLines={1}>{v.cliente || 'Cliente não informado'}</Text>
                        <Text style={s.listSub} numberOfLines={2}>
                          {v.itens.map((i) => `${i.quantidade}x ${i.nome}${i.comDesconto ? ' 🏷️ promoção (comissão 50%)' : ''}`).join(' • ')}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={s.listValue}>{formatMoney(v.total)}</Text>
                        <Text style={[s.listSub, { color: KIPI_BLUE_ACCENT }]}>
                          Comissão {formatMoney(comissaoDaVenda(v, revendedora))}
                        </Text>
                        <View style={[s.statusPill, { backgroundColor: status.fundo }]}>
                          <Text style={[s.statusPillText, { color: status.cor }]}>{status.label}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            {/* HISTÓRICO DE ENTREGAS */}
            <Text style={s.sectionTitle}>ENTREGAS DE PRODUTOS</Text>
            <View style={s.listCard}>
              {dados.entregas.length === 0 ? (
                <Text style={s.emptyText}>Nenhuma entrega feita ainda.</Text>
              ) : (
                dados.entregas.map((e, idx) => (
                  <View key={e.id} style={[s.listRow, idx % 2 === 0 && s.listRowEven]}>
                    <View style={{ width: 74 }}>
                      <Text style={s.listSub}>{formatarDataBR(e.data)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.listMain} numberOfLines={2}>
                        {e.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(' • ')}
                      </Text>
                      {e.observacoes ? <Text style={s.listSub}>{e.observacoes}</Text> : null}
                    </View>
                    <Text style={s.listValue}>
                      {e.itens.reduce((acc, i) => acc + i.quantidade, 0)} un
                    </Text>
                    <TouchableOpacity
                      style={{ padding: 6 }}
                      onPress={() => {
                        if (confirmarExclusao(`Excluir esta entrega? Os produtos voltam para a vitrine.`)) onExcluirEntrega(e.id);
                      }}>
                      <Feather name="trash-2" size={14} color="#9A8F87" />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = paraCelular(StyleSheet.create({
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: KIPI_BLUE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    fontWeight: '800',
    color: KIPI_BLUE_ACCENT,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  tagPill: {
    backgroundColor: '#F3EEE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagPillText: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
    color: '#4A3E37',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBtn: {
    flexGrow: 1,
  },
  kpiSaldoAberto: {
    borderColor: '#F2DDB0',
    backgroundColor: '#FBF0DC',
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F8F6F2',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: '100%',
  },
  summaryText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#4A3E37',
    flexShrink: 1,
  },
  summaryStrong: {
    fontWeight: '800',
    color: '#2E211A',
  },
  reporBtn: {
    marginLeft: 6,
    backgroundColor: KIPI_BLUE_TINT,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  reporBtnText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: KIPI_BLUE_ACCENT,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stockChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  stockChipQtd: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '800',
    color: KIPI_BLUE_ACCENT,
  },
  stockChipName: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#4A3E37',
    flexShrink: 1,
  },
}));

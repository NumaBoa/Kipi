import { paraCelular } from '@/lib/responsivo';
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Modal, Platform, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  Revendedora,
  VendaRevenda,
  PagamentoRevenda,
  FormaPagamento,
  FORMAS_PAGAMENTO,
  resumoFinanceiro,
  descreverComissao,
  labelFormaPagamento,
  formatMoney,
  formatarDataBR,
  dataHojeBR,
  mascaraData,
  dataBRParaISO,
} from '@/lib/revenda';
import {
  estilosRevenda as s,
  FONT_DISPLAY,
  FONT_SANS,
  KIPI_BLUE,
  KIPI_BLUE_ACCENT,
  KIPI_BLUE_TINT,
  KIPI_FROST_BG,
  SUCCESS_GREEN,
  SUCCESS_TINT,
  WARNING_AMBER,
} from './estilos';
import { confirmarExclusao } from './DossieRevendedoraModal';
import { dinheiroParaCampo, lerDinheiro, mascaraDinheiro } from '@/lib/dinheiro';

interface Props {
  visible: boolean;
  revendedora: Revendedora | null;
  vendas: VendaRevenda[];
  pagamentos: PagamentoRevenda[];
  onClose: () => void;
  onRegistrar: (pagamento: Omit<PagamentoRevenda, 'id'>) => void;
  onExcluir: (pagamentoId: string) => void;
}

const paraCampo = (valor: number) => (valor > 0 ? valor.toFixed(2).replace('.', ',') : '');

// Aceita apenas números e uma vírgula, com até 2 casas decimais
const mascaraDecimal = (valor: string) => {
  const limpo = valor.replace(/[^\d,]/g, '');
  const [inteiro, ...resto] = limpo.split(',');
  if (resto.length === 0) return inteiro;
  return `${inteiro},${resto.join('').slice(0, 2)}`;
};

export default function AcertoContasModal({ visible, revendedora, vendas, pagamentos, onClose, onRegistrar, onExcluir }: Props) {
  const resumo = useMemo(
    () => (revendedora ? resumoFinanceiro(revendedora, vendas, pagamentos) : null),
    [revendedora, vendas, pagamentos]
  );
  const historico = useMemo(
    () =>
      revendedora
        ? pagamentos.filter((p) => p.revendedoraId === revendedora.id).sort((a, b) => b.data.localeCompare(a.data))
        : [],
    [revendedora, pagamentos]
  );

  const [valor, setValor] = useState('');
  const [forma, setForma] = useState<FormaPagamento>('pix');
  const [data, setData] = useState(dataHojeBR());
  const [observacoes, setObservacoes] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  // Ao abrir: sugere o saldo em aberto como valor e a data de hoje
  useEffect(() => {
    if (visible && resumo) {
      setValor(dinheiroParaCampo(resumo.saldo));
      setForma('pix');
      setData(dataHojeBR());
      setObservacoes('');
      setErro(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!revendedora || !resumo) return null;

  const valorNum = lerDinheiro(valor);
  const acimaDoSaldo = !isNaN(valorNum) && valorNum > resumo.saldo + 0.001;

  const handleRegistrar = async () => {
    if (isNaN(valorNum) || valorNum <= 0) {
      setErro('Informe o valor do pagamento.');
      return;
    }
    const dataISO = dataBRParaISO(data);
    if (!dataISO) {
      setErro('Informe uma data válida no formato DD/MM/AAAA.');
      return;
    }
    setErro(null);
    setSalvando(true);
    await onRegistrar({
      revendedoraId: revendedora.id,
      valor: valorNum,
      data: dataISO,
      formaPagamento: forma,
      observacoes: observacoes.trim() || null,
    });
    setSalvando(false);
    setValor('');
    setObservacoes('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={s.modalBox}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="arrow-left" size={18} color="#6B615A" />
            </TouchableOpacity>
            <View style={[s.modalHeaderIcon, { backgroundColor: SUCCESS_TINT }]}>
              <Feather name="dollar-sign" size={18} color={SUCCESS_GREEN} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle}>Acerto de contas</Text>
              <Text style={s.modalSubtitle} numberOfLines={1}>
                {revendedora.nome} • {descreverComissao(revendedora)}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={20} color="#6B615A" />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.modalScroll} contentContainerStyle={s.modalScrollContent}>
            {/* KPIs */}
            <View style={s.kpiGrid}>
              <View style={s.kpiCard}>
                <Text style={s.kpiLabel}>TOTAL VENDIDO</Text>
                <Text style={s.kpiValue}>{formatMoney(resumo.totalVendido)}</Text>
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiLabel}>COMISSÃO</Text>
                <Text style={[s.kpiValue, { color: KIPI_BLUE_ACCENT }]}>{formatMoney(resumo.comissao)}</Text>
              </View>
              <View style={s.kpiCard}>
                <Text style={s.kpiLabel}>TOTAL JÁ PAGO</Text>
                <Text style={[s.kpiValue, { color: SUCCESS_GREEN }]}>{formatMoney(resumo.pago)}</Text>
              </View>
              <View style={[s.kpiCard, resumo.saldo > 0 && styles.kpiSaldoAberto]}>
                <Text style={s.kpiLabel}>SALDO A PAGAR</Text>
                <Text style={[s.kpiValue, { color: resumo.saldo > 0 ? WARNING_AMBER : '#2E211A' }]}>
                  {formatMoney(resumo.saldo)}
                </Text>
              </View>
            </View>

            {/* NOVO PAGAMENTO / REPASSE */}
            <Text style={s.sectionTitle}>REGISTRAR PAGAMENTO OU REPASSE</Text>
            <View style={styles.formCard}>
              {erro && (
                <View style={s.errorAlert}>
                  <Feather name="alert-circle" size={14} color="#B42318" />
                  <Text style={s.errorAlertText}>{erro}</Text>
                </View>
              )}

              <View style={styles.formRow}>
                <View style={{ flex: 1, minWidth: 160 }}>
                  <Text style={s.inputLabel}>Valor a pagar *</Text>
                  <View style={styles.moneyInputWrap}>
                    <Text style={styles.moneyPrefix}>R$</Text>
                    <TextInput
                      style={styles.moneyInput}
                      placeholder="0,00"
                      placeholderTextColor="#9A8F87"
                      keyboardType="decimal-pad"
                      value={valor}
                      onChangeText={(t) => setValor(mascaraDinheiro(t))}
                    />
                  </View>
                  {acimaDoSaldo && (
                    <Text style={styles.warnText}>Valor maior que o saldo em aberto (fica como adiantamento).</Text>
                  )}
                </View>
                <View style={{ flex: 1, minWidth: 160 }}>
                  <Text style={s.inputLabel}>Data *</Text>
                  <TextInput
                    style={s.formInput}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor="#9A8F87"
                    keyboardType="numeric"
                    value={data}
                    onChangeText={(t) => setData(mascaraData(t))}
                  />
                </View>
              </View>

              <Text style={s.inputLabel}>Forma de pagamento *</Text>
              <View style={styles.formasRow}>
                {FORMAS_PAGAMENTO.map((f) => {
                  const ativo = forma === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      style={[styles.formaChip, ativo && styles.formaChipActive]}
                      onPress={() => setForma(f.id)}>
                      <Feather name={f.icon} size={13} color={ativo ? KIPI_BLUE_ACCENT : '#6B615A'} />
                      <Text style={[styles.formaChipText, ativo && styles.formaChipTextActive]}>{f.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[s.inputLabel, { marginTop: 12 }]}>Observação</Text>
              <TextInput
                style={[s.formInput, s.formTextarea]}
                placeholder="Ex: acerto da 2ª quinzena de outubro"
                placeholderTextColor="#9A8F87"
                multiline
                value={observacoes}
                onChangeText={setObservacoes}
              />

              <TouchableOpacity
                style={[s.btnPrimary, { backgroundColor: SUCCESS_GREEN, marginTop: 14, alignSelf: 'flex-end' }]}
                disabled={salvando}
                onPress={handleRegistrar}>
                {salvando ? (
                  <ActivityIndicator size="small" color="#FFFDFA" />
                ) : (
                  <>
                    <Feather name="check" size={16} color="#FFFDFA" />
                    <Text style={s.btnPrimaryText}>Registrar pagamento</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* HISTÓRICO DE REPASSES */}
            <Text style={s.sectionTitle}>HISTÓRICO DE PAGAMENTOS E REPASSES</Text>
            <View style={s.listCard}>
              {historico.length === 0 ? (
                <Text style={s.emptyText}>Nenhum pagamento registrado ainda.</Text>
              ) : (
                historico.map((p, idx) => (
                  <View key={p.id} style={[s.listRow, idx % 2 === 0 && s.listRowEven]}>
                    <View style={styles.formaIcon}>
                      <Feather
                        name={FORMAS_PAGAMENTO.find((f) => f.id === p.formaPagamento)?.icon || 'dollar-sign'}
                        size={14}
                        color={SUCCESS_GREEN}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.listMain}>
                        {labelFormaPagamento(p.formaPagamento)} • {formatarDataBR(p.data)}
                      </Text>
                      {p.observacoes ? <Text style={s.listSub}>{p.observacoes}</Text> : null}
                    </View>
                    <Text style={[s.listValue, { color: SUCCESS_GREEN }]}>{formatMoney(p.valor)}</Text>
                    <TouchableOpacity
                      style={{ padding: 6 }}
                      onPress={() => {
                        if (confirmarExclusao(`Excluir o pagamento de ${formatMoney(p.valor)}? O valor volta para o saldo a pagar.`)) onExcluir(p.id);
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
  kpiSaldoAberto: {
    borderColor: '#F2DDB0',
    backgroundColor: '#FBF0DC',
  },
  formCard: {
    borderWidth: 1,
    borderColor: '#E8E0D6',
    borderRadius: 14,
    padding: 14,
  },
  formRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  moneyInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KIPI_FROST_BG,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  moneyPrefix: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    fontWeight: '800',
    color: '#6B615A',
  },
  moneyInput: {
    flex: 1,
    fontFamily: FONT_DISPLAY,
    fontSize: 16,
    fontWeight: '800',
    color: '#2E211A',
    paddingVertical: 8,
    ...Platform.select({ web: { outlineStyle: 'none' } as any }),
  },
  warnText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: WARNING_AMBER,
    marginTop: 4,
  },
  formasRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  formaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    backgroundColor: '#FFFDFA',
  },
  formaChipActive: {
    borderColor: KIPI_BLUE,
    backgroundColor: KIPI_BLUE_TINT,
  },
  formaChipText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '600',
    color: '#6B615A',
  },
  formaChipTextActive: {
    color: KIPI_BLUE_ACCENT,
    fontWeight: '800',
  },
  formaIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: SUCCESS_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
}));

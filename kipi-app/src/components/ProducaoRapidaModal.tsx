import { paraCelular } from '@/lib/responsivo';
import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Platform, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useEstoqueVitrine, useEstoqueFreezer } from '@/lib/estoqueVitrine';
import { useInsumos, receitaDoProduto, congelarMassas, assarDoFreezer } from '@/lib/insumos';

// ============================================================================
// PREPARAR / ASSAR RÁPIDO — atalho usado fora da Produção (Estoque Central, Produtos).
// A ação acontece na própria tela: mesmo registro e mesmo histórico da Produção.
// ============================================================================
const FONT_DISPLAY = Platform.select({ web: '"Sora", ui-sans-serif, system-ui, sans-serif', default: 'System' });
const FONT_SANS = Platform.select({ web: '"Manrope", ui-sans-serif, system-ui, sans-serif', default: 'System' });
const FREEZER_CYAN = '#0891B2';
const OVEN_ORANGE = '#EA580C';
const DANGER = '#DC2626';

export type ModoProducaoRapida = 'preparar' | 'assar';

interface Props {
  visible: boolean;
  produtoId: string | null;
  modo: ModoProducaoRapida;
  onClose: () => void;
  onFeito?: (mensagem: string) => void;
}

export default function ProducaoRapidaModal({ visible, produtoId, modo, onClose, onFeito }: Props) {
  const vitrine = useEstoqueVitrine();
  const freezer = useEstoqueFreezer();
  const insumos = useInsumos(); // checklist acompanha o estoque de insumos
  const [qtd, setQtd] = useState('');
  const [descontar, setDescontar] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const produto = vitrine.find((p) => p.id === produtoId) ?? null;
  const noFreezer = produto ? freezer[produto.id] ?? 0 : 0;
  const assar = modo === 'assar';
  const cor = assar ? OVEN_ORANGE : FREEZER_CYAN;
  const quantidade = parseInt(qtd, 10) || 0;

  useEffect(() => {
    if (!visible) return;
    setQtd(assar ? String(Math.min(6, noFreezer) || '') : '');
    setDescontar(true);
    setErro(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, produtoId, modo]);

  // Preparo: quanto de cada insumo a quantidade pede e se o estoque dá
  const receita = produto && !assar ? receitaDoProduto(produto.id, insumos) : [];
  const checklist = receita.map((r) => {
    const necessario = r.quantidadePorUnidade * quantidade;
    return { ...r, necessario, ok: necessario <= r.estoqueAtual };
  });
  const faltaAlgo = checklist.some((c) => !c.ok);

  const ajustar = (delta: number) => {
    const max = assar ? noFreezer : 9999;
    setQtd(String(Math.max(0, Math.min(max, quantidade + delta))));
    setErro(null);
  };

  const confirmar = () => {
    if (!produto) return;
    if (quantidade <= 0) return setErro('Informe a quantidade.');
    if (assar) {
      if (quantidade > noFreezer) return setErro(`Só há ${noFreezer} no freezer.`);
      assarDoFreezer(produto.id, produto.nome, quantidade, noFreezer);
      onFeito?.(`🔥 ${quantidade} un de ${produto.nome} assadas e na vitrine`);
    } else {
      congelarMassas(produto.id, quantidade, descontar, 'atalho fora da Produção');
      onFeito?.(`🧊 ${quantidade} massas de ${produto.nome} no freezer`);
    }
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.box}>
          <View style={s.header}>
            <View style={[s.headerIcon, { backgroundColor: assar ? '#FFF7ED' : '#ECFEFF' }]}>
              <Text style={{ fontSize: 17 }}>{assar ? '🔥' : '🧊'}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{assar ? 'Assar' : 'Preparar massa'}</Text>
              <Text style={s.subtitle} numberOfLines={1}>{produto?.nome ?? ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {produto && (
            <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={{ gap: 14 }} showsVerticalScrollIndicator={false}>
              <View style={s.saldos}>
                <View style={s.saldo}>
                  <Text style={s.saldoRotulo}>🧊 NO FREEZER</Text>
                  <Text style={s.saldoValor}>{noFreezer} un</Text>
                </View>
                <View style={s.saldo}>
                  <Text style={s.saldoRotulo}>🧁 NA VITRINE</Text>
                  <Text style={s.saldoValor}>{produto.estoque} un</Text>
                </View>
              </View>

              <View>
                <Text style={s.label}>{assar ? 'QUANTAS VAI ASSAR AGORA?' : 'QUANTAS MASSAS VAI MODELAR?'}</Text>
                <View style={s.stepper}>
                  <TouchableOpacity style={s.stepBtn} onPress={() => ajustar(-1)}>
                    <Feather name="minus" size={16} color="#334155" />
                  </TouchableOpacity>
                  <TextInput
                    style={s.stepInput}
                    value={qtd}
                    onChangeText={(t) => {
                      setQtd(t.replace(/\D/g, ''));
                      setErro(null);
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#CBD5E1"
                  />
                  <TouchableOpacity style={s.stepBtn} onPress={() => ajustar(1)}>
                    <Feather name="plus" size={16} color={cor} />
                  </TouchableOpacity>
                  {assar && noFreezer > 0 && (
                    <TouchableOpacity onPress={() => setQtd(String(noFreezer))}>
                      <Text style={[s.link, { color: cor }]}>Tudo ({noFreezer})</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {assar && noFreezer === 0 && <Text style={[s.dica, { color: DANGER }]}>Sem massa congelada. Prepare a massa primeiro.</Text>}
              </View>

              {!assar && (
                <View style={s.checklist}>
                  <Text style={s.label}>INSUMOS NECESSÁRIOS</Text>
                  {checklist.length === 0 ? (
                    <Text style={s.dica}>Produto sem receita: nenhum insumo será descontado.</Text>
                  ) : (
                    checklist.map((c) => (
                      <View key={c.insumoId} style={s.checkLinha}>
                        <Feather name={c.ok ? 'check-circle' : 'alert-circle'} size={13} color={c.ok ? '#16A34A' : DANGER} />
                        <Text style={s.checkNome} numberOfLines={1}>{c.nome}</Text>
                        <Text style={[s.checkQtd, !c.ok && { color: DANGER }]}>
                          {Math.round(c.necessario * 10) / 10} / {c.estoqueAtual} {c.unidade}
                        </Text>
                      </View>
                    ))
                  )}
                  {checklist.length > 0 && (
                    <TouchableOpacity style={s.toggleLinha} onPress={() => setDescontar((v) => !v)}>
                      <View style={[s.caixa, descontar && { backgroundColor: cor, borderColor: cor }]}>
                        {descontar && <Feather name="check" size={11} color="#FFFFFF" />}
                      </View>
                      <Text style={s.toggleTexto}>
                        Descontar ingredientes do estoque{faltaAlgo && descontar ? ' (o que faltar para em zero)' : ''}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {erro && (
                <View style={s.erro}>
                  <Feather name="alert-circle" size={13} color={DANGER} />
                  <Text style={s.erroText}>{erro}</Text>
                </View>
              )}
            </ScrollView>
          )}

          <View style={s.footer}>
            <TouchableOpacity style={s.btnSec} onPress={onClose}>
              <Text style={s.btnSecText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btnPri, { backgroundColor: cor }, (assar && noFreezer === 0) && { opacity: 0.5 }]}
              disabled={assar && noFreezer === 0}
              onPress={confirmar}>
              <Feather name="check" size={14} color="#FFFFFF" />
              <Text style={s.btnPriText}>{assar ? 'Assar' : 'Preparar'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = paraCelular(StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  box: { width: '100%', maxWidth: 440, maxHeight: '92%', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#E2E8F0' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontFamily: FONT_SANS, fontSize: 11, color: '#64748B', marginTop: 1 },
  saldos: { flexDirection: 'row', gap: 8 },
  saldo: { flex: 1, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#EEF2F6', paddingHorizontal: 12, paddingVertical: 9 },
  saldoRotulo: { fontFamily: FONT_SANS, fontSize: 9, fontWeight: '800', color: '#64748B', letterSpacing: 0.4 },
  saldoValor: { fontFamily: FONT_DISPLAY, fontSize: 17, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  label: { fontFamily: FONT_SANS, fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.4, marginBottom: 7 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  stepInput: { width: 72, textAlign: 'center', fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: '800', color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingVertical: 6, backgroundColor: '#F8FAFC' },
  link: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '700', marginLeft: 4 },
  dica: { fontFamily: FONT_SANS, fontSize: 11, color: '#94A3B8', marginTop: 6 },
  checklist: { backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#EEF2F6', padding: 12, gap: 6 },
  checkLinha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkNome: { flex: 1, fontFamily: FONT_SANS, fontSize: 12, fontWeight: '600', color: '#334155' },
  checkQtd: { fontFamily: FONT_SANS, fontSize: 11, fontWeight: '700', color: '#475569' },
  toggleLinha: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  caixa: { width: 18, height: 18, borderRadius: 5, borderWidth: 1.5, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },
  toggleTexto: { flex: 1, fontFamily: FONT_SANS, fontSize: 12, color: '#334155' },
  erro: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 8, padding: 8 },
  erroText: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '600', color: DANGER },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  btnSec: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  btnSecText: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '700', color: '#334155' },
  btnPri: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10 },
  btnPriText: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
}));

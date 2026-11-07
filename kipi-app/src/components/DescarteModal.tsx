import { paraCelular } from '@/lib/responsivo';
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Platform, Modal } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useEstoqueVitrine, useEstoqueFreezer } from '@/lib/estoqueVitrine';
import { useFichas } from '@/lib/insumos';
import {
  MOTIVOS_DESCARTE,
  EMOJI_MOTIVO,
  custoMaterialUnitario,
  registrarDescarte,
  type MotivoDescarte,
  type OrigemDescarte,
} from '@/lib/descarte';

// ============================================================================
// DESCARTE — o mesmo em Produção, Estoque Central e Produtos.
// Escolhe de onde sai (vitrine ou freezer), quantas unidades e o motivo;
// o custo de material entra como perda.
// ============================================================================
const FONT_DISPLAY = Platform.select({ web: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif', default: 'System' });
const FONT_SANS = Platform.select({ web: '"Instrument Sans", ui-sans-serif, system-ui, sans-serif', default: 'System' });
const DANGER = '#B42318';
const DANGER_TINT = '#FBE7E4';
const KIPI_BLUE = '#9E5D25';

const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  visible: boolean;
  produtoId: string | null; // null = escolhe o produto na lista
  origemInicial?: OrigemDescarte;
  onClose: () => void;
  onDescartado?: (mensagem: string) => void;
}

export default function DescarteModal({ visible, produtoId, origemInicial = 'vitrine', onClose, onDescartado }: Props) {
  const vitrine = useEstoqueVitrine();
  const freezer = useEstoqueFreezer();
  useFichas(); // custo acompanha mudanças na receita
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  // Nada vem escolhido: origem, quantidade e motivo são obrigatórios
  const [origem, setOrigem] = useState<OrigemDescarte | null>(null);
  const [qtd, setQtd] = useState('');
  const [motivo, setMotivo] = useState<MotivoDescarte | null>(null);
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setEscolhido(produtoId);
    setBusca('');
    setOrigem(null);
    setQtd('');
    setMotivo(null);
    setObs('');
    setErro(null);
  }, [visible, produtoId, origemInicial]);

  const produto = vitrine.find((p) => p.id === escolhido) ?? null;
  const naVitrine = produto?.estoque ?? 0;
  const noFreezer = produto ? freezer[produto.id] ?? 0 : 0;
  const disponivel = origem === 'freezer' ? noFreezer : origem === 'vitrine' ? naVitrine : 0;
  const quantidade = parseInt(qtd, 10) || 0;
  const custoUnit = produto && origem ? custoMaterialUnitario(produto.id, origem) : 0;

  // Sem produto definido: lista o que tem na vitrine ou no freezer
  const opcoes = useMemo(
    () =>
      vitrine
        .filter((p) => p.estoque > 0 || (freezer[p.id] ?? 0) > 0)
        .filter((p) => p.nome.toLowerCase().includes(busca.trim().toLowerCase())),
    [vitrine, freezer, busca]
  );

  // Ao escolher, se não houver na vitrine mas houver no freezer, já troca a origem
  const escolher = (id: string) => {
    setEscolhido(id);
    setOrigem(null);
    setQtd('');
    setErro(null);
  };

  const confirmar = () => {
    if (!produto) return setErro('Escolha o produto.');
    if (!origem) return setErro('Escolha de onde sai: vitrine ou freezer.');
    if (quantidade <= 0) return setErro('Informe quantas unidades vai descartar.');
    if (!motivo) return setErro('Escolha o motivo do descarte.');
    const falha = registrarDescarte({ produtoId: produto.id, quantidade, origem, disponivel, motivo, observacao: obs });
    if (falha) return setErro(falha);
    onDescartado?.(`🗑 ${quantidade} un de ${produto.nome} descartadas (${motivo}) · perda de ${money(custoUnit * quantidade)}`);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={s.box}>
          <View style={s.header}>
            <View style={s.headerIcon}>
              <Feather name="trash-2" size={16} color={DANGER} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Descartar produto</Text>
              <Text style={s.subtitle} numberOfLines={1}>
                {produto ? produto.nome : 'Escolha o produto, de onde sai e o motivo'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={18} color="#6B615A" />
            </TouchableOpacity>
          </View>

          {erro && (
            <View style={s.erro}>
              <Feather name="alert-circle" size={13} color={DANGER} />
              <Text style={s.erroText}>{erro}</Text>
            </View>
          )}

          <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false}>
            {/* Produto escolhido: vira um resumo com "Trocar" (a lista some e libera espaço) */}
            {!produtoId && produto && (
              <View style={s.bloco}>
                <Text style={s.label}>PRODUTO</Text>
                <View style={s.escolhido}>
                  <View style={s.emoji}>
                    <Text style={{ fontSize: 20 }}>{produto.emoji ?? '🧁'}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.escolhidoNome} numberOfLines={1}>{produto.nome}</Text>
                    <Text style={s.opcaoQtd}>🧁 {naVitrine} na vitrine · 🧊 {noFreezer} no freezer</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setEscolhido(null); setBusca(''); }}>
                    <Text style={s.link}>Trocar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!produtoId && !produto && (
              <View style={s.bloco}>
                <Text style={s.label}>PRODUTO</Text>
                <TextInput style={s.input} placeholder="Buscar produto..." placeholderTextColor="#9A8F87" value={busca} onChangeText={setBusca} />
                <ScrollView style={s.lista} contentContainerStyle={{ gap: 6 }} nestedScrollEnabled>
                  {opcoes.length === 0 ? (
                    <Text style={s.hint}>Nenhum produto com estoque.</Text>
                  ) : (
                    opcoes.map((p) => {
                      const ativo = p.id === escolhido;
                      return (
                        <TouchableOpacity key={p.id} style={[s.opcao, ativo && s.opcaoAtiva]} onPress={() => escolher(p.id)}>
                          <View style={s.emoji}>
                            <Text style={{ fontSize: 18 }}>{p.emoji ?? '🧁'}</Text>
                          </View>
                          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                            <Text style={s.opcaoNome} numberOfLines={1}>{p.nome}</Text>
                            <View style={{ flexDirection: 'row', gap: 6 }}>
                              {p.estoque > 0 && (
                                <View style={[s.pill, { backgroundColor: '#E4F1E9' }]}>
                                  <Text style={[s.pillTexto, { color: '#2F7D55' }]}>✓ {p.estoque} prontos</Text>
                                </View>
                              )}
                              {(freezer[p.id] ?? 0) > 0 && (
                                <View style={[s.pill, { backgroundColor: '#ECEBFA' }]}>
                                  <Text style={[s.pillTexto, { color: '#3A3D9E' }]}>❄ {freezer[p.id]} massas</Text>
                                </View>
                              )}
                            </View>
                          </View>
                          <Feather name="chevron-right" size={16} color="#9A8F87" />
                        </TouchableOpacity>
                      );
                    })
                  )}
                </ScrollView>
              </View>
            )}

            {produto && (
              <>
                <View style={s.bloco}>
                  <Text style={s.label}>SAI DE ONDE?</Text>
                  <View style={s.toggle}>
                    {([
                      { id: 'vitrine', label: `🧁 Vitrine · ${naVitrine} un` },
                      { id: 'freezer', label: `🧊 Freezer · ${noFreezer} un` },
                    ] as const).map((o) => {
                      const ativo = origem === o.id;
                      return (
                        <TouchableOpacity
                          key={o.id}
                          style={[s.toggleBtn, ativo && s.toggleBtnAtivo, (o.id === 'vitrine' ? naVitrine : noFreezer) <= 0 && { opacity: 0.4 }]}
                          disabled={(o.id === 'vitrine' ? naVitrine : noFreezer) <= 0}
                          onPress={() => {
                            setOrigem(o.id);
                            setErro(null);
                          }}>
                          <Text style={[s.toggleText, ativo && s.toggleTextAtivo]}>{o.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={s.bloco}>
                  <Text style={s.label}>QUANTIDADE</Text>
                  <View style={s.linha}>
                    <TouchableOpacity style={s.stepBtn} onPress={() => setQtd(quantidade - 1 > 0 ? String(quantidade - 1) : '')}>
                      <Feather name="minus" size={14} color="#3D312A" />
                    </TouchableOpacity>
                    <TextInput style={[s.input, s.qtdInput]} keyboardType="numeric" placeholder="0" placeholderTextColor="#9A8F87" value={qtd} onChangeText={(t) => setQtd(t.replace(/\D/g, ''))} />
                    <TouchableOpacity style={s.stepBtn} onPress={() => setQtd(String(Math.min(disponivel, quantidade + 1)))}>
                      <Feather name="plus" size={14} color="#3D312A" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setQtd(String(disponivel))}>
                      <Text style={s.link}>Tudo ({disponivel})</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={s.bloco}>
                  <Text style={s.label}>MOTIVO</Text>
                  <View style={s.chips}>
                    {MOTIVOS_DESCARTE.map((m) => {
                      const ativo = motivo === m;
                      return (
                        <TouchableOpacity key={m} style={[s.chip, ativo && s.chipAtivo]} onPress={() => { setMotivo(m); setErro(null); }}>
                          <Text style={[s.chipText, ativo && s.chipTextAtivo]}>{EMOJI_MOTIVO[m]} {m}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                <View style={s.bloco}>
                  <Text style={s.label}>OBSERVAÇÃO (OPCIONAL)</Text>
                  <TextInput style={s.input} placeholder="Ex.: doado para a feira do bairro" placeholderTextColor="#9A8F87" value={obs} onChangeText={setObs} />
                </View>

                <View style={s.resumo}>
                  <Text style={s.resumoLabel}>Perda de material</Text>
                  <Text style={s.resumoVal}>{money(custoUnit * quantidade)}</Text>
                  <Text style={s.resumoHint}>
                    {!origem ? 'Escolha de onde sai para calcular' : `${money(custoUnit)}/un · ${origem === 'freezer' ? 'ingredientes da massa' : 'ingredientes + embalagem'} · entra em Perdas e desconta do lucro`}
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          <View style={s.footer}>
            <TouchableOpacity style={s.btnSec} onPress={onClose}>
              <Text style={s.btnSecText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnPri, !produto && { opacity: 0.5 }]} onPress={confirmar} disabled={!produto}>
              <Feather name="trash-2" size={13} color="#FFFDFA" />
              <Text style={s.btnPriText}>Descartar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = paraCelular(StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(43, 36, 33, 0.55)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  box: { width: '100%', maxWidth: 460, maxHeight: '92%', backgroundColor: '#FFFDFA', borderRadius: 18, padding: 18, borderWidth: 1, borderColor: '#E8E0D6' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F3EEE7' },
  headerIcon: { width: 32, height: 32, borderRadius: 9, backgroundColor: DANGER_TINT, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: '800', color: '#2E211A' },
  subtitle: { fontFamily: FONT_SANS, fontSize: 11, color: '#6B615A', marginTop: 1 },
  erro: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: DANGER_TINT, borderRadius: 8, padding: 8, marginBottom: 10 },
  erroText: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '600', color: DANGER },
  bloco: { marginBottom: 12 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontFamily: FONT_SANS, fontSize: 10, fontWeight: '700', color: '#4A3E37', letterSpacing: 0.4, marginBottom: 6 },
  hint: { fontFamily: FONT_SANS, fontSize: 12, color: '#9A8F87', paddingVertical: 6 },
  input: { fontFamily: FONT_SANS, fontSize: 13, color: '#2E211A', backgroundColor: '#F8F6F2', borderWidth: 1, borderColor: '#E8E0D6', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
  lista: { marginTop: 8, maxHeight: 320 },
  escolhido: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F8F6F2', borderWidth: 1, borderColor: '#E8E0D6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 },
  escolhidoNome: { fontFamily: FONT_SANS, fontSize: 13, fontWeight: '700', color: '#2E211A' },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#E8E0D6', backgroundColor: '#FFFDFA' },
  opcaoAtiva: { borderColor: '#B42318', backgroundColor: '#FBE7E4' },
  opcaoNome: { fontFamily: FONT_SANS, fontSize: 13, fontWeight: '700', color: '#2E211A' },
  emoji: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F8F6F2', alignItems: 'center', justifyContent: 'center' },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  pillTexto: { fontFamily: FONT_SANS, fontSize: 10, fontWeight: '800' },
  opcaoQtd: { fontFamily: FONT_SANS, fontSize: 10, color: '#6B615A' },
  toggle: { flexDirection: 'row', backgroundColor: '#F3EEE7', borderRadius: 8, padding: 2 },
  toggleBtn: { flex: 1, alignItems: 'center', paddingVertical: 6, borderRadius: 6 },
  toggleBtnAtivo: { backgroundColor: '#FFFDFA' },
  toggleText: { fontFamily: FONT_SANS, fontSize: 11, fontWeight: '600', color: '#6B615A' },
  toggleTextAtivo: { color: '#2E211A', fontWeight: '700' },
  stepBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 1, borderColor: '#E8E0D6', alignItems: 'center', justifyContent: 'center' },
  qtdInput: { width: 60, textAlign: 'center' },
  link: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '700', color: '#4B4FC4' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: '#F3EEE7', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#E8E0D6' },
  chipAtivo: { backgroundColor: DANGER, borderColor: DANGER },
  chipText: { fontFamily: FONT_SANS, fontSize: 11, fontWeight: '600', color: '#4A3E37' },
  chipTextAtivo: { color: '#FFFDFA' },
  resumo: { backgroundColor: DANGER_TINT, borderRadius: 12, padding: 12 },
  resumoLabel: { fontFamily: FONT_SANS, fontSize: 10, fontWeight: '700', color: '#8A1C12' },
  resumoVal: { fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: '800', color: DANGER, marginVertical: 2 },
  resumoHint: { fontFamily: FONT_SANS, fontSize: 10, color: '#8A1C12' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingTop: 12, marginTop: 10, borderTopWidth: 1, borderTopColor: '#F3EEE7' },
  btnSec: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: '#E8E0D6' },
  btnSecText: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '700', color: '#3D312A' },
  btnPri: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, backgroundColor: DANGER },
  btnPriText: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '700', color: '#FFFDFA' },
}));

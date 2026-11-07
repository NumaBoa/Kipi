import { paraCelular } from '@/lib/responsivo';
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Modal, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  Revendedora,
  ProdutoEstoqueLoja,
  ItemEntrega,
  formatMoney,
  useRevenda,
  saboresComRevendedora,
  dataHojeBR,
  mascaraData,
  dataBRParaISO,
  NIVEL_IDEAL_POR_SABOR,
} from '@/lib/revenda';
import {
  estilosRevenda as s,
  FONT_DISPLAY,
  FONT_SANS,
  KIPI_BLUE_ACCENT,
  KIPI_BLUE_TINT,
  KIPI_FROST_BG,
  DANGER_RED,
} from './estilos';

interface Props {
  visible: boolean;
  revendedora: Revendedora | null;
  produtos: ProdutoEstoqueLoja[];
  onClose: () => void;
  onConfirmar: (itens: ItemEntrega[], observacoes: string | null, dataISO: string) => void;
  preencher?: Record<string, number> | null; // atalho do alerta: produtoId → quantidade sugerida
}

export default function EntregaProdutosModal({ visible, revendedora, produtos, onClose, onConfirmar, preencher }: Props) {
  const [quantidades, setQuantidades] = useState<Record<string, number>>({});
  const [busca, setBusca] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [data, setData] = useState(dataHojeBR());
  const [erro, setErro] = useState<string | null>(null);

  // Sugestão de reposição por sabor desta revendedora (completa até o nível ideal)
  const { entregas, vendas } = useRevenda();
  const sugestoes = useMemo(() => {
    const mapa: Record<string, number> = {};
    if (revendedora) {
      saboresComRevendedora(revendedora.id, entregas, vendas).forEach((sab) => {
        if (sab.sugestao > 0 && sab.produtoId) mapa[sab.produtoId] = sab.sugestao;
      });
    }
    return mapa;
  }, [revendedora, entregas, vendas]);

  // Nunca mais do que há no estoque da loja
  const limitarAoEstoque = (mapa: Record<string, number>) => {
    const limitado: Record<string, number> = {};
    Object.entries(mapa).forEach(([id, qtd]) => {
      const prod = produtos.find((p) => p.id === id);
      if (prod) limitado[id] = Math.max(0, Math.min(prod.estoque, qtd));
    });
    return limitado;
  };

  useEffect(() => {
    if (visible) {
      setQuantidades(preencher ? limitarAoEstoque(preencher) : {});
      setBusca('');
      setObservacoes('');
      setData(dataHojeBR());
      setErro(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, preencher]);

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return produtos.filter((p) => !termo || p.nome.toLowerCase().includes(termo));
  }, [produtos, busca]);

  const selecionados = produtos.filter((p) => (quantidades[p.id] || 0) > 0);
  const totalItens = selecionados.reduce((acc, p) => acc + quantidades[p.id], 0);
  const valorEmVenda = selecionados.reduce((acc, p) => acc + quantidades[p.id] * p.preco, 0);

  // Nunca permite entregar mais do que há no estoque da loja
  const definirQuantidade = (produto: ProdutoEstoqueLoja, qtd: number) => {
    const limitada = Math.max(0, Math.min(produto.estoque, Math.floor(qtd) || 0));
    setQuantidades((prev) => ({ ...prev, [produto.id]: limitada }));
  };

  const handleConfirmar = () => {
    if (selecionados.length === 0) return;
    const dataISO = dataBRParaISO(data);
    if (!dataISO) {
      setErro('Informe uma data válida no formato DD/MM/AAAA.');
      return;
    }
    onConfirmar(
      selecionados.map((p) => ({ produtoId: p.id, nome: p.nome, quantidade: quantidades[p.id] })),
      observacoes.trim() || null,
      dataISO
    );
  };

  if (!revendedora) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.modalOverlay}>
        <View style={[s.modalBox, { maxWidth: 640 }]}>
          <View style={s.modalHeader}>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="arrow-left" size={18} color="#6B615A" />
            </TouchableOpacity>
            <View style={s.modalHeaderIcon}>
              <Feather name="truck" size={18} color={KIPI_BLUE_ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.modalTitle}>Entregar produtos</Text>
              <Text style={s.modalSubtitle} numberOfLines={1}>
                Para {revendedora.nome} • sai do estoque da loja
              </Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={20} color="#6B615A" />
            </TouchableOpacity>
          </View>

          <ScrollView style={s.modalScroll} contentContainerStyle={s.modalScrollContent}>
            {erro && <Text style={[s.listSub, { color: DANGER_RED, marginBottom: 8 }]}>{erro}</Text>}
            {Object.keys(sugestoes).length > 0 && (
              <TouchableOpacity style={styles.btnSugerido} onPress={() => setQuantidades(limitarAoEstoque(sugestoes))}>
                <Feather name="zap" size={13} color={KIPI_BLUE_ACCENT} />
                <Text style={styles.btnSugeridoText}>
                  Repor sugerido ({Object.keys(sugestoes).length} {Object.keys(sugestoes).length === 1 ? 'sabor' : 'sabores'} até {NIVEL_IDEAL_POR_SABOR} un)
                </Text>
              </TouchableOpacity>
            )}
            <View style={styles.searchBox}>
              <Feather name="search" size={15} color="#9A8F87" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar produto..."
                placeholderTextColor="#9A8F87"
                value={busca}
                onChangeText={setBusca}
              />
            </View>

            <View style={[s.listCard, { marginTop: 12 }]}>
              {produtosFiltrados.length === 0 ? (
                <Text style={s.emptyText}>Nenhum produto encontrado.</Text>
              ) : (
                produtosFiltrados.map((p, idx) => {
                  const qtd = quantidades[p.id] || 0;
                  const semEstoque = p.estoque <= 0;
                  return (
                    <View
                      key={p.id}
                      style={[s.listRow, idx % 2 === 0 && s.listRowEven, qtd > 0 && styles.rowSelected, semEstoque && { opacity: 0.5 }]}>
                      <View style={styles.prodAvatar}>
                        <Text style={{ fontSize: 18 }}>{p.emoji}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.listMain} numberOfLines={1}>{p.nome}</Text>
                        <Text style={[s.listSub, semEstoque && { color: DANGER_RED }]}>
                          {semEstoque
                            ? 'Sem estoque na loja'
                            : `Estoque na loja: ${p.estoque - qtd} de ${p.estoque} un • ${formatMoney(p.preco)}`}
                        </Text>
                      </View>
                      <View style={styles.stepper}>
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          disabled={qtd === 0}
                          onPress={() => definirQuantidade(p, qtd - 1)}>
                          <Feather name="minus" size={14} color={qtd === 0 ? '#D9CFC4' : '#4A3E37'} />
                        </TouchableOpacity>
                        <TextInput
                          style={styles.stepperInput}
                          keyboardType="numeric"
                          editable={!semEstoque}
                          value={String(qtd)}
                          onChangeText={(t) => definirQuantidade(p, parseInt(t.replace(/\D/g, ''), 10))}
                          selectTextOnFocus
                        />
                        <TouchableOpacity
                          style={styles.stepperBtn}
                          disabled={qtd >= p.estoque}
                          onPress={() => definirQuantidade(p, qtd + 1)}>
                          <Feather name="plus" size={14} color={qtd >= p.estoque ? '#D9CFC4' : KIPI_BLUE_ACCENT} />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>

            <Text style={[s.inputLabel, { marginTop: 16 }]}>Data da entrega</Text>
            <TextInput
              style={s.formInput}
              placeholder="DD/MM/AAAA"
              placeholderTextColor="#9A8F87"
              keyboardType="numeric"
              value={data}
              onChangeText={(t) => setData(mascaraData(t))}
            />

            <Text style={[s.inputLabel, { marginTop: 12 }]}>Observação</Text>
            <TextInput
              style={[s.formInput, s.formTextarea]}
              placeholder="Ex: retirou no ateliê, entregue no condomínio..."
              placeholderTextColor="#9A8F87"
              multiline
              value={observacoes}
              onChangeText={setObservacoes}
            />
          </ScrollView>

          <View style={[s.modalFooter, { justifyContent: 'space-between' }]}>
            <View>
              <Text style={styles.footerTotal}>{totalItens} {totalItens === 1 ? 'produto' : 'produtos'}</Text>
              <Text style={s.listSub}>Valor de venda: {formatMoney(valorEmVenda)}</Text>
            </View>
            <TouchableOpacity
              style={[s.btnPrimary, selecionados.length === 0 && s.btnPrimaryDisabled]}
              disabled={selecionados.length === 0}
              onPress={handleConfirmar}>
              <Feather name="check" size={16} color="#FFFDFA" />
              <Text style={s.btnPrimaryText}>Confirmar entrega</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = paraCelular(StyleSheet.create({
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KIPI_FROST_BG,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONT_SANS,
    fontSize: 13,
    color: '#2E211A',
    ...Platform.select({ web: { outlineStyle: 'none' } as any }),
  },
  rowSelected: {
    backgroundColor: KIPI_BLUE_TINT,
  },
  prodAvatar: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: '#F3EEE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E8E0D6',
    borderRadius: 10,
    backgroundColor: '#FFFDFA',
  },
  stepperBtn: {
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  stepperInput: {
    width: 38,
    textAlign: 'center',
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '800',
    color: '#2E211A',
    paddingVertical: 6,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#E8E0D6',
    ...Platform.select({ web: { outlineStyle: 'none' } as any }),
  },
  btnSugerido: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: KIPI_BLUE_TINT,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  btnSugeridoText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: KIPI_BLUE_ACCENT,
  },
  footerTotal: {
    fontFamily: FONT_DISPLAY,
    fontSize: 15,
    fontWeight: '800',
    color: '#2E211A',
  },
}));

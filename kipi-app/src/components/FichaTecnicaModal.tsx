import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, StyleSheet, Platform, Modal, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  useInsumos,
  useFichas,
  fichaDoProduto,
  salvarFicha,
  excluirFicha,
  calcularFicha,
  margemReal,
  MARGEM_MINIMA,
  type FichaTecnica,
  type ModoLucro,
} from '@/lib/insumos';
import { useEstoqueVitrine, definirPrecoProduto, produtoAtivo, cadastrarProduto, produtoPorNome, type ProdutoVitrine } from '@/lib/estoqueVitrine';

// ============================================================================
// EDITOR DA FICHA TÉCNICA — o mesmo em Insumos & Receitas e no dossiê de Produtos.
// Custo atualiza a vitrine sozinho; o preço só muda em "Salvar e aplicar preço".
// ============================================================================
const FONT_DISPLAY = Platform.select({ web: '"Sora", ui-sans-serif, system-ui, sans-serif', default: 'System' });
const FONT_SANS = Platform.select({ web: '"Manrope", ui-sans-serif, system-ui, sans-serif', default: 'System' });
const KIPI_BLUE = '#5798D7';
const KIPI_BLUE_ACCENT = '#2563EB';
const KIPI_BLUE_TINT = '#EAF3FA';

const num = (s: string) => parseFloat(s.replace(',', '.')) || 0;
const money = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface Props {
  visible: boolean;
  produtoId: string | null; // null = nova ficha (escolhe o produto)
  onClose: () => void;
}

export default function FichaTecnicaModal({ visible, produtoId, onClose }: Props) {
  const insumos = useInsumos();
  const { fichas, horaTrabalhada } = useFichas();
  const vitrine = useEstoqueVitrine();

  const [produtoEscolhido, setProdutoEscolhido] = useState<string | null>(null);
  const [rendimento, setRendimento] = useState('12');
  const [tempo, setTempo] = useState('45');
  const [itens, setItens] = useState<{ insumoId: string; qtd: string }[]>([]);
  const [extras, setExtras] = useState<{ id: string; descricao: string; valor: string }[]>([]);
  const [modoLucro, setModoLucro] = useState<ModoLucro>('porcentagem');
  const [lucro, setLucro] = useState('200');
  const [busca, setBusca] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [buscaProduto, setBuscaProduto] = useState('');
  // Passo 1 da receita nova: produto que já existe ou produto criado aqui mesmo
  const [modoProduto, setModoProduto] = useState<'existente' | 'novo'>('existente');
  const [novoNome, setNovoNome] = useState('');
  const [novaCategoria, setNovaCategoria] = useState('');
  const [novaDisp, setNovaDisp] = useState<NonNullable<ProdutoVitrine['disponibilidade']>>('pronta_entrega');
  const [novoMinimo, setNovoMinimo] = useState('5');
  const { width } = useWindowDimensions();
  const largo = width >= 900; // resumo fica ao lado do formulário

  // Carrega a ficha existente (ou rascunho vazio) sempre que o modal abre
  useEffect(() => {
    if (!visible) return;
    const f = produtoId ? fichaDoProduto(produtoId) : undefined;
    setProdutoEscolhido(produtoId);
    setRendimento(String(f?.rendimento ?? 12));
    setTempo(String(f?.tempoPreparoMinutos ?? 45));
    setItens(f?.itens.map((it) => ({ insumoId: it.insumoId, qtd: String(it.quantidade) })) ?? []);
    setExtras(f?.custosExtras.map((c) => ({ id: c.id, descricao: c.descricao, valor: String(c.valor) })) ?? [{ id: `extra-${Date.now()}`, descricao: 'Gás / energia', valor: '3' }]);
    setModoLucro(f?.modoLucro ?? 'porcentagem');
    setLucro(String(f?.lucroDesejado ?? 200));
    setBusca('');
    setBuscaProduto('');
    setNovoNome('');
    setNovaCategoria('');
    setNovaDisp('pronta_entrega');
    setNovoMinimo('5');
    // Sem produto livre para receita: já abre em "criar produto novo"
    setModoProduto(vitrine.some((p) => produtoAtivo(p) && !fichas.some((x) => x.produtoId === p.id)) ? 'existente' : 'novo');
    setErro(null);
  }, [visible, produtoId]);

  const produto = vitrine.find((p) => p.id === produtoEscolhido);
  const existente = produtoId ? fichas.some((f) => f.produtoId === produtoId) : false;
  // Nova ficha: só produtos ativos que ainda não têm ficha
  const semFicha = vitrine.filter((p) => produtoAtivo(p) && !fichas.some((f) => f.produtoId === p.id));

  const rascunho: FichaTecnica = {
    produtoId: produtoEscolhido ?? '',
    rendimento: Math.max(1, num(rendimento)),
    tempoPreparoMinutos: num(tempo),
    itens: itens.map((it) => ({ insumoId: it.insumoId, quantidade: num(it.qtd) })),
    custosExtras: extras.map((c) => ({ id: c.id, descricao: c.descricao.trim() || 'Custo extra', valor: num(c.valor) })),
    modoLucro,
    lucroDesejado: num(lucro),
  };
  const calc = calcularFicha(rascunho, insumos, horaTrabalhada);
  const margemAtual = produto ? margemReal(produto.preco, calc.custoUnitario) : 0;
  const margemSugerida = margemReal(calc.precoSugerido, calc.custoUnitario);

  const opcoes = useMemo(() => {
    const q = busca.toLowerCase().trim();
    return insumos
      .filter((i) => i.status === 'ativo' && !itens.some((it) => it.insumoId === i.id))
      .filter((i) => !q || i.nome.toLowerCase().includes(q))
      .slice(0, 8);
  }, [insumos, itens, busca]);

  const criandoProduto = !produtoId && modoProduto === 'novo';

  const salvar = (aplicarPreco: boolean) => {
    if (criandoProduto) {
      // Atalho: cria o produto e a receita juntos (preço = sugerido; estoque começa em 0)
      const nome = novoNome.trim();
      if (!nome) return setErro('Dê um nome para o produto novo.');
      if (produtoPorNome(nome)) return setErro('Já existe um produto com esse nome.');
      if (!novaCategoria.trim()) return setErro('Escolha a categoria do produto.');
      if (!rascunho.itens.some((it) => it.quantidade > 0)) return setErro('Inclua ao menos um insumo com quantidade.');
      const id = `prod-${Date.now()}`;
      cadastrarProduto({
        id,
        nome,
        detalhe: novaCategoria.trim(),
        categoria: novaCategoria.trim(),
        preco: Number(calc.precoSugerido.toFixed(2)),
        custo: calc.custoUnitario,
        estoque: 0,
        estoqueMinimo: Math.max(0, parseInt(novoMinimo, 10) || 0),
        disponibilidade: novaDisp,
      });
      salvarFicha({ ...rascunho, produtoId: id, itens: rascunho.itens.filter((it) => it.quantidade > 0) });
      onClose();
      return;
    }
    if (!produtoEscolhido) return setErro('Escolha o produto desta ficha.');
    if (!rascunho.itens.some((it) => it.quantidade > 0)) return setErro('Inclua ao menos um insumo com quantidade.');
    salvarFicha({ ...rascunho, itens: rascunho.itens.filter((it) => it.quantidade > 0) });
    if (aplicarPreco) definirPrecoProduto(produtoEscolhido, Number(calc.precoSugerido.toFixed(2)));
    onClose();
  };

  // Composição do custo por unidade (barras do resumo)
  const rend = Math.max(1, num(rendimento));
  const partes = [
    { id: 'ing', rotulo: 'Ingredientes', valor: calc.ingredientes / rend, cor: '#5798D7' },
    { id: 'emb', rotulo: 'Embalagens', valor: calc.embalagens / rend, cor: '#A78BFA' },
    { id: 'mao', rotulo: 'Mão de obra', valor: calc.maoDeObra / rend, cor: '#F59E0B' },
    { id: 'ext', rotulo: 'Extras', valor: calc.extras / rend, cor: '#94A3B8' },
  ];
  const somaPartes = partes.reduce((a, p) => a + p.valor, 0) || 1;
  const produtosFiltrados = semFicha.filter((p) => !buscaProduto.trim() || p.nome.toLowerCase().includes(buscaProduto.trim().toLowerCase()));
  const categoriasExistentes = Array.from(new Set(vitrine.map((p) => p.categoria))).filter(Boolean);

  const resumo = (
    <View style={[s.resumo, largo && s.resumoLateral]}>
      <Text style={s.resumoTitulo}>Resumo por unidade</Text>
      <View style={s.resumoDestaques}>
        <View style={{ flex: 1 }}>
          <Text style={s.resumoMini}>CUSTO</Text>
          <Text style={s.resumoVal}>{money(calc.custoUnitario)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.resumoMini}>PREÇO SUGERIDO</Text>
          <Text style={[s.resumoVal, { color: '#16A34A' }]}>{money(calc.precoSugerido)}</Text>
          <Text style={s.resumoNota}>margem {Math.round(margemSugerida)}%</Text>
        </View>
      </View>

      {/* Barra da composição do custo */}
      <View style={s.barra}>
        {partes.map((p) =>
          p.valor > 0 ? <View key={p.id} style={{ flex: p.valor / somaPartes, backgroundColor: p.cor }} /> : null
        )}
      </View>
      <View style={{ gap: 5 }}>
        {partes.map((p) => (
          <View key={p.id} style={s.parteLinha}>
            <View style={[s.parteCor, { backgroundColor: p.cor }]} />
            <Text style={s.parteRotulo}>{p.rotulo}</Text>
            <Text style={s.parteValor}>{money(p.valor)}</Text>
          </View>
        ))}
      </View>

      {produto && !criandoProduto && (
        <View style={[s.precoAtual, margemAtual < MARGEM_MINIMA && s.precoAtualAlerta]}>
          <Text style={s.resumoMini}>PREÇO ATUAL NA VITRINE</Text>
          <View style={s.parteLinha}>
            <Text style={[s.resumoVal, { fontSize: 15, flex: 1 }]}>{money(produto.preco)}</Text>
            <Text style={[s.resumoNota, margemAtual < MARGEM_MINIMA && { color: '#DC2626', fontWeight: '800' }]}>
              {margemAtual < MARGEM_MINIMA ? '⚠ ' : ''}margem {Math.round(margemAtual)}%
            </Text>
          </View>
        </View>
      )}

      {calc.gargalo && (
        <Text style={s.resumoNota}>
          📦 O estoque dá para {calc.receitasPossiveis} receita(s) · falta primeiro: {calc.gargalo}
        </Text>
      )}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.overlay}>
        <View style={[s.box, largo && { maxWidth: 920 }]}>
          <View style={s.header}>
            <View style={s.headerIcone}>
              <Feather name="book-open" size={17} color={KIPI_BLUE_ACCENT} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>{criandoProduto ? (novoNome.trim() ? `Nova receita · ${novoNome.trim()}` : 'Novo produto + receita') : produto ? `Receita · ${produto.nome}` : 'Nova receita'}</Text>
              <Text style={s.subtitle}>
                Custo pelo custo médio atual dos insumos · hora trabalhada {money(horaTrabalhada)}/h
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="x" size={18} color="#64748B" />
            </TouchableOpacity>
          </View>

          {erro && (
            <View style={s.erro}>
              <Feather name="alert-circle" size={14} color="#DC2626" />
              <Text style={s.erroText}>{erro}</Text>
            </View>
          )}

          <View style={[s.corpo, largo && { flexDirection: 'row' }]}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 12 }} showsVerticalScrollIndicator={false}>
              {/* 1. PRODUTO (só na receita nova): um sem receita ou um novo, criado aqui mesmo */}
              {!produtoId && (
                <View style={s.secao}>
                  <View style={s.secaoTopo}>
                    <Text style={s.secaoNumero}>1</Text>
                    <Text style={s.secaoTitulo}>Para qual produto?</Text>
                  </View>

                  <View style={[s.toggle, { marginBottom: 12 }]}>
                    {([
                      { id: 'existente', label: `Produto sem receita (${semFicha.length})`, icon: 'list' },
                      { id: 'novo', label: 'Criar produto novo', icon: 'plus-circle' },
                    ] as const).map((m) => {
                      const ativo = modoProduto === m.id;
                      return (
                        <TouchableOpacity
                          key={m.id}
                          style={[s.toggleBtn, { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 6 }, ativo && s.toggleBtnAtivo]}
                          onPress={() => {
                            setModoProduto(m.id);
                            setErro(null);
                          }}>
                          <Feather name={m.icon} size={12} color={ativo ? KIPI_BLUE_ACCENT : '#64748B'} />
                          <Text style={[s.toggleText, ativo && s.toggleTextAtivo]}>{m.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {modoProduto === 'novo' ? (
                    <View style={{ gap: 10 }}>
                      <View>
                        <Text style={s.label}>NOME DO PRODUTO *</Text>
                        <TextInput
                          style={s.input}
                          value={novoNome}
                          onChangeText={setNovoNome}
                          placeholder="Ex: Cookie Pistache com Framboesa"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                      <View>
                        <Text style={s.label}>CATEGORIA *</Text>
                        <View style={s.chips}>
                          {categoriasExistentes.map((c) => {
                            const ativo = novaCategoria === c;
                            return (
                              <TouchableOpacity key={c} style={[s.chip, ativo && s.chipAtivo]} onPress={() => setNovaCategoria(c)}>
                                <Text style={[s.chipText, ativo && s.chipTextAtivo]}>{c}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                        <TextInput
                          style={[s.input, { marginTop: 6 }]}
                          value={categoriasExistentes.includes(novaCategoria) ? '' : novaCategoria}
                          onChangeText={setNovaCategoria}
                          placeholder="ou digite uma categoria nova"
                          placeholderTextColor="#94A3B8"
                        />
                      </View>
                      <View style={s.linha}>
                        <View style={{ flex: 2 }}>
                          <Text style={s.label}>COMO VENDE</Text>
                          <View style={s.toggle}>
                            {([
                              { id: 'pronta_entrega', label: 'Pronta entrega' },
                              { id: 'sob_encomenda', label: 'Encomenda' },
                              { id: 'hibrido', label: 'Os dois' },
                            ] as const).map((d) => (
                              <TouchableOpacity
                                key={d.id}
                                style={[s.toggleBtn, { flex: 1, alignItems: 'center' }, novaDisp === d.id && s.toggleBtnAtivo]}
                                onPress={() => setNovaDisp(d.id)}>
                                <Text style={[s.toggleText, novaDisp === d.id && s.toggleTextAtivo]}>{d.label}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={s.label}>ESTOQUE MÍNIMO</Text>
                          <View style={s.campoSufixo}>
                            <TextInput
                              style={[s.campoInput, { flex: 1 }]}
                              value={novoMinimo}
                              onChangeText={(t) => setNovoMinimo(t.replace(/\D/g, ''))}
                              keyboardType="numeric"
                            />
                            <Text style={s.sufixo}>un</Text>
                          </View>
                        </View>
                      </View>
                      <Text style={s.dica}>
                        O produto entra na vitrine com estoque 0 e preço = sugerido pela receita. Foto, promoção e demais detalhes você ajusta depois em Produtos.
                      </Text>
                    </View>
                  ) : semFicha.length === 0 ? (
                    <View style={s.vazio}>
                      <Text style={s.hint}>Todos os produtos ativos já têm receita.</Text>
                      <TouchableOpacity onPress={() => setModoProduto('novo')}>
                        <Text style={s.link}>+ Criar produto novo aqui</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      {semFicha.length > 6 && (
                        <View style={s.busca}>
                          <Feather name="search" size={13} color="#94A3B8" />
                          <TextInput
                            style={s.buscaInput}
                            value={buscaProduto}
                            onChangeText={setBuscaProduto}
                            placeholder="Buscar produto sem receita..."
                            placeholderTextColor="#94A3B8"
                          />
                        </View>
                      )}
                      <View style={s.chips}>
                        {produtosFiltrados.map((p) => {
                          const ativo = produtoEscolhido === p.id;
                          return (
                            <TouchableOpacity key={p.id} style={[s.chip, ativo && s.chipAtivo]} onPress={() => setProdutoEscolhido(p.id)}>
                              {ativo && <Feather name="check" size={12} color="#FFFFFF" />}
                              <Text style={[s.chipText, ativo && s.chipTextAtivo]}>{p.nome}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <Text style={s.dica}>Só aparecem produtos ativos que ainda não têm receita.</Text>
                    </>
                  )}
                </View>
              )}

              {/* 2. RENDIMENTO E TEMPO */}
              <View style={s.secao}>
                <View style={s.secaoTopo}>
                  <Text style={s.secaoNumero}>{produtoId ? 1 : 2}</Text>
                  <Text style={s.secaoTitulo}>Rendimento e tempo</Text>
                </View>
                <View style={s.linha}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>RENDE</Text>
                    <View style={s.campoSufixo}>
                      <TextInput style={s.campoInput} value={rendimento} onChangeText={setRendimento} keyboardType="numeric" />
                      <Text style={s.sufixo}>un por receita</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.label}>PREPARO</Text>
                    <View style={s.campoSufixo}>
                      <TextInput style={s.campoInput} value={tempo} onChangeText={setTempo} keyboardType="numeric" />
                      <Text style={s.sufixo}>min</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* 3. INSUMOS */}
              <View style={s.secao}>
                <View style={s.secaoTopo}>
                  <Text style={s.secaoNumero}>{produtoId ? 2 : 3}</Text>
                  <Text style={s.secaoTitulo}>Insumos da receita</Text>
                  <Text style={s.secaoExtra}>{money(calc.ingredientes + calc.embalagens)} / receita</Text>
                </View>
                {itens.length === 0 && <Text style={s.hint}>Nenhum insumo ainda. Busque abaixo para incluir.</Text>}
                <View style={{ gap: 6 }}>
                  {itens.map((it, idx) => {
                    const item = insumos.find((i) => i.id === it.insumoId);
                    if (!item) return null;
                    return (
                      <View key={it.insumoId} style={s.itemRow}>
                        <View style={s.itemEmoji}>
                          <Text style={{ fontSize: 14 }}>{item.emoji}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={s.itemNome} numberOfLines={1}>{item.nome}</Text>
                          <Text style={s.itemSub}>{money(item.custoUnitario)}/{item.unidadeFracionada}</Text>
                        </View>
                        <View style={s.campoSufixo}>
                          <TextInput
                            style={[s.campoInput, { width: 56, textAlign: 'right' }]}
                            value={it.qtd}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#CBD5E1"
                            onChangeText={(v) => setItens((prev) => prev.map((p, i) => (i === idx ? { ...p, qtd: v } : p)))}
                          />
                          <Text style={s.sufixo}>{item.unidadeFracionada}</Text>
                        </View>
                        <Text style={s.itemCusto}>{money(num(it.qtd) * item.custoUnitario)}</Text>
                        <TouchableOpacity style={s.iconeBtn} onPress={() => setItens((prev) => prev.filter((_, i) => i !== idx))}>
                          <Feather name="trash-2" size={13} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
                <View style={[s.busca, { marginTop: 10 }]}>
                  <Feather name="search" size={13} color="#94A3B8" />
                  <TextInput
                    style={s.buscaInput}
                    value={busca}
                    onChangeText={setBusca}
                    placeholder="Buscar insumo para incluir..."
                    placeholderTextColor="#94A3B8"
                  />
                </View>
                <View style={[s.chips, { marginTop: 8 }]}>
                  {opcoes.map((i) => (
                    <TouchableOpacity key={i.id} style={s.chipAdd} onPress={() => setItens((prev) => [...prev, { insumoId: i.id, qtd: '' }])}>
                      <Feather name="plus" size={11} color={KIPI_BLUE_ACCENT} />
                      <Text style={s.chipAddText}>{i.emoji} {i.nome}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* 4. CUSTOS EXTRAS */}
              <View style={s.secao}>
                <View style={s.secaoTopo}>
                  <Text style={s.secaoNumero}>{produtoId ? 3 : 4}</Text>
                  <Text style={s.secaoTitulo}>Custos extras por receita</Text>
                  <Text style={s.secaoExtra}>gás, energia...</Text>
                </View>
                <View style={{ gap: 6 }}>
                  {extras.map((c, idx) => (
                    <View key={c.id} style={s.linha}>
                      <TextInput
                        style={[s.input, { flex: 1 }]}
                        value={c.descricao}
                        placeholder="Descrição"
                        placeholderTextColor="#94A3B8"
                        onChangeText={(v) => setExtras((prev) => prev.map((p, i) => (i === idx ? { ...p, descricao: v } : p)))}
                      />
                      <View style={s.campoSufixo}>
                        <Text style={s.sufixo}>R$</Text>
                        <TextInput
                          style={[s.campoInput, { width: 60, textAlign: 'right' }]}
                          value={c.valor}
                          keyboardType="numeric"
                          placeholder="0"
                          placeholderTextColor="#CBD5E1"
                          onChangeText={(v) => setExtras((prev) => prev.map((p, i) => (i === idx ? { ...p, valor: v } : p)))}
                        />
                      </View>
                      <TouchableOpacity style={s.iconeBtn} onPress={() => setExtras((prev) => prev.filter((_, i) => i !== idx))}>
                        <Feather name="trash-2" size={13} color="#DC2626" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                <TouchableOpacity onPress={() => setExtras((prev) => [...prev, { id: `extra-${Date.now()}`, descricao: '', valor: '' }])}>
                  <Text style={s.link}>+ custo extra</Text>
                </TouchableOpacity>
              </View>

              {/* 5. LUCRO */}
              <View style={s.secao}>
                <View style={s.secaoTopo}>
                  <Text style={s.secaoNumero}>{produtoId ? 4 : 5}</Text>
                  <Text style={s.secaoTitulo}>Lucro desejado</Text>
                </View>
                <View style={s.linha}>
                  <View style={s.toggle}>
                    {(['porcentagem', 'reais'] as const).map((m) => (
                      <TouchableOpacity key={m} style={[s.toggleBtn, modoLucro === m && s.toggleBtnAtivo]} onPress={() => setModoLucro(m)}>
                        <Text style={[s.toggleText, modoLucro === m && s.toggleTextAtivo]}>{m === 'porcentagem' ? '% sobre o custo' : 'R$ por unidade'}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <View style={[s.campoSufixo, { flex: 1 }]}>
                    {modoLucro === 'reais' && <Text style={s.sufixo}>R$</Text>}
                    <TextInput style={[s.campoInput, { flex: 1 }]} value={lucro} onChangeText={setLucro} keyboardType="numeric" />
                    {modoLucro === 'porcentagem' && <Text style={s.sufixo}>%</Text>}
                  </View>
                </View>
              </View>

              {!largo && resumo}
            </ScrollView>

            {largo && resumo}
          </View>

          <View style={s.footer}>
            {existente && produtoId && (
              <TouchableOpacity
                style={{ marginRight: 'auto' }}
                onPress={() => {
                  excluirFicha(produtoId);
                  onClose();
                }}>
                <Text style={[s.link, { color: '#DC2626', marginTop: 0 }]}>Excluir receita</Text>
              </TouchableOpacity>
            )}
            {criandoProduto ? (
              <TouchableOpacity style={s.btnPri} onPress={() => salvar(true)}>
                <Feather name="check" size={14} color="#FFFFFF" />
                <Text style={s.btnPriText}>Criar produto e receita · {money(calc.precoSugerido)}</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity style={s.btnSec} onPress={() => salvar(false)}>
                  <Text style={s.btnSecText}>Salvar receita</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnPri} onPress={() => salvar(true)}>
                  <Feather name="check" size={14} color="#FFFFFF" />
                  <Text style={s.btnPriText}>Salvar e aplicar {money(calc.precoSugerido)}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.55)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  box: { width: '100%', maxWidth: 620, maxHeight: '92%', backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, borderWidth: 1, borderColor: '#E2E8F0', ...Platform.select({ web: { boxShadow: '0 20px 50px rgba(15,23,42,0.18)' } }) },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 12, marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerIcone: { width: 36, height: 36, borderRadius: 10, backgroundColor: KIPI_BLUE_TINT, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontFamily: FONT_SANS, fontSize: 11, color: '#64748B', marginTop: 2 },
  erro: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FEF2F2', borderRadius: 8, padding: 8, marginBottom: 10 },
  erroText: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '600', color: '#DC2626' },
  corpo: { flexShrink: 1, gap: 16 },
  secao: { backgroundColor: '#F8FAFC', borderRadius: 14, borderWidth: 1, borderColor: '#EEF2F6', padding: 14 },
  secaoTopo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  secaoNumero: { width: 20, height: 20, borderRadius: 10, backgroundColor: KIPI_BLUE, color: '#FFFFFF', textAlign: 'center', lineHeight: 20, fontFamily: FONT_DISPLAY, fontSize: 11, fontWeight: '800', overflow: 'hidden' },
  secaoTitulo: { flex: 1, fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: '800', color: '#0F172A' },
  secaoExtra: { fontFamily: FONT_SANS, fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontFamily: FONT_SANS, fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.4, marginBottom: 5 },
  hint: { fontFamily: FONT_SANS, fontSize: 12, color: '#94A3B8' },
  dica: { fontFamily: FONT_SANS, fontSize: 11, color: '#94A3B8', marginTop: 8 },
  vazio: { gap: 2 },
  input: { fontFamily: FONT_SANS, fontSize: 13, color: '#0F172A', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  campoSufixo: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 10 },
  campoInput: { minWidth: 0, fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: '700', color: '#0F172A', paddingVertical: 7, ...Platform.select({ web: { outlineStyle: 'none' } as any }) },
  sufixo: { fontFamily: FONT_SANS, fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  busca: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 10, marginBottom: 8 },
  buscaInput: { flex: 1, minWidth: 0, fontFamily: FONT_SANS, fontSize: 13, color: '#0F172A', paddingVertical: 8, ...Platform.select({ web: { outlineStyle: 'none' } as any }) },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, borderWidth: 1, borderColor: '#E2E8F0' },
  chipAtivo: { backgroundColor: KIPI_BLUE, borderColor: KIPI_BLUE },
  chipText: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '600', color: '#475569' },
  chipTextAtivo: { color: '#FFFFFF', fontWeight: '800' },
  chipAdd: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: KIPI_BLUE_TINT, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipAddText: { fontFamily: FONT_SANS, fontSize: 11, fontWeight: '700', color: '#1E40AF' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 10, borderWidth: 1, borderColor: '#EEF2F6', paddingHorizontal: 10, paddingVertical: 7 },
  itemEmoji: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  itemNome: { fontFamily: FONT_SANS, fontSize: 12.5, fontWeight: '700', color: '#0F172A' },
  itemSub: { fontFamily: FONT_SANS, fontSize: 10.5, color: '#94A3B8', marginTop: 1 },
  itemCusto: { width: 72, fontFamily: FONT_DISPLAY, fontSize: 12.5, fontWeight: '800', color: '#334155', textAlign: 'right' },
  iconeBtn: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2' },
  link: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '700', color: KIPI_BLUE_ACCENT, marginTop: 8 },
  toggle: { flexDirection: 'row', backgroundColor: '#EEF2F6', borderRadius: 10, padding: 3 },
  toggleBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  toggleBtnAtivo: { backgroundColor: '#FFFFFF', ...Platform.select({ web: { boxShadow: '0 1px 3px rgba(15,23,42,0.1)' } }) },
  toggleText: { fontFamily: FONT_SANS, fontSize: 11, fontWeight: '600', color: '#64748B' },
  toggleTextAtivo: { color: KIPI_BLUE_ACCENT, fontWeight: '800' },
  resumo: { backgroundColor: KIPI_BLUE_TINT, borderRadius: 14, padding: 14, gap: 10 },
  resumoLateral: { width: 280, alignSelf: 'flex-start' },
  resumoTitulo: { fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: '800', color: '#0F172A' },
  resumoDestaques: { flexDirection: 'row', gap: 10 },
  resumoMini: { fontFamily: FONT_SANS, fontSize: 9, fontWeight: '800', color: '#64748B', letterSpacing: 0.4 },
  resumoVal: { fontFamily: FONT_DISPLAY, fontSize: 19, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  resumoNota: { fontFamily: FONT_SANS, fontSize: 11, color: '#475569' },
  barra: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#FFFFFF', gap: 2 },
  parteLinha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  parteCor: { width: 8, height: 8, borderRadius: 2 },
  parteRotulo: { flex: 1, fontFamily: FONT_SANS, fontSize: 11.5, color: '#475569' },
  parteValor: { fontFamily: FONT_DISPLAY, fontSize: 12, fontWeight: '700', color: '#0F172A' },
  precoAtual: { backgroundColor: '#FFFFFF', borderRadius: 10, padding: 10, gap: 2 },
  precoAtualAlerta: { borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 10, paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  btnSec: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  btnSecText: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '700', color: '#334155' },
  btnPri: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 10, backgroundColor: KIPI_BLUE },
  btnPriText: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
});

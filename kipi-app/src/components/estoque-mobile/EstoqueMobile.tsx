import React, { useMemo, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { aceitaEncomenda, adicionarAoEstoque, produtoAtivo, removerDoEstoque, retirarDoFreezer, useEstoqueFreezer, useEstoqueVitrine } from '@/lib/estoqueVitrine';
import {
  ajustarEstoqueInsumo,
  capacidadeDoInsumo,
  congelarMassas,
  custoPorUnidadeEstoque,
  excluirInsumo,
  ROTULO_ARMAZENAMENTO,
  useInsumos,
  type Insumo,
} from '@/lib/insumos';
import { registrarProducao, useHistoricoProducao } from '@/lib/historicoProducao';
import { custoDoDescarte, EMOJI_MOTIVO, resumoDePerdas, ultimosDias } from '@/lib/descarte';
import TabBar from '@/components/mobile/TabBar';
import { brl, cor, fonte, numeros, sombra } from '@/components/mobile/tema';
import { Aviso, Botao, Gaveta, Opcao, T, useAviso } from '@/components/mobile/ui';
import { FOTOS } from '@/components/produtos-mobile/ProdutosMobile';
import InsumoFormMobile from '@/components/insumos-mobile/InsumoFormMobile';

// ============================================================================
// ESTOQUE CENTRAL NO CELULAR: produtos (vitrine e freezer), materiais e compras.
// Mesmas regras da versão de computador: ajustes entram no histórico da Produção,
// entrada de material com valor pago recalcula o custo médio.
// ============================================================================

const AZUL_FREEZER = '#3A3D9E';
const LARANJA_ESCURO = '#9A6516';
type Aba = 'produtos' | 'materiais' | 'compras';
type Ajuste = { tipo: 'vitrine' | 'freezer' | 'material'; id: string; nome: string };
type Linha = { nome: string; valor: string; alerta?: boolean };

// Mínimo do freezer por produto (o mesmo da versão de computador)
const MINIMO_FREEZER: Record<string, number> = { 'prod-1': 12, 'prod-2': 12, 'prod-4': 6, 'prod-11': 10, 'prod-12': 10 };
const EMOJI_CATEGORIA: Record<string, string> = {
  Cookies: '🍪', 'Bolos & Bentos': '🎂', Macarons: '✨', Sobremesas: '🥧', 'Doces Finos': '🍬', Presentes: '🎁', Folhados: '🥐', Bebidas: '☕',
};
const ROTULO_TIPO: Record<string, string> = { ingrediente: 'Ingrediente', embalagem: 'Embalagem', outro: 'Outro' };
const fmtQtd = (n: number) => Number(n.toFixed(2)).toLocaleString('pt-BR');
const fmtCusto = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: v < 1 ? 3 : 2 });
const lerNum = (t: string) => parseFloat(t.replace(/\./g, '').replace(',', '.')) || 0;
const lerQtd = (t: string) => parseFloat(t.replace(',', '.')) || 0;
const campoWeb = Platform.select({ web: { outlineStyle: 'none' } as object, default: {} });

export default function EstoqueMobile() {
  const insets = useSafeAreaInsets();
  const { msg, avisar } = useAviso();
  const vitrine = useEstoqueVitrine();
  const freezer = useEstoqueFreezer();
  const insumos = useInsumos();
  const historico = useHistoricoProducao();

  const [aba, setAba] = useState<Aba>('produtos');
  const [buscaProd, setBuscaProd] = useState('');
  const [categoria, setCategoria] = useState('Todas');
  const [buscaMat, setBuscaMat] = useState('');
  const [tipoMat, setTipoMat] = useState<'ingrediente' | 'outros'>('ingrediente');
  const [gaveta, setGaveta] = useState<null | 'categorias' | 'produto' | 'material' | 'ajuste' | 'kpi'>(null);
  const [produtoId, setProdutoId] = useState<string | null>(null);
  const [materialId, setMaterialId] = useState<string | null>(null);
  const [ajuste, setAjuste] = useState<Ajuste | null>(null);
  const [ajQtd, setAjQtd] = useState('1');
  const [ajValor, setAjValor] = useState('');
  const [kpi, setKpi] = useState<{ titulo: string; explicacao: string; linhas: Linha[] } | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [form, setForm] = useState<{ aberto: boolean; id: string | null }>({ aberto: false, id: null });

  // PRODUTOS
  const produtos = useMemo(
    () =>
      vitrine.filter(produtoAtivo).map((v) => ({
        id: v.id,
        nome: v.nome,
        categoria: v.categoria,
        emoji: FOTOS[v.id] ?? EMOJI_CATEGORIA[v.categoria] ?? '🧁',
        preco: v.preco,
        custo: v.custo,
        prontas: v.estoque,
        congelados: freezer[v.id] ?? 0,
        minProntas: v.estoqueMinimo,
        minFreezer: MINIMO_FREEZER[v.id] ?? 0,
      })),
    [vitrine, freezer]
  );
  const categorias = ['Todas', ...Array.from(new Set(produtos.map((p) => p.categoria)))];
  const produtosFiltrados = produtos.filter((p) => {
    const q = buscaProd.trim().toLowerCase();
    return (categoria === 'Todas' || p.categoria === categoria) && (!q || p.nome.toLowerCase().includes(q) || p.categoria.toLowerCase().includes(q));
  });
  const totalProntas = produtos.reduce((a, p) => a + p.prontas, 0);
  const totalFreezer = produtos.reduce((a, p) => a + p.congelados, 0);
  const valorVitrine = produtos.reduce((a, p) => a + p.prontas * p.preco, 0);
  const valorFreezer = produtos.reduce((a, p) => a + p.congelados * p.preco, 0);
  const encomenda = vitrine.filter((v) => produtoAtivo(v) && aceitaEncomenda(v));
  const perdas = resumoDePerdas(historico, ultimosDias(30));

  // MATERIAIS (lista única de insumos)
  const nomeProduto = (id: string) => vitrine.find((v) => v.id === id)?.nome ?? id;
  const ingredientes = insumos.filter((i) => i.tipo === 'ingrediente');
  const outros = insumos.filter((i) => i.tipo !== 'ingrediente');
  const baixo = (i: Insumo) => i.quantidadeEstoque <= i.estoqueMinimo;
  const valorGuardado = insumos.reduce((a, i) => a + i.quantidadeEstoque * custoPorUnidadeEstoque(i), 0);
  const materiaisFiltrados = (tipoMat === 'ingrediente' ? ingredientes : outros).filter((i) => {
    const q = buscaMat.trim().toLowerCase();
    return !q || [i.nome, i.categoria ?? '', ROTULO_TIPO[i.tipo], i.usadoEm ?? ''].some((t) => t.toLowerCase().includes(q));
  });

  // LISTA DE COMPRAS: tudo no mínimo ou abaixo; sugestão = repor até o dobro do mínimo
  const compras = useMemo(
    () =>
      insumos.filter(baixo).map((i) => {
        const ing = i.tipo === 'ingrediente';
        const sugerido = ing ? Number((i.estoqueMinimo * 2 - i.quantidadeEstoque).toFixed(1)) : Math.round(i.estoqueMinimo * 2 - i.quantidadeEstoque);
        return { i, sugerido, preco: sugerido * custoPorUnidadeEstoque(i) };
      }),
    [insumos]
  );
  const totalCompras = compras.reduce((a, c) => a + c.preco, 0);

  const abrirKpi = (titulo: string, explicacao: string, linhas: Linha[]) => {
    setKpi({ titulo, explicacao, linhas });
    setGaveta('kpi');
  };
  const kpis = {
    vitrine: () =>
      abrirKpi(`Valor em vitrine · ${brl(valorVitrine)}`, `Pelo preço de venda do que está pronto. Com o freezer: ${brl(valorVitrine + valorFreezer)}.`, produtos.filter((p) => p.prontas > 0).map((p) => ({ nome: `${p.nome} (${p.prontas} × ${brl(p.preco)})`, valor: brl(p.prontas * p.preco) }))),
    prontas: () =>
      abrirKpi(`Prontas · ${totalProntas} un`, 'Unidades assadas na vitrine. Em vermelho, abaixo do mínimo.', produtos.map((p) => ({ nome: p.nome, valor: `${p.prontas} un (mín ${p.minProntas})`, alerta: p.prontas <= p.minProntas }))),
    freezer: () =>
      abrirKpi(`Freezer · ${totalFreezer} un`, 'Massas prontas para assar. Em vermelho, abaixo do mínimo.', produtos.filter((p) => p.minFreezer > 0 || p.congelados > 0).map((p) => ({ nome: p.nome, valor: `${p.congelados} un (mín ${p.minFreezer})`, alerta: p.minFreezer > 0 && p.congelados <= p.minFreezer }))),
    encomenda: () =>
      abrirKpi(`Sob encomenda · ${encomenda.length}`, 'Saem do estoque só quando a encomenda é entregue.', encomenda.map((v) => ({ nome: v.nome, valor: v.disponibilidade === 'hibrido' ? 'Híbrido' : 'Só encomenda' }))),
    perdas: () =>
      abrirKpi(`Perdas 30 dias · ${brl(perdas.total)}`, `${perdas.unidades} un descartadas. Custo do material que se perdeu; desconta do lucro.`, [
        ...perdas.porMotivo.map((m) => ({ nome: `${EMOJI_MOTIVO[m.motivo] ?? '🗑'} ${m.motivo} · ${m.unidades} un`, valor: brl(m.custo), alerta: true })),
        ...perdas.lista.map((r) => ({ nome: `${new Date(r.data).toLocaleDateString('pt-BR')} · ${r.quantidade}× ${r.produtoNome} (${r.motivo ?? 'Outro'})`, valor: brl(custoDoDescarte(r)) })),
      ]),
    itens: () =>
      abrirKpi(`Itens · ${insumos.length}`, 'Ingredientes, embalagens e outros (a mesma lista de Insumos e Receitas).', insumos.map((i) => ({ nome: `${i.emoji} ${i.nome}`, valor: `${fmtQtd(i.quantidadeEstoque)} ${i.unidade}` }))),
    guardado: () =>
      abrirKpi(
        `Valor guardado · ${brl(valorGuardado)}`,
        'Quantidade × custo médio das compras.',
        insumos
          .map((i) => ({ nome: `${i.emoji} ${i.nome}`, total: i.quantidadeEstoque * custoPorUnidadeEstoque(i) }))
          .sort((a, b) => b.total - a.total)
          .map((x) => ({ nome: x.nome, valor: brl(x.total) }))
      ),
  };

  const produto = produtos.find((p) => p.id === produtoId) ?? null;
  const material = insumos.find((i) => i.id === materialId) ?? null;

  const abrirAjuste = (a: Ajuste) => {
    setAjuste(a);
    setAjQtd('1');
    setAjValor('');
    setGaveta('ajuste');
  };
  const materialAjuste = ajuste?.tipo === 'material' ? insumos.find((i) => i.id === ajuste.id) : undefined;
  const qtdAjuste = lerQtd(ajQtd);
  const valorAjuste = lerNum(ajValor);
  const previaCusto =
    materialAjuste && qtdAjuste > 0 && valorAjuste > 0
      ? (materialAjuste.quantidadeEstoque * custoPorUnidadeEstoque(materialAjuste) + valorAjuste) / (materialAjuste.quantidadeEstoque + qtdAjuste)
      : null;

  const confirmarAjuste = (sinal: 1 | -1) => {
    if (!ajuste || qtdAjuste <= 0) return;
    if (ajuste.tipo === 'vitrine') {
      const mov = [{ produtoId: ajuste.id, nome: ajuste.nome, quantidade: qtdAjuste }];
      if (sinal > 0) adicionarAoEstoque(mov);
      else removerDoEstoque(mov);
      registrarProducao({ tipo: 'ajuste', produtoId: ajuste.id, produtoNome: ajuste.nome, quantidade: qtdAjuste, detalhes: `Vitrine ${sinal > 0 ? '+' : '−'}${qtdAjuste} un (ajuste no Estoque Central).` });
    } else if (ajuste.tipo === 'freezer') {
      // Entrada no freezer é massa feita: desconta os insumos da receita (e vai para o histórico)
      if (sinal > 0) congelarMassas(ajuste.id, qtdAjuste, true, 'entrada pelo Estoque Central');
      else {
        retirarDoFreezer(ajuste.id, qtdAjuste);
        registrarProducao({ tipo: 'ajuste', produtoId: ajuste.id, produtoNome: ajuste.nome, quantidade: qtdAjuste, detalhes: `Freezer −${qtdAjuste} un (ajuste no Estoque Central).` });
      }
    } else {
      ajustarEstoqueInsumo(ajuste.id, sinal * qtdAjuste, sinal > 0 ? valorAjuste : 0);
    }
    setGaveta(null);
    avisar(sinal > 0 ? (ajuste.tipo === 'material' && valorAjuste > 0 ? 'Entrada registrada · compra no financeiro' : 'Entrada registrada') : 'Baixa registrada');
  };

  const copiarCompras = async () => {
    const hoje = new Date().toLocaleDateString('pt-BR');
    let texto = `📋 *LISTA DE COMPRAS & REPOSIÇÃO • ATELIÊ KIPI*\nData: ${hoje}\n\n`;
    compras.forEach(({ i, sugerido }) => {
      texto += `${i.emoji} *${i.nome}* (${ROTULO_TIPO[i.tipo]})\n`;
      texto += `   • Estoque atual: ${i.quantidadeEstoque} ${i.unidade} | Mínimo: ${i.estoqueMinimo} ${i.unidade}\n`;
      texto += `   • Sugestão de compra: *${sugerido} ${i.unidade}*\n\n`;
    });
    texto += `💰 *Valor Estimado Total: ${brl(totalCompras)}*\nGerado automaticamente pelo Sistema Kipi.`;
    await Clipboard.setStringAsync(texto);
    avisar('Lista copiada. É só colar no WhatsApp.');
  };

  const irPara = (rota: string) => {
    setGaveta(null);
    router.push(rota as never);
  };

  const abas: { id: Aba; rotulo: string; qtd: number; alerta?: boolean }[] = [
    { id: 'produtos', rotulo: 'Produtos', qtd: produtos.length },
    { id: 'materiais', rotulo: 'Materiais', qtd: insumos.length },
    { id: 'compras', rotulo: 'Compras', qtd: compras.length, alerta: compras.length > 0 },
  ];

  return (
    <SafeAreaView style={s.tela} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 170 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.topo}>
          <T titulo style={s.titulo}>Estoque Central</T>
          <T style={s.subtitulo}>Vitrine, freezer, materiais e compras</T>
        </View>

        <View style={s.segmento} accessibilityRole="tablist">
          {abas.map((a) => {
            const on = aba === a.id;
            return (
              <TouchableOpacity key={a.id} style={[s.segItem, on && s.segItemOn]} onPress={() => setAba(a.id)} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                <T style={[s.segTexto, on && s.segTextoOn]}>{a.rotulo}</T>
                <View style={[s.segNum, a.alerta && { backgroundColor: '#FBE7E4' }]}>
                  <T style={[s.segNumTexto, numeros, a.alerta && { color: cor.vermelho }]}>{a.qtd}</T>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ===================== PRODUTOS ===================== */}
        {aba === 'produtos' && (
          <>
            <View style={[s.cartao, sombra]}>
              <TouchableOpacity style={s.valorLinha} onPress={kpis.vitrine} accessibilityRole="button">
                <View style={{ gap: 2 }}>
                  <T style={[s.rotuloPeq, { color: cor.verde }]}>Valor em vitrine</T>
                  <T titulo style={[s.valorGrande, numeros]}>{brl(valorVitrine)}</T>
                </View>
                <T style={[s.dica, numeros]}>com freezer {brl(valorVitrine + valorFreezer)} ›</T>
              </TouchableOpacity>
              <View style={s.kpis}>
                {[
                  { r: '✓ Prontas', v: `${totalProntas} un`, bg: cor.verdeClaro, fg: cor.verde, f: kpis.prontas },
                  { r: '❄ Freezer', v: `${totalFreezer} un`, bg: '#ECEBFA', fg: AZUL_FREEZER, f: kpis.freezer },
                  { r: 'Encomenda', v: String(encomenda.length), bg: cor.azulClaro, fg: cor.azulTexto, f: kpis.encomenda },
                  { r: '🗑 Perdas', v: brl(perdas.total).replace(/,\d\d$/, ''), bg: perdas.total > 0 ? cor.vermelhoClaro : cor.verdeClaro, fg: perdas.total > 0 ? cor.vermelho : cor.verde, f: kpis.perdas },
                ].map((k) => (
                  <TouchableOpacity key={k.r} style={[s.kpi, { backgroundColor: k.bg }]} onPress={k.f} accessibilityRole="button" accessibilityLabel={k.r}>
                    <T style={[s.kpiRot, { color: k.fg }]}>{k.r}</T>
                    <T style={[s.kpiVal, numeros, { color: k.fg }]} numberOfLines={1}>{k.v}</T>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={s.buscaLinha}>
              <View style={[s.busca, sombra]}>
                <Feather name="search" size={18} color="#9A8F87" />
                <TextInput value={buscaProd} onChangeText={setBuscaProd} placeholder="Produto ou categoria…" placeholderTextColor="#9A8F87" style={s.buscaInput} accessibilityLabel="Buscar produto" />
              </View>
              <TouchableOpacity style={[s.filtro, sombra, categoria !== 'Todas' && { backgroundColor: cor.azulClaro }]} onPress={() => setGaveta('categorias')} accessibilityRole="button" accessibilityLabel="Filtrar categoria">
                <Feather name="filter" size={18} color={categoria !== 'Todas' ? cor.azulTexto : cor.textoMedio} />
              </TouchableOpacity>
            </View>
            {categoria !== 'Todas' && (
              <View style={s.mostrando}>
                <T style={s.mostrandoTexto}>
                  Mostrando: <T style={[s.mostrandoTexto, { fontWeight: '800', color: cor.texto }]}>{categoria}</T>
                </T>
                <TouchableOpacity onPress={() => setCategoria('Todas')} accessibilityRole="button" style={{ minHeight: 32, justifyContent: 'center' }}>
                  <T style={s.link}>Limpar</T>
                </TouchableOpacity>
              </View>
            )}

            {produtosFiltrados.length === 0 ? (
              <View style={s.vazio}>
                <T titulo style={s.vazioTitulo}>Nenhum produto encontrado</T>
                <T style={s.dica}>Tente outro nome ou categoria.</T>
              </View>
            ) : (
              <View style={[s.lista, sombra]}>
                {produtosFiltrados.map((p, idx) => {
                  const vb = p.prontas <= p.minProntas;
                  const fb = p.minFreezer > 0 && p.congelados <= p.minFreezer;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[s.linha, idx > 0 && s.borda]}
                      onPress={() => {
                        setProdutoId(p.id);
                        setGaveta('produto');
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir ${p.nome}`}>
                      <View style={s.icone}>
                        <T style={{ fontSize: 22 }}>{p.emoji}</T>
                      </View>
                      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                        <T style={s.nome} numberOfLines={1}>{p.nome}</T>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <T style={[s.qtd, numeros, { color: vb ? cor.vermelho : cor.verde }]}>✓ {p.prontas} prontas</T>
                          <T style={[s.qtd, numeros, { color: fb ? cor.vermelho : AZUL_FREEZER }]}>❄ {p.congelados} no freezer</T>
                        </View>
                      </View>
                      {(vb || fb) && (
                        <View style={[s.selo, { backgroundColor: vb ? '#FBF0DC' : '#ECEBFA' }]}>
                          <T style={[s.seloTexto, { color: vb ? LARANJA_ESCURO : '#3A3D9E' }]}>{vb ? '🔥 Assar mais' : '❄ Fazer massa'}</T>
                        </View>
                      )}
                      <Feather name="chevron-right" size={16} color="#9A8F87" />
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* ===================== MATERIAIS ===================== */}
        {aba === 'materiais' && (
          <>
            <View style={[s.cartao, sombra, { flexDirection: 'row', gap: 6 }]}>
              <TouchableOpacity style={{ flex: 1, gap: 2 }} onPress={kpis.itens} accessibilityRole="button">
                <T style={s.rotuloPeq}>Itens</T>
                <T titulo style={[s.valorMedio, numeros]}>{insumos.length}</T>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, gap: 2 }} onPress={() => setAba('compras')} accessibilityRole="button">
                <T style={[s.rotuloPeq, { color: compras.length ? cor.vermelho : cor.verde }]}>Para repor</T>
                <T titulo style={[s.valorMedio, numeros, { color: compras.length ? cor.vermelho : cor.verde }]}>{compras.length ? `${compras.length} ›` : '✓ 0'}</T>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1.2, gap: 2 }} onPress={kpis.guardado} accessibilityRole="button">
                <T style={[s.rotuloPeq, { color: cor.verde }]}>Valor guardado</T>
                <T titulo style={[s.valorMedio, numeros, { color: cor.verde, fontSize: 16 }]} numberOfLines={1}>{brl(valorGuardado)}</T>
              </TouchableOpacity>
            </View>

            <View style={[s.busca, sombra, { marginHorizontal: 16, marginTop: 12 }]}>
              <Feather name="search" size={18} color="#9A8F87" />
              <TextInput value={buscaMat} onChangeText={setBuscaMat} placeholder="Nome, tipo ou onde é usado…" placeholderTextColor="#9A8F87" style={s.buscaInput} accessibilityLabel="Buscar material" />
            </View>
            <View style={s.chipsLinha}>
              <Opcao rotulo={`Ingredientes · ${ingredientes.length}`} ativo={tipoMat === 'ingrediente'} aoTocar={() => setTipoMat('ingrediente')} forte style={s.chip} />
              <Opcao rotulo={`Embalagens e outros · ${outros.length}`} ativo={tipoMat === 'outros'} aoTocar={() => setTipoMat('outros')} forte style={s.chip} />
            </View>

            {materiaisFiltrados.length === 0 ? (
              <View style={s.vazio}>
                <T titulo style={s.vazioTitulo}>Nenhum material encontrado</T>
              </View>
            ) : (
              <View style={[s.lista, sombra]}>
                {materiaisFiltrados.map((i, idx) => {
                  const b = baixo(i);
                  const cap = i.tipo === 'ingrediente' ? capacidadeDoInsumo(i, nomeProduto).sort((x, y) => x.fornadasPossiveis - y.fornadasPossiveis)[0] : undefined;
                  const linhaCap = i.tipo === 'ingrediente'
                    ? cap
                      ? `${cap.receitaNome}: até ${cap.fornadasPossiveis} ${cap.fornadasPossiveis === 1 ? 'fornada' : 'fornadas'}`
                      : 'Não usado em receitas'
                    : `${ROTULO_TIPO[i.tipo]}${i.usadoEm ? ` · ${i.usadoEm}` : ''}`;
                  return (
                    <TouchableOpacity
                      key={i.id}
                      style={[s.linha, idx > 0 && s.borda]}
                      onPress={() => {
                        setMaterialId(i.id);
                        setConfirmarExclusao(false);
                        setGaveta('material');
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Abrir ${i.nome}`}>
                      <View style={s.icone}>
                        <T style={{ fontSize: 22 }}>{i.emoji}</T>
                      </View>
                      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                        <T style={s.nome} numberOfLines={1}>{i.nome}</T>
                        <T style={[s.qtd, numeros, { color: b ? cor.vermelho : cor.verde }]}>
                          {b ? '⚠ ' : ''}{fmtQtd(i.quantidadeEstoque)} {i.unidade} · mín {fmtQtd(i.estoqueMinimo)}
                        </T>
                        <T style={[s.dica, { fontSize: 11 }, cap && cap.fornadasPossiveis <= 3 && { color: cor.vermelho }]} numberOfLines={1}>{linhaCap}</T>
                      </View>
                      <T style={[s.custo, numeros]}>{fmtCusto(custoPorUnidadeEstoque(i))}/{i.unidade}</T>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* ===================== COMPRAS ===================== */}
        {aba === 'compras' &&
          (compras.length === 0 ? (
            <View style={[s.vazio, { gap: 8 }]}>
              <Feather name="check-circle" size={32} color={cor.verde} />
              <T titulo style={s.vazioTitulo}>Tudo em dia com seu estoque!</T>
              <T style={[s.dica, { textAlign: 'center' }]}>Nenhum ingrediente ou embalagem abaixo do mínimo no momento.</T>
            </View>
          ) : (
            <>
              <View style={[s.cartao, { backgroundColor: cor.ambarFundo, gap: 10 }]}>
                <View style={s.valorLinha}>
                  <T style={[s.rotuloPeq, { color: cor.ambarTexto, fontSize: 13 }]}>Total estimado</T>
                  <T titulo style={[s.valorGrande, numeros, { color: cor.ambarTexto }]}>{brl(totalCompras)}</T>
                </View>
                <T style={[s.dica, { color: cor.ambarTexto }]}>
                  {compras.length} {compras.length === 1 ? 'item' : 'itens'} no mínimo ou abaixo. Sugestão: repor até o dobro do mínimo.
                </T>
                <Botao rotulo="Copiar lista para WhatsApp" icone="message-circle" variante="verde" altura={48} aoTocar={copiarCompras} />
              </View>
              <View style={[s.lista, sombra]}>
                {compras.map(({ i, sugerido, preco }, idx) => (
                  <TouchableOpacity
                    key={i.id}
                    style={[s.linha, idx > 0 && s.borda]}
                    onPress={() => {
                      setMaterialId(i.id);
                      setConfirmarExclusao(false);
                      setGaveta('material');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir ${i.nome}`}>
                    <T style={{ fontSize: 22 }}>{i.emoji}</T>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <T style={[s.nome, { fontSize: 14 }]} numberOfLines={1}>{i.nome}</T>
                      <T style={[s.dica, numeros]}>
                        {ROTULO_TIPO[i.tipo]} · tem <T style={[s.dica, { fontWeight: '800', color: cor.vermelho }]}>{fmtQtd(i.quantidadeEstoque)} {i.unidade}</T> · mín {fmtQtd(i.estoqueMinimo)}
                      </T>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 2 }}>
                      <View style={[s.selo, { backgroundColor: '#E4F1E9' }]}>
                        <T style={[s.seloTexto, numeros, { color: cor.verde }]}>+ {fmtQtd(sugerido)} {i.unidade}</T>
                      </View>
                      <T style={[s.custo, numeros, { color: cor.texto }]}>{brl(preco)}</T>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ))}
      </ScrollView>

      {aba === 'materiais' && (
        <TouchableOpacity style={[s.fab, { bottom: 78 + Math.max(insets.bottom, 8) }]} onPress={() => setForm({ aberto: true, id: null })} accessibilityRole="button" accessibilityLabel="Novo material" activeOpacity={0.9}>
          <Feather name="plus" size={22} color="#FFFDFA" />
          <T style={s.fabTexto}>Novo material</T>
        </TouchableOpacity>
      )}

      <Aviso msg={msg} base={150 + insets.bottom} />
      <TabBar ativa="/mais" />

      {/* CATEGORIAS */}
      <Gaveta aberta={gaveta === 'categorias'} aoFechar={() => setGaveta(null)} titulo="Categoria" subtitulo="Filtrar produtos">
        <View style={s.chipsWrap}>
          {categorias.map((c) => (
            <Opcao key={c} rotulo={c} ativo={categoria === c} forte style={{ minHeight: 40 }} aoTocar={() => { setCategoria(c); setGaveta(null); }} />
          ))}
        </View>
      </Gaveta>

      {/* PRODUTO */}
      <Gaveta aberta={gaveta === 'produto' && !!produto} aoFechar={() => setGaveta(null)} titulo={produto?.nome ?? ''} subtitulo={produto?.categoria}>
        {produto && (
          <>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {([
                ['vitrine', '✓ Pronto para venda', produto.prontas, produto.minProntas, cor.verdeClaro, cor.verde, cor.verdeBorda],
                ['freezer', '❄ No freezer', produto.congelados, produto.minFreezer, '#ECEBFA', AZUL_FREEZER, '#D6D7F3'],
              ] as const).map(([tipo, rot, n, min, bg, fg, borda]) => (
                <View key={tipo} style={[s.caixaEstoque, { backgroundColor: bg }]}>
                  <T style={[s.rotuloPeq, { color: fg }]}>{rot}</T>
                  <T titulo style={[s.valorGrande, numeros]}>
                    {n} <T style={s.dica}>mín {min}</T>
                  </T>
                  <TouchableOpacity style={[s.ajustarBtn, { borderColor: borda }]} onPress={() => abrirAjuste({ tipo, id: produto.id, nome: produto.nome })} accessibilityRole="button" accessibilityLabel={`Ajustar ${tipo === 'vitrine' ? 'vitrine' : 'freezer'}`}>
                    <T style={[s.ajustarTexto, { color: fg }]}>Ajustar ±</T>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <T style={[s.dica, numeros]}>
              {brl(produto.preco)}
              {produto.custo > 0 ? ` · custo ${brl(produto.custo)} · margem ${Math.round(((produto.preco - produto.custo) / produto.preco) * 100)}%` : ' · sem custo cadastrado'}
            </T>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <BotaoCor rotulo="❄ Preparar massa" bg="#ECEBFA" fg="#3A3D9E" aoTocar={() => irPara(`/producao?preparar=${produto.id}&t=${Date.now()}`)} />
              <BotaoCor rotulo="🔥 Assar" bg="#FBF0DC" fg={LARANJA_ESCURO} desativado={produto.congelados <= 0} aoTocar={() => irPara(`/producao?assar=${produto.id}&t=${Date.now()}`)} />
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Botao rotulo="Ver produto" variante="secundario" altura={48} style={{ flex: 1 }} aoTocar={() => irPara(`/produtos-estoque?produto=${produto.id}&t=${Date.now()}`)} />
              <BotaoCor
                rotulo="🗑 Descartar"
                bg={cor.vermelhoClaro}
                fg={cor.vermelho}
                desativado={produto.prontas + produto.congelados <= 0}
                aoTocar={() => irPara(`/produtos-estoque?produto=${produto.id}&descartar=1&t=${Date.now()}`)}
              />
            </View>
          </>
        )}
      </Gaveta>

      {/* MATERIAL */}
      <Gaveta aberta={gaveta === 'material' && !!material} aoFechar={() => setGaveta(null)} titulo={material?.nome ?? ''} subtitulo={material ? ROTULO_TIPO[material.tipo] : ''}>
        {material && (
          <>
            <View style={[s.materialTopo, { backgroundColor: baixo(material) ? cor.vermelhoClaro : cor.verdeClaro }]}>
              <View style={{ flex: 1, gap: 2 }}>
                <T style={[s.rotuloPeq, { color: baixo(material) ? cor.vermelho : cor.verde }]}>
                  {baixo(material) ? `⚠ Repor · mínimo ${fmtQtd(material.estoqueMinimo)} ${material.unidade}` : `Acima do mínimo (${fmtQtd(material.estoqueMinimo)} ${material.unidade})`}
                </T>
                <T style={[s.dica, numeros]}>
                  {fmtCusto(custoPorUnidadeEstoque(material))}/{material.unidade}
                  {material.tipo === 'ingrediente'
                    ? `${material.categoria ? ` · ${material.categoria}` : ''} · ${ROTULO_ARMAZENAMENTO[material.armazenamento]}`
                    : material.usadoEm
                      ? ` · ${material.usadoEm}`
                      : ''}
                </T>
              </View>
              <T titulo style={[s.valorGrande, numeros, { color: baixo(material) ? cor.vermelho : cor.verde }]}>
                {fmtQtd(material.quantidadeEstoque)} {material.unidade}
              </T>
            </View>
            {material.tipo === 'ingrediente' && (
              <View>
                <T style={s.rotulo}>Dá para fazer</T>
                {capacidadeDoInsumo(material, nomeProduto).length === 0 && <T style={[s.dica, { paddingTop: 6 }]}>Nenhuma receita usa este ingrediente.</T>}
                {capacidadeDoInsumo(material, nomeProduto).map((c) => (
                  <View key={c.receitaNome} style={[s.capLinha, s.borda]}>
                    <T style={{ flex: 1, fontSize: 14 }} numberOfLines={1}>{c.receitaNome}</T>
                    <T style={[s.dica, numeros]}>{fmtQtd(c.gastoPorFornada)} {material.unidade}/fornada</T>
                    <T style={[s.capN, numeros, { color: c.fornadasPossiveis <= 3 ? cor.vermelho : cor.verde }]}>até {c.fornadasPossiveis}</T>
                  </View>
                ))}
              </View>
            )}
            <Botao rotulo="Entrada ou baixa" aoTocar={() => abrirAjuste({ tipo: 'material', id: material.id, nome: material.nome })} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Botao rotulo="Editar" variante="secundario" altura={48} style={{ flex: 1 }} aoTocar={() => { setGaveta(null); setForm({ aberto: true, id: material.id }); }} />
              <Botao
                rotulo={confirmarExclusao ? 'Confirmar exclusão' : 'Excluir'}
                altura={48}
                variante={confirmarExclusao ? 'perigo' : 'secundario'}
                style={{ flex: 1 }}
                aoTocar={() => {
                  if (!confirmarExclusao) return setConfirmarExclusao(true);
                  excluirInsumo(material.id);
                  setGaveta(null);
                  avisar('Material excluído');
                }}
              />
            </View>
          </>
        )}
      </Gaveta>

      {/* AJUSTE */}
      <Gaveta
        aberta={gaveta === 'ajuste' && !!ajuste}
        aoFechar={() => setGaveta(null)}
        titulo={ajuste?.tipo === 'material' ? 'Entrada ou baixa' : ajuste?.tipo === 'freezer' ? 'Ajustar freezer' : 'Ajustar vitrine'}
        subtitulo={ajuste ? (ajuste.tipo === 'material' ? `${ajuste.nome} · compra recalcula o custo médio` : `${ajuste.nome} · fica no histórico da Produção`) : ''}>
        {ajuste && (
          <>
            <View style={{ gap: 6 }}>
              <T style={s.rotulo}>Quantidade ({materialAjuste ? materialAjuste.unidade : 'un'})</T>
              <TextInput value={ajQtd} onChangeText={setAjQtd} keyboardType="decimal-pad" style={s.campo} accessibilityLabel="Quantidade" />
              <T style={[s.dica, numeros]}>
                {materialAjuste
                  ? `Atual: ${fmtQtd(materialAjuste.quantidadeEstoque)} ${materialAjuste.unidade} · ${fmtCusto(custoPorUnidadeEstoque(materialAjuste))}/${materialAjuste.unidade}`
                  : ajuste.tipo === 'freezer'
                    ? `Atual: ${produto?.congelados ?? 0} no freezer`
                    : `Atual: ${produto?.prontas ?? 0} prontas`}
              </T>
            </View>
            {materialAjuste && (
              <View style={{ gap: 6 }}>
                <T style={s.rotulo}>
                  Valor total pago <T style={[s.dica, { fontWeight: '500' }]}>opcional, só na entrada</T>
                </T>
                <TextInput value={ajValor} onChangeText={setAjValor} keyboardType="decimal-pad" placeholder="R$ 0,00" placeholderTextColor="#9A8F87" style={s.campo} accessibilityLabel="Valor total pago" />
                {previaCusto !== null && (
                  <View style={s.previa}>
                    <T style={[s.previaTexto, numeros]}>Novo custo médio: {fmtCusto(previaCusto)}/{materialAjuste.unidade}</T>
                  </View>
                )}
              </View>
            )}
            {ajuste.tipo === 'freezer' && <T style={[s.dica, { color: AZUL_FREEZER }]}>Entrada no freezer é massa feita: desconta os insumos da receita.</T>}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={s.baixa} onPress={() => confirmarAjuste(-1)} accessibilityRole="button">
                <T style={[s.ajusteTexto, { color: cor.vermelho }]}>− Dar baixa</T>
              </TouchableOpacity>
              <Botao rotulo="+ Dar entrada" variante="verde" aoTocar={() => confirmarAjuste(1)} style={{ flex: 1 }} />
            </View>
          </>
        )}
      </Gaveta>

      {/* DETALHE DE INDICADOR */}
      <Gaveta aberta={gaveta === 'kpi' && !!kpi} aoFechar={() => setGaveta(null)} titulo={kpi?.titulo ?? ''} subtitulo={kpi?.explicacao}>
        <View>
          {kpi?.linhas.length === 0 && <T style={s.dica}>Nada para mostrar no momento.</T>}
          {kpi?.linhas.map((l, idx) => (
            <View key={`${l.nome}-${idx}`} style={[s.capLinha, idx > 0 && s.borda]}>
              <T style={{ flex: 1, fontSize: 14 }} numberOfLines={1}>{l.nome}</T>
              <T style={[s.capN, numeros, { color: l.alerta ? cor.vermelho : cor.texto }]}>{l.valor}</T>
            </View>
          ))}
        </View>
      </Gaveta>

      <InsumoFormMobile
        visivel={form.aberto}
        insumo={form.id ? insumos.find((i) => i.id === form.id) ?? null : null}
        aoFechar={() => setForm({ aberto: false, id: null })}
        aoSalvo={(m) => {
          setForm({ aberto: false, id: null });
          avisar(m.replace('Insumo', 'Material'));
        }}
      />
    </SafeAreaView>
  );
}

// Botão claro com texto colorido (ações do produto)
function BotaoCor({ rotulo, bg, fg, aoTocar, desativado }: { rotulo: string; bg: string; fg: string; aoTocar: () => void; desativado?: boolean }) {
  return (
    <TouchableOpacity
      style={[s.botaoCor, { backgroundColor: desativado ? cor.cinzaClaro : bg }]}
      onPress={aoTocar}
      disabled={desativado}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!desativado }}
      activeOpacity={0.85}>
      <T style={[s.botaoCorTexto, { color: desativado ? cor.textoSuave : fg }]}>{rotulo}</T>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  botaoCor: { flex: 1, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  botaoCorTexto: { fontSize: 14, fontWeight: '800' },
  tela: { flex: 1, backgroundColor: cor.fundo },
  topo: { paddingHorizontal: 20, paddingTop: 10, gap: 2 },
  titulo: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  subtitulo: { fontSize: 13, fontWeight: '600', color: cor.textoSuave },
  dica: { fontSize: 12, color: cor.textoSuave },
  link: { fontSize: 13, fontWeight: '800', color: cor.azulTexto },
  rotulo: { fontSize: 13, fontWeight: '800', color: cor.textoMedio },
  rotuloPeq: { fontSize: 12, fontWeight: '700', color: cor.textoSuave },
  segmento: { flexDirection: 'row', marginHorizontal: 16, marginTop: 14, padding: 4, gap: 4, borderRadius: 16, backgroundColor: '#F3EEE7' },
  segItem: { flex: 1, height: 40, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  segItemOn: { backgroundColor: '#FFFDFA', shadowColor: '#2E211A', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segTexto: { fontSize: 13, fontWeight: '600', color: cor.textoMedio },
  segTextoOn: { fontWeight: '800', color: cor.texto },
  segNum: { minWidth: 18, paddingHorizontal: 5, borderRadius: 9, alignItems: 'center' },
  segNumTexto: { fontSize: 11, fontWeight: '800', color: cor.textoSuave },
  cartao: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 22, backgroundColor: '#FFFDFA', gap: 12 },
  valorLinha: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  valorGrande: { fontSize: 22, fontWeight: '700' },
  valorMedio: { fontSize: 18, fontWeight: '700' },
  kpis: { flexDirection: 'row', gap: 6 },
  kpi: { flex: 1, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 14, gap: 1 },
  kpiRot: { fontSize: 10, fontWeight: '800' },
  kpiVal: { fontSize: 14, fontWeight: '800' },
  buscaLinha: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 12 },
  busca: { flex: 1, height: 48, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#FFFDFA', flexDirection: 'row', alignItems: 'center', gap: 10 },
  buscaInput: { flex: 1, minWidth: 0, height: 44, fontSize: 15, color: cor.texto, fontFamily: fonte.texto, ...campoWeb },
  filtro: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#FFFDFA', alignItems: 'center', justifyContent: 'center' },
  mostrando: { marginHorizontal: 20, marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  mostrandoTexto: { flex: 1, fontSize: 13, color: cor.textoMedio },
  chipsLinha: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginHorizontal: 16, marginTop: 10 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { minHeight: 38, paddingHorizontal: 14, borderRadius: 19 },
  lista: { marginHorizontal: 16, marginTop: 12, borderRadius: 22, backgroundColor: '#FFFDFA', overflow: 'hidden' },
  linha: { paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  borda: { borderTopWidth: 1, borderTopColor: cor.bordaSuave },
  icone: { width: 44, height: 44, borderRadius: 14, backgroundColor: cor.fundo, alignItems: 'center', justifyContent: 'center' },
  nome: { fontSize: 15, fontWeight: '700' },
  qtd: { fontSize: 12, fontWeight: '800' },
  selo: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9 },
  seloTexto: { fontSize: 11, fontWeight: '800' },
  custo: { fontSize: 12, fontWeight: '700', color: cor.textoSuave },
  vazio: { margin: 16, marginTop: 24, padding: 28, borderRadius: 22, backgroundColor: '#FFFDFA', alignItems: 'center', gap: 4 },
  vazioTitulo: { fontSize: 16, fontWeight: '700' },
  fab: { position: 'absolute', right: 16, height: 56, paddingLeft: 18, paddingRight: 22, borderRadius: 28, backgroundColor: cor.azulBotao, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: cor.azulBotao, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  fabTexto: { color: '#FFFDFA', fontSize: 15, fontWeight: '800' },
  caixaEstoque: { flex: 1, padding: 12, borderRadius: 16, gap: 6 },
  ajustarBtn: { height: 36, borderRadius: 18, borderWidth: 1, backgroundColor: '#FFFDFA', alignItems: 'center', justifyContent: 'center' },
  ajustarTexto: { fontSize: 12, fontWeight: '800' },
  materialTopo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16 },
  capLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9 },
  capN: { fontSize: 13, fontWeight: '800' },
  campo: { height: 50, borderRadius: 14, borderWidth: 1, borderColor: cor.borda, paddingHorizontal: 14, fontSize: 16, fontWeight: '700', color: cor.texto, fontFamily: fonte.texto, ...campoWeb },
  previa: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, backgroundColor: cor.verdeClaro },
  previaTexto: { fontSize: 13, fontWeight: '800', color: cor.verde },
  baixa: { flex: 1, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: '#F3C4BD', alignItems: 'center', justifyContent: 'center' },
  ajusteTexto: { fontSize: 15, fontWeight: '800' },
});

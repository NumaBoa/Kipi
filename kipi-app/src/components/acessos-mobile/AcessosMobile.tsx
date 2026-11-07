import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import {
  alertasDeReposicao,
  comissaoDaVenda,
  dataBRParaISO,
  dataHojeBR,
  descreverComissao,
  excluirEntrega,
  excluirPagamento,
  FORMAS_PAGAMENTO,
  formatarDataBR,
  labelFormaPagamento,
  mascaraData,
  registrarEntrega,
  registrarPagamento,
  resumoFinanceiro,
  saboresComRevendedora,
  useRevenda,
  type FormaPagamento,
  type Revendedora,
  type TipoComissao,
} from '@/lib/revenda';
import { acessoDaRevendedora, SENHA_PADRAO_REVENDEDORA } from '@/lib/acesso';
import { produtoAtivo, useEstoqueVitrine } from '@/lib/estoqueVitrine';
import TabBar from '@/components/mobile/TabBar';
import { brl, cor, fonte, numeros, sombra } from '@/components/mobile/tema';
import { Aviso, Botao, Gaveta, Opcao, T, useAviso } from '@/components/mobile/ui';
import { FOTOS } from '@/components/produtos-mobile/ProdutosMobile';
import RevendedoraFormMobile from './RevendedoraFormMobile';

// ============================================================================
// ACESSOS (REVENDEDORAS) NO CELULAR: lista, ficha, entrega e acerto de contas.
// Mesmos dados e regras da versão de computador (lib/revenda).
// ============================================================================

const EMOJI_CATEGORIA: Record<string, string> = {
  Cookies: '🍪', 'Bolos & Bentos': '🎂', Macarons: '✨', Sobremesas: '🥧', 'Doces Finos': '🍬', Presentes: '🎁', Folhados: '🥐', Bebidas: '☕',
};
const STATUS_SABOR = {
  esgotado: { rotulo: 'Esgotado', bg: '#FBE7E4', fg: cor.vermelho },
  baixo: { rotulo: 'acabando', bg: cor.ambarClaro, fg: cor.ambarTexto },
  abastecido: { rotulo: 'em dia', bg: '#E4F1E9', fg: cor.verde },
};
const STATUS_VENDA = { pago: ['Pago', cor.verde], pendente: ['Pendente', cor.ambar], cancelado: ['Cancelado', cor.vermelho] } as const;
const iniciais = (nome: string) => nome.trim().split(/\s+/).slice(0, 2).map((p) => p[0] ?? '').join('').toUpperCase();
const dataCurta = (iso: string) => formatarDataBR(iso).slice(0, 5);
const campoWeb = Platform.select({ web: { outlineStyle: 'none' } as object, default: {} });
const abrirUrl = (url: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank');
  else Linking.openURL(url).catch(() => {});
};

type Inicial = { gaveta: 'entrega'; preencher: Record<string, number> } | null;

export default function AcessosMobile() {
  const insets = useSafeAreaInsets();
  const { msg, avisar } = useAviso();
  const { revendedoras, vendas, entregas, pagamentos } = useRevenda();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<'todas' | TipoComissao>('todas');
  const [gaveta, setGaveta] = useState<null | 'alertas' | 'filtro'>(null);
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [inicial, setInicial] = useState<Inicial>(null);
  const [novo, setNovo] = useState(false);

  const alertas = useMemo(() => alertasDeReposicao(revendedoras, entregas, vendas), [revendedoras, entregas, vendas]);
  // Reposição agrupada por revendedora (evita confusão entre elas)
  const grupos = useMemo(() => {
    const m = new Map<string, { r: Revendedora; sabores: (typeof alertas)[number]['sabor'][] }>();
    alertas.forEach(({ revendedora, sabor }) => {
      const g = m.get(revendedora.id) ?? { r: revendedora, sabores: [] };
      g.sabores.push(sabor);
      m.set(revendedora.id, g);
    });
    return Array.from(m.values());
  }, [alertas]);

  const porId = useMemo(() => {
    const mapa: Record<string, { saldo: number; unidades: number; repor: boolean }> = {};
    revendedoras.forEach((r) => {
      const sab = saboresComRevendedora(r.id, entregas, vendas);
      mapa[r.id] = { saldo: resumoFinanceiro(r, vendas, pagamentos).saldo, unidades: sab.reduce((a, x) => a + x.saldo, 0), repor: sab.some((x) => x.status !== 'abastecido') };
    });
    return mapa;
  }, [revendedoras, entregas, vendas, pagamentos]);
  const totalAPagar = Object.values(porId).reduce((a, v) => a + Math.max(0, v.saldo), 0);
  const totalComElas = Object.values(porId).reduce((a, v) => a + v.unidades, 0);

  const lista = revendedoras.filter((r) => {
    const t = busca.trim().toLowerCase();
    const casa = !t || [r.nome, r.telefone, r.email ?? '', r.cpf ?? '', r.tag ?? '', r.bairro ?? '', r.cidade ?? ''].some((x) => x.toLowerCase().includes(t));
    return casa && (filtro === 'todas' || r.tipoComissao === filtro);
  });
  const contagem = { todas: revendedoras.length, porcentagem: revendedoras.filter((r) => r.tipoComissao === 'porcentagem').length, valor_fixo: revendedoras.filter((r) => r.tipoComissao === 'valor_fixo').length };
  const ficha = revendedoras.find((r) => r.id === fichaId) ?? null;

  return (
    <SafeAreaView style={s.tela} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 170 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={s.topo}>
          <T titulo style={s.titulo}>Revendedoras</T>
          <T style={s.subtitulo}>Acessos, comissões, entregas e acertos</T>
        </View>

        <View style={[s.cartao, sombra]}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <View style={{ flex: 0.9, gap: 2 }}>
              <T style={s.rotuloPeq}>Revendedoras</T>
              <T titulo style={[s.valorMedio, numeros]}>{revendedoras.length}</T>
            </View>
            <View style={{ flex: 1.3, gap: 2 }}>
              <T style={[s.rotuloPeq, { color: totalAPagar > 0 ? cor.ambar : cor.verde }]}>Comissões a pagar</T>
              <T titulo style={[s.valorMedio, numeros, { color: totalAPagar > 0 ? cor.ambar : cor.verde }]} numberOfLines={1}>{brl(totalAPagar)}</T>
            </View>
            <View style={{ flex: 0.9, gap: 2 }}>
              <T style={s.rotuloPeq}>Com elas</T>
              <T titulo style={[s.valorMedio, numeros]}>{totalComElas} un</T>
            </View>
          </View>
          {alertas.length > 0 && (
            <TouchableOpacity style={s.alerta} onPress={() => setGaveta('alertas')} accessibilityRole="button">
              <Feather name="alert-triangle" size={16} color={cor.ambarTexto} />
              <T style={s.alertaTexto}>
                {alertas.length} {alertas.length === 1 ? 'sabor precisa' : 'sabores precisam'} de reposição
              </T>
              <T style={s.alertaTexto}>Ver ›</T>
            </TouchableOpacity>
          )}
        </View>

        <View style={s.buscaLinha}>
          <View style={[s.busca, sombra]}>
            <Feather name="search" size={18} color="#9A8F87" />
            <TextInput value={busca} onChangeText={setBusca} placeholder="Nome, telefone, e-mail, bairro…" placeholderTextColor="#9A8F87" style={s.buscaInput} accessibilityLabel="Buscar revendedora" />
          </View>
          <TouchableOpacity style={[s.filtro, sombra, filtro !== 'todas' && { backgroundColor: cor.azulClaro }]} onPress={() => setGaveta('filtro')} accessibilityRole="button" accessibilityLabel="Filtrar comissão">
            <Feather name="filter" size={18} color={filtro !== 'todas' ? cor.azulTexto : cor.textoMedio} />
          </TouchableOpacity>
        </View>

        {lista.length === 0 ? (
          <View style={s.vazio}>
            <Feather name="users" size={30} color="#9A8F87" />
            <T titulo style={s.vazioTitulo}>Nenhuma revendedora encontrada</T>
            <T style={[s.dica, { textAlign: 'center' }]}>{revendedoras.length === 0 ? 'Cadastre sua primeira revendedora para começar.' : 'Tente alterar a busca ou o filtro de comissão.'}</T>
          </View>
        ) : (
          <View style={[s.lista, sombra]}>
            {lista.map((r, idx) => {
              const info = porId[r.id];
              const acesso = acessoDaRevendedora(r.id);
              return (
                <TouchableOpacity key={r.id} style={[s.linha, idx > 0 && s.borda]} onPress={() => setFichaId(r.id)} accessibilityRole="button" accessibilityLabel={`Abrir ${r.nome}`}>
                  <View style={s.avatar}>
                    <T style={s.avatarTexto}>{iniciais(r.nome)}</T>
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <T style={s.nome} numberOfLines={1}>{r.nome}</T>
                    <View style={s.subLinha}>
                      {!!r.tag && (
                        <View style={s.tag}>
                          <T style={s.tagTexto} numberOfLines={1}>{r.tag}</T>
                        </View>
                      )}
                      <T style={[s.dica, numeros, { flex: 1 }]} numberOfLines={1}>
                        {r.tipoComissao === 'porcentagem' ? `${r.valorComissao.toLocaleString('pt-BR')}%` : `${brl(r.valorComissao)} por produto`} · {info?.unidades ?? 0} un com ela
                      </T>
                    </View>
                    <T style={[s.acessoLinha, { color: acesso ? cor.verde : cor.ambar }]} numberOfLines={1}>
                      🔑 {acesso ? `Acesso: ${r.email}` : 'Sem acesso: cadastre um e-mail'}
                    </T>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 3 }}>
                    <T style={[s.saldo, numeros, { color: (info?.saldo ?? 0) > 0 ? cor.ambar : cor.textoSuave }]}>{brl(info?.saldo ?? 0)}</T>
                    <T style={[s.dica, { fontSize: 11 }]}>a pagar</T>
                    {info?.repor && (
                      <View style={[s.tag, { backgroundColor: cor.ambarClaro, maxWidth: 120 }]}>
                        <T style={[s.tagTexto, { color: cor.ambarTexto }]} numberOfLines={1}>⚠ Repor</T>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={[s.fab, { bottom: 78 + Math.max(insets.bottom, 8) }]} onPress={() => setNovo(true)} accessibilityRole="button" accessibilityLabel="Nova revendedora" activeOpacity={0.9}>
        <Feather name="user-plus" size={20} color="#FFFDFA" />
        <T style={s.fabTexto}>Nova revendedora</T>
      </TouchableOpacity>

      <Aviso msg={msg} base={150 + insets.bottom} />
      <TabBar ativa="/mais" />

      <Gaveta aberta={gaveta === 'alertas'} aoFechar={() => setGaveta(null)} titulo="Reposição" subtitulo="Por revendedora · sugestão completa até 10 de cada sabor">
        {grupos.map(({ r, sabores }) => {
          const preencher: Record<string, number> = {};
          sabores.forEach((x) => {
            if (x.produtoId) preencher[x.produtoId] = x.sugestao;
          });
          const total = sabores.reduce((a, x) => a + x.sugestao, 0);
          return (
            <View key={r.id} style={s.grupo}>
              <View style={s.grupoTopo}>
                <View style={[s.avatar, { width: 34, height: 34, borderRadius: 17 }]}>
                  <T style={[s.avatarTexto, { fontSize: 12 }]}>{iniciais(r.nome)}</T>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T style={[s.nome, { fontSize: 14 }]} numberOfLines={1}>{r.nome}</T>
                  <T style={s.dica}>{sabores.length} {sabores.length === 1 ? 'sabor' : 'sabores'} para repor</T>
                </View>
                <TouchableOpacity
                  style={s.entregarTudo}
                  onPress={() => {
                    setGaveta(null);
                    setInicial({ gaveta: 'entrega', preencher });
                    setFichaId(r.id);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Entregar tudo para ${r.nome}`}>
                  <T style={s.entregarTudoTexto}>Entregar tudo +{total}</T>
                </TouchableOpacity>
              </View>
              {sabores.map((x) => {
                const st = STATUS_SABOR[x.status];
                return (
                  <View key={x.produtoId || x.nome} style={s.grupoSabor}>
                    <T style={{ flex: 1, fontSize: 13 }} numberOfLines={1}>{x.nome}</T>
                    <View style={[s.tag, { backgroundColor: st.bg }]}>
                      <T style={[s.tagTexto, numeros, { color: st.fg }]}>{x.status === 'esgotado' ? 'Esgotado' : `${x.saldo} un`}</T>
                    </View>
                    <T style={[s.sugestao, numeros]}>+{x.sugestao}</T>
                  </View>
                );
              })}
            </View>
          );
        })}
      </Gaveta>

      <Gaveta aberta={gaveta === 'filtro'} aoFechar={() => setGaveta(null)} titulo="Comissão" subtitulo="Filtrar pelo formato">
        <View style={s.chips}>
          {([
            ['todas', `Todas · ${contagem.todas}`],
            ['porcentagem', `Comissão em % · ${contagem.porcentagem}`],
            ['valor_fixo', `Valor fixo (R$) · ${contagem.valor_fixo}`],
          ] as const).map(([id, rot]) => (
            <Opcao key={id} rotulo={rot} ativo={filtro === id} forte style={{ minHeight: 40 }} aoTocar={() => { setFiltro(id); setGaveta(null); }} />
          ))}
        </View>
      </Gaveta>

      <RevendedoraFormMobile visivel={novo} revendedora={null} aoFechar={() => setNovo(false)} aoSalvo={(m) => { setNovo(false); avisar(m); }} />

      {ficha && (
        <FichaRevendedora
          r={ficha}
          inicial={inicial}
          aoFechar={() => {
            setFichaId(null);
            setInicial(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// FICHA DA REVENDEDORA (tela inteira) + entrega + acerto
// ============================================================================
function FichaRevendedora({ r, inicial, aoFechar }: { r: Revendedora; inicial: Inicial; aoFechar: () => void }) {
  const insets = useSafeAreaInsets();
  const { msg, avisar } = useAviso();
  const { vendas, entregas, pagamentos } = useRevenda();
  const vitrine = useEstoqueVitrine();
  const [gaveta, setGaveta] = useState<null | 'estoque' | 'todas' | 'entrega' | 'acerto' | 'excluirEntrega' | 'excluirPagamento'>(null);
  const [aba, setAba] = useState<'vendas' | 'entregas'>('vendas');
  const [editando, setEditando] = useState(false);
  const [alvoExcluir, setAlvoExcluir] = useState<string | null>(null);

  const resumo = resumoFinanceiro(r, vendas, pagamentos);
  const sabores = saboresComRevendedora(r.id, entregas, vendas);
  const comEla = sabores.reduce((a, x) => a + x.saldo, 0);
  const atencao = sabores.filter((x) => x.status !== 'abastecido');
  const ordenar = <X extends { data: string }>(l: X[]) => [...l].sort((a, b) => b.data.localeCompare(a.data));
  const minhasVendas = ordenar(vendas.filter((v) => v.revendedoraId === r.id));
  const minhasEntregas = ordenar(entregas.filter((e) => e.revendedoraId === r.id));
  const meusPagamentos = ordenar(pagamentos.filter((p) => p.revendedoraId === r.id));
  const acesso = acessoDaRevendedora(r.id);
  const tel = r.telefone.replace(/\D/g, '');
  const endereco = [r.rua && `${r.rua}${r.numero ? `, ${r.numero}` : ''}`, r.complemento, r.bairro, r.cidade && `${r.cidade}${r.estado ? `/${r.estado}` : ''}`, r.cep && `CEP ${r.cep}`].filter(Boolean).join(' · ');

  // ENTREGA
  const produtos = vitrine.filter(produtoAtivo).map((p) => ({ id: p.id, nome: p.nome, emoji: FOTOS[p.id] ?? EMOJI_CATEGORIA[p.categoria] ?? '🧁', preco: p.preco, estoque: p.estoque }));
  const sugestaoDe: Record<string, number> = {};
  sabores.forEach((x) => {
    if (x.sugestao > 0 && x.produtoId) sugestaoDe[x.produtoId] = x.sugestao;
  });
  const [qtd, setQtd] = useState<Record<string, number>>({});
  const [buscaProd, setBuscaProd] = useState('');
  const [dataEnt, setDataEnt] = useState(dataHojeBR());
  const [obsEnt, setObsEnt] = useState('');
  const [erroEnt, setErroEnt] = useState<string | null>(null);
  const abrirEntrega = (preencher: Record<string, number> = {}) => {
    const limitado: Record<string, number> = {};
    Object.entries(preencher).forEach(([id, n]) => {
      const p = produtos.find((x) => x.id === id);
      if (p) limitado[id] = Math.max(0, Math.min(p.estoque, n));
    });
    setQtd(limitado);
    setBuscaProd('');
    setDataEnt(dataHojeBR());
    setObsEnt('');
    setErroEnt(null);
    setGaveta('entrega');
  };
  useEffect(() => {
    if (inicial?.gaveta === 'entrega') abrirEntrega(inicial.preencher);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const escolhidos = produtos.filter((p) => (qtd[p.id] ?? 0) > 0);
  const totalItens = escolhidos.reduce((a, p) => a + qtd[p.id], 0);
  const valorEmVenda = escolhidos.reduce((a, p) => a + qtd[p.id] * p.preco, 0);
  const confirmarEntrega = () => {
    if (escolhidos.length === 0) return setErroEnt('Escolha ao menos um produto.');
    const dataISO = dataBRParaISO(dataEnt);
    if (!dataISO) return setErroEnt('Informe uma data válida no formato DD/MM/AAAA.');
    registrarEntrega({ id: `ent_${Date.now()}`, revendedoraId: r.id, data: dataISO, itens: escolhidos.map((p) => ({ produtoId: p.id, nome: p.nome, quantidade: qtd[p.id] })), observacoes: obsEnt.trim() || null });
    setGaveta(null);
    avisar(`${totalItens} produtos entregues para ${r.nome.split(' ')[0]}!`);
  };

  // ACERTO (o valor nunca vem preenchido)
  const [valor, setValor] = useState('');
  const [forma, setForma] = useState<FormaPagamento>('pix');
  const [dataPag, setDataPag] = useState(dataHojeBR());
  const [obsPag, setObsPag] = useState('');
  const [erroPag, setErroPag] = useState<string | null>(null);
  const abrirAcerto = () => {
    setValor('');
    setForma('pix');
    setDataPag(dataHojeBR());
    setObsPag('');
    setErroPag(null);
    setGaveta('acerto');
  };
  const valorNum = parseFloat(valor.replace(',', '.'));
  const registrar = () => {
    if (isNaN(valorNum) || valorNum <= 0) return setErroPag('Informe o valor do pagamento.');
    const dataISO = dataBRParaISO(dataPag);
    if (!dataISO) return setErroPag('Informe uma data válida no formato DD/MM/AAAA.');
    registrarPagamento({ revendedoraId: r.id, valor: valorNum, data: dataISO, formaPagamento: forma, observacoes: obsPag.trim() || null });
    setGaveta(null);
    avisar(`Pagamento de ${brl(valorNum)} registrado!`);
  };

  const historico = aba === 'vendas' ? minhasVendas : minhasEntregas;

  const LinhaVenda = ({ v, borda }: { v: (typeof minhasVendas)[number]; borda: boolean }) => {
    const [rot, corSt] = STATUS_VENDA[v.status];
    const promo = v.itens.some((i) => i.comDesconto);
    return (
      <View style={[s.hist, borda && s.borda]}>
        <T style={[s.histData, numeros]}>{dataCurta(v.data)}</T>
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <T style={s.histTitulo} numberOfLines={1}>
            {v.cliente ? `${v.cliente} · ` : ''}
            {v.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(', ')}
            {promo ? ' 🏷' : ''}
          </T>
          <T style={[s.dica, numeros, { color: corSt }]} numberOfLines={1}>
            {rot} · comissão {brl(comissaoDaVenda(v, r))}
            {promo ? ' (promoção: 50%)' : ''}
          </T>
        </View>
        <T style={[s.histValor, numeros]}>{brl(v.total)}</T>
      </View>
    );
  };
  const LinhaEntrega = ({ e, borda }: { e: (typeof minhasEntregas)[number]; borda: boolean }) => (
    <View style={[s.hist, borda && s.borda]}>
      <T style={[s.histData, numeros]}>{dataCurta(e.data)}</T>
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <T style={s.histTitulo} numberOfLines={1}>{e.itens.map((i) => `${i.quantidade}x ${i.nome}`).join(', ')}</T>
        <T style={s.dica} numberOfLines={1}>{e.observacoes || 'Sem observação'}</T>
      </View>
      <T style={[s.histValor, numeros]}>{e.itens.reduce((a, i) => a + i.quantidade, 0)} un</T>
      <TouchableOpacity
        style={s.lixeira}
        onPress={() => {
          setAlvoExcluir(e.id);
          setGaveta('excluirEntrega');
        }}
        accessibilityRole="button"
        accessibilityLabel="Excluir entrega">
        <Feather name="trash-2" size={13} color={cor.textoSuave} />
      </TouchableOpacity>
    </View>
  );

  const dados: { rot: string; val: string; icone: keyof typeof Feather.glyphMap; acao?: [string, () => void] }[] = [
    { rot: 'WhatsApp', val: r.telefone, icone: 'phone', acao: tel ? ['Ligar', () => Linking.openURL(`tel:${tel}`).catch(() => {})] : undefined },
    ...(r.email ? [{ rot: 'E-mail', val: r.email, icone: 'mail' as const }] : []),
    ...(r.cpf ? [{ rot: 'CPF', val: r.cpf, icone: 'credit-card' as const }] : []),
    {
      rot: 'Endereço',
      val: endereco || 'Não informado',
      icone: 'map-pin',
      acao: endereco
        ? [
            'Copiar',
            async () => {
              await Clipboard.setStringAsync(`${r.nome}\n${endereco}`);
              avisar('Endereço copiado!');
            },
          ]
        : undefined,
    },
  ];

  return (
    <Modal visible animationType="slide" onRequestClose={aoFechar} statusBarTranslucent>
      <SafeAreaView style={s.tela} edges={['top']}>
        <View style={s.fichaTopo}>
          <TouchableOpacity onPress={aoFechar} style={[s.redondo, sombra]} accessibilityRole="button" accessibilityLabel="Voltar para revendedoras">
            <Feather name="chevron-left" size={22} color={cor.texto} />
          </TouchableOpacity>
          <T style={s.fichaTopoTexto}>Revendedoras</T>
          <TouchableOpacity onPress={() => setEditando(true)} style={[s.editarTopo, sombra]} accessibilityRole="button" accessibilityLabel="Editar cadastro">
            <T style={s.link}>Editar</T>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          <View style={s.identidade}>
            <View style={[s.avatar, { width: 60, height: 60, borderRadius: 30 }]}>
              <T titulo style={[s.avatarTexto, { fontSize: 20 }]}>{iniciais(r.nome)}</T>
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
              <T titulo style={s.fichaNome}>{r.nome}</T>
              <View style={s.subLinha}>
                {!!r.tag && (
                  <View style={s.tag}>
                    <T style={s.tagTexto}>{r.tag}</T>
                  </View>
                )}
                <View style={[s.tag, { backgroundColor: cor.azulClaro }]}>
                  <T style={[s.tagTexto, { color: cor.azulTexto }]}>{descreverComissao(r)}</T>
                </View>
              </View>
            </View>
          </View>

          <View style={[s.acesso, { backgroundColor: acesso ? cor.verdeClaro : cor.ambarFundo }]}>
            <T style={{ fontSize: 16 }}>🔑</T>
            <T style={[s.acessoTexto, { color: acesso ? cor.verde : cor.ambarTexto }]}>
              {acesso ? (
                <>
                  <T style={[s.acessoTexto, { fontWeight: '800', color: cor.verde }]}>Entra com {r.email}</T>
                  {`\nsenha inicial ${SENHA_PADRAO_REVENDEDORA}`}
                </>
              ) : (
                'Sem acesso ao app: cadastre um e-mail em Editar.'
              )}
            </T>
          </View>

          <View style={s.acoes}>
            <TouchableOpacity style={[s.acao, sombra]} onPress={() => abrirUrl(tel ? `https://wa.me/55${tel}` : 'https://wa.me/')} accessibilityRole="button">
              <Feather name="message-circle" size={19} color={cor.verde} />
              <T style={[s.acaoTexto, { color: cor.verde }]}>WhatsApp</T>
            </TouchableOpacity>
            <TouchableOpacity style={[s.acao, { backgroundColor: cor.azulBotao }]} onPress={() => abrirEntrega()} accessibilityRole="button">
              <Feather name="truck" size={19} color="#FFFDFA" />
              <T style={[s.acaoTexto, { color: '#FFFDFA' }]}>Entregar</T>
            </TouchableOpacity>
            <TouchableOpacity style={[s.acao, { backgroundColor: cor.verde }]} onPress={abrirAcerto} accessibilityRole="button">
              <Feather name="dollar-sign" size={19} color="#FFFDFA" />
              <T style={[s.acaoTexto, { color: '#FFFDFA' }]}>Acerto</T>
            </TouchableOpacity>
          </View>

          {/* FINANCEIRO */}
          <View style={[s.cartao, sombra]}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <View style={{ gap: 2 }}>
                <T style={[s.rotuloPeq, { color: resumo.saldo > 0 ? cor.ambar : cor.verde, fontWeight: '800' }]}>Saldo a pagar</T>
                <T titulo style={[s.valorGrande, numeros, { color: resumo.saldo > 0 ? cor.ambar : cor.verde }]}>{brl(resumo.saldo)}</T>
              </View>
              <T style={[s.dica, numeros, { textAlign: 'right' }]}>
                comissão {brl(resumo.comissao)}
                {'\n'}já pago {brl(resumo.pago)}
              </T>
            </View>
            <View style={[s.resumoLinha, s.borda]}>
              <View style={{ flex: 1 }}>
                <T style={[s.dica, { fontSize: 11 }]}>Vendido</T>
                <T style={[s.forte, numeros]}>{brl(resumo.totalVendido)}</T>
                <T style={[s.dica, { fontSize: 11 }]}>{resumo.qtdVendas} vendas</T>
              </View>
              <View style={{ flex: 0.7 }}>
                <T style={[s.dica, { fontSize: 11 }]}>Itens</T>
                <T style={[s.forte, numeros]}>{resumo.qtdItens} un</T>
              </View>
              <View style={{ flex: 1.3 }}>
                <T style={[s.dica, { fontSize: 11 }]}>Mais vende</T>
                <T style={[s.forte, { fontSize: 12 }]} numberOfLines={2}>{resumo.produtoMaisVendido ? `🏆 ${resumo.produtoMaisVendido}` : '—'}</T>
              </View>
            </View>
          </View>

          {/* ESTOQUE COM ELA (resumo; detalhe ao tocar) */}
          <TouchableOpacity style={[s.cartao, sombra, s.estoqueResumo]} onPress={() => setGaveta('estoque')} accessibilityRole="button" accessibilityLabel="Ver estoque com ela">
            <View style={s.estoqueIcone}>
              <Feather name="package" size={18} color={cor.pistacheTexto} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <T style={s.rotuloPeq}>Estoque com ela</T>
              <T titulo style={[s.valorMedio, numeros]}>
                {comEla} {comEla === 1 ? 'produto' : 'produtos'} · {sabores.length} {sabores.length === 1 ? 'sabor' : 'sabores'}
              </T>
              {atencao.length > 0 ? (
                <T style={[s.dica, { fontWeight: '800', color: cor.ambar }]}>
                  ⚠ {atencao.length} {atencao.length === 1 ? 'sabor precisa' : 'sabores precisam'} de atenção
                </T>
              ) : (
                <T style={[s.dica, { fontWeight: '800', color: cor.verde }]}>✓ Tudo em dia</T>
              )}
            </View>
            <Feather name="chevron-right" size={16} color="#9A8F87" />
          </TouchableOpacity>

          {/* HISTÓRICO: 3 últimas */}
          <View style={[s.cartao, sombra, { gap: 4, paddingBottom: 4 }]}>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 4 }}>
              {([
                ['vendas', `Vendas · ${minhasVendas.length}`],
                ['entregas', `Entregas · ${minhasEntregas.length}`],
              ] as const).map(([id, rot]) => (
                <Opcao key={id} rotulo={rot} ativo={aba === id} forte aoTocar={() => setAba(id)} style={{ minHeight: 34, paddingHorizontal: 12 }} />
              ))}
            </View>
            {historico.length === 0 && <T style={[s.dica, { paddingVertical: 10 }]}>{aba === 'vendas' ? 'Nenhuma venda registrada ainda.' : 'Nenhuma entrega feita ainda.'}</T>}
            {aba === 'vendas'
              ? minhasVendas.slice(0, 3).map((v, i) => <LinhaVenda key={v.id} v={v} borda={i > 0} />)
              : minhasEntregas.slice(0, 3).map((e, i) => <LinhaEntrega key={e.id} e={e} borda={i > 0} />)}
            {historico.length > 3 && (
              <TouchableOpacity style={[s.verTodas, s.borda]} onPress={() => setGaveta('todas')} accessibilityRole="button">
                <T style={s.link}>{aba === 'vendas' ? `Ver todas as ${minhasVendas.length} vendas ›` : `Ver todas as ${minhasEntregas.length} entregas ›`}</T>
              </TouchableOpacity>
            )}
          </View>

          {/* DADOS */}
          <View style={[s.cartao, sombra, { padding: 0, gap: 0 }]}>
            {dados.map((d, i) => (
              <View key={d.rot} style={[s.dado, i > 0 && s.borda]}>
                <View style={s.dadoIcone}>
                  <Feather name={d.icone} size={16} color={cor.textoMedio} />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                  <T style={[s.dica, { fontSize: 11, fontWeight: '700' }]}>{d.rot}</T>
                  <T style={[s.dadoValor, numeros]}>{d.val}</T>
                </View>
                {d.acao && (
                  <TouchableOpacity style={s.miniBotao} onPress={d.acao[1]} accessibilityRole="button">
                    <T style={s.miniBotaoTexto}>{d.acao[0]}</T>
                  </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
          {!!r.observacoes && (
            <View style={s.obs}>
              <T style={{ fontSize: 16 }}>📝</T>
              <View style={{ flex: 1, gap: 2 }}>
                <T style={[s.rotuloPeq, { color: cor.ambarTexto, fontWeight: '800' }]}>Observações</T>
                <T style={s.obsTexto}>{r.observacoes}</T>
              </View>
            </View>
          )}
        </ScrollView>

        <View style={[s.rodape, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          <Botao rotulo="Entregar produtos" variante="secundario" aoTocar={() => abrirEntrega()} style={{ flex: 1 }} />
          <Botao rotulo={resumo.saldo > 0 ? `Acerto · ${brl(resumo.saldo)}` : 'Acerto de contas'} variante="verde" aoTocar={abrirAcerto} style={{ flex: 1 }} />
        </View>

        <Aviso msg={msg} base={100 + insets.bottom} />

        {/* ESTOQUE COMPLETO */}
        <Gaveta aberta={gaveta === 'estoque'} aoFechar={() => setGaveta(null)} titulo={`Estoque com ${r.nome.split(' ')[0]}`} subtitulo={`${comEla} produtos · ${sabores.length} sabores`}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[
              ['Entregue', sabores.reduce((a, x) => a + x.entregue, 0), cor.fundo, cor.textoSuave],
              ['Vendido', sabores.reduce((a, x) => a + x.vendido, 0), cor.fundo, cor.textoSuave],
              ['Com ela', comEla, cor.pistacheClaro, cor.pistacheTexto],
            ].map(([rot, n, bg, fg]) => (
              <View key={rot as string} style={[s.mini, { backgroundColor: bg as string }]}>
                <T style={[s.dica, { fontSize: 11, fontWeight: '700', color: fg as string }]}>{rot}</T>
                <T style={[s.forte, numeros, { color: fg === cor.textoSuave ? cor.texto : (fg as string) }]}>{n} un</T>
              </View>
            ))}
          </View>
          {sabores.length === 0 && <T style={s.dica}>Nenhum produto entregue ainda.</T>}
          <View>
            {sabores.map((x, i) => {
              const st = STATUS_SABOR[x.status];
              return (
                <View key={x.produtoId || x.nome} style={[s.hist, i > 0 && s.borda]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T style={s.histTitulo} numberOfLines={1}>{x.nome}</T>
                    <T style={[s.dica, numeros]}>entregue {x.entregue} · vendido {x.vendido}</T>
                  </View>
                  <View style={[s.tag, { backgroundColor: st.bg }]}>
                    <T style={[s.tagTexto, numeros, { color: st.fg }]}>{x.status === 'esgotado' ? 'Esgotado' : `${x.saldo} un · ${st.rotulo}`}</T>
                  </View>
                  {x.sugestao > 0 && x.produtoId && (
                    <TouchableOpacity style={s.repor} onPress={() => abrirEntrega({ [x.produtoId]: x.sugestao })} accessibilityRole="button">
                      <T style={s.reporTexto}>Repor +{x.sugestao}</T>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>
          {atencao.length > 0 && <Botao rotulo={`Repor o que falta (+${atencao.reduce((a, x) => a + x.sugestao, 0)})`} aoTocar={() => abrirEntrega(sugestaoDe)} />}
        </Gaveta>

        {/* HISTÓRICO COMPLETO */}
        <Gaveta aberta={gaveta === 'todas'} aoFechar={() => setGaveta(null)} titulo={aba === 'vendas' ? 'Todas as vendas' : 'Todas as entregas'} subtitulo={r.nome}>
          <View>
            {aba === 'vendas'
              ? minhasVendas.map((v, i) => <LinhaVenda key={v.id} v={v} borda={i > 0} />)
              : minhasEntregas.map((e, i) => <LinhaEntrega key={e.id} e={e} borda={i > 0} />)}
          </View>
        </Gaveta>

        {/* ENTREGA */}
        <Gaveta aberta={gaveta === 'entrega'} aoFechar={() => setGaveta(null)} titulo="Entregar produtos" subtitulo={`${r.nome.split(' ')[0]} · os produtos saem da vitrine`}>
          {!!erroEnt && (
            <View style={s.erro}>
              <T style={s.erroTexto}>{erroEnt}</T>
            </View>
          )}
          <View style={s.buscaGaveta}>
            <Feather name="search" size={16} color={cor.textoSuave} />
            <TextInput value={buscaProd} onChangeText={setBuscaProd} placeholder="Buscar produto…" placeholderTextColor="#9A8F87" style={s.buscaInput} accessibilityLabel="Buscar produto" />
          </View>
          <View>
            {produtos
              .filter((p) => !buscaProd.trim() || p.nome.toLowerCase().includes(buscaProd.trim().toLowerCase()))
              .map((p, i) => {
                const n = qtd[p.id] ?? 0;
                const sug = sugestaoDe[p.id];
                return (
                  <View key={p.id} style={[s.prodLinha, i > 0 && s.borda, p.estoque <= 0 && { opacity: 0.45 }]}>
                    <T style={{ fontSize: 20 }}>{p.emoji}</T>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T style={s.histTitulo} numberOfLines={1}>{p.nome}</T>
                      <T style={[s.dica, numeros]}>
                        {p.estoque} na vitrine
                        {sug ? <T style={[s.dica, { fontWeight: '800', color: cor.azulTexto }]}> · sugestão +{sug}</T> : null}
                      </T>
                    </View>
                    <View style={s.passo}>
                      <TouchableOpacity style={s.passoBotao} onPress={() => setQtd({ ...qtd, [p.id]: Math.max(0, n - 1) })} accessibilityLabel={`Menos ${p.nome}`}>
                        <Feather name="minus" size={14} color={cor.texto} />
                      </TouchableOpacity>
                      <T style={[s.passoNum, numeros]}>{n}</T>
                      <TouchableOpacity style={[s.passoBotao, n >= p.estoque && { opacity: 0.35 }]} disabled={n >= p.estoque} onPress={() => setQtd({ ...qtd, [p.id]: Math.min(p.estoque, n + 1) })} accessibilityLabel={`Mais ${p.nome}`}>
                        <Feather name="plus" size={14} color={cor.texto} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <T style={s.rotuloPeq}>Data</T>
              <TextInput value={dataEnt} onChangeText={(t) => setDataEnt(mascaraData(t))} placeholder="DD/MM/AAAA" keyboardType="numeric" placeholderTextColor="#9A8F87" style={s.campo} accessibilityLabel="Data da entrega" />
            </View>
            <View style={{ flex: 1.4, gap: 4 }}>
              <T style={s.rotuloPeq}>Observação</T>
              <TextInput value={obsEnt} onChangeText={setObsEnt} placeholder="Opcional" placeholderTextColor="#9A8F87" style={s.campo} accessibilityLabel="Observação da entrega" />
            </View>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T style={[s.dica, numeros, { color: cor.textoMedio }]}>{totalItens} itens · saem da vitrine</T>
            <T style={[s.forte, numeros]}>{brl(valorEmVenda)} em venda</T>
          </View>
          <Botao rotulo="Confirmar entrega" aoTocar={confirmarEntrega} desativado={totalItens === 0} />
        </Gaveta>

        {/* ACERTO */}
        <Gaveta aberta={gaveta === 'acerto'} aoFechar={() => setGaveta(null)} titulo="Acerto de contas" subtitulo={`${r.nome.split(' ')[0]} · ${descreverComissao(r)}`}>
          {!!erroPag && (
            <View style={s.erro}>
              <T style={s.erroTexto}>{erroPag}</T>
            </View>
          )}
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {[
              ['Comissão', resumo.comissao, cor.fundo, cor.textoSuave],
              ['Já pago', resumo.pago, cor.verdeClaro, cor.verde],
              ['Saldo', resumo.saldo, cor.ambarFundo, cor.ambar],
            ].map(([rot, v, bg, fg]) => (
              <View key={rot as string} style={[s.mini, { backgroundColor: bg as string }]}>
                <T style={[s.dica, { fontSize: 11, fontWeight: '700', color: fg as string }]}>{rot}</T>
                <T style={[s.forte, numeros, { color: fg === cor.textoSuave ? cor.texto : (fg as string) }]} numberOfLines={1}>{brl(v as number)}</T>
              </View>
            ))}
          </View>
          <View style={{ gap: 6 }}>
            <T style={s.rotuloPeq}>Valor a pagar</T>
            <TextInput value={valor} onChangeText={(t) => setValor(t.replace(/[^\d,]/g, ''))} placeholder="R$ 0,00" placeholderTextColor="#9A8F87" keyboardType="decimal-pad" style={[s.campo, { fontSize: 18, fontWeight: '800' }]} accessibilityLabel="Valor a pagar" />
            {resumo.saldo > 0 && (
              <TouchableOpacity style={s.usarSaldo} onPress={() => setValor(resumo.saldo.toFixed(2).replace('.', ','))} accessibilityRole="button">
                <T style={s.usarSaldoTexto}>Usar saldo {brl(resumo.saldo)}</T>
              </TouchableOpacity>
            )}
            {!isNaN(valorNum) && valorNum > resumo.saldo + 0.001 && <T style={[s.dica, { fontWeight: '700', color: cor.ambar }]}>Valor maior que o saldo em aberto (fica como adiantamento).</T>}
          </View>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {FORMAS_PAGAMENTO.map((f) => (
              <Opcao key={f.id} rotulo={f.id === 'transferencia' ? 'Transf.' : f.label} ativo={forma === f.id} aoTocar={() => setForma(f.id)} style={{ flex: 1, minHeight: 42, paddingHorizontal: 4 }} />
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1, gap: 4 }}>
              <T style={s.rotuloPeq}>Data</T>
              <TextInput value={dataPag} onChangeText={(t) => setDataPag(mascaraData(t))} placeholder="DD/MM/AAAA" keyboardType="numeric" placeholderTextColor="#9A8F87" style={s.campo} accessibilityLabel="Data do pagamento" />
            </View>
            <View style={{ flex: 1.4, gap: 4 }}>
              <T style={s.rotuloPeq}>Observação</T>
              <TextInput value={obsPag} onChangeText={setObsPag} placeholder="Opcional" placeholderTextColor="#9A8F87" style={s.campo} accessibilityLabel="Observação do pagamento" />
            </View>
          </View>
          <Botao rotulo="Registrar pagamento" variante="verde" aoTocar={registrar} />
          <T style={s.rotuloPeq}>Pagamentos e repasses</T>
          <View>
            {meusPagamentos.length === 0 && <T style={s.dica}>Nenhum pagamento registrado ainda.</T>}
            {meusPagamentos.map((p, i) => (
              <View key={p.id} style={[s.hist, i > 0 && s.borda]}>
                <T style={[s.histData, numeros]}>{dataCurta(p.data)}</T>
                <T style={{ flex: 1, fontSize: 13 }} numberOfLines={1}>
                  {labelFormaPagamento(p.formaPagamento)}
                  {p.observacoes ? ` · ${p.observacoes}` : ''}
                </T>
                <T style={[s.histValor, numeros]}>{brl(p.valor)}</T>
                <TouchableOpacity
                  style={s.lixeira}
                  onPress={() => {
                    setAlvoExcluir(p.id);
                    setGaveta('excluirPagamento');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Excluir pagamento">
                  <Feather name="trash-2" size={13} color={cor.textoSuave} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </Gaveta>

        {/* CONFIRMAÇÕES */}
        <Gaveta aberta={gaveta === 'excluirEntrega'} aoFechar={() => setGaveta(null)} titulo="Excluir esta entrega?" subtitulo="Os produtos voltam para a vitrine">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Botao rotulo="Voltar" variante="secundario" aoTocar={() => setGaveta(null)} style={{ flex: 1 }} />
            <Botao
              rotulo="Excluir"
              variante="perigo"
              style={{ flex: 1.3 }}
              aoTocar={() => {
                const erro = alvoExcluir ? excluirEntrega(alvoExcluir) : null;
                setGaveta(null);
                avisar(erro ?? 'Entrega excluída. Os produtos voltaram para a vitrine.');
              }}
            />
          </View>
        </Gaveta>
        <Gaveta aberta={gaveta === 'excluirPagamento'} aoFechar={() => setGaveta('acerto')} titulo="Excluir este pagamento?" subtitulo="O valor volta para o saldo a pagar">
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Botao rotulo="Voltar" variante="secundario" aoTocar={() => setGaveta('acerto')} style={{ flex: 1 }} />
            <Botao
              rotulo="Excluir"
              variante="perigo"
              style={{ flex: 1.3 }}
              aoTocar={() => {
                if (alvoExcluir) excluirPagamento(alvoExcluir);
                setGaveta(null);
                avisar('Pagamento excluído. O valor voltou para o saldo a pagar.');
              }}
            />
          </View>
        </Gaveta>

        <RevendedoraFormMobile visivel={editando} revendedora={r} aoFechar={() => setEditando(false)} aoSalvo={(m) => { setEditando(false); avisar(m); }} />
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  topo: { paddingHorizontal: 20, paddingTop: 10, gap: 2 },
  titulo: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5 },
  subtitulo: { fontSize: 13, fontWeight: '600', color: cor.textoSuave },
  dica: { fontSize: 12, color: cor.textoSuave },
  link: { fontSize: 13, fontWeight: '800', color: cor.azulTexto },
  forte: { fontSize: 14, fontWeight: '800' },
  rotuloPeq: { fontSize: 12, fontWeight: '700', color: cor.textoSuave },
  valorMedio: { fontSize: 18, fontWeight: '700' },
  valorGrande: { fontSize: 24, fontWeight: '700' },
  cartao: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 22, backgroundColor: '#FFFDFA', gap: 12 },
  alerta: { minHeight: 44, paddingHorizontal: 12, borderRadius: 14, backgroundColor: cor.ambarFundo, flexDirection: 'row', alignItems: 'center', gap: 8 },
  alertaTexto: { fontSize: 13, fontWeight: '800', color: cor.ambarTexto, flexShrink: 1 },
  buscaLinha: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 12 },
  busca: { flex: 1, height: 48, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#FFFDFA', flexDirection: 'row', alignItems: 'center', gap: 10 },
  buscaInput: { flex: 1, minWidth: 0, height: 44, fontSize: 15, color: cor.texto, fontFamily: fonte.texto, ...campoWeb },
  filtro: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#FFFDFA', alignItems: 'center', justifyContent: 'center' },
  lista: { marginHorizontal: 16, marginTop: 12, borderRadius: 22, backgroundColor: '#FFFDFA', overflow: 'hidden' },
  linha: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  borda: { borderTopWidth: 1, borderTopColor: cor.bordaSuave },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: cor.azulClaro, alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { fontSize: 14, fontWeight: '800', color: cor.azulTexto },
  nome: { fontSize: 15, fontWeight: '700' },
  subLinha: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 },
  tag: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 7, backgroundColor: cor.cinzaClaro, maxWidth: '60%' },
  tagTexto: { fontSize: 11, fontWeight: '800', color: cor.textoMedio },
  acessoLinha: { fontSize: 11, fontWeight: '700' },
  saldo: { fontSize: 14, fontWeight: '800' },
  vazio: { margin: 16, marginTop: 24, padding: 28, borderRadius: 22, backgroundColor: '#FFFDFA', alignItems: 'center', gap: 6 },
  vazioTitulo: { fontSize: 16, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fab: { position: 'absolute', right: 16, height: 56, paddingLeft: 18, paddingRight: 22, borderRadius: 28, backgroundColor: cor.azulBotao, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: cor.azulBotao, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  fabTexto: { color: '#FFFDFA', fontSize: 15, fontWeight: '800' },
  grupo: { padding: 12, borderRadius: 18, backgroundColor: '#F8F6F2', gap: 6 },
  grupoTopo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grupoSabor: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 44, paddingTop: 4 },
  sugestao: { width: 34, textAlign: 'right', fontSize: 12, fontWeight: '800', color: cor.azulTexto },
  entregarTudo: { height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: cor.azulBotao, alignItems: 'center', justifyContent: 'center' },
  entregarTudoTexto: { fontSize: 12, fontWeight: '800', color: '#FFFDFA' },
  // ficha
  fichaTopo: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 },
  fichaTopoTexto: { flex: 1, fontSize: 15, fontWeight: '700', color: cor.textoMedio },
  redondo: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFDFA', alignItems: 'center', justifyContent: 'center' },
  editarTopo: { height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: '#FFFDFA', alignItems: 'center', justifyContent: 'center' },
  identidade: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 4 },
  fichaNome: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  acesso: { marginHorizontal: 16, marginTop: 14, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  acessoTexto: { flex: 1, fontSize: 12 },
  acoes: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 12 },
  acao: { flex: 1, height: 62, borderRadius: 18, backgroundColor: '#FFFDFA', alignItems: 'center', justifyContent: 'center', gap: 4 },
  acaoTexto: { fontSize: 12, fontWeight: '800' },
  resumoLinha: { flexDirection: 'row', gap: 6, paddingTop: 10 },
  estoqueResumo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  estoqueIcone: { width: 40, height: 40, borderRadius: 20, backgroundColor: cor.pistacheClaro, alignItems: 'center', justifyContent: 'center' },
  hist: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  histData: { width: 40, fontSize: 12, fontWeight: '700', color: cor.textoSuave },
  histTitulo: { fontSize: 13, fontWeight: '700' },
  histValor: { fontSize: 13, fontWeight: '800' },
  verTodas: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  lixeira: { width: 32, height: 32, borderRadius: 16, backgroundColor: cor.cinzaClaro, alignItems: 'center', justifyContent: 'center' },
  dado: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  dadoIcone: { width: 36, height: 36, borderRadius: 12, backgroundColor: cor.fundo, alignItems: 'center', justifyContent: 'center' },
  dadoValor: { fontSize: 14, fontWeight: '600', lineHeight: 19 },
  miniBotao: { height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: cor.borda, alignItems: 'center', justifyContent: 'center' },
  miniBotaoTexto: { fontSize: 12, fontWeight: '800', color: cor.azulTexto },
  obs: { marginHorizontal: 16, marginTop: 12, padding: 14, paddingHorizontal: 16, borderRadius: 22, backgroundColor: cor.ambarFundo, flexDirection: 'row', gap: 12 },
  obsTexto: { fontSize: 14, lineHeight: 20 },
  rodape: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFFDFA', borderTopWidth: 1, borderTopColor: cor.borda },
  mini: { flex: 1, padding: 10, borderRadius: 14, gap: 1 },
  repor: { height: 34, paddingHorizontal: 10, borderRadius: 17, backgroundColor: cor.azulClaro, alignItems: 'center', justifyContent: 'center' },
  reporTexto: { fontSize: 12, fontWeight: '800', color: cor.azulTexto },
  erro: { padding: 12, borderRadius: 14, backgroundColor: cor.vermelhoClaro },
  erroTexto: { fontSize: 13, fontWeight: '700', color: cor.vermelho },
  buscaGaveta: { height: 46, borderRadius: 14, backgroundColor: cor.fundo, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  prodLinha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  passo: { flexDirection: 'row', alignItems: 'center', height: 38, borderRadius: 19, backgroundColor: cor.cinzaClaro },
  passoBotao: { width: 36, height: 38, alignItems: 'center', justifyContent: 'center' },
  passoNum: { minWidth: 22, textAlign: 'center', fontSize: 14, fontWeight: '800' },
  campo: { height: 48, borderRadius: 14, borderWidth: 1, borderColor: cor.borda, paddingHorizontal: 12, fontSize: 15, color: cor.texto, fontFamily: fonte.texto, ...campoWeb },
  usarSaldo: { alignSelf: 'flex-start', height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: '#F2DDB0', backgroundColor: cor.ambarFundo, alignItems: 'center', justifyContent: 'center' },
  usarSaldoTexto: { fontSize: 12, fontWeight: '800', color: cor.ambarTexto },
});

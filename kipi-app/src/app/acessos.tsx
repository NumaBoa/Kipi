import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  useWindowDimensions,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Sidebar from '@/components/Sidebar';
import { PageHeaderTitulo, TOPO_COMPACTO } from '@/components/PageHeader';
import { useConfigLoja } from '@/lib/configuracoes';
import { acessoDaRevendedora, SENHA_PADRAO_REVENDEDORA } from '@/lib/acesso';
import DossieRevendedoraModal from '@/components/revenda/DossieRevendedoraModal';
import EntregaProdutosModal from '@/components/revenda/EntregaProdutosModal';
import AcertoContasModal from '@/components/revenda/AcertoContasModal';
import {
  Revendedora,
  TipoComissao,
  VendaRevenda,
  EntregaRevenda,
  PagamentoRevenda,
  ProdutoEstoqueLoja,
  ItemEntrega,
  resumoFinanceiro,
  descreverComissao,
  formatMoney,
  useRevenda,
  salvarRevendedora,
  registrarEntrega,
  registrarPagamento,
  excluirEntrega,
  excluirPagamento,
  saboresComRevendedora,
  alertasDeReposicao,
} from '@/lib/revenda';
import { useEstoqueVitrine, produtoAtivo } from '@/lib/estoqueVitrine';

// Emoji do produto na entrega (pela categoria da vitrine)
const EMOJI_CATEGORIA: Record<string, string> = {
  Cookies: '🍪',
  'Bolos & Bentos': '🎂',
  Macarons: '✨',
  Sobremesas: '🥧',
  'Doces Finos': '🍬',
  Presentes: '🎁',
  Folhados: '🥐',
  Bebidas: '☕',
};

// ============================================================================
// TIPOGRAFIA & CONSTANTES DE TEMA (KIPI ATELIÊ / UX SÊNIOR)
// ============================================================================
const FONT_DISPLAY = Platform.select({ web: '"Sora", ui-sans-serif, system-ui, sans-serif', default: 'System' });
const FONT_SANS = Platform.select({ web: '"Manrope", ui-sans-serif, system-ui, sans-serif', default: 'System' });

const KIPI_BLUE = '#5798D7';
const KIPI_BLUE_DARK = '#3E7BB8';
const KIPI_BLUE_TINT = '#EAF3FA';
const KIPI_BLUE_ACCENT = '#2563EB';
const KIPI_FROST_BG = '#F8FAFC';
const SUCCESS_GREEN = '#16A34A';
const SUCCESS_TINT = '#DCFCE7';
const WARNING_AMBER = '#D97706';
const WARNING_TINT = '#FEF3C7';
const DANGER_RED = '#DC2626';
const DANGER_TINT = '#FEE2E2';

export type FiltroComissao = 'todas' | TipoComissao;
type ModalRevenda = 'dossie' | 'entrega' | 'acerto' | null;

const TAGS_SUGERIDAS = ['Revendedora', 'Consignado', 'Ponto de Venda', 'Atacado', 'Indicação'];

// ============================================================================
// MÁSCARAS E VALIDAÇÕES
// ============================================================================
const formatarTelefone = (valor: string) => {
  const limpo = valor.replace(/\D/g, '').slice(0, 11);
  if (limpo.length <= 2) return limpo;
  if (limpo.length <= 6) return `(${limpo.slice(0, 2)}) ${limpo.slice(2)}`;
  if (limpo.length <= 10) return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
  return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
};

const formatarCpf = (valor: string) => {
  const limpo = valor.replace(/\D/g, '').slice(0, 11);
  if (limpo.length <= 3) return limpo;
  if (limpo.length <= 6) return `${limpo.slice(0, 3)}.${limpo.slice(3)}`;
  if (limpo.length <= 9) return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6)}`;
  return `${limpo.slice(0, 3)}.${limpo.slice(3, 6)}.${limpo.slice(6, 9)}-${limpo.slice(9)}`;
};

const formatarCep = (valor: string) => {
  const limpo = valor.replace(/\D/g, '').slice(0, 8);
  if (limpo.length <= 5) return limpo;
  return `${limpo.slice(0, 5)}-${limpo.slice(5)}`;
};

// E-mail: sem espaços, minúsculo
const formatarEmail = (valor: string) => valor.replace(/\s/g, '').toLowerCase();

// Valor da comissão: aceita apenas números e uma vírgula, com até 2 casas decimais
const formatarDecimal = (valor: string) => {
  const limpo = valor.replace(/[^\d,]/g, '');
  const [inteiro, ...resto] = limpo.split(',');
  if (resto.length === 0) return inteiro;
  return `${inteiro},${resto.join('').slice(0, 2)}`;
};

const emailValido = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

const cpfValido = (cpf: string) => {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (base: string, pesoInicial: number) => {
    const soma = base.split('').reduce((acc, n, i) => acc + Number(n) * (pesoInicial - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(d.slice(0, 9), 10) === Number(d[9]) && digito(d.slice(0, 10), 11) === Number(d[10]);
};

export default function AcessosScreen() {
  const { config } = useConfigLoja();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  // Revendedoras, vendas, entregas e pagamentos compartilhados (Visão Geral e cadastro de clientes)
  const { revendedoras, vendas, entregas, pagamentos } = useRevenda();
  const [busca, setBusca] = useState('');
  const [filtroComissao, setFiltroComissao] = useState<FiltroComissao>('todas');
  const [toastMensagem, setToastMensagem] = useState<string | null>(null);

  // ESTOQUE DA LOJA = VITRINE COMPARTILHADA (a entrega baixa a vitrine)
  const vitrine = useEstoqueVitrine();
  const produtosLoja: ProdutoEstoqueLoja[] = vitrine.filter(produtoAtivo).map((p) => ({
    id: p.id,
    nome: p.nome,
    emoji: EMOJI_CATEGORIA[p.categoria] ?? '🧁',
    preco: p.preco,
    estoque: p.estoque,
  }));

  // DOSSIÊ / ENTREGA / ACERTO
  const [modalRevenda, setModalRevenda] = useState<ModalRevenda>(null);
  const [abertoPeloCard, setAbertoPeloCard] = useState(false);
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const selecionada = revendedoras.find((r) => r.id === selecionadaId) || null;

  // MODAL DE CADASTRO / EDIÇÃO
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formNome, setFormNome] = useState('');
  const [formTelefone, setFormTelefone] = useState('');
  const [formTag, setFormTag] = useState('Revendedora');
  const [formEmail, setFormEmail] = useState('');
  const [formCpf, setFormCpf] = useState('');
  const [formTipoComissao, setFormTipoComissao] = useState<TipoComissao>('porcentagem');
  const [formValorComissao, setFormValorComissao] = useState('');
  const [formCep, setFormCep] = useState('');
  const [formRua, setFormRua] = useState('');
  const [formNumero, setFormNumero] = useState('');
  const [formComplemento, setFormComplemento] = useState('');
  const [formBairro, setFormBairro] = useState('');
  const [formCidade, setFormCidade] = useState('');
  const [formEstado, setFormEstado] = useState('');
  const [formObservacoes, setFormObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const abrirDossie = (r: Revendedora) => {
    setSelecionadaId(r.id);
    setAbertoPeloCard(false);
    setModalRevenda('dossie');
  };

  // Atalhos do card: abre entrega/acerto direto e, ao fechar, volta para a lista
  const abrirPeloCard = (r: Revendedora, modal: 'entrega' | 'acerto', preencher: Record<string, number> | null = null) => {
    setSelecionadaId(r.id);
    setAbertoPeloCard(true);
    setPreencherEntrega(preencher);
    setModalRevenda(modal);
  };

  const fecharSubmodal = () => {
    setPreencherEntrega(null);
    setModalRevenda(abertoPeloCard ? null : 'dossie');
  };

  // Atalho do alerta / "Repor +X": entrega já com o sabor e a quantidade sugerida
  const [preencherEntrega, setPreencherEntrega] = useState<Record<string, number> | null>(null);
  const [alertasAbertos, setAlertasAbertos] = useState(false);
  const alertas = useMemo(() => alertasDeReposicao(revendedoras, entregas, vendas), [revendedoras, entregas, vendas]);
  const emPossePorId = useMemo(() => {
    const mapa: Record<string, { unidades: number; repor: boolean }> = {};
    revendedoras.forEach((r) => {
      const sabores = saboresComRevendedora(r.id, entregas, vendas);
      mapa[r.id] = {
        unidades: sabores.reduce((acc, s) => acc + s.saldo, 0),
        repor: sabores.some((s) => s.status !== 'abastecido'),
      };
    });
    return mapa;
  }, [revendedoras, entregas, vendas]);

  // ENTREGA: baixa do estoque da loja e registra a remessa para a revendedora
  const handleConfirmarEntrega = (itens: ItemEntrega[], observacoes: string | null, dataISO: string) => {
    if (!selecionada) return;
    const entrega: EntregaRevenda = {
      id: `ent_${Date.now()}`,
      revendedoraId: selecionada.id,
      data: dataISO,
      itens,
      observacoes,
    };
    // Os produtos saem da vitrine (Pedidos, Produção e Estoque Central já mostram o novo estoque)
    registrarEntrega(entrega);
    fecharSubmodal();

    const totalItens = itens.reduce((acc, i) => acc + i.quantidade, 0);
    exibirToast(`🚚 ${totalItens} produtos entregues para ${selecionada.nome}!`);
  };

  const handleRegistrarPagamento = (dados: Omit<PagamentoRevenda, 'id'>) => {
    registrarPagamento(dados);
    exibirToast(`✅ Pagamento de ${formatMoney(dados.valor)} registrado!`);
  };

  const exibirToast = (msg: string) => {
    setToastMensagem(msg);
    setTimeout(() => setToastMensagem(null), 3800);
  };

  const revendedorasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return revendedoras.filter((r) => {
      const matchBusca =
        !termo ||
        r.nome.toLowerCase().includes(termo) ||
        r.telefone.includes(termo) ||
        (r.email && r.email.toLowerCase().includes(termo)) ||
        (r.cpf && r.cpf.includes(termo)) ||
        (r.tag && r.tag.toLowerCase().includes(termo)) ||
        (r.bairro && r.bairro.toLowerCase().includes(termo)) ||
        (r.cidade && r.cidade.toLowerCase().includes(termo));

      if (!matchBusca) return false;
      if (filtroComissao !== 'todas') return r.tipoComissao === filtroComissao;
      return true;
    });
  }, [revendedoras, busca, filtroComissao]);

  const saldosPorId = useMemo(() => {
    const mapa: Record<string, number> = {};
    revendedoras.forEach((r) => {
      mapa[r.id] = resumoFinanceiro(r, vendas, pagamentos).saldo;
    });
    return mapa;
  }, [revendedoras, vendas, pagamentos]);

  const totalComissoesPendentes = Object.values(saldosPorId).reduce((acc, v) => acc + Math.max(0, v), 0);
  const totalEmPosse = Object.values(emPossePorId).reduce((acc, v) => acc + v.unidades, 0);

  const stats = useMemo(() => ({
    total: revendedoras.length,
    porcentagem: revendedoras.filter((r) => r.tipoComissao === 'porcentagem').length,
    valorFixo: revendedoras.filter((r) => r.tipoComissao === 'valor_fixo').length,
  }), [revendedoras]);

  const limparFormulario = () => {
    setEditandoId(null);
    setFormNome('');
    setFormTelefone('');
    setFormTag('Revendedora');
    setFormEmail('');
    setFormCpf('');
    setFormTipoComissao(config.comissaoPadraoTipo);
    setFormValorComissao(String(config.comissaoPadraoValor).replace('.', ','));
    setFormCep('');
    setFormRua('');
    setFormNumero('');
    setFormComplemento('');
    setFormBairro('');
    setFormCidade('');
    setFormEstado('');
    setFormObservacoes('');
    setErroForm(null);
  };

  const abrirNovaRevendedora = () => {
    limparFormulario();
    setModalAberto(true);
  };

  const abrirEdicao = (r: Revendedora) => {
    setEditandoId(r.id);
    setFormNome(r.nome);
    setFormTelefone(r.telefone);
    setFormTag(r.tag || '');
    setFormEmail(r.email || '');
    setFormCpf(r.cpf || '');
    setFormTipoComissao(r.tipoComissao);
    setFormValorComissao(String(r.valorComissao).replace('.', ','));
    setFormCep(r.cep || '');
    setFormRua(r.rua || '');
    setFormNumero(r.numero || '');
    setFormComplemento(r.complemento || '');
    setFormBairro(r.bairro || '');
    setFormCidade(r.cidade || '');
    setFormEstado(r.estado || '');
    setFormObservacoes(r.observacoes || '');
    setErroForm(null);
    setModalAberto(true);
  };

  const handleSalvar = () => {
    const nomeLimpo = formNome.trim();
    const emailLimpo = formEmail.trim();
    const cpfLimpo = formCpf.trim();
    const valorComissao = parseFloat(formValorComissao.replace(',', '.'));

    if (!nomeLimpo) {
      setErroForm('Informe o nome da revendedora.');
      return;
    }
    if (formTelefone.replace(/\D/g, '').length < 10) {
      setErroForm('Informe um telefone/WhatsApp válido com DDD.');
      return;
    }
    if (emailLimpo && !emailValido(emailLimpo)) {
      setErroForm('O e-mail informado não é válido. Ex: nome@gmail.com');
      return;
    }
    if (cpfLimpo && !cpfValido(cpfLimpo)) {
      setErroForm('O CPF informado não é válido. Confira os números.');
      return;
    }
    if (isNaN(valorComissao) || valorComissao <= 0) {
      setErroForm('Informe o valor da comissão.');
      return;
    }
    if (formTipoComissao === 'porcentagem' && valorComissao > 100) {
      setErroForm('A comissão em porcentagem não pode passar de 100%.');
      return;
    }

    setSalvando(true);
    setErroForm(null);

    const revendedora: Revendedora = {
      id: editandoId || `rev_${Date.now()}`,
      nome: nomeLimpo,
      telefone: formTelefone.trim(),
      email: emailLimpo || null,
      cpf: cpfLimpo || null,
      tag: formTag.trim() || null,
      tipoComissao: formTipoComissao,
      valorComissao,
      cep: formCep.trim() || null,
      rua: formRua.trim() || null,
      numero: formNumero.trim() || null,
      complemento: formComplemento.trim() || null,
      bairro: formBairro.trim() || null,
      cidade: formCidade.trim() || null,
      estado: formEstado.trim().toUpperCase() || null,
      observacoes: formObservacoes.trim() || null,
    };

    // Fase de testes: só dados de exemplo, nada é gravado no banco
    // Já aparece no cadastro de clientes ("Cliente de ...") e na Visão Geral
    salvarRevendedora(revendedora);
    setSalvando(false);
    setModalAberto(false);
    exibirToast(
      editandoId
        ? `✅ Dados de "${revendedora.nome}" atualizados!`
        : `✨ Revendedora "${revendedora.nome}" cadastrada com sucesso!`
    );
    limparFormulario();
  };

  const enderecoResumo = (r: Revendedora) => {
    const linha = [r.rua && `${r.rua}${r.numero ? `, ${r.numero}` : ''}`, r.bairro, r.cidade && `${r.cidade}${r.estado ? `/${r.estado}` : ''}`]
      .filter(Boolean)
      .join(' • ');
    return linha || 'Endereço não informado';
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.screenWrapper}>
        {/* SIDEBAR MODULAR */}
        <Sidebar activeRoute="/acessos" onNotice={(msg) => exibirToast(msg)} />

        {/* CONTEÚDO PRINCIPAL */}
        <View style={styles.mainContainer}>
          {/* CABEÇALHO */}
          <View style={styles.topHeader}>
            <PageHeaderTitulo
              etiqueta="SISTEMA · REVENDEDORAS"
              titulo="Acessos"
              subtitulo="Revendedoras com acesso ao sistema e a regra de comissão de cada uma."
            />

            <View style={styles.topActionsRow}>
              <TouchableOpacity style={styles.btnPrimary} onPress={abrirNovaRevendedora} activeOpacity={0.85}>
                <Feather name="user-plus" size={16} color="#FFFFFF" />
                <Text style={styles.btnPrimaryText}>Nova Revendedora</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* BARRA DE CONTROLE: BUSCA E FILTRO DE COMISSÃO */}
          <View style={styles.controlsBar}>
            <View style={styles.searchBox}>
              <Feather name="search" size={16} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por nome, telefone, e-mail, CPF, tag ou bairro..."
                placeholderTextColor="#94A3B8"
                value={busca}
                onChangeText={setBusca}
              />
              {busca ? (
                <TouchableOpacity onPress={() => setBusca('')}>
                  <Feather name="x" size={15} color="#94A3B8" />
                </TouchableOpacity>
              ) : null}
            </View>

            <View style={styles.tabsContainer}>
              {[
                { id: 'todas', label: 'Todas', count: stats.total },
                { id: 'porcentagem', label: 'Comissão em %', count: stats.porcentagem },
                { id: 'valor_fixo', label: 'Valor fixo (R$)', count: stats.valorFixo },
              ].map((f) => {
                const ativo = filtroComissao === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.tabButton, ativo && styles.tabButtonActive]}
                    onPress={() => setFiltroComissao(f.id as FiltroComissao)}>
                    <Text style={[styles.tabButtonText, ativo && styles.tabButtonTextActive]}>{f.label}</Text>
                    <View style={[styles.tabBadge, ativo && styles.tabBadgeActive]}>
                      <Text style={[styles.tabBadgeText, ativo && styles.tabBadgeTextActive]}>{f.count}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* INDICADORES COMPACTOS */}
          <View style={styles.statsStrip}>
            {[
              { rotulo: 'Revendedoras', valor: String(stats.total), cor: '#0F172A' },
              { rotulo: 'Comissões pendentes', valor: formatMoney(totalComissoesPendentes), cor: totalComissoesPendentes > 0 ? WARNING_AMBER : SUCCESS_GREEN },
              { rotulo: 'Unidades em posse', valor: `${totalEmPosse} un`, cor: '#0F172A' },
              { rotulo: 'Sabores p/ repor', valor: String(alertas.length), cor: alertas.length > 0 ? DANGER_RED : SUCCESS_GREEN },
            ].map((ind, idx) => (
              <View key={ind.rotulo} style={[styles.statItem, idx > 0 && styles.statItemBorda]}>
                <Text style={styles.statRotulo}>{ind.rotulo}</Text>
                <Text style={[styles.statValor, { color: ind.cor }]}>{ind.valor}</Text>
              </View>
            ))}
          </View>

          {/* ALERTA DE REPOSIÇÃO POR SABOR (RECOLHÍVEL) */}
          {alertas.length > 0 && (
            <View style={styles.alertaBar}>
              <TouchableOpacity style={styles.alertaHeader} onPress={() => setAlertasAbertos(!alertasAbertos)}>
                <Feather name="alert-triangle" size={14} color={WARNING_AMBER} />
                <Text style={styles.alertaTitulo}>
                  {alertas.length} {alertas.length === 1 ? 'sabor precisa' : 'sabores precisam'} de reposição
                </Text>
                <Feather name={alertasAbertos ? 'chevron-up' : 'chevron-down'} size={15} color="#92400E" />
              </TouchableOpacity>
              {alertasAbertos &&
                alertas.map(({ revendedora: r, sabor }) => (
                  <View key={`${r.id}-${sabor.produtoId || sabor.nome}`} style={styles.alertaLinha}>
                    <Text style={styles.alertaTexto} numberOfLines={1}>
                      <Text style={{ fontWeight: '700' }}>{r.nome}</Text> · {sabor.nome}:{' '}
                      <Text style={{ fontWeight: '800', color: sabor.status === 'esgotado' ? DANGER_RED : '#92400E' }}>
                        {sabor.saldo} un
                      </Text>
                    </Text>
                    {sabor.produtoId ? (
                      <TouchableOpacity
                        style={styles.alertaBtn}
                        onPress={() => abrirPeloCard(r, 'entrega', { [sabor.produtoId]: sabor.sugestao })}>
                        <Text style={styles.alertaBtnText}>Entregar +{sabor.sugestao}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ))}
            </View>
          )}

          {/* LISTA DE REVENDEDORAS */}
          <ScrollView style={styles.tabContentScroll} showsVerticalScrollIndicator={false}>
            {revendedorasFiltradas.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Feather name="users" size={36} color="#94A3B8" />
                <Text style={styles.emptyTitle}>Nenhuma revendedora encontrada</Text>
                <Text style={styles.emptySubtitle}>
                  {revendedoras.length === 0
                    ? 'Cadastre sua primeira revendedora para começar.'
                    : 'Tente alterar a busca ou o filtro de comissão.'}
                </Text>
              </View>
            ) : (
              <View style={styles.cardsGrid}>
                {revendedorasFiltradas.map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.resellerCard, !isDesktop && styles.resellerCardMobile]}
                    onPress={() => abrirDossie(r)}
                    activeOpacity={0.88}>
                    <View style={styles.cardTop}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{r.nome.substring(0, 2).toUpperCase()}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={styles.nameRow}>
                          <Text style={styles.cardName} numberOfLines={1}>{r.nome}</Text>
                          {r.tag ? (
                            <View style={styles.tagPill}>
                              <Text style={styles.tagPillText}>{r.tag}</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.cardContact}>
                          <Feather name="phone" size={11} color="#64748B" /> {r.telefone}
                        </Text>
                        <Text style={styles.cardContact} numberOfLines={1}>
                          <Feather name="mail" size={11} color="#64748B" /> {r.email || 'Sem e-mail'}
                        </Text>
                        <Text style={[styles.cardContact, { color: acessoDaRevendedora(r.id) ? '#16A34A' : '#D97706' }]} numberOfLines={1}>
                          <Feather name="key" size={11} color={acessoDaRevendedora(r.id) ? '#16A34A' : '#D97706'} />{' '}
                          {acessoDaRevendedora(r.id) ? `Entra com o e-mail · senha inicial ${SENHA_PADRAO_REVENDEDORA}` : 'Sem acesso: cadastre um e-mail'}
                        </Text>
                      </View>
                    </View>

                    {/* REGRA DE COMISSÃO */}
                    <View style={styles.commissionBox}>
                      <View
                        style={[
                          styles.commissionIcon,
                          { backgroundColor: r.tipoComissao === 'porcentagem' ? KIPI_BLUE_TINT : SUCCESS_TINT },
                        ]}>
                        <Feather
                          name={r.tipoComissao === 'porcentagem' ? 'percent' : 'dollar-sign'}
                          size={14}
                          color={r.tipoComissao === 'porcentagem' ? KIPI_BLUE_ACCENT : SUCCESS_GREEN}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.commissionLabel}>REGRA DE COMISSÃO</Text>
                        <Text style={styles.commissionValue}>{descreverComissao(r)}</Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.commissionLabel}>SALDO A PAGAR</Text>
                        <Text
                          style={[
                            styles.commissionValue,
                            { color: (saldosPorId[r.id] || 0) > 0 ? WARNING_AMBER : '#0F172A' },
                          ]}>
                          {formatMoney(saldosPorId[r.id] || 0)}
                        </Text>
                      </View>
                    </View>

                    {/* ESTOQUE EM POSSE */}
                    <View style={styles.posseRow}>
                      <Text style={styles.posseText}>
                        📦 <Text style={{ fontWeight: '800', color: '#0F172A' }}>{emPossePorId[r.id]?.unidades ?? 0} un</Text> em posse
                      </Text>
                      {emPossePorId[r.id]?.repor ? (
                        <View style={styles.reporPill}>
                          <Text style={styles.reporPillText}>⚠ Reposição necessária</Text>
                        </View>
                      ) : null}
                    </View>

                    {r.observacoes ? (
                      <View style={styles.notesBox}>
                        <Feather name="file-text" size={12} color={WARNING_AMBER} style={{ marginTop: 2 }} />
                        <Text style={styles.notesText} numberOfLines={2}>{r.observacoes}</Text>
                      </View>
                    ) : null}

                    {/* ATALHOS: ENTREGAR PRODUTOS E ACERTO DE CONTAS */}
                    <View style={styles.cardActionsRow}>
                      <TouchableOpacity
                        style={styles.cardActionBtn}
                        onPress={() => abrirPeloCard(r, 'entrega')}
                        activeOpacity={0.8}>
                        <Feather name="truck" size={13} color={KIPI_BLUE_ACCENT} />
                        <Text style={styles.cardActionText}>Entregar produtos</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.cardActionBtn, styles.cardActionBtnAcerto]}
                        onPress={() => abrirPeloCard(r, 'acerto')}
                        activeOpacity={0.8}>
                        <Feather name="dollar-sign" size={13} color={SUCCESS_GREEN} />
                        <Text style={[styles.cardActionText, { color: SUCCESS_GREEN }]}>Acerto de contas</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.cardFooter}>
                      <Text style={styles.addressText} numberOfLines={1}>📍 {enderecoResumo(r)}</Text>
                      <View style={styles.cardFooterRight}>
                        {r.cpf ? <Text style={styles.cpfText}>CPF {r.cpf}</Text> : null}
                        <Feather name="chevron-right" size={14} color={KIPI_BLUE_ACCENT} />
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* =========================================================================
          MODAL: CADASTRAR / EDITAR REVENDEDORA
      ========================================================================== */}
      <Modal
        visible={modalAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setModalAberto(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderIcon}>
                <Feather name="briefcase" size={18} color={KIPI_BLUE_ACCENT} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{editandoId ? 'Editar Revendedora' : 'Nova Revendedora'}</Text>
                <Text style={styles.modalSubtitle}>Campos com * são obrigatórios.</Text>
              </View>
              <TouchableOpacity onPress={() => setModalAberto(false)}>
                <Feather name="x" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {erroForm && (
              <View style={styles.errorAlert}>
                <Feather name="alert-circle" size={14} color={DANGER_RED} />
                <Text style={styles.errorAlertText}>{erroForm}</Text>
              </View>
            )}

            <ScrollView style={styles.formScroll} contentContainerStyle={styles.formScrollContent}>
              {/* SEÇÃO 1: DADOS PESSOAIS */}
              <Text style={styles.formSectionTitle}>1. DADOS DA REVENDEDORA</Text>

              <View style={[styles.formRow, !isDesktop && styles.formRowMobile]}>
                <View style={{ flex: 1.4 }}>
                  <Text style={styles.inputLabel}>Nome completo *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Ex: Juliana Martins Costa"
                    placeholderTextColor="#94A3B8"
                    value={formNome}
                    onChangeText={setFormNome}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Telefone / WhatsApp *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="(21) 99999-9999"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    value={formTelefone}
                    onChangeText={(t) => setFormTelefone(formatarTelefone(t))}
                  />
                </View>
              </View>

              <View style={[styles.formRow, !isDesktop && styles.formRowMobile]}>
                <View style={{ flex: 1.4 }}>
                  <Text style={styles.inputLabel}>E-mail</Text>
                  <TextInput
                    style={[styles.formInput, formEmail.length > 0 && !emailValido(formEmail) && styles.formInputInvalid]}
                    placeholder="nome@gmail.com"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={formEmail}
                    onChangeText={(t) => setFormEmail(formatarEmail(t))}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>CPF</Text>
                  <TextInput
                    style={[styles.formInput, formCpf.length === 14 && !cpfValido(formCpf) && styles.formInputInvalid]}
                    placeholder="000.000.000-00"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={formCpf}
                    onChangeText={(t) => setFormCpf(formatarCpf(t))}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Tag</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Ex: Revendedora"
                placeholderTextColor="#94A3B8"
                value={formTag}
                onChangeText={setFormTag}
              />
              <View style={styles.tagsQuickRow}>
                {TAGS_SUGERIDAS.map((tg) => (
                  <TouchableOpacity
                    key={tg}
                    style={[styles.tagQuickChip, formTag === tg && styles.tagQuickChipActive]}
                    onPress={() => setFormTag(tg)}>
                    <Text style={[styles.tagQuickChipText, formTag === tg && styles.tagQuickChipTextActive]}>{tg}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* SEÇÃO 2: REGRAS DE REVENDA */}
              <Text style={styles.formSectionTitle}>2. REGRAS DE REVENDA</Text>

              <Text style={styles.inputLabel}>Formato da comissão *</Text>
              <View style={styles.segmented}>
                {[
                  { id: 'porcentagem', label: 'Porcentagem (%)', icon: 'percent' as const },
                  { id: 'valor_fixo', label: 'Valor fixo por produto (R$)', icon: 'dollar-sign' as const },
                ].map((op) => {
                  const ativo = formTipoComissao === op.id;
                  return (
                    <TouchableOpacity
                      key={op.id}
                      style={[styles.segmentedBtn, ativo && styles.segmentedBtnActive]}
                      onPress={() => setFormTipoComissao(op.id as TipoComissao)}>
                      <Feather name={op.icon} size={14} color={ativo ? KIPI_BLUE_ACCENT : '#64748B'} />
                      <Text style={[styles.segmentedText, ativo && styles.segmentedTextActive]}>{op.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.inputLabel}>
                {formTipoComissao === 'porcentagem' ? 'Comissão sobre o valor vendido *' : 'Valor pago por produto vendido *'}
              </Text>
              <View style={styles.affixInputWrap}>
                {formTipoComissao === 'valor_fixo' && <Text style={styles.affixText}>R$</Text>}
                <TextInput
                  style={styles.affixInput}
                  placeholder={formTipoComissao === 'porcentagem' ? '15' : '3,50'}
                  placeholderTextColor="#94A3B8"
                  keyboardType="decimal-pad"
                  value={formValorComissao}
                  onChangeText={(t) => setFormValorComissao(formatarDecimal(t))}
                />
                {formTipoComissao === 'porcentagem' && <Text style={styles.affixText}>%</Text>}
              </View>
              <Text style={styles.helperText}>
                {formTipoComissao === 'porcentagem'
                  ? 'Ex: 15% → numa venda de R$ 100,00 a revendedora recebe R$ 15,00.'
                  : 'Ex: R$ 3,50 → a cada produto vendido a revendedora recebe R$ 3,50.'}
              </Text>

              {/* SEÇÃO 3: ENDEREÇO */}
              <Text style={styles.formSectionTitle}>3. ENDEREÇO</Text>

              <View style={[styles.formRow, !isDesktop && styles.formRowMobile]}>
                <View style={{ flex: 0.8 }}>
                  <Text style={styles.inputLabel}>CEP</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="00000-000"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={formCep}
                    onChangeText={(t) => setFormCep(formatarCep(t))}
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Text style={styles.inputLabel}>Rua</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Ex: Rua General Severiano"
                    placeholderTextColor="#94A3B8"
                    value={formRua}
                    onChangeText={setFormRua}
                  />
                </View>
              </View>

              <View style={[styles.formRow, !isDesktop && styles.formRowMobile]}>
                <View style={{ flex: 0.6 }}>
                  <Text style={styles.inputLabel}>Número</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="84"
                    placeholderTextColor="#94A3B8"
                    value={formNumero}
                    onChangeText={setFormNumero}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Complemento</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Apto, bloco..."
                    placeholderTextColor="#94A3B8"
                    value={formComplemento}
                    onChangeText={setFormComplemento}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Bairro</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Ex: Botafogo"
                    placeholderTextColor="#94A3B8"
                    value={formBairro}
                    onChangeText={setFormBairro}
                  />
                </View>
              </View>

              <View style={[styles.formRow, !isDesktop && styles.formRowMobile]}>
                <View style={{ flex: 2 }}>
                  <Text style={styles.inputLabel}>Cidade</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Ex: Rio de Janeiro"
                    placeholderTextColor="#94A3B8"
                    value={formCidade}
                    onChangeText={setFormCidade}
                  />
                </View>
                <View style={{ flex: 0.6 }}>
                  <Text style={styles.inputLabel}>UF</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="RJ"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                    maxLength={2}
                    value={formEstado}
                    onChangeText={(t) => setFormEstado(t.replace(/[^a-zA-Z]/g, '').toUpperCase())}
                  />
                </View>
              </View>

              {/* SEÇÃO 4: OBSERVAÇÕES */}
              <Text style={styles.formSectionTitle}>4. OBSERVAÇÕES</Text>
              <TextInput
                style={[styles.formInput, styles.formTextarea]}
                placeholder="Ex: dias de retirada, produtos que revende, combinados de acerto..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                value={formObservacoes}
                onChangeText={setFormObservacoes}
              />

              {/* AVISO: ACESSO AO SISTEMA (PRÓXIMA ETAPA) */}
              <View style={styles.accessNotice}>
                <Feather name="lock" size={14} color={KIPI_BLUE_DARK} />
                <Text style={styles.accessNoticeText}>
                  Login e senha de acesso da revendedora ao sistema serão configurados em uma próxima etapa.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.btnCancel} onPress={() => setModalAberto(false)}>
                <Text style={styles.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnPrimary} onPress={handleSalvar} disabled={salvando}>
                {salvando ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="check" size={16} color="#FFFFFF" />
                    <Text style={styles.btnPrimaryText}>{editandoId ? 'Salvar Alterações' : 'Cadastrar Revendedora'}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* =========================================================================
          DOSSIÊ DA REVENDEDORA + ENTREGA DE PRODUTOS + ACERTO DE CONTAS
      ========================================================================== */}
      <DossieRevendedoraModal
        visible={modalRevenda === 'dossie'}
        revendedora={selecionada}
        vendas={vendas}
        entregas={entregas}
        pagamentos={pagamentos}
        onClose={() => setModalRevenda(null)}
        onEntregar={() => setModalRevenda('entrega')}
        onAcerto={() => setModalRevenda('acerto')}
        onEditar={() => {
          setModalRevenda(null);
          if (selecionada) abrirEdicao(selecionada);
        }}
        onRepor={(preencher) => {
          setPreencherEntrega(preencher);
          setModalRevenda('entrega');
        }}
        onExcluirEntrega={(id) => {
          const erro = excluirEntrega(id);
          exibirToast(erro ?? '🗑️ Entrega excluída. Os produtos voltaram para a vitrine.');
        }}
      />

      <EntregaProdutosModal
        visible={modalRevenda === 'entrega'}
        revendedora={selecionada}
        produtos={produtosLoja}
        preencher={preencherEntrega}
        onClose={fecharSubmodal}
        onConfirmar={handleConfirmarEntrega}
      />

      <AcertoContasModal
        visible={modalRevenda === 'acerto'}
        revendedora={selecionada}
        vendas={vendas}
        pagamentos={pagamentos}
        onClose={fecharSubmodal}
        onRegistrar={handleRegistrarPagamento}
        onExcluir={(id) => {
          excluirPagamento(id);
          exibirToast('🗑️ Pagamento excluído. O valor voltou para o saldo a pagar.');
        }}
      />

      {/* TOAST */}
      {toastMensagem && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toastMensagem}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  screenWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: KIPI_FROST_BG,
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 20,
    backgroundColor: KIPI_FROST_BG,
  },

  // CABEÇALHO
  topHeader: TOPO_COMPACTO,
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: KIPI_BLUE,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  btnPrimaryText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // CONTROLES
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  searchBox: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontFamily: FONT_SANS,
    fontSize: 13,
    color: '#0F172A',
    ...Platform.select({ web: { outlineStyle: 'none' } as any }),
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexWrap: 'wrap',
    gap: 4,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 8,
  },
  tabButtonActive: {
    backgroundColor: KIPI_BLUE_TINT,
  },
  tabButtonText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  tabButtonTextActive: {
    color: KIPI_BLUE_ACCENT,
    fontWeight: '800',
  },
  tabBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tabBadgeActive: {
    backgroundColor: '#FFFFFF',
  },
  tabBadgeText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  tabBadgeTextActive: {
    color: KIPI_BLUE_ACCENT,
  },
  tabContentScroll: {
    flex: 1,
  },

  // CARDS
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    paddingBottom: 30,
  },
  resellerCard: {
    width: '32%',
    minWidth: 300,
    flexGrow: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  resellerCardMobile: {
    width: '100%',
    minWidth: 0,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
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
    gap: 6,
    flexWrap: 'wrap',
    marginBottom: 2,
  },
  cardName: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    flexShrink: 1,
  },
  tagPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagPillText: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  cardContact: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  commissionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KIPI_FROST_BG,
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  commissionIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commissionLabel: {
    fontFamily: FONT_SANS,
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  commissionValue: {
    fontFamily: FONT_DISPLAY,
    fontSize: 13,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 1,
  },
  statsStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  statItem: {
    flexGrow: 1,
    minWidth: 120,
    paddingHorizontal: 14,
  },
  statItemBorda: {
    borderLeftWidth: 1,
    borderLeftColor: '#F1F5F9',
  },
  statRotulo: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statValor: {
    fontFamily: FONT_DISPLAY,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 2,
  },
  alertaBar: {
    backgroundColor: WARNING_TINT,
    borderWidth: 1,
    borderColor: '#FCD34D',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
    gap: 6,
  },
  alertaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  alertaTitulo: {
    flex: 1,
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
  },
  alertaLinha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  alertaTexto: {
    flex: 1,
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#475569',
  },
  alertaBtn: {
    backgroundColor: KIPI_BLUE_TINT,
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  alertaBtnText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: KIPI_BLUE_ACCENT,
  },
  posseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  posseText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#64748B',
  },
  reporPill: {
    backgroundColor: WARNING_TINT,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  reporPillText: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '700',
    color: '#92400E',
  },
  notesBox: {
    flexDirection: 'row',
    gap: 6,
    backgroundColor: WARNING_TINT,
    borderRadius: 10,
    padding: 8,
  },
  notesText: {
    flex: 1,
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#78350F',
    lineHeight: 16,
  },
  cardActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cardActionBtn: {
    flex: 1,
    minWidth: 130,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: KIPI_BLUE_TINT,
  },
  cardActionBtnAcerto: {
    borderColor: '#BBF7D0',
    backgroundColor: '#F0FDF4',
  },
  cardActionText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: KIPI_BLUE_ACCENT,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    gap: 8,
  },
  addressText: {
    flex: 1,
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#64748B',
  },
  cardFooterRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cpfText: {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 40,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  emptyTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  emptySubtitle: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#64748B',
  },

  // MODAL
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 640,
    maxHeight: '92%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    boxShadow: '0 20px 40px rgba(0,0,0,0.18)',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalHeaderIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: KIPI_BLUE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  errorAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: DANGER_TINT,
    marginHorizontal: 20,
    marginTop: 14,
    padding: 10,
    borderRadius: 10,
  },
  errorAlertText: {
    flex: 1,
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '600',
    color: DANGER_RED,
  },
  formScroll: {
    flexGrow: 0,
  },
  formScrollContent: {
    padding: 20,
    paddingTop: 6,
  },
  formSectionTitle: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '800',
    color: KIPI_BLUE_DARK,
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 10,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  formRowMobile: {
    flexDirection: 'column',
  },
  inputLabel: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 6,
  },
  formInput: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: KIPI_FROST_BG,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...Platform.select({ web: { outlineStyle: 'none' } as any }),
  },
  formInputInvalid: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FFF7F7',
  },
  formTextarea: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  tagsQuickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  tagQuickChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  tagQuickChipActive: {
    borderColor: KIPI_BLUE,
    backgroundColor: KIPI_BLUE_TINT,
  },
  tagQuickChipText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  tagQuickChipTextActive: {
    color: KIPI_BLUE_ACCENT,
    fontWeight: '800',
  },
  segmented: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  segmentedBtn: {
    flex: 1,
    minWidth: 200,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  segmentedBtnActive: {
    borderColor: KIPI_BLUE,
    backgroundColor: KIPI_BLUE_TINT,
  },
  segmentedText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  segmentedTextActive: {
    color: KIPI_BLUE_ACCENT,
    fontWeight: '800',
  },
  affixInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KIPI_FROST_BG,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    maxWidth: 220,
    gap: 6,
  },
  affixText: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    fontWeight: '800',
    color: '#64748B',
  },
  affixInput: {
    flex: 1,
    fontFamily: FONT_DISPLAY,
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    paddingVertical: 9,
    ...Platform.select({ web: { outlineStyle: 'none' } as any }),
  },
  helperText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
  },
  accessNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: KIPI_BLUE_TINT,
    borderRadius: 10,
    padding: 10,
    marginTop: 18,
  },
  accessNoticeText: {
    flex: 1,
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: KIPI_BLUE_DARK,
    lineHeight: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  btnCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  btnCancelText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },

  // TOAST
  toast: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    backgroundColor: '#0F172A',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
  },
  toastText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

import { paraCelular } from '@/lib/responsivo';
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
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Sidebar from '@/components/Sidebar';
import NovoPedidoModal from '@/components/NovoPedidoModal';
import ClienteFormModal, { ClienteCadastrado } from '@/components/ClienteFormModal';
import {
  useClientes,
  usePedidos,
  metricasCliente,
  salvarCliente,
  alternarStatusCliente as alternarStatusNaLista,
  cadastroDoFormulario,
  type ClienteCompleto,
  type ClienteCadastro,
} from '@/lib/clientesPedidos';
import { useEscopoRevendedora, pedidosDoEscopo } from '@/lib/minhaRevenda';
import { useEhCelular } from '@/lib/layout';
import ClientesMobile from '@/components/clientes-mobile/ClientesMobile';

// ============================================================================
// TIPOGRAFIA & CONSTANTES DE TEMA (ATELIÊ SAGE / LOVABLE)
// ============================================================================
const FONT_DISPLAY = Platform.select({ web: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif', default: 'System' });
const FONT_SANS = Platform.select({ web: '"Instrument Sans", ui-sans-serif, system-ui, sans-serif', default: 'System' });

const ATELIE_GREEN = '#7A4520';
const ATELIE_TINT = '#F6E8D6';
const ATELIE_SUCCESS = '#2F7D55';

export type ViewMode = 'grid' | 'lista' | 'cards';
export type StatusFilter = 'todos' | 'ativos' | 'inativos' | 'aniversariantes';

// Celular: lista, ficha e cadastro próprios; computador: tela completa abaixo
export default function ClientesScreen() {
  const celular = useEhCelular();
  return celular ? <ClientesMobile /> : <ClientesDesktop />;
}

function ClientesDesktop() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  // ESTADOS DA TELA
  // Clientes compartilhados: total gasto, pedidos e produtos comprados saem dos pedidos
  // Revendedora: só os clientes dela, com totais calculados só pelas vendas dela
  const escopo = useEscopoRevendedora();
  const todosPedidos = usePedidos();
  const todosClientes = useClientes();
  const clientes = escopo.ehRevendedora
    ? todosClientes
        .filter((c) => c.revendedoraId === escopo.revendedoraId)
        .map((c) => ({ ...c, ...metricasCliente(c, pedidosDoEscopo(todosPedidos, escopo.revendedoraId)) }))
    : todosClientes;
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [busca, setBusca] = useState('');

  // MODAIS
  const [modalNovoClienteAberto, setModalNovoClienteAberto] = useState(false);
  const [clienteEmEdicao, setClienteEmEdicao] = useState<ClienteCompleto | null>(null);
  const [confirmandoInativacao, setConfirmandoInativacao] = useState(false);
  // Guarda só o id: o dossiê se atualiza sozinho quando entra um pedido novo do cliente
  const [clienteDetalheId, setClienteDetalheId] = useState<string | null>(null);
  const clienteDetalhe = clientes.find((c) => c.id === clienteDetalheId) ?? null;
  const setClienteDetalhe = (c: ClienteCompleto | null) => setClienteDetalheId(c?.id ?? null);
  const [modalNovoPedidoAberto, setModalNovoPedidoAberto] = useState(false);
  const [toastMensagem, setToastMensagem] = useState<string | null>(null);

  const exibirToast = (msg: string) => {
    setToastMensagem(msg);
    setTimeout(() => {
      setToastMensagem(null);
    }, 3800);
  };

  // FILTRAGEM DE CLIENTES
  const mesAtual = new Date().getMonth() + 1; // 1-12 (Outubro = 10)

  const clientesFiltrados = useMemo(() => {
    return clientes.filter((c) => {
      // 1. Busca por qualquer campo
      const termo = busca.trim().toLowerCase();
      const matchBusca =
        !termo ||
        c.nome.toLowerCase().includes(termo) ||
        c.telefone.toLowerCase().includes(termo) ||
        (c.email && c.email.toLowerCase().includes(termo)) ||
        (c.bairro && c.bairro.toLowerCase().includes(termo)) ||
        (c.rua && c.rua.toLowerCase().includes(termo)) ||
        (c.tag && c.tag.toLowerCase().includes(termo)) ||
        (c.observacoes && c.observacoes.toLowerCase().includes(termo));

      if (!matchBusca) return false;

      // 2. Filtro de Status
      if (statusFilter === 'ativos') return c.status === 'ativo';
      if (statusFilter === 'inativos') return c.status === 'inativo';
      if (statusFilter === 'aniversariantes') return c.mesAniversario === mesAtual;

      return true;
    });
  }, [clientes, busca, statusFilter, mesAtual]);

  // ESTATÍSTICAS RÁPIDAS
  const stats = useMemo(() => {
    const total = clientes.length;
    const ativos = clientes.filter((c) => c.status === 'ativo').length;
    const inativos = clientes.filter((c) => c.status === 'inativo').length;
    const aniversariantesMes = clientes.filter((c) => c.mesAniversario === mesAtual).length;
    const somaFaturamento = clientes.reduce((acc, c) => acc + c.totalGasto, 0);

    return { total, ativos, inativos, aniversariantesMes, somaFaturamento };
  }, [clientes, mesAtual]);

  // CONVERSÃO PARA O FORMULÁRIO COMPARTILHADO
  const paraFormulario = (c: ClienteCompleto): ClienteCadastrado => ({
    id: c.id,
    nome: c.nome,
    telefone: c.telefone,
    tag: c.tag || '',
    cpfCnpj: c.cpf_cnpj || null,
    cep: c.cep || null,
    rua: c.rua || null,
    numero: c.numero || null,
    complemento: c.complemento || null,
    bairro: c.bairro || null,
    cidade: c.cidade || null,
    estado: c.estado || null,
    aniversario: c.aniversario || null,
    email: c.email || null,
    observacoes: c.observacoes || null,
    revendedoraId: c.revendedoraId || null,
    revendedoraNome: c.revendedoraNome || null,
  });

  // CLIENTE SALVO PELO FORMULÁRIO (NOVO OU EDIÇÃO)
  const handleClienteSalvo = (cadastrado: ClienteCadastrado) => {
    if (clienteEmEdicao) {
      const atualizado: ClienteCadastro = cadastroDoFormulario(cadastrado, clienteEmEdicao.status);
      salvarCliente(atualizado);
      setClienteDetalheId(atualizado.id);
      setClienteEmEdicao(null);
      setModalNovoClienteAberto(false);
      exibirToast(`✓ Dados de "${atualizado.nome}" atualizados!`);
      return;
    }

    // Cadastrado aqui já aparece no Novo Pedido
    const novo = cadastroDoFormulario(cadastrado);
    salvarCliente(novo);
    setModalNovoClienteAberto(false);
    exibirToast(`✨ Cliente "${novo.nome}" cadastrado com sucesso!`);
  };

  const abrirEdicaoCliente = (c: ClienteCompleto) => {
    setClienteEmEdicao(c);
    setModalNovoClienteAberto(true);
  };

  // EXCLUSÃO LÓGICA: o cliente fica inativo e pode ser reativado
  const alternarStatusCliente = (c: ClienteCompleto) => {
    const novoStatus: ClienteCompleto['status'] = c.status === 'ativo' ? 'inativo' : 'ativo';
    alternarStatusNaLista(c.id);
    setConfirmandoInativacao(false);
    exibirToast(novoStatus === 'inativo' ? `Cliente "${c.nome}" inativado.` : `Cliente "${c.nome}" reativado!`);
  };

  const abrirWhatsAppCliente = (c: ClienteCompleto) => {
    const tel = c.telefone.replace(/\D/g, '');
    if (!tel) return;
    Linking.openURL(`https://wa.me/55${tel}`);
  };

  const enderecoCompleto = (c: ClienteCompleto) =>
    [
      c.rua ? `${c.rua}, ${c.numero || 'S/N'}` : null,
      c.complemento || null,
      c.bairro || null,
      c.cidade ? `${c.cidade}${c.estado ? ` - ${c.estado}` : ''}` : null,
      c.cep ? `CEP ${c.cep}` : null,
    ]
      .filter(Boolean)
      .join(', ');

  const copiarEndereco = (c: ClienteCompleto) => {
    const texto = enderecoCompleto(c);
    if (!texto) {
      exibirToast('Este cliente não tem endereço cadastrado.');
      return;
    }
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(`${c.nome}\n${texto}`);
    }
    exibirToast('📋 Endereço copiado!');
  };

  return (
    <SafeAreaView style={styles.viewport}>
      <View style={styles.mainLayout}>

        {/* =========================================================================
            MENU LATERAL MODULAR
        ========================================================================== */}
        <Sidebar
          activeRoute="/clientes"
          onNotice={(msg) => exibirToast(msg)}
        />

        {/* =========================================================================
            CONTEÚDO PRINCIPAL (TELA DE CLIENTES)
        ========================================================================== */}
        <View style={styles.contentArea}>

          {/* CABEÇALHO SUPERIOR COM BARRA DE BUSCA E NOVO CLIENTE */}
          <View style={styles.topHeader}>
            <View style={styles.topHeaderLeft}>
              <View style={styles.tagBadge}>
                <Text style={styles.tagBadgeText}>{escopo.ehRevendedora ? 'REVENDA · MEUS CLIENTES' : 'ATELIÊ · CLIENTES & FIDELIDADE'}</Text>
              </View>
              <Text style={styles.pageTitle}>{escopo.ehRevendedora ? 'Meus Clientes' : 'Gestão de Clientes do Ateliê'}</Text>
              <Text style={styles.pageSubtitle}>
                Histórico de compras, preferências gastronômicas e fidelidade.
              </Text>
            </View>

            <View style={styles.topHeaderActions}>
              <TouchableOpacity
                style={styles.btnNovoClientePrimary}
                onPress={() => {
                  setClienteEmEdicao(null);
                  setModalNovoClienteAberto(true);
                }}
                activeOpacity={0.85}>
                <Feather name="user-plus" size={16} color="#FFFDFA" />
                <Text style={styles.btnNovoClientePrimaryText}>Novo Cliente</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* BARRA DE CONTROLE: BUSCA, FILTROS E MODO DE VISUALIZAÇÃO */}
          <View style={styles.controlsBar}>
            {/* CAMPO DE BUSCA LIVRE (POR QUALQUER DADO DO CADASTRO) */}
            <View style={styles.searchBox}>
              <Feather name="search" size={16} color="#9A8F87" />
              <TextInput
                style={styles.searchInput}
                placeholder="Buscar por nome, telefone, email, bairro, rua ou tag..."
                placeholderTextColor="#9A8F87"
                value={busca}
                onChangeText={setBusca}
              />
              {busca ? (
                <TouchableOpacity onPress={() => setBusca('')}>
                  <Feather name="x" size={15} color="#9A8F87" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* FILTROS DE STATUS (TODOS, ATIVOS, INATIVOS, ANIVERSARIANTES) */}
            <View style={styles.statusPillsTrack}>
              {[
                { id: 'todos', label: `Todos (${stats.total})` },
                { id: 'ativos', label: `Ativos (${stats.ativos})` },
                { id: 'inativos', label: `Inativos (${stats.inativos})` },
                { id: 'aniversariantes', label: `🎂 Aniversariantes (${stats.aniversariantesMes})` },
              ].map((f) => {
                const ativo = statusFilter === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[styles.filterPill, ativo && styles.filterPillActive]}
                    onPress={() => setStatusFilter(f.id as any)}>
                    <Text style={[styles.filterPillText, ativo && styles.filterPillTextActive]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* SELETOR DE MODO DE VISUALIZAÇÃO (GRID, LISTA, CARDS) */}
            <View style={styles.viewModeSwitcher}>
              <TouchableOpacity
                style={[styles.viewModeBtn, viewMode === 'cards' && styles.viewModeBtnActive]}
                onPress={() => setViewMode('cards')}
                accessibilityLabel="Visualização em Cards">
                <Feather
                  name="credit-card"
                  size={15}
                  color={viewMode === 'cards' ? ATELIE_GREEN : '#6B615A'}
                />
                <Text style={[styles.viewModeBtnText, viewMode === 'cards' && styles.viewModeBtnTextActive]}>
                  Cards
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.viewModeBtn, viewMode === 'grid' && styles.viewModeBtnActive]}
                onPress={() => setViewMode('grid')}
                accessibilityLabel="Visualização em Grade">
                <Feather
                  name="grid"
                  size={15}
                  color={viewMode === 'grid' ? ATELIE_GREEN : '#6B615A'}
                />
                <Text style={[styles.viewModeBtnText, viewMode === 'grid' && styles.viewModeBtnTextActive]}>
                  Grid
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.viewModeBtn, viewMode === 'lista' && styles.viewModeBtnActive]}
                onPress={() => setViewMode('lista')}
                accessibilityLabel="Visualização em Lista">
                <Feather
                  name="list"
                  size={15}
                  color={viewMode === 'lista' ? ATELIE_GREEN : '#6B615A'}
                />
                <Text style={[styles.viewModeBtnText, viewMode === 'lista' && styles.viewModeBtnTextActive]}>
                  Lista
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* =========================================================================
              ÁREA PRINCIPAL DE CLIENTES CONFORME MODO ESCOLHIDO
          ========================================================================== */}
          <ScrollView
            style={styles.mainScroll}
            contentContainerStyle={styles.mainScrollContent}
            showsVerticalScrollIndicator={true}>

            {clientesFiltrados.length === 0 ? (
              <View style={styles.emptyBox}>
                <View style={styles.emptyIconCircle}>
                  <Feather name="users" size={32} color="#9A8F87" />
                </View>
                <Text style={styles.emptyTitle}>Nenhum cliente encontrado</Text>
                <Text style={styles.emptySub}>
                  Tente alterar os termos de busca ou o filtro de status selecionado.
                </Text>
                <TouchableOpacity
                  style={styles.btnEmptyReset}
                  onPress={() => {
                    setBusca('');
                    setStatusFilter('todos');
                  }}>
                  <Text style={styles.btnEmptyResetText}>Limpar filtros de busca</Text>
                </TouchableOpacity>
              </View>
            ) : viewMode === 'cards' ? (
              /* ---------------------------------------------------------------------
                 1. VISUALIZAÇÃO EM CARDS (BOUTIQUE DOSSIÊ GOURMET)
              ---------------------------------------------------------------------- */
              <View style={styles.cardsLayoutWrap}>
                {clientesFiltrados.map((cli) => {
                  const isAniverMes = cli.mesAniversario === mesAtual;

                  return (
                    <TouchableOpacity
                      key={cli.id}
                      style={[
                        styles.dossierCard,
                        isDesktop ? (width >= 1400 ? styles.dossierCardLargo : styles.dossierCardDesktop) : styles.dossierCardMobile,
                      ]}
                      onPress={() => setClienteDetalhe(cli)}
                      activeOpacity={0.88}>

                      {/* CABEÇALHO: avatar, nome + tag, telefone e situação na mesma linha */}
                      <View style={styles.ccHeader}>
                        <View style={styles.ccAvatar}>
                          <Text style={styles.ccAvatarText}>{cli.nome.substring(0, 2).toUpperCase()}</Text>
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <View style={styles.dossierTitleRow}>
                            <Text style={styles.ccNome} numberOfLines={1}>{cli.nome}</Text>
                            {!!cli.tag && (
                              <View style={styles.clientTagPill}>
                                <Text style={styles.clientTagPillText}>{cli.tag}</Text>
                              </View>
                            )}
                          </View>
                          <View style={styles.ccSubLinha}>
                            <Text style={styles.ccSub} numberOfLines={1}>
                              <Feather name="phone" size={10} color="#6B615A" /> {cli.telefone}
                              {cli.revendedoraId ? `  ·  Cliente de ${cli.revendedoraNome?.split(' ')[0] || 'revendedora'}` : ''}
                            </Text>
                            <View style={[styles.ccStatusDot, { backgroundColor: cli.status === 'ativo' ? '#2F7D55' : '#D9CFC4' }]} />
                            <Text style={[styles.ccStatusTexto, { color: cli.status === 'ativo' ? '#2F7D55' : '#9A8F87' }]}>
                              {cli.status === 'ativo' ? 'Ativo' : 'Inativo'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {/* NÚMEROS DO CLIENTE */}
                      <View style={styles.ccMetricas}>
                        <View style={styles.ccMetrica}>
                          <Text style={styles.ccMetricaRotulo}>TOTAL GASTO</Text>
                          <Text style={styles.ccMetricaValor}>R$ {cli.totalGasto.toFixed(2)}</Text>
                        </View>
                        <View style={styles.ccDivisor} />
                        <View style={styles.ccMetrica}>
                          <Text style={styles.ccMetricaRotulo}>PEDIDOS</Text>
                          <Text style={styles.ccMetricaValor}>{cli.quantidadePedidos}</Text>
                        </View>
                        <View style={styles.ccDivisor} />
                        <View style={styles.ccMetrica}>
                          <Text style={styles.ccMetricaRotulo}>TICKET MÉDIO</Text>
                          <Text style={styles.ccMetricaValor}>R$ {cli.ticketMedio.toFixed(2)}</Text>
                        </View>
                      </View>

                      {/* FAVORITO E PREFERÊNCIAS EM LINHAS CURTAS */}
                      {(cli.produtoMaisComprado || cli.observacoes) && (
                        <View style={styles.ccInfos}>
                          {cli.produtoMaisComprado && (
                            <Text style={styles.ccInfo} numberOfLines={1}>
                              🏆 <Text style={styles.ccInfoRotulo}>Mais pede: </Text>
                              <Text style={styles.ccInfoForte}>{cli.produtoMaisComprado}</Text>
                            </Text>
                          )}
                          {cli.observacoes ? (
                            <Text style={styles.ccInfo} numberOfLines={1}>
                              💚 {cli.observacoes}
                            </Text>
                          ) : null}
                        </View>
                      )}

                      {/* RODAPÉ: ENDEREÇO E ANIVERSÁRIO */}
                      <View style={styles.ccRodape}>
                        <Text style={styles.ccRodapeTexto} numberOfLines={1}>
                          📍 {cli.bairro || cli.rua ? [cli.bairro, cli.rua].filter(Boolean).join(' · ') : 'Sem endereço'}
                        </Text>
                        {cli.aniversario && (
                          <Text style={[styles.ccRodapeTexto, styles.ccNiver, isAniverMes && styles.dossierBdayHighlight]} numberOfLines={1}>
                            🎂 {cli.aniversario}{isAniverMes ? ' ★ este mês' : ''}
                          </Text>
                        )}
                        <Feather name="chevron-right" size={14} color={ATELIE_GREEN} />
                      </View>

                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : viewMode === 'grid' ? (
              /* ---------------------------------------------------------------------
                 2. VISUALIZAÇÃO EM GRID COMPACTO
              ---------------------------------------------------------------------- */
              <View style={styles.compactGridLayout}>
                {clientesFiltrados.map((cli) => (
                  <TouchableOpacity
                    key={cli.id}
                    style={styles.compactGridCard}
                    onPress={() => setClienteDetalhe(cli)}
                    activeOpacity={0.88}>
                    <View style={styles.compactGridTop}>
                      <View style={styles.compactGridAvatar}>
                        <Text style={styles.compactGridAvatarText}>
                          {cli.nome.substring(0, 2).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.compactGridName} numberOfLines={1}>{cli.nome}</Text>
                        <Text style={styles.compactGridPhone}>{cli.telefone}</Text>
                      </View>
                      {!!cli.tag && (
                        <View style={styles.compactGridTag}>
                          <Text style={styles.compactGridTagText}>{cli.tag}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.compactGridDivider} />

                    <View style={styles.compactGridBottom}>
                      <View>
                        <Text style={styles.compactGridSpendLabel}>Gasto no ateliê</Text>
                        <Text style={styles.compactGridSpendValue}>R$ {cli.totalGasto.toFixed(2)}</Text>
                      </View>
                      <View style={styles.compactGridDetailsBtn}>
                        <Text style={styles.compactGridDetailsBtnText}>Ver Dossiê →</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              /* ---------------------------------------------------------------------
                 3. VISUALIZAÇÃO EM LISTA (TABELA LIMPA E MODERNA)
              ---------------------------------------------------------------------- */
              <View style={styles.tableCard}>
                {/* CABEÇALHO DA TABELA */}
                <View style={styles.tableHeaderRow}>
                  <Text style={[styles.tableHeaderCell, { flex: 1.8 }]}>CLIENTE</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>CONTATO</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>LOCALIZAÇÃO</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 0.9 }]}>TAG</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.0 }]}>ANIVERSÁRIO</Text>
                  <Text style={[styles.tableHeaderCell, { flex: 1.0, textAlign: 'right' }]}>TOTAL GASTO</Text>
                  <Text style={[styles.tableHeaderCell, { width: 70, textAlign: 'center' }]}>AÇÃO</Text>
                </View>

                {/* LINHAS DA TABELA */}
                {clientesFiltrados.map((cli) => {
                  const isAniverMes = cli.mesAniversario === mesAtual;

                  return (
                    <TouchableOpacity
                      key={cli.id}
                      style={styles.tableRow}
                      onPress={() => setClienteDetalhe(cli)}
                      activeOpacity={0.75}>
                      {/* CLIENTE */}
                      <View style={[styles.tableCell, { flex: 1.8, flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                        <View style={styles.tableRowAvatar}>
                          <Text style={styles.tableRowAvatarText}>
                            {cli.nome.substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.tableClientName} numberOfLines={1}>{cli.nome}</Text>
                          <Text style={styles.tableClientEmail} numberOfLines={1}>{cli.email || 'Sem e-mail'}</Text>
                        </View>
                      </View>

                      {/* CONTATO */}
                      <View style={[styles.tableCell, { flex: 1.2 }]}>
                        <Text style={styles.tableCellText}>{cli.telefone}</Text>
                      </View>

                      {/* LOCALIZAÇÃO */}
                      <View style={[styles.tableCell, { flex: 1.2 }]}>
                        <Text style={styles.tableCellText} numberOfLines={1}>
                          {cli.bairro || 'Copacabana'}, {cli.cidade || 'RJ'}
                        </Text>
                      </View>

                      {/* TAG */}
                      <View style={[styles.tableCell, { flex: 0.9 }]}>
                        {cli.tag ? (
                          <View style={styles.tableTagPill}>
                            <Text style={styles.tableTagPillText}>{cli.tag}</Text>
                          </View>
                        ) : (
                          <Text style={{ fontSize: 11, color: '#9A8F87' }}>—</Text>
                        )}
                      </View>

                      {/* ANIVERSÁRIO */}
                      <View style={[styles.tableCell, { flex: 1.0 }]}>
                        <Text style={[styles.tableCellText, isAniverMes && styles.tableCellBdayHighlight]}>
                          {cli.aniversario ? `🎂 ${cli.aniversario}` : '—'}
                        </Text>
                      </View>

                      {/* TOTAL GASTO */}
                      <View style={[styles.tableCell, { flex: 1.0, alignItems: 'flex-end' }]}>
                        <Text style={styles.tableSpendTotal}>R$ {cli.totalGasto.toFixed(2)}</Text>
                        <Text style={styles.tableOrdersCount}>{cli.quantidadePedidos} pedidos</Text>
                      </View>

                      {/* AÇÃO */}
                      <View style={[styles.tableCell, { width: 70, alignItems: 'center' }]}>
                        <View style={styles.tableActionCircle}>
                          <Feather name="eye" size={13} color={ATELIE_GREEN} />
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

          </ScrollView>

        </View>

      </View>

      {/* =========================================================================
          MODAL: CADASTRAR NOVO CLIENTE (FORMULÁRIO COMPARTILHADO COM O NOVO PEDIDO)
      ========================================================================== */}
      <ClienteFormModal
        visible={modalNovoClienteAberto}
        onClose={() => {
          setModalNovoClienteAberto(false);
          setClienteEmEdicao(null);
        }}
        onSalvo={handleClienteSalvo}
        clienteInicial={clienteEmEdicao ? paraFormulario(clienteEmEdicao) : null}
        revendedoraFixa={escopo.revendedoraId}
      />

      {/* =========================================================================
          MODAL / GAVETA: DETALHES COMPLETOS DO REGISTRO DO CLIENTE (DOSSIÊ)
      ========================================================================== */}
      {clienteDetalhe && (
        <Modal
          visible={!!clienteDetalhe}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setClienteDetalhe(null);
            setConfirmandoInativacao(false);
          }}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalDossierContent}>

              {/* CABEÇALHO DO DOSSIÊ DO CLIENTE */}
              <View style={styles.dossierModalHeader}>
                <View style={styles.dossierModalAvatar}>
                  <Text style={styles.dossierModalAvatarText}>
                    {clienteDetalhe.nome.substring(0, 2).toUpperCase()}
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={styles.dossierModalName}>{clienteDetalhe.nome}</Text>
                    {!!clienteDetalhe.tag && (
                      <View style={styles.clientTagPill}>
                        <Text style={styles.clientTagPillText}>{clienteDetalhe.tag}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.dossierModalSub}>
                    {clienteDetalhe.telefone} • {clienteDetalhe.email || 'Sem e-mail'}
                  </Text>
                  <View style={styles.dossierOrigemRow}>
                    <View style={[styles.origemPill, clienteDetalhe.revendedoraId ? styles.origemPillRevenda : styles.origemPillDireto]}>
                      <Feather
                        name={clienteDetalhe.revendedoraId ? 'briefcase' : 'home'}
                        size={11}
                        color={clienteDetalhe.revendedoraId ? '#4B4FC4' : '#4B4FC4'}
                      />
                      <Text style={[styles.origemPillText, { color: clienteDetalhe.revendedoraId ? '#3A3D9E' : '#3A3D9E' }]}>
                        {clienteDetalhe.revendedoraId
                          ? `Cliente de: ${clienteDetalhe.revendedoraNome || 'Revendedora'}`
                          : 'Cliente direto (ateliê)'}
                      </Text>
                    </View>
                    {clienteDetalhe.cpf_cnpj ? (
                      <Text style={styles.dossierDocText}>
                        {clienteDetalhe.cpf_cnpj.replace(/\D/g, '').length > 11 ? 'CNPJ' : 'CPF'} {clienteDetalhe.cpf_cnpj}
                      </Text>
                    ) : null}
                    {clienteDetalhe.status === 'inativo' && (
                      <View style={styles.inativoPill}>
                        <Text style={styles.inativoPillText}>INATIVO</Text>
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.dossierModalHeaderBtns}>
                  <TouchableOpacity
                    style={styles.btnCriarPedidoParaCliente}
                    onPress={() => {
                      setClienteDetalhe(null);
                      setModalNovoPedidoAberto(true);
                    }}>
                    <Feather name="plus" size={14} color="#FFFDFA" />
                    <Text style={styles.btnCriarPedidoParaClienteText}>Novo Pedido</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.modalCloseCircle}
                    onPress={() => setClienteDetalhe(null)}>
                    <Feather name="x" size={16} color="#6B615A" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* AÇÕES DO CLIENTE */}
              <View style={styles.dossierActionsBar}>
                <TouchableOpacity style={styles.dossierActionWpp} onPress={() => abrirWhatsAppCliente(clienteDetalhe)}>
                  <Feather name="message-circle" size={14} color="#2F7D55" />
                  <Text style={styles.dossierActionWppText}>WhatsApp</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dossierActionBtn}
                  onPress={() => {
                    abrirEdicaoCliente(clienteDetalhe);
                    setClienteDetalhe(null);
                  }}>
                  <Feather name="edit-2" size={14} color="#4A3E37" />
                  <Text style={styles.dossierActionBtnText}>Editar</Text>
                </TouchableOpacity>
                {clienteDetalhe.status === 'inativo' ? (
                  <TouchableOpacity style={styles.dossierActionBtn} onPress={() => alternarStatusCliente(clienteDetalhe)}>
                    <Feather name="rotate-ccw" size={14} color={ATELIE_GREEN} />
                    <Text style={[styles.dossierActionBtnText, { color: ATELIE_GREEN }]}>Reativar cliente</Text>
                  </TouchableOpacity>
                ) : confirmandoInativacao ? (
                  <View style={styles.dossierConfirmRow}>
                    <Text style={styles.dossierConfirmText}>Inativar este cliente?</Text>
                    <TouchableOpacity style={styles.dossierConfirmYes} onPress={() => alternarStatusCliente(clienteDetalhe)}>
                      <Text style={styles.dossierConfirmYesText}>Sim, inativar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setConfirmandoInativacao(false)}>
                      <Text style={styles.dossierConfirmNoText}>Cancelar</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.dossierActionBtn} onPress={() => setConfirmandoInativacao(true)}>
                    <Feather name="user-x" size={14} color="#B42318" />
                    <Text style={[styles.dossierActionBtnText, { color: '#B42318' }]}>Inativar</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* CONTEÚDO SCROLLÁVEL DO REGISTRO DO CLIENTE */}
              <ScrollView style={styles.dossierModalScroll} contentContainerStyle={styles.dossierModalScrollContent}>

                {/* KPIS DE CONSUMO DO CLIENTE */}
                <View style={styles.dossierKpiStrip}>
                  <View style={styles.dossierKpiBox}>
                    <Text style={styles.dossierKpiLabel}>TOTAL GASTO</Text>
                    <Text style={styles.dossierKpiValue}>R$ {clienteDetalhe.totalGasto.toFixed(2)}</Text>
                    <Text style={styles.dossierKpiHint}>Acumulado na loja</Text>
                  </View>

                  <View style={styles.dossierKpiBox}>
                    <Text style={styles.dossierKpiLabel}>PEDIDOS REALIZADOS</Text>
                    <Text style={styles.dossierKpiValue}>{clienteDetalhe.quantidadePedidos}</Text>
                    <Text style={styles.dossierKpiHint}>Compras concluídas</Text>
                  </View>

                  <View style={styles.dossierKpiBox}>
                    <Text style={styles.dossierKpiLabel}>TICKET MÉDIO</Text>
                    <Text style={styles.dossierKpiValue}>R$ {clienteDetalhe.ticketMedio.toFixed(2)}</Text>
                    <Text style={styles.dossierKpiHint}>Por pedido</Text>
                  </View>

                  <View style={styles.dossierKpiBox}>
                    <Text style={styles.dossierKpiLabel}>PRODUTO FAVORITO</Text>
                    <Text style={[styles.dossierKpiValue, { fontSize: 13, color: ATELIE_GREEN }]} numberOfLines={1}>
                      🏆 {clienteDetalhe.produtoMaisComprado || 'Cookies Gourmet'}
                    </Text>
                    <Text style={styles.dossierKpiHint}>Item mais comprado</Text>
                  </View>
                </View>

                {/* ENDEREÇO E ANIVERSÁRIO */}
                <View style={styles.infoCardTwoCol}>
                  <View style={styles.infoCardBox}>
                    <View style={styles.infoCardHeader}>
                      <Feather name="map-pin" size={14} color={ATELIE_GREEN} />
                      <Text style={styles.infoCardTitle}>Endereço Cadastrado</Text>
                    </View>
                    <Text style={styles.infoCardPrimary}>
                      {clienteDetalhe.rua ? `${clienteDetalhe.rua}, ${clienteDetalhe.numero || 'S/N'}` : 'Rua não informada'}
                    </Text>
                    <Text style={styles.infoCardSecondary}>
                      {clienteDetalhe.complemento ? `${clienteDetalhe.complemento} • ` : ''}
                      {[clienteDetalhe.bairro, clienteDetalhe.cidade && `${clienteDetalhe.cidade}${clienteDetalhe.estado ? ` - ${clienteDetalhe.estado}` : ''}`]
                        .filter(Boolean)
                        .join(', ') || 'Bairro e cidade não informados'}
                    </Text>
                    <Text style={styles.infoCardCep}>CEP: {clienteDetalhe.cep || 'Não cadastrado'}</Text>
                    <TouchableOpacity style={styles.copyAddressBtn} onPress={() => copiarEndereco(clienteDetalhe)}>
                      <Feather name="copy" size={12} color={ATELIE_GREEN} />
                      <Text style={styles.copyAddressBtnText}>Copiar endereço</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.infoCardBox}>
                    <View style={styles.infoCardHeader}>
                      <Feather name="calendar" size={14} color={ATELIE_GREEN} />
                      <Text style={styles.infoCardTitle}>Aniversário & Datas Especiais</Text>
                    </View>
                    <Text style={styles.infoCardPrimary}>
                      {clienteDetalhe.aniversario ? `🎂 ${clienteDetalhe.aniversario}` : 'Data não informada'}
                    </Text>
                    <Text style={styles.infoCardSecondary}>
                      {clienteDetalhe.mesAniversario === mesAtual ? '🎉 Aniversariante deste mês! Enviar cupom presente.' : 'Fidelidade Ateliê ativa.'}
                    </Text>
                    <View style={styles.tagStatusPill}>
                      <Text style={styles.tagStatusPillText}>Status: {clienteDetalhe.status.toUpperCase()}</Text>
                    </View>
                  </View>
                </View>

                {/* PREFERÊNCIAS E RESTRIÇÕES */}
                <View style={styles.preferencesFullCard}>
                  <View style={styles.preferencesHeader}>
                    <Feather name="heart" size={15} color={ATELIE_GREEN} />
                    <Text style={styles.preferencesTitle}>Preferências & Restrições Gastronômicas</Text>
                  </View>
                  <Text style={styles.preferencesText}>
                    {clienteDetalhe.observacoes || 'Nenhuma restrição ou preferência especial registrada para este cliente.'}
                  </Text>
                </View>

                {/* PRODUTOS COMPRADOS POR ELE (HISTÓRICO DE CONSUMO) */}
                <View style={styles.purchasedProductsSection}>
                  <View style={styles.purchasedProductsHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Feather name="shopping-bag" size={15} color={ATELIE_GREEN} />
                      <Text style={styles.purchasedProductsTitle}>Delícias e Produtos Comprados pelo Cliente</Text>
                    </View>
                    <Text style={styles.purchasedProductsCount}>
                      {clienteDetalhe.produtosComprados.length} doces diferentes
                    </Text>
                  </View>

                  <View style={styles.purchasedProductsList}>
                    {clienteDetalhe.produtosComprados.map((item) => (
                      <View key={item.id} style={styles.purchasedProductRow}>
                        <View style={styles.purchasedEmojiBox}>
                          <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.purchasedProdName}>{item.nome}</Text>
                          <Text style={styles.purchasedProdCat}>
                            {item.categoria} • Última compra em {item.dataUltimaCompra}
                          </Text>
                        </View>
                        <View style={styles.purchasedQtdBadge}>
                          <Text style={styles.purchasedQtdBadgeText}>{item.quantidade} un.</Text>
                        </View>
                        <Text style={styles.purchasedTotalVal}>R$ {item.totalGasto.toFixed(2)}</Text>
                      </View>
                    ))}
                  </View>
                </View>

              </ScrollView>

            </View>
          </View>
        </Modal>
      )}

      {/* MODAL DE NOVO PEDIDO (INTEGRADO COM ESTILO ATELIÊ) */}
      <NovoPedidoModal
        visible={modalNovoPedidoAberto}
        onClose={() => setModalNovoPedidoAberto(false)}
        onPedidoCriado={(pedido) => {
          exibirToast(`🎉 Pedido registrado com sucesso no ateliê!`);
        }}
      />

      {/* TOAST DE FEEDBACK FLUTUANTE */}
      {toastMensagem && (
        <View style={styles.toastContainer}>
          <Feather name="check-circle" size={16} color="#FFFDFA" />
          <Text style={styles.toastText}>{toastMensagem}</Text>
        </View>
      )}

    </SafeAreaView>
  );
}

// ============================================================================
// ESTILOS COM A MESMA IDENTIDADE DO MODAL DE NOVO PEDIDO (SORA + MANROPE + VERDE SÁLVIA)
// ============================================================================
const styles = paraCelular(StyleSheet.create({
  // ORIGEM / DOCUMENTO / STATUS NO DOSSIÊ
  dossierOrigemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  origemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  origemPillDireto: {
    backgroundColor: '#ECEBFA',
    borderColor: '#D6D7F3',
  },
  origemPillRevenda: {
    backgroundColor: '#F3F2FC',
    borderColor: '#D6D7F3',
  },
  origemPillText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONT_SANS,
  },
  dossierDocText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B615A',
    fontFamily: FONT_SANS,
  },
  inativoPill: {
    backgroundColor: '#FBE7E4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  inativoPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#B42318',
    letterSpacing: 0.5,
    fontFamily: FONT_SANS,
  },
  cardOrigemText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#3A3D9E',
    fontFamily: FONT_SANS,
    marginBottom: 2,
  },

  // AÇÕES DO DOSSIÊ (WHATSAPP, EDITAR, INATIVAR)
  dossierActionsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3EEE7',
    backgroundColor: '#F8F6F2',
  },
  dossierActionWpp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#E4F1E9',
    borderWidth: 1,
    borderColor: '#BFDCCB',
  },
  dossierActionWppText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2F7D55',
    fontFamily: FONT_SANS,
  },
  dossierActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#FFFDFA',
    borderWidth: 1,
    borderColor: '#E8E0D6',
  },
  dossierActionBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A3E37',
    fontFamily: FONT_SANS,
  },
  dossierConfirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FBE7E4',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  dossierConfirmText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#8A1C12',
    fontFamily: FONT_SANS,
  },
  dossierConfirmYes: {
    backgroundColor: '#B42318',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  dossierConfirmYesText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFDFA',
    fontFamily: FONT_SANS,
  },
  dossierConfirmNoText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#6B615A',
    fontFamily: FONT_SANS,
  },
  copyAddressBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E4F1E9',
    backgroundColor: '#FFFDFA',
  },
  copyAddressBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: ATELIE_GREEN,
    fontFamily: FONT_SANS,
  },

  viewport: {
    flex: 1,
    backgroundColor: '#F8F6F2',
  },
  mainLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  contentArea: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#F8F6F2',
    overflow: 'hidden',
  },

  // CABEÇALHO DA TELA
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 18,
    backgroundColor: '#FFFDFA',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E0D6',
  },
  topHeaderLeft: {
    gap: 3,
  },
  tagBadge: {
    backgroundColor: ATELIE_TINT,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tagBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: ATELIE_GREEN,
    fontFamily: FONT_SANS,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2E211A',
    fontFamily: FONT_DISPLAY,
    letterSpacing: -0.3,
  },
  pageSubtitle: {
    fontSize: 12,
    color: '#6B615A',
    fontFamily: FONT_SANS,
  },
  topHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  btnNovoClientePrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: ATELIE_GREEN,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(122, 69, 32, 0.25)',
      },
    }),
  },
  btnNovoClientePrimaryText: {
    color: '#FFFDFA',
    fontSize: 13,
    fontWeight: '700',
    fontFamily: FONT_DISPLAY,
  },

  // BARRA DE CONTROLES: BUSCA, STATUS E MODO DE VISUALIZAÇÃO
  controlsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 28,
    paddingVertical: 14,
    backgroundColor: '#FFFDFA',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E0D6',
    flexWrap: 'wrap',
    gap: 12,
  },
  searchBox: {
    flex: 1,
    minWidth: 260,
    height: 40,
    backgroundColor: '#F8F6F2',
    borderWidth: 1,
    borderColor: '#E8E0D6',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    color: '#2E211A',
    fontFamily: FONT_SANS,
    padding: 0,
    outlineWidth: 0,
  },
  statusPillsTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F8F6F2',
    borderWidth: 1,
    borderColor: '#E8E0D6',
  },
  filterPillActive: {
    backgroundColor: ATELIE_TINT,
    borderColor: ATELIE_GREEN,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B615A',
    fontFamily: FONT_SANS,
  },
  filterPillTextActive: {
    color: ATELIE_GREEN,
    fontWeight: '700',
  },
  viewModeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F3EEE7',
    borderRadius: 8,
    padding: 3,
    gap: 3,
  },
  viewModeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 5,
  },
  viewModeBtnActive: {
    backgroundColor: '#FFFDFA',
    ...Platform.select({
      web: {
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      },
    }),
  },
  viewModeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B615A',
    fontFamily: FONT_SANS,
  },
  viewModeBtnTextActive: {
    color: ATELIE_GREEN,
    fontWeight: '700',
  },

  // ÁREA DE ROLAGEM PRINCIPAL
  mainScroll: {
    flex: 1,
  },
  mainScrollContent: {
    padding: 28,
  },
  loadingBox: {
    padding: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#6B615A',
    fontFamily: FONT_SANS,
  },
  emptyBox: {
    padding: 60,
    alignItems: 'center',
    gap: 10,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F3EEE7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2E211A',
    fontFamily: FONT_DISPLAY,
  },
  emptySub: {
    fontSize: 12,
    color: '#6B615A',
    fontFamily: FONT_SANS,
    textAlign: 'center',
    maxWidth: 320,
  },
  btnEmptyReset: {
    marginTop: 8,
    backgroundColor: '#FFFDFA',
    borderWidth: 1,
    borderColor: '#E8E0D6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnEmptyResetText: {
    fontSize: 12,
    fontWeight: '700',
    color: ATELIE_GREEN,
    fontFamily: FONT_SANS,
  },

  // 1. CARDS / DOSSIÊ GOURMET
  cardsLayoutWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  dossierCard: {
    backgroundColor: '#FFFDFA',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    padding: 14,
    gap: 10,
    ...Platform.select({
      web: {
        transition: 'all 0.16s ease',
        boxShadow: '0 2px 8px rgba(43, 36, 33, 0.04)',
      },
    }),
  },
  dossierCardDesktop: {
    width: 'calc(50% - 8px)' as any,
  },
  // CARD DE CLIENTE COMPACTO
  dossierCardLargo: { width: 'calc(33.333% - 11px)' as any },
  ccHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ccAvatar: { width: 38, height: 38, borderRadius: 11, backgroundColor: ATELIE_TINT, alignItems: 'center', justifyContent: 'center' },
  ccAvatarText: { fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: '800', color: ATELIE_GREEN },
  ccNome: { fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: '700', color: '#2E211A', flexShrink: 1 },
  ccSubLinha: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  ccSub: { flexShrink: 1, fontFamily: FONT_SANS, fontSize: 11, color: '#6B615A', marginRight: 4 },
  ccStatusDot: { width: 6, height: 6, borderRadius: 3 },
  ccStatusTexto: { fontFamily: FONT_SANS, fontSize: 10, fontWeight: '700' },
  ccMetricas: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F6F2', borderRadius: 10, paddingVertical: 7 },
  ccMetrica: { flex: 1, alignItems: 'center' },
  ccMetricaRotulo: { fontFamily: FONT_SANS, fontSize: 9, fontWeight: '800', color: '#9A8F87', letterSpacing: 0.4 },
  ccMetricaValor: { fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: '800', color: '#2E211A', marginTop: 1 },
  ccDivisor: { width: 1, height: 22, backgroundColor: '#E8E0D6' },
  ccInfos: { gap: 3 },
  ccInfo: { fontFamily: FONT_SANS, fontSize: 11.5, color: '#4A3E37' },
  ccInfoRotulo: { color: '#9A8F87', fontWeight: '600' },
  ccInfoForte: { color: '#2E211A', fontWeight: '700' },
  ccRodape: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#F3EEE7' },
  ccRodapeTexto: { flex: 1, fontFamily: FONT_SANS, fontSize: 11, color: '#6B615A' },
  ccNiver: { flex: 0 },
  dossierCardMobile: {
    width: '100%',
  },
  dossierHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dossierAvatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: ATELIE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dossierAvatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: ATELIE_GREEN,
    fontFamily: FONT_DISPLAY,
  },
  dossierNameCol: {
    flex: 1,
    minWidth: 0,
  },
  dossierTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  dossierName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2E211A',
    fontFamily: FONT_DISPLAY,
  },
  clientTagPill: {
    backgroundColor: '#F6E8D6',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  clientTagPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7A4520',
    fontFamily: FONT_SANS,
  },
  dossierPhone: {
    fontSize: 12,
    color: '#6B615A',
    fontFamily: FONT_SANS,
    marginTop: 2,
  },
  statusDotBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusDotAtivo: {
    backgroundColor: '#E4F1E9',
  },
  statusDotInativo: {
    backgroundColor: '#FBE7E4',
  },
  statusDotText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: FONT_SANS,
  },
  statusDotTextAtivo: {
    color: ATELIE_SUCCESS,
  },
  statusDotTextInativo: {
    color: '#B42318',
  },
  dossierMetricsGrid: {
    flexDirection: 'row',
    backgroundColor: '#F8F6F2',
    borderRadius: 10,
    padding: 10,
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#F3EEE7',
  },
  dossierMetricItem: {
    alignItems: 'center',
  },
  dossierMetricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#9A8F87',
    letterSpacing: 0.5,
    fontFamily: FONT_SANS,
  },
  dossierMetricValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2E211A',
    fontFamily: FONT_DISPLAY,
    marginTop: 2,
  },
  favoriteProductBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F8F6F2',
    borderWidth: 1,
    borderColor: '#F8F6F2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  favIcon: {
    fontSize: 15,
  },
  favTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B615A',
    fontFamily: FONT_SANS,
  },
  favName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2E211A',
    fontFamily: FONT_SANS,
  },
  preferencesPreviewBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FFFDFA',
    borderWidth: 1,
    borderColor: '#F6E8D6',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  preferencesPreviewText: {
    flex: 1,
    fontSize: 11,
    color: '#4A3E37',
    fontFamily: FONT_SANS,
    lineHeight: 16,
  },
  dossierFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F8F6F2',
    paddingTop: 8,
  },
  dossierAddressCol: {
    flex: 1,
  },
  dossierAddressText: {
    fontSize: 11,
    color: '#6B615A',
    fontFamily: FONT_SANS,
  },
  dossierBdayText: {
    fontSize: 10,
    color: '#6B615A',
    fontFamily: FONT_SANS,
    marginTop: 2,
  },
  dossierBdayHighlight: {
    color: '#9A6516',
    fontWeight: '700',
  },
  dossierArrowCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: ATELIE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // 2. GRID COMPACTO
  compactGridLayout: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  compactGridCard: {
    width: 'calc(33.333% - 10px)' as any,
    minWidth: 260,
    backgroundColor: '#FFFDFA',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    padding: 14,
    gap: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(43, 36, 33, 0.03)',
      },
    }),
  },
  compactGridTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  compactGridAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: ATELIE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactGridAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: ATELIE_GREEN,
    fontFamily: FONT_DISPLAY,
  },
  compactGridName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E211A',
    fontFamily: FONT_SANS,
  },
  compactGridPhone: {
    fontSize: 11,
    color: '#6B615A',
    fontFamily: FONT_SANS,
  },
  compactGridTag: {
    backgroundColor: '#F6E8D6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  compactGridTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#7A4520',
  },
  compactGridDivider: {
    height: 1,
    backgroundColor: '#F3EEE7',
  },
  compactGridBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactGridSpendLabel: {
    fontSize: 9,
    color: '#9A8F87',
    fontFamily: FONT_SANS,
  },
  compactGridSpendValue: {
    fontSize: 13,
    fontWeight: '800',
    color: ATELIE_GREEN,
    fontFamily: FONT_DISPLAY,
  },
  compactGridDetailsBtn: {
    backgroundColor: '#F8F6F2',
    borderWidth: 1,
    borderColor: '#E8E0D6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  compactGridDetailsBtnText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#2E211A',
    fontFamily: FONT_SANS,
  },

  // 3. TABELA / LISTA
  tableCard: {
    backgroundColor: '#FFFDFA',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    overflow: 'hidden',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F6F2',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E0D6',
  },
  tableHeaderCell: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9A8F87',
    letterSpacing: 0.6,
    fontFamily: FONT_SANS,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F6F2',
  },
  tableCell: {
    justifyContent: 'center',
  },
  tableRowAvatar: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: ATELIE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableRowAvatarText: {
    fontSize: 11,
    fontWeight: '800',
    color: ATELIE_GREEN,
    fontFamily: FONT_DISPLAY,
  },
  tableClientName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E211A',
    fontFamily: FONT_SANS,
  },
  tableClientEmail: {
    fontSize: 11,
    color: '#9A8F87',
    fontFamily: FONT_SANS,
  },
  tableCellText: {
    fontSize: 12,
    color: '#4A3E37',
    fontFamily: FONT_SANS,
  },
  tableCellBdayHighlight: {
    color: '#9A6516',
    fontWeight: '700',
  },
  tableTagPill: {
    backgroundColor: '#F6E8D6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  tableTagPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#7A4520',
  },
  tableSpendTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E211A',
    fontFamily: FONT_DISPLAY,
  },
  tableOrdersCount: {
    fontSize: 10,
    color: '#9A8F87',
    fontFamily: FONT_SANS,
  },
  tableActionCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: ATELIE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // MODAL DE NOVO CLIENTE
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 36, 33, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3EEE7',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // MODAL / DOSSIÊ DE DETALHES DO CLIENTE
  modalDossierContent: {
    width: '100%',
    maxWidth: 780,
    maxHeight: '90%',
    backgroundColor: '#FFFDFA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    overflow: 'hidden',
    flexDirection: 'column',
    ...Platform.select({
      web: {
        boxShadow: '0 25px 50px -12px rgba(43, 36, 33, 0.25)',
      },
    }),
  },
  dossierModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E0D6',
    backgroundColor: '#FFFDFA',
  },
  dossierModalAvatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: ATELIE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dossierModalAvatarText: {
    fontSize: 18,
    fontWeight: '800',
    color: ATELIE_GREEN,
    fontFamily: FONT_DISPLAY,
  },
  dossierModalName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2E211A',
    fontFamily: FONT_DISPLAY,
  },
  dossierModalSub: {
    fontSize: 12,
    color: '#6B615A',
    fontFamily: FONT_SANS,
    marginTop: 2,
  },
  dossierModalHeaderBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  btnCriarPedidoParaCliente: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ATELIE_GREEN,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  btnCriarPedidoParaClienteText: {
    color: '#FFFDFA',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONT_DISPLAY,
  },
  dossierModalScroll: {
    flex: 1,
  },
  dossierModalScrollContent: {
    padding: 24,
    gap: 18,
  },
  dossierKpiStrip: {
    flexDirection: 'row',
    backgroundColor: '#F8F6F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    padding: 12,
    gap: 10,
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  dossierKpiBox: {
    flex: 1,
    minWidth: 130,
    alignItems: 'center',
    padding: 6,
  },
  dossierKpiLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#9A8F87',
    letterSpacing: 0.8,
    fontFamily: FONT_SANS,
  },
  dossierKpiValue: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2E211A',
    fontFamily: FONT_DISPLAY,
    marginTop: 3,
  },
  dossierKpiHint: {
    fontSize: 10,
    color: '#6B615A',
    fontFamily: FONT_SANS,
    marginTop: 2,
  },
  infoCardTwoCol: {
    flexDirection: 'row',
    gap: 14,
    flexWrap: 'wrap',
  },
  infoCardBox: {
    flex: 1,
    minWidth: 260,
    backgroundColor: '#FFFDFA',
    borderWidth: 1,
    borderColor: '#E8E0D6',
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  infoCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  infoCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2E211A',
    fontFamily: FONT_DISPLAY,
  },
  infoCardPrimary: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E211A',
    fontFamily: FONT_SANS,
  },
  infoCardSecondary: {
    fontSize: 11,
    color: '#6B615A',
    fontFamily: FONT_SANS,
  },
  infoCardCep: {
    fontSize: 11,
    fontWeight: '600',
    color: ATELIE_GREEN,
    fontFamily: FONT_SANS,
    marginTop: 2,
  },
  tagStatusPill: {
    backgroundColor: '#E4F1E9',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  tagStatusPillText: {
    fontSize: 9,
    fontWeight: '800',
    color: ATELIE_SUCCESS,
  },
  preferencesFullCard: {
    backgroundColor: '#FFFDFA',
    borderWidth: 1,
    borderColor: '#F6E8D6',
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  preferencesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  preferencesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#24603F',
    fontFamily: FONT_DISPLAY,
  },
  preferencesText: {
    fontSize: 12,
    color: '#3D312A',
    fontFamily: FONT_SANS,
    lineHeight: 18,
  },
  purchasedProductsSection: {
    backgroundColor: '#FFFDFA',
    borderWidth: 1,
    borderColor: '#E8E0D6',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  purchasedProductsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F3EEE7',
    paddingBottom: 8,
  },
  purchasedProductsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E211A',
    fontFamily: FONT_DISPLAY,
  },
  purchasedProductsCount: {
    fontSize: 11,
    color: '#6B615A',
    fontFamily: FONT_SANS,
  },
  purchasedProductsList: {
    gap: 8,
  },
  purchasedProductRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F6F2',
  },
  purchasedEmojiBox: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F8F6F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  purchasedProdName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2E211A',
    fontFamily: FONT_SANS,
  },
  purchasedProdCat: {
    fontSize: 10,
    color: '#6B615A',
    fontFamily: FONT_SANS,
  },
  purchasedQtdBadge: {
    backgroundColor: ATELIE_TINT,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  purchasedQtdBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: ATELIE_GREEN,
    fontFamily: FONT_SANS,
  },
  purchasedTotalVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2E211A',
    fontFamily: FONT_DISPLAY,
    minWidth: 70,
    textAlign: 'right',
  },

  // TOAST FLUTUANTE
  toastContainer: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#2E211A',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    zIndex: 9999,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(43, 36, 33, 0.25)',
      },
    }),
  },
  toastText: {
    color: '#FFFDFA',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONT_SANS,
  },
}));

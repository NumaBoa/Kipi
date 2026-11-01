import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useConfigLoja, encerrarSessao } from '@/lib/configuracoes';
import { trocarArea, ROTAS_DO_PERFIL, type Perfil } from '@/lib/acesso';

export interface MenuItem {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  route?: string;
  isDeveloped?: boolean;
}

export interface MenuGroup {
  groupTitle: string;
  items: MenuItem[];
}

export const MENU_GROUPS: MenuGroup[] = [
  {
    groupTitle: 'Acesso Rápido',
    items: [
      { id: 'visao-geral', label: 'Visão Geral', icon: 'grid', route: '/visao-geral', isDeveloped: true },
      { id: 'pedidos', label: 'Pedidos', icon: 'shopping-bag', route: '/pedidos', isDeveloped: true },
      { id: 'clientes', label: 'Clientes', icon: 'users', route: '/clientes', isDeveloped: true },
    ],
  },
  {
    groupTitle: 'Produção',
    items: [
      { id: 'producao', label: 'Produção & Forno', icon: 'zap', route: '/producao', isDeveloped: true },
      { id: 'estoque', label: 'Estoque Central', icon: 'archive', route: '/estoque', isDeveloped: true },
      { id: 'insumos-receitas', label: 'Insumos e Receitas', icon: 'book-open', route: '/insumos-receitas', isDeveloped: true },
      { id: 'produtos-estoque', label: 'Produtos', icon: 'package', route: '/produtos-estoque', isDeveloped: true },
    ],
  },
  {
    groupTitle: 'Financeiro',
    items: [
      { id: 'fluxo-caixa', label: 'Fluxo de caixa', icon: 'dollar-sign', route: '/fluxo-caixa', isDeveloped: false },
      { id: 'relatorios', label: 'Relatórios', icon: 'bar-chart-2', route: '/relatorios', isDeveloped: false },
    ],
  },
  {
    groupTitle: 'Sistema',
    items: [
      { id: 'acessos', label: 'Acessos', icon: 'shield', route: '/acessos', isDeveloped: true },
      { id: 'configuracoes', label: 'Configurações', icon: 'settings', route: '/configuracoes', isDeveloped: true },
      { id: 'historico', label: 'Histórico', icon: 'clock', route: '/historico', isDeveloped: false },
    ],
  },
];

// Revendedora: só os clientes, as vendas e o acerto de contas dela
export const MENU_REVENDEDORA: MenuGroup[] = [
  {
    groupTitle: 'Minha revenda',
    items: [
      { id: 'visao-geral', label: 'Visão Geral', icon: 'grid', route: '/visao-geral', isDeveloped: true },
      { id: 'pedidos', label: 'Pedidos', icon: 'shopping-bag', route: '/pedidos', isDeveloped: true },
      { id: 'clientes', label: 'Clientes', icon: 'users', route: '/clientes', isDeveloped: true },
    ],
  },
];

// Administração do sistema: empresas, planos e mensalidades (nada dos dados das empresas)
export const MENU_ADMIN: MenuGroup[] = [
  {
    groupTitle: 'Kipi',
    items: [{ id: 'admin', label: 'Empresas & Planos', icon: 'briefcase', route: '/admin', isDeveloped: true }],
  },
];

const MENU_DO_PERFIL: Record<Perfil, MenuGroup[]> = { dona: MENU_GROUPS, revendedora: MENU_REVENDEDORA, admin: MENU_ADMIN };
const CARGO_DO_PERFIL: Record<Perfil, string> = { dona: 'PROPRIETÁRIA', revendedora: 'REVENDEDORA', admin: 'ADMIN KIPI' };

interface SidebarProps {
  activeRoute: '/visao-geral' | '/pedidos' | '/clientes' | string;
  onNotice?: (message: string) => void;
}

// ============================================================================
// ESTADO DO MENU (compartilhado entre as telas). Começa solto: abre ao passar o
// mouse e fecha ao sair; "Fixar menu" deixa aberto e fica lembrado neste navegador.
// ============================================================================
const CHAVE_MENU_FIXADO = 'kipi:menu-fixado';
let estadoMenu = { menuPinned: false, menuHovered: false };
const ouvintesMenu = new Set<() => void>();

const atualizarMenu = (parcial: Partial<typeof estadoMenu>) => {
  estadoMenu = { ...estadoMenu, ...parcial };
  if (parcial.menuPinned !== undefined) {
    // Ao desafixar, o mouse está sobre o botão: continua aberto até o mouse sair
    estadoMenu.menuHovered = !parcial.menuPinned;
    AsyncStorage.setItem(CHAVE_MENU_FIXADO, parcial.menuPinned ? '1' : '0').catch(() => {});
  }
  ouvintesMenu.forEach((fn) => fn());
};

// Preferência guardada neste navegador (só lê; não mexe no "aberto pelo mouse")
AsyncStorage.getItem(CHAVE_MENU_FIXADO)
  .then((v) => {
    if (v === null) return;
    estadoMenu = { ...estadoMenu, menuPinned: v === '1' };
    ouvintesMenu.forEach((fn) => fn());
  })
  .catch(() => {});

const useEstadoMenu = () => {
  const [, forcarRender] = useState(0);
  useEffect(() => {
    const ouvinte = () => forcarRender((n) => n + 1);
    ouvintesMenu.add(ouvinte);
    return () => {
      ouvintesMenu.delete(ouvinte);
    };
  }, []);
  return estadoMenu;
};

const FONT_DISPLAY = Platform.select({ web: '"Sora", ui-sans-serif, system-ui, sans-serif', default: 'System' });
const FONT_SANS = Platform.select({ web: '"Manrope", ui-sans-serif, system-ui, sans-serif', default: 'System' });

export default function Sidebar({ activeRoute, onNotice }: SidebarProps) {
  const router = useRouter();
  const { config, sessao } = useConfigLoja();
  const nomeUsuario = sessao?.nome || 'Camila Lima';
  const perfil: Perfil = sessao?.perfil ?? 'dona';
  const menu = MENU_DO_PERFIL[perfil];
  // O painel do Kipi não mostra a marca de nenhum ateliê
  const marca = perfil === 'admin' ? { nome: 'Kipi', slogan: 'Painel do sistema', logoUri: null } : config;
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  // Estado do menu compartilhado entre as telas: trocar de tela não fixa nem fecha o menu
  const { menuPinned, menuHovered } = useEstadoMenu();
  const setMenuHovered = (v: boolean) => atualizarMenu({ menuHovered: v });
  const setMenuPinned = (v: boolean) => atualizarMenu({ menuPinned: v });
  const menuExpanded = isDesktop ? (menuPinned || menuHovered) : false;

  const handleItemPress = (item: MenuItem) => {
    if (item.isDeveloped && item.route) {
      if (item.route !== activeRoute) {
        router.push(item.route as any);
      }
    } else {
      if (onNotice) {
        onNotice(`A tela "${item.label}" será desenvolvida nas próximas etapas.`);
      }
    }
  };

  // Passou o mouse: abre; tirou: fecha (só quando não está fixado)
  const entrar = () => isDesktop && !menuPinned && !menuHovered && setMenuHovered(true);
  const sair = () => isDesktop && menuHovered && setMenuHovered(false);

  if (!isDesktop) return <View style={styles.sidebarMobileHidden} />;

  return (
    // Fixado: o menu ocupa 240px na tela. Solto: ocupa só a faixa de ícones e abre por cima do conteúdo.
    <View style={[styles.sidebarSlot, menuPinned ? styles.sidebarExpanded : styles.sidebarCollapsed]}>
    <View
      style={[
        styles.sidebar,
        styles.sidebarFlutuante,
        menuExpanded ? styles.sidebarExpanded : styles.sidebarCollapsed,
        !menuPinned && menuHovered && styles.sidebarSobreposto,
      ]}
      // @ts-ignore — eventos de mouse do react-native-web
      onMouseEnter={entrar}
      onMouseLeave={sair}
      onPointerEnter={entrar}
      onPointerLeave={sair}>

      {/* CABEÇALHO DO MENU / LOGO */}
      <View style={[styles.sidebarHeader, !menuExpanded && styles.sidebarHeaderCollapsed]}>
        <View style={styles.brandIconBox}>
          {marca.logoUri ? (
            <Image source={{ uri: marca.logoUri }} style={styles.brandLogo} contentFit="cover" />
          ) : (
            <Text style={styles.brandEmoji}>✨</Text>
          )}
        </View>

        {menuExpanded && (
          <View style={styles.brandTextBox}>
            <Text style={styles.brandTitle} numberOfLines={1}>{marca.nome}</Text>
            {marca.slogan ? (
              <Text style={styles.brandSubtitle} numberOfLines={1}>{marca.slogan.toUpperCase()}</Text>
            ) : null}
          </View>
        )}
      </View>

      {/* LISTA ROLÁVEL DE ITENS ORGANIZADOS POR GRUPOS */}
      <ScrollView
        style={styles.navScroll}
        contentContainerStyle={styles.navScrollContent}
        showsVerticalScrollIndicator={false}>

        {menu.map((group, gIdx) => (
          <View key={group.groupTitle} style={[styles.groupContainer, gIdx > 0 && styles.groupDivider]}>
            {menuExpanded && (
              <Text style={styles.groupHeaderLabel}>{group.groupTitle.toUpperCase()}</Text>
            )}

            <View style={styles.groupItemsList}>
              {group.items.map((item) => {
                const isActive = item.route === activeRoute;

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.navItem,
                      !menuExpanded && styles.navItemCollapsed,
                      isActive && styles.navItemActive,
                      isActive && !menuExpanded && styles.navItemActiveCollapsed,
                    ]}
                    activeOpacity={0.75}
                    onPress={() => handleItemPress(item)}>
                    <View style={[styles.iconWrapper, isActive && !menuExpanded && styles.iconWrapperActiveCollapsed]}>
                      <Feather
                        name={item.icon}
                        size={17}
                        color={isActive ? (menuExpanded ? '#FFFFFF' : '#FFFFFF') : '#64748B'}
                      />
                    </View>

                    {menuExpanded && (
                      <View style={styles.navTextRow}>
                        <Text style={[styles.navItemText, isActive && styles.navItemTextActive]}>
                          {item.label}
                        </Text>
                        {!item.isDeveloped && (
                          <View style={styles.soonPill}>
                            <Text style={styles.soonPillText}>Em breve</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))}

      </ScrollView>

      {/* RODAPÉ DO MENU (FIXAR MENU + PERFIL) */}
      <View style={styles.sidebarFooter}>
        {isDesktop && (
          <TouchableOpacity
            style={[
              styles.pinBtn,
              menuPinned && styles.pinBtnActive,
              !menuExpanded && styles.pinBtnCollapsed,
            ]}
            onPress={() => setMenuPinned(!menuPinned)}
            activeOpacity={0.7}>
            <Feather
              name={menuPinned ? 'lock' : 'unlock'}
              size={14}
              color={menuPinned ? '#2D7A58' : '#94A3B8'}
            />
            {menuExpanded && (
              <Text style={[styles.pinBtnText, menuPinned && styles.pinBtnTextActive]}>
                {menuPinned ? 'Menu fixado' : 'Fixar menu'}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Mesmo login com mais de uma área (ex.: Admin Kipi e Revendedora): troca sem sair */}
        {menuExpanded && (sessao?.areas?.length ?? 0) > 1 && (
          <View style={styles.areasBox}>
            <Text style={styles.areasTitulo}>TROCAR DE ÁREA</Text>
            {sessao!.areas!.map((a, i) => {
              const atual = a.perfil === sessao!.perfil && a.estabelecimentoId === sessao!.estabelecimentoId;
              return (
                <TouchableOpacity
                  key={`${a.perfil}-${a.estabelecimentoId}-${i}`}
                  style={[styles.areaBtn, atual && styles.areaBtnAtual]}
                  disabled={atual}
                  onPress={async () => {
                    await trocarArea(i);
                    router.replace(ROTAS_DO_PERFIL[a.perfil].inicio as any);
                  }}>
                  <Feather name={a.perfil === 'admin' ? 'shield' : a.perfil === 'revendedora' ? 'briefcase' : 'home'} size={12} color={atual ? '#2D7A58' : '#64748B'} />
                  <Text style={[styles.areaBtnTexto, atual && styles.areaBtnTextoAtual]} numberOfLines={1}>
                    {a.rotulo}
                  </Text>
                  {atual && <Feather name="check" size={12} color="#2D7A58" />}
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <View style={[styles.userMiniCard, !menuExpanded && styles.userMiniCardCollapsed]}>
          <View style={styles.userMiniAvatar}>
            <Text style={styles.userMiniAvatarLetter}>{nomeUsuario[0]?.toUpperCase()}</Text>
          </View>
          {menuExpanded && (
            <View style={styles.userMiniInfo}>
              <Text style={styles.userMiniName} numberOfLines={1}>{nomeUsuario}</Text>
              <Text style={styles.userMiniRole}>{CARGO_DO_PERFIL[perfil]}</Text>
            </View>
          )}
          {menuExpanded && (
            <TouchableOpacity
              onPress={async () => {
                await encerrarSessao();
                router.replace('/');
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="log-out" size={15} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

    </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    backgroundColor: '#FFFFFF',
    borderRightWidth: 1,
    borderRightColor: '#E2E8F0',
    flexDirection: 'column',
    justifyContent: 'space-between',
    zIndex: 100,
    ...Platform.select({
      web: {
        transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        boxShadow: '1px 0 10px rgba(15, 23, 42, 0.03)',
      },
    }),
  },
  sidebarSlot: {
    position: 'relative',
    zIndex: 100,
    alignSelf: 'stretch',
  },
  sidebarFlutuante: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
  },
  sidebarSobreposto: {
    ...Platform.select({
      web: { boxShadow: '8px 0 24px rgba(15, 23, 42, 0.12)' },
    }),
  },
  sidebarExpanded: {
    width: 240,
  },
  sidebarCollapsed: {
    width: 72,
  },
  sidebarMobileHidden: {
    display: 'none',
  },

  // HEADER LOGO
  sidebarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 10,
    height: 68,
  },
  sidebarHeaderCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  brandIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EAF5F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandEmoji: {
    fontSize: 18,
  },
  brandLogo: {
    width: 38,
    height: 38,
    borderRadius: 12,
  },
  brandTextBox: {
    flex: 1,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: FONT_DISPLAY,
    letterSpacing: -0.2,
  },
  brandSubtitle: {
    fontSize: 9,
    fontWeight: '800',
    color: '#2D7A58',
    letterSpacing: 0.8,
    fontFamily: FONT_SANS,
  },

  // ITENS DO MENU
  navScroll: {
    flex: 1,
  },
  navScrollContent: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  groupContainer: {
    marginBottom: 12,
  },
  groupDivider: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F8FAFC',
  },
  groupHeaderLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
    paddingHorizontal: 12,
    marginBottom: 6,
    fontFamily: FONT_SANS,
  },
  groupItemsList: {
    gap: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 10,
    ...Platform.select({
      web: {
        transition: 'all 0.15s ease',
      },
    }),
  },
  navItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
    paddingVertical: 6,
  },
  navItemActive: {
    backgroundColor: '#2D7A58',
  },
  navItemActiveCollapsed: {
    backgroundColor: 'transparent',
  },
  iconWrapper: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  iconWrapperActiveCollapsed: {
    backgroundColor: '#2D7A58',
  },
  navTextRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navItemText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    fontFamily: FONT_SANS,
  },
  navItemTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  soonPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  soonPillText: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '600',
    fontFamily: FONT_SANS,
  },

  // FOOTER DA SIDEBAR
  sidebarFooter: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    gap: 8,
    backgroundColor: '#FFFFFF',
  },
  pinBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
    gap: 8,
  },
  pinBtnCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  pinBtnActive: {
    backgroundColor: '#EAF5F1',
  },
  pinBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
    fontFamily: FONT_SANS,
  },
  pinBtnTextActive: {
    color: '#2D7A58',
  },
  areasBox: { gap: 4, marginBottom: 8 },
  areasTitulo: { fontSize: 9, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.6, marginBottom: 2, paddingHorizontal: 4 },
  areaBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, backgroundColor: '#F8FAFC' },
  areaBtnAtual: { backgroundColor: '#ECFDF5' },
  areaBtnTexto: { flex: 1, fontSize: 11, fontWeight: '600', color: '#475569' },
  areaBtnTextoAtual: { color: '#2D7A58', fontWeight: '800' },
  userMiniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    gap: 8,
  },
  userMiniCardCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  userMiniAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EAF5F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userMiniAvatarLetter: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2D7A58',
    fontFamily: FONT_DISPLAY,
  },
  userMiniInfo: {
    flex: 1,
  },
  userMiniName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: FONT_SANS,
  },
  userMiniRole: {
    fontSize: 9,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
    fontFamily: FONT_SANS,
  },
});

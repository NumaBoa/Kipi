import React, { useState } from 'react';
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
      { id: 'acessos', label: 'Acessos', icon: 'shield', route: '/acessos', isDeveloped: false },
      { id: 'configuracoes', label: 'Configurações', icon: 'settings', route: '/configuracoes', isDeveloped: false },
      { id: 'historico', label: 'Histórico', icon: 'clock', route: '/historico', isDeveloped: false },
    ],
  },
];

interface SidebarProps {
  activeRoute: '/visao-geral' | '/pedidos' | '/clientes' | string;
  onNotice?: (message: string) => void;
}

const FONT_DISPLAY = Platform.select({ web: '"Sora", ui-sans-serif, system-ui, sans-serif', default: 'System' });
const FONT_SANS = Platform.select({ web: '"Manrope", ui-sans-serif, system-ui, sans-serif', default: 'System' });

export default function Sidebar({ activeRoute, onNotice }: SidebarProps) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1024;

  const [menuHovered, setMenuHovered] = useState(false);
  const [menuPinned, setMenuPinned] = useState(true);
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

  return (
    <View
      style={[
        styles.sidebar,
        isDesktop
          ? menuExpanded
            ? styles.sidebarExpanded
            : styles.sidebarCollapsed
          : styles.sidebarMobileHidden,
      ]}
      // @ts-ignore
      onMouseEnter={() => isDesktop && !menuPinned && setMenuHovered(true)}
      onMouseLeave={() => isDesktop && !menuPinned && setMenuHovered(false)}>

      {/* CABEÇALHO DO MENU / LOGO */}
      <View style={[styles.sidebarHeader, !menuExpanded && styles.sidebarHeaderCollapsed]}>
        <View style={styles.brandIconBox}>
          <Text style={styles.brandEmoji}>✨</Text>
        </View>

        {menuExpanded && (
          <View style={styles.brandTextBox}>
            <Text style={styles.brandTitle}>AtelierQ</Text>
            <Text style={styles.brandSubtitle}>PÂTISSERIE GOURMET</Text>
          </View>
        )}
      </View>

      {/* LISTA ROLÁVEL DE ITENS ORGANIZADOS POR GRUPOS */}
      <ScrollView
        style={styles.navScroll}
        contentContainerStyle={styles.navScrollContent}
        showsVerticalScrollIndicator={false}>

        {MENU_GROUPS.map((group, gIdx) => (
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

        <View style={[styles.userMiniCard, !menuExpanded && styles.userMiniCardCollapsed]}>
          <View style={styles.userMiniAvatar}>
            <Text style={styles.userMiniAvatarLetter}>C</Text>
          </View>
          {menuExpanded && (
            <View style={styles.userMiniInfo}>
              <Text style={styles.userMiniName} numberOfLines={1}>Camila Lima</Text>
              <Text style={styles.userMiniRole}>PROPRIETÁRIA</Text>
            </View>
          )}
          {menuExpanded && (
            <TouchableOpacity
              onPress={() => router.replace('/')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Feather name="log-out" size={15} color="#94A3B8" />
            </TouchableOpacity>
          )}
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

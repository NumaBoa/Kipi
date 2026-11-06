import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSessao } from '@/lib/acesso';
import { usePedidos } from '@/lib/clientesPedidos';
import { pedidosDoEscopo, useEscopoRevendedora } from '@/lib/minhaRevenda';
import { T } from './ui';
import { cor } from './tema';

// ============================================================================
// ABAS DO CELULAR — o que se usa todo dia fica a um toque; o resto vai para "Mais".
// Revendedora vê só as abas das telas dela.
// ============================================================================
type Aba = { rota: string; rotulo: string; icone: keyof typeof Feather.glyphMap };

const ABAS_DONA: Aba[] = [
  { rota: '/visao-geral', rotulo: 'Início', icone: 'grid' },
  { rota: '/pedidos', rotulo: 'Pedidos', icone: 'shopping-bag' },
  { rota: '/producao', rotulo: 'Produção', icone: 'zap' },
  { rota: '/clientes', rotulo: 'Clientes', icone: 'users' },
  { rota: '/mais', rotulo: 'Mais', icone: 'menu' },
];
const ABAS_REVENDEDORA: Aba[] = [
  { rota: '/visao-geral', rotulo: 'Início', icone: 'grid' },
  { rota: '/pedidos', rotulo: 'Pedidos', icone: 'shopping-bag' },
  { rota: '/clientes', rotulo: 'Clientes', icone: 'users' },
  { rota: '/mais', rotulo: 'Mais', icone: 'menu' },
];

export const ALTURA_ABAS = 62;

export default function TabBar({ ativa }: { ativa: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sessao } = useSessao();
  const escopo = useEscopoRevendedora();
  // Número de pedidos esperando pagamento, visível de qualquer tela
  const pendentes = pedidosDoEscopo(usePedidos(), escopo.revendedoraId).filter((p) => !p.deletado && p.status === 'pendente').length;
  const abas = sessao?.perfil === 'revendedora' ? ABAS_REVENDEDORA : ABAS_DONA;

  return (
    <View style={[s.barra, { paddingBottom: Math.max(insets.bottom, 8) }]} accessibilityRole="tablist">
      {abas.map((a) => {
        const on = a.rota === ativa;
        return (
          <TouchableOpacity
            key={a.rota}
            style={s.aba}
            onPress={() => !on && router.replace(a.rota as any)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={a.rota === '/pedidos' && pendentes > 0 ? `${a.rotulo}, ${pendentes} pendentes` : a.rotulo}>
            <View style={[s.icone, on && s.iconeOn]}>
              <Feather name={a.icone} size={21} color={on ? cor.azulTexto : cor.textoSuave} />
              {a.rota === '/pedidos' && pendentes > 0 && (
                <View style={s.selo}>
                  <T style={s.seloTexto}>{pendentes > 99 ? '99+' : pendentes}</T>
                </View>
              )}
            </View>
            <T style={[s.rotulo, on && s.rotuloOn]}>{a.rotulo}</T>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  barra: {
    flexDirection: 'row',
    paddingTop: 8,
    paddingHorizontal: 6,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: cor.borda,
  },
  aba: { flex: 1, alignItems: 'center', gap: 3, minHeight: 48 },
  icone: { width: 56, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  iconeOn: { backgroundColor: cor.azulClaro },
  rotulo: { fontSize: 11, fontWeight: '600', color: cor.textoSuave },
  rotuloOn: { color: cor.azulTexto, fontWeight: '800' },
  selo: {
    position: 'absolute',
    top: -2,
    right: 8,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: cor.vermelhoForte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seloTexto: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
});

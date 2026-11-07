import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useConfigLoja, encerrarSessao } from '@/lib/configuracoes';
import { trocarArea, ROTAS_DO_PERFIL, type Perfil } from '@/lib/acesso';
import { useEhCelular } from '@/lib/layout';
import { MENU_DO_PERFIL, CARGO_DO_PERFIL } from '@/components/Sidebar';
import TabBar from '@/components/mobile/TabBar';
import { T, useAviso, Aviso } from '@/components/mobile/ui';
import { cor, sombra } from '@/components/mobile/tema';

// ============================================================================
// MENU "MAIS" (celular) — tudo o que não está nas abas, nos mesmos grupos do menu lateral
// ============================================================================
const NAS_ABAS = ['/visao-geral', '/pedidos', '/producao', '/clientes'];

export default function MaisScreen() {
  const router = useRouter();
  const celular = useEhCelular();
  const { config, sessao } = useConfigLoja();
  const { msg, avisar } = useAviso();
  const perfil: Perfil = sessao?.perfil ?? 'dona';
  const nome = sessao?.nome || 'Camila Lima';

  // No computador o menu lateral já mostra tudo: "Mais" não existe
  useEffect(() => {
    if (!celular) router.replace(ROTAS_DO_PERFIL[perfil].inicio as any);
  }, [celular, perfil]);

  const grupos = MENU_DO_PERFIL[perfil]
    .map((g) => ({ ...g, items: g.items.filter((i) => !NAS_ABAS.includes(i.route ?? '')) }))
    .filter((g) => g.items.length > 0);

  return (
    <SafeAreaView style={s.tela} edges={['top']}>
      <ScrollView contentContainerStyle={s.conteudo} showsVerticalScrollIndicator={false}>
        <T titulo style={s.titulo}>Mais</T>

        <TouchableOpacity style={s.perfil} activeOpacity={0.85} onPress={() => perfil === 'dona' && router.push('/configuracoes')} accessibilityRole="button">
          <View style={s.avatar}>
            <T titulo style={s.avatarTexto}>{nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</T>
          </View>
          <View style={{ flex: 1 }}>
            <T style={s.perfilNome}>{nome}</T>
            <T style={s.perfilSub}>{CARGO_DO_PERFIL[perfil]} · {config.nome}</T>
          </View>
          {perfil === 'dona' && <Feather name="chevron-right" size={18} color="#FFFDFA" />}
        </TouchableOpacity>

        {grupos.map((g) => (
          <View key={g.groupTitle} style={{ gap: 8 }}>
            <T style={s.grupoTitulo}>{g.groupTitle}</T>
            <View style={[s.lista, sombra]}>
              {g.items.map((it, i) => (
                <TouchableOpacity
                  key={it.id}
                  style={[s.item, i > 0 && s.itemBorda]}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  onPress={() => (it.isDeveloped && it.route ? router.push(it.route as any) : avisar(`A tela "${it.label}" será desenvolvida nas próximas etapas.`))}>
                  <View style={s.itemIcone}>
                    <Feather name={it.icon} size={19} color={cor.azulTexto} />
                  </View>
                  <T style={s.itemTexto}>{it.label}</T>
                  {!it.isDeveloped && <T style={s.emBreve}>Em breve</T>}
                  <Feather name="chevron-right" size={18} color={cor.textoSuave} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        {(sessao?.areas?.length ?? 0) > 1 && (
          <View style={{ gap: 8 }}>
            <T style={s.grupoTitulo}>Trocar de área</T>
            <View style={[s.lista, sombra]}>
              {sessao!.areas!.map((a, i) => {
                const atual = a.perfil === sessao!.perfil && a.estabelecimentoId === sessao!.estabelecimentoId;
                return (
                  <TouchableOpacity
                    key={`${a.perfil}-${a.estabelecimentoId}-${i}`}
                    style={[s.item, i > 0 && s.itemBorda]}
                    disabled={atual}
                    onPress={async () => {
                      await trocarArea(i);
                      router.replace(ROTAS_DO_PERFIL[a.perfil].inicio as any);
                    }}>
                    <T style={[s.itemTexto, atual && { color: cor.azulTexto }]}>{a.rotulo}</T>
                    {atual && <Feather name="check" size={18} color={cor.azulTexto} />}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <TouchableOpacity
          style={s.sair}
          accessibilityRole="button"
          onPress={async () => {
            await encerrarSessao();
            router.replace('/');
          }}>
          <Feather name="log-out" size={18} color={cor.vermelho} />
          <T style={s.sairTexto}>Sair da conta</T>
        </TouchableOpacity>

        <View style={s.rodape}>
          <T style={s.rodapeTexto}>Kipi · versão {Constants.expoConfig?.version ?? '1.0.0'}</T>
          <T style={s.rodapeTexto}>Termos · Ajuda & Suporte</T>
        </View>
      </ScrollView>
      <Aviso msg={msg} base={90} />
      <TabBar ativa="/mais" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  conteudo: { padding: 16, paddingTop: 12, gap: 18, paddingBottom: 32 },
  titulo: { fontSize: 28, fontWeight: '700', letterSpacing: -0.6, paddingHorizontal: 4 },
  perfil: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 24, backgroundColor: cor.azulBotao },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: cor.pistache, alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { fontSize: 18, fontWeight: '700' },
  perfilNome: { color: '#FFFDFA', fontSize: 16, fontWeight: '800' },
  perfilSub: { color: '#ECEBFA', fontSize: 13 },
  grupoTitulo: { paddingHorizontal: 12, fontSize: 13, fontWeight: '800', color: cor.textoMedio },
  lista: { backgroundColor: '#FFFDFA', borderRadius: 24, overflow: 'hidden' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 60, paddingHorizontal: 16 },
  itemBorda: { borderTopWidth: 1, borderTopColor: cor.bordaSuave },
  itemIcone: { width: 38, height: 38, borderRadius: 13, backgroundColor: cor.azulClaro, alignItems: 'center', justifyContent: 'center' },
  itemTexto: { flex: 1, fontSize: 15, fontWeight: '700' },
  emBreve: { fontSize: 11, fontWeight: '800', color: cor.textoSuave },
  sair: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 54, borderRadius: 27, backgroundColor: cor.vermelhoClaro },
  sairTexto: { color: cor.vermelho, fontSize: 15, fontWeight: '800' },
  rodape: { alignItems: 'center', gap: 4 },
  rodapeTexto: { fontSize: 12, color: cor.textoSuave },
});

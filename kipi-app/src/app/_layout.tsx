import { useEffect } from 'react';
import { Stack, usePathname, useRouter } from 'expo-router';
import { useSessao, destinoPermitido } from '@/lib/acesso';
import '@/lib/sincronizacao'; // liga as telas ao banco quando o .env existe
import StatusBanco from '@/components/StatusBanco';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import '../global.css';

// On Web, ensure browser autofill does not render blue background
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  // Página em português: evita o navegador oferecer "Traduzir do inglês"
  document.documentElement.lang = 'pt-BR';
  const styleId = 'kipi-autofill-fix';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      input:-webkit-autofill:active {
        -webkit-box-shadow: 0 0 0 1000px #FFFDFA inset !important;
        box-shadow: 0 0 0 1000px #FFFDFA inset !important;
        -webkit-text-fill-color: #2E211A !important;
        transition: background-color 50000s ease-in-out 0s;
        background-color: transparent !important;
      }
      input {
        background-color: transparent !important;
      }
    `;
    document.head.appendChild(style);
  }

  const fontId = 'google-fonts-kipi-id';
  if (!document.getElementById(fontId)) {
    const linkPreconnect1 = document.createElement('link');
    linkPreconnect1.rel = 'preconnect';
    linkPreconnect1.href = 'https://fonts.googleapis.com';
    document.head.appendChild(linkPreconnect1);

    const linkPreconnect2 = document.createElement('link');
    linkPreconnect2.rel = 'preconnect';
    linkPreconnect2.href = 'https://fonts.gstatic.com';
    linkPreconnect2.crossOrigin = 'anonymous';
    document.head.appendChild(linkPreconnect2);

    const fontLink = document.createElement('link');
    fontLink.id = fontId;
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=Instrument+Sans:wght@400;500;600;700&display=swap';
    document.head.appendChild(fontLink);
  }
}

// Cada perfil só abre as telas dele: sem sessão volta ao login, revendedora não
// abre telas da dona, dona não abre o painel do Kipi (e vice-versa)
function GuardaDeRotas() {
  const { sessao, carregada } = useSessao();
  const rota = usePathname();
  const router = useRouter();
  const destino = carregada ? destinoPermitido(sessao, rota) : null;
  useEffect(() => {
    if (destino) router.replace(destino as any);
  }, [destino]);
  // Enquanto confere ou redireciona, cobre a tela para não mostrar dados de outro perfil
  if (carregada && !destino) return null;
  return <View style={styles.cobertura} />;
}

export default function RootLayout() {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="visao-geral" options={{ headerShown: false }} />
        <Stack.Screen name="pedidos" options={{ headerShown: false }} />
        <Stack.Screen name="clientes" options={{ headerShown: false }} />
        <Stack.Screen name="acessos" options={{ headerShown: false }} />
        <Stack.Screen name="configuracoes" options={{ headerShown: false }} />
        <Stack.Screen name="insumos-receitas" options={{ headerShown: false }} />
        <Stack.Screen name="produtos-estoque" options={{ headerShown: false }} />
        <Stack.Screen name="producao" options={{ headerShown: false }} />
        <Stack.Screen name="estoque" options={{ headerShown: false }} />
        <Stack.Screen name="explore" options={{ headerShown: false }} />
        <Stack.Screen name="admin" options={{ headerShown: false }} />
        <Stack.Screen name="mais" options={{ headerShown: false, animation: 'none' }} />
      </Stack>
      <GuardaDeRotas />
      <StatusBanco />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F6F2',
  },
  cobertura: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F8F6F2',
    zIndex: 1000,
  },
});

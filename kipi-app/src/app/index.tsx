import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle, Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { entrar, sessaoAtual, ROTAS_DO_PERFIL, SENHA_PADRAO_REVENDEDORA } from '@/lib/acesso';
import { bancoLigado } from '@/lib/supabase';
import { useStatusBanco } from '@/lib/sincronizacao';

// ============================================================================
// LOGIN — nova identidade (caramelo + mirtilo, Bricolage Grotesque / Instrument Sans)
// Computador (≥ 1100px): painel em degradê à esquerda e formulário à direita.
// Celular: degradê no topo e formulário subindo por cima.
// ============================================================================

// Usuários de teste: um de cada perfil (e dois ateliês, para conferir que um não vê o outro)
const ATALHOS_TESTE = [
  { rotulo: 'Kipi (administração)', email: 'admin@kipi.app', senha: 'kipi123' },
  { rotulo: 'AtelierQ (responsável)', email: 'camila.c.lima08@gmail.com', senha: 'P&ix1nh0!' },
  { rotulo: 'Doce Encanto (responsável)', email: 'patricia@doceencanto.com', senha: '123456' },
  { rotulo: 'Juliana (revendedora)', email: 'juliana.martins@gmail.com', senha: SENHA_PADRAO_REVENDEDORA },
];

const C = {
  fundo: '#F8F6F2',
  papel: '#FFFDFA',
  tinta: '#2E211A',
  tintaMedia: '#3D312A',
  suave: '#6B615A',
  apagado: '#9A8F87',
  borda: '#E8E0D6',
  caramelo: '#B06A2C',
  carameloEscuro: '#7A4520',
  carameloTinta: '#5A3318',
  creme: '#FFF6EA',
  cremeSuave: '#F6E6D4',
  mirtilo: '#4B4FC4',
  mirtiloClaro: '#ECEBFA',
  erro: '#B42318',
  erroFundo: '#FBE7E4',
  erroBorda: '#F3C4BD',
};

const TITULO = Platform.select({ web: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif', default: undefined });
const TEXTO = Platform.select({ web: '"Instrument Sans", ui-sans-serif, system-ui, sans-serif', default: undefined });

const DEGRADE = 'radial-gradient(120% 120% at 85% 0%, #C08550 0%, #8A5530 55%, #6E4426 100%)';
const comDegrade = (sombra?: string) =>
  Platform.OS === 'web'
    ? ({ backgroundImage: DEGRADE, experimental_backgroundImage: DEGRADE, ...(sombra ? { boxShadow: sombra } : {}) } as object)
    : {};

const DESTAQUES = [
  { emoji: '🧾', titulo: 'Pedidos', texto: 'Encomendas, entregas e quem falta pagar' },
  { emoji: '🧁', titulo: 'Produção', texto: 'O que assar hoje e o que está no freezer' },
  { emoji: '🤝', titulo: 'Revenda', texto: 'Estoque e acerto de cada revendedora' },
];

function Biscoito({ size = 18, color = '#FFFFFF' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20.8 12.6A9 9 0 1111.4 3.2a3 3 0 003.6 3.6 3 3 0 004 4 2.9 2.9 0 001.8 1.8z" />
      <Circle cx={8.5} cy={10} r={0.9} fill={color} />
      <Circle cx={12} cy={15} r={0.9} fill={color} />
      <Circle cx={15.8} cy={15.6} r={0.9} fill={color} />
    </Svg>
  );
}

function Logo({ grande }: { grande?: boolean }) {
  const t = grande ? 20 : 18;
  return (
    <View style={s.logo}>
      <View style={[s.logoIcone, { width: t + 14, height: t + 14 }]}>
        <Biscoito size={t} />
      </View>
      <Text style={[s.logoTexto, { fontSize: t }]}>Kipi</Text>
    </View>
  );
}

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <Path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <Path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
      <Path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </Svg>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const computador = width >= 1100;
  const tituloPainel = Math.min(60, Math.round((width - 700) / 11));
  const mostrarDestaques = width >= 1280;
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [foco, setFoco] = useState<'email' | 'senha' | null>(null);
  // Banco ligado: atalhos com os dados reais (aparecem quando o banco termina de carregar)
  const { atalhos: atalhosBanco } = useStatusBanco();
  const atalhos = bancoLigado ? atalhosBanco : ATALHOS_TESTE; // banco ligado: sem atalhos (cada um usa o próprio login)

  const handleLogin = async (emailParam?: string, senhaParam?: string) => {
    const loginEmail = (emailParam || email).trim().toLowerCase();
    const loginSenha = (senhaParam || senha).trim();
    if (!loginEmail) {
      setErro('Informe seu e-mail');
      return;
    }
    if (!loginSenha) {
      setErro('Digite sua senha');
      return;
    }
    setCarregando(true);
    setErro(null);
    const falha = await entrar(loginEmail, loginSenha);
    setCarregando(false);
    if (falha) {
      setErro(falha);
      return;
    }
    const sessao = sessaoAtual();
    if (sessao) router.replace(ROTAS_DO_PERFIL[sessao.perfil].inicio as any);
  };

  const preencherRapido = (uEmail: string, uSenha: string) => {
    setEmail(uEmail);
    setSenha(uSenha);
    setErro(null);
    handleLogin(uEmail, uSenha);
  };

  const formulario = (
    <View style={s.form}>
      {erro && (
        <View style={s.erroCaixa} accessibilityRole="alert">
          <Feather name="alert-circle" size={16} color={C.erro} />
          <Text style={s.erroTexto}>{erro}</Text>
        </View>
      )}

      <View style={s.grupo}>
        <Text style={s.rotulo}>E-mail</Text>
        <View style={[s.campo, foco === 'email' && s.campoFoco]}>
          <Feather name="mail" size={18} color={foco === 'email' ? C.mirtilo : C.apagado} />
          <TextInput
            style={s.input}
            placeholder="seu@email.com"
            placeholderTextColor={C.apagado}
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              if (erro) setErro(null);
            }}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
            onFocus={() => setFoco('email')}
            onBlur={() => setFoco(null)}
          />
        </View>
      </View>

      <View style={s.grupo}>
        <View style={s.rotuloLinha}>
          <Text style={s.rotulo}>Senha</Text>
          <TouchableOpacity activeOpacity={0.7} hitSlop={8}>
            <Text style={s.link}>Esqueceu a senha?</Text>
          </TouchableOpacity>
        </View>
        <View style={[s.campo, foco === 'senha' && s.campoFoco]}>
          <Feather name="lock" size={18} color={foco === 'senha' ? C.mirtilo : C.apagado} />
          <TextInput
            style={s.input}
            placeholder="Sua senha"
            placeholderTextColor={C.apagado}
            value={senha}
            onChangeText={(t) => {
              setSenha(t);
              if (erro) setErro(null);
            }}
            secureTextEntry={!mostrarSenha}
            autoComplete="current-password"
            returnKeyType="go"
            onSubmitEditing={() => handleLogin()}
            onFocus={() => setFoco('senha')}
            onBlur={() => setFoco(null)}
          />
          <TouchableOpacity
            onPress={() => setMostrarSenha(!mostrarSenha)}
            style={s.olho}
            accessibilityLabel={mostrarSenha ? 'Esconder senha' : 'Mostrar senha'}
            hitSlop={8}>
            <Feather name={mostrarSenha ? 'eye-off' : 'eye'} size={18} color={C.suave} />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[s.entrar, carregando && { opacity: 0.85 }]}
        onPress={() => handleLogin()}
        disabled={carregando}
        activeOpacity={0.85}
        accessibilityRole="button">
        {carregando ? (
          <>
            <ActivityIndicator size="small" color={C.creme} />
            <Text style={s.entrarTexto}>Entrando...</Text>
          </>
        ) : (
          <>
            <Text style={s.entrarTexto}>Entrar</Text>
            <Feather name="arrow-right" size={18} color={C.creme} />
          </>
        )}
      </TouchableOpacity>

      <View style={s.divisor}>
        <View style={s.divisorLinha} />
        <Text style={s.divisorTexto}>ou</Text>
        <View style={s.divisorLinha} />
      </View>

      <TouchableOpacity style={s.google} activeOpacity={0.85}>
        <GoogleIcon size={18} />
        <Text style={s.googleTexto}>Entrar com o Google</Text>
      </TouchableOpacity>

      <View style={s.criarLinha}>
        <Text style={s.criarTexto}>Ainda não usa o Kipi? </Text>
        <TouchableOpacity activeOpacity={0.7}>
          <Text style={[s.link, { fontSize: 14 }]}>Criar uma conta</Text>
        </TouchableOpacity>
      </View>

      {/* ATALHO DE TESTE: só com os dados de exemplo (sem banco) */}
      {atalhos.length > 0 && (
        <View style={s.atalhos}>
          <Text style={s.atalhosTitulo}>ENTRAR COMO (SÓ NA VERSÃO DE TESTES)</Text>
          <View style={s.atalhosLista}>
            {atalhos.map((a) => (
              <TouchableOpacity key={a.email} style={s.atalho} onPress={() => preencherRapido(a.email, a.senha)}>
                <Text style={s.atalhoTexto}>{a.rotulo}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  if (computador) {
    return (
      <View style={s.telaWeb}>
        <View style={[s.painel, comDegrade('0 30px 60px -36px rgba(40,18,4,.8)')]}>
          <View style={[s.circulo, { right: -120, top: -80, width: 460, height: 460, borderRadius: 230 }]} />
          <View style={[s.bolha, { right: 60, bottom: 150, width: 160, height: 160, borderRadius: 80 }]} />
          <Logo grande />
          <View style={s.painelMeio}>
            <View style={s.sobreLinha}>
              <View style={s.pontoCreme} />
              <Text style={s.sobreTexto}>GESTÃO PARA ATELIÊS DE CONFEITARIA</Text>
            </View>
            <Text style={[s.painelTitulo, { fontSize: tituloPainel, lineHeight: tituloPainel }]}>
              Do forno à revendedora, <Text style={s.painelTituloSuave}>no mesmo lugar.</Text>
            </Text>
            <Text style={s.painelTexto}>
              Pedidos, produção, estoque, receitas e o acerto com as revendedoras. Tudo organizado, do jeito que o seu ateliê trabalha.
            </Text>
          </View>
          {mostrarDestaques && (
          <View style={s.destaques}>
            {DESTAQUES.map((d) => (
              <View key={d.titulo} style={s.destaque}>
                <Text style={{ fontSize: 20 }}>{d.emoji}</Text>
                <Text style={s.destaqueTitulo}>{d.titulo}</Text>
                <Text style={s.destaqueTexto}>{d.texto}</Text>
              </View>
            ))}
          </View>
          )}
        </View>
        <ScrollView style={s.ladoForm} contentContainerStyle={s.ladoFormConteudo} keyboardShouldPersistTaps="handled">
          <View style={s.formLargura}>
            <View style={[s.cabecalho, { marginBottom: 22 }]}>
              <View style={s.sobreLinha}>
                <View style={s.pontoCaramelo} />
                <Text style={s.olaTexto}>Bem-vinda de volta</Text>
              </View>
              <Text style={s.tituloWeb}>
                Entre na sua <Text style={{ color: C.mirtilo }}>conta.</Text>
              </Text>
            </View>
            {formulario}
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <SafeAreaView style={s.telaCel} edges={['bottom']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={[s.topo, comDegrade()]}>
          <View style={[s.circulo, { right: -40, top: 40, width: 180, height: 180, borderRadius: 90 }]} />
          <View style={[s.bolha, { right: 30, top: 120, width: 70, height: 70, borderRadius: 35 }]} />
          <Logo />
          <Text style={s.topoTitulo}>
            Do forno à revendedora,{'\n'}
            <Text style={s.painelTituloSuave}>no mesmo lugar.</Text>
          </Text>
          <Text style={s.topoTexto}>Pedidos, produção, estoque e revenda do seu ateliê num só app.</Text>
        </View>
        <View style={s.folha}>
          <View style={[s.cabecalho, { marginBottom: 4 }]}>
            <Text style={s.tituloCel}>Entrar</Text>
            <Text style={s.olaCel}>
              Que bom te ver de novo. <Text style={{ color: C.mirtilo, fontWeight: '700' }}>Acesse sua conta.</Text>
            </Text>
          </View>
          {formulario}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  // ---------- comuns ----------
  logo: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 16,
    borderRadius: 999,
    backgroundColor: C.creme,
  },
  logoIcone: { borderRadius: 11, backgroundColor: C.caramelo, alignItems: 'center', justifyContent: 'center' },
  logoTexto: { fontFamily: TITULO, fontWeight: '700', letterSpacing: -0.6, color: C.carameloTinta },
  circulo: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(255,246,234,0.16)' },
  bolha: { position: 'absolute', backgroundColor: 'rgba(255,246,234,0.07)' },
  painelTituloSuave: { color: C.cremeSuave, opacity: 0.8 },
  sobreLinha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pontoCreme: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.creme },
  pontoCaramelo: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.caramelo },
  cabecalho: { gap: 6, marginBottom: 8 },

  form: { gap: 16 },
  erroCaixa: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: C.erroFundo,
    borderWidth: 1,
    borderColor: C.erroBorda,
  },
  erroTexto: { flex: 1, fontFamily: TEXTO, fontSize: 13, fontWeight: '600', color: C.erro },
  grupo: { gap: 7 },
  rotuloLinha: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rotulo: { fontFamily: TEXTO, fontSize: 13, fontWeight: '600', color: C.tintaMedia },
  link: { fontFamily: TEXTO, fontSize: 13, fontWeight: '700', color: C.mirtilo },
  campo: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: C.borda,
    backgroundColor: C.papel,
  },
  campoFoco: {
    borderColor: C.mirtilo,
    ...Platform.select({ web: { boxShadow: `0 0 0 4px ${C.mirtiloClaro}` } as object, default: {} }),
  },
  input: {
    flex: 1,
    minWidth: 0,
    height: '100%',
    fontFamily: TEXTO,
    fontSize: 15,
    color: C.tinta,
    ...Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }),
  },
  olho: { width: 36, height: 36, marginRight: -8, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  entrar: {
    height: 54,
    borderRadius: 999,
    backgroundColor: C.carameloEscuro,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...Platform.select({
      web: { boxShadow: '0 16px 30px -18px rgba(40,18,4,.9)' } as object,
      default: { shadowColor: '#28120A', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
    }),
  },
  entrarTexto: { fontFamily: TEXTO, fontSize: 16, fontWeight: '700', color: C.creme },
  divisor: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  divisorLinha: { flex: 1, height: 1, backgroundColor: C.borda },
  divisorTexto: { fontFamily: TEXTO, fontSize: 13, color: C.apagado },
  google: {
    height: 50,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: C.borda,
    backgroundColor: C.papel,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  googleTexto: { fontFamily: TEXTO, fontSize: 15, fontWeight: '600', color: C.tinta },
  criarLinha: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' },
  criarTexto: { fontFamily: TEXTO, fontSize: 14, color: C.suave },
  atalhos: { padding: 14, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: '#D9CFC4', gap: 8 },
  atalhosTitulo: { fontFamily: TEXTO, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, color: C.apagado },
  atalhosLista: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  atalho: { height: 32, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, borderColor: C.borda, backgroundColor: C.papel, justifyContent: 'center' },
  atalhoTexto: { fontFamily: TEXTO, fontSize: 12, fontWeight: '600', color: '#4A3E37' },

  // ---------- computador ----------
  telaWeb: { flex: 1, flexDirection: 'row', backgroundColor: C.fundo },
  painel: {
    flex: 1,
    margin: 20,
    marginRight: 0,
    borderRadius: 32,
    paddingVertical: 48,
    paddingHorizontal: 56,
    backgroundColor: '#8A5530',
    overflow: 'hidden',
  },
  painelMeio: { marginTop: 'auto', gap: 18, maxWidth: 560 },
  sobreTexto: { fontFamily: TEXTO, fontSize: 13, fontWeight: '700', letterSpacing: 0.8, color: C.cremeSuave },
  painelTitulo: { fontFamily: TITULO, fontSize: 60, lineHeight: 60, fontWeight: '700', letterSpacing: -2.2, color: C.creme },
  painelTexto: { fontFamily: TEXTO, fontSize: 17, lineHeight: 26, color: C.cremeSuave, maxWidth: 470 },
  destaques: { marginTop: 36, flexDirection: 'row', gap: 12 },
  destaque: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 22,
    backgroundColor: 'rgba(255,246,234,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,246,234,0.18)',
    gap: 4,
  },
  destaqueTitulo: { fontFamily: TITULO, fontSize: 17, fontWeight: '700', letterSpacing: -0.5, color: C.creme },
  destaqueTexto: { fontFamily: TEXTO, fontSize: 13, lineHeight: 18, color: C.cremeSuave },
  ladoForm: { width: 540, flexGrow: 0 },
  ladoFormConteudo: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  formLargura: { width: '100%', maxWidth: 420 },
  olaTexto: { fontFamily: TEXTO, fontSize: 13, fontWeight: '600', color: C.suave },
  tituloWeb: { fontFamily: TITULO, fontSize: 40, lineHeight: 42, fontWeight: '700', letterSpacing: -1.4, color: C.tinta },

  // ---------- celular ----------
  telaCel: { flex: 1, backgroundColor: C.fundo },
  topo: {
    paddingTop: 64,
    paddingHorizontal: 24,
    paddingBottom: 72,
    backgroundColor: '#8A5530',
    overflow: 'hidden',
  },
  topoTitulo: { marginTop: 26, fontFamily: TITULO, fontSize: 34, lineHeight: 36, fontWeight: '700', letterSpacing: -1.2, color: C.creme },
  topoTexto: { marginTop: 12, fontFamily: TEXTO, fontSize: 15, lineHeight: 21, color: C.cremeSuave, maxWidth: 300 },
  folha: {
    flex: 1,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    marginTop: -36,
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: C.fundo,
    gap: 16,
  },
  tituloCel: { fontFamily: TITULO, fontSize: 26, fontWeight: '700', letterSpacing: -0.8, color: C.tinta },
  olaCel: { fontFamily: TEXTO, fontSize: 14, color: C.suave },
});

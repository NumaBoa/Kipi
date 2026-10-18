import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { KipiPalette, Fonts } from '@/constants/theme';

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 840;

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [lembrar, setLembrar] = useState(true);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [usuarioLogado, setUsuarioLogado] = useState<any | null>(null);

  const [emailFocado, setEmailFocado] = useState(false);
  const [senhaFocada, setSenhaFocada] = useState(false);

  const handleLogin = async (emailParam?: string, senhaParam?: string) => {
    const loginEmail = (emailParam || email).trim().toLowerCase();
    const loginSenha = (senhaParam || senha).trim();

    if (!loginEmail) {
      setErro('Informe seu e-mail');
      return;
    }
    if (!loginSenha) {
      setErro('Informe sua senha');
      return;
    }

    setCarregando(true);
    setErro(null);

    try {
      const { data, error: dbError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', loginEmail)
        .maybeSingle();

      if (dbError) throw new Error(dbError.message);

      if (!data) {
        setErro('E-mail não cadastrado no sistema');
        setCarregando(false);
        return;
      }

      if (data.senha && data.senha !== loginSenha) {
        setErro('Senha incorreta. Tente novamente');
        setCarregando(false);
        return;
      }

      setUsuarioLogado(data);
    } catch (e: any) {
      setErro(e.message || 'Erro ao realizar login');
    } finally {
      setCarregando(false);
    }
  };

  const preencherRapido = (uEmail: string, uSenha: string) => {
    setEmail(uEmail);
    setSenha(uSenha);
    setErro(null);
    handleLogin(uEmail, uSenha);
  };

  if (usuarioLogado) {
    return (
      <View style={styles.fullScreenCenter}>
        <View style={styles.authSuccessCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>
              {usuarioLogado.nome?.[0]?.toUpperCase() || 'K'}
            </Text>
          </View>
          <View style={styles.successPill}>
            <Text style={styles.successPillText}>✨ CONECTADO • HOMOLOGAÇÃO</Text>
          </View>
          <Text style={styles.successHeading}>{usuarioLogado.nome}</Text>
          <Text style={styles.successEmail}>{usuarioLogado.email}</Text>

          <View style={styles.successDetails}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Função</Text>
              <Text style={styles.detailValue}>{usuarioLogado.papel}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Status</Text>
              <Text style={styles.detailValue}>Ativo</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryPillBtn}
            onPress={() => setUsuarioLogado(null)}
            activeOpacity={0.85}>
            <Text style={styles.primaryPillBtnText}>Desconectar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.viewport}>
      <View style={styles.viewportCenter}>
        {/* ========================================================= */}
        {/* CONTAINER PRINCIPAL FLUTUANTE (INSPIRADO EM BLOOMLY)     */}
        {/* ========================================================= */}
        <View
          style={[
            styles.bloomlyCard,
            isDesktop ? styles.bloomlyCardDesktop : styles.bloomlyCardMobile,
          ]}>

          {/* ------------------------------------------------------- */}
          {/* LADO ESQUERDO: APRESENTAÇÃO & ILUSTRAÇÃO 3D EMPREENDEDORA */}
          {/* ------------------------------------------------------- */}
          <View
            style={[
              styles.leftColumn,
              isDesktop ? styles.leftColumnDesktop : styles.leftColumnMobile,
            ]}>
            {/* Logo no topo esquerdo */}
            <View style={styles.logoRow}>
              <View style={styles.flowerIconWrap}>
                <Text style={styles.flowerIconEmoji}>🌸</Text>
              </View>
              <Text style={styles.logoText}>Kipi</Text>
            </View>

            {/* Texto de Boas-vindas (como na referência Bloomly) */}
            <View style={styles.welcomeBlock}>
              <Text style={styles.welcomeHeading}>Bem-vindo ao Kipi! 🌸</Text>
              <Text style={styles.welcomeSubheading}>
                O sistema inteligente para confeitarias, ateliês, pet shops e serviços.
              </Text>
            </View>

            {/* Ilustração 3D da Empreendedora em seu ateliê */}
            <View style={styles.illustrationFrame}>
              <Image
                source={require('@/assets/images/kipi-entrepreneur.jpg')}
                style={styles.illustrationImage}
                resizeMode="cover"
              />
            </View>
          </View>

          {/* ------------------------------------------------------- */}
          {/* LADO DIREITO: CARD ELEVADO DO FORMULÁRIO (ESTILO BLOOMLY) */}
          {/* ------------------------------------------------------- */}
          <View
            style={[
              styles.rightCard,
              isDesktop ? styles.rightCardDesktop : styles.rightCardMobile,
            ]}>

            {/* Cabeçalho do Card */}
            <View style={styles.formHeader}>
              <Text style={styles.cardTitle}>Acesse sua conta</Text>
              <Text style={styles.cardSubtitle}>
                Que bom ter você aqui! Digite seus dados abaixo. 💜
              </Text>
            </View>

            {/* Banner de Erro */}
            {erro && (
              <View style={styles.compactError}>
                <Text style={styles.compactErrorText}>⚠️ {erro}</Text>
              </View>
            )}

            {/* Campo E-mail com badge de ícone estilo Bloomly */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>E-mail de acesso</Text>
              <View
                style={[
                  styles.bloomlyInput,
                  emailFocado && styles.bloomlyInputFocused,
                ]}>
                <View style={styles.iconBadgeDenim}>
                  <Text style={styles.iconBadgeText}>✉️</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="seu.email@exemplo.com"
                  placeholderTextColor="#94A3B8"
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    if (erro) setErro(null);
                  }}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  onFocus={() => setEmailFocado(true)}
                  onBlur={() => setEmailFocado(false)}
                />
              </View>
            </View>

            {/* Campo Senha com badge de ícone e alternância de visibilidade */}
            <View style={styles.fieldGroup}>
              <Text style={styles.inputLabel}>Sua senha</Text>
              <View
                style={[
                  styles.bloomlyInput,
                  senhaFocada && styles.bloomlyInputFocused,
                ]}>
                <View style={styles.iconBadgeDenim}>
                  <Text style={styles.iconBadgeText}>🔒</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="Digite sua senha"
                  placeholderTextColor="#94A3B8"
                  value={senha}
                  onChangeText={(t) => {
                    setSenha(t);
                    if (erro) setErro(null);
                  }}
                  secureTextEntry={!mostrarSenha}
                  onFocus={() => setSenhaFocada(true)}
                  onBlur={() => setSenhaFocada(false)}
                />
                <TouchableOpacity
                  onPress={() => setMostrarSenha(!mostrarSenha)}
                  style={styles.eyeBtn}>
                  <Text style={styles.eyeBtnText}>{mostrarSenha ? '👁️' : '🙈'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Lembrar-me & Esqueci a senha */}
            <View style={styles.rememberLine}>
              <TouchableOpacity
                style={styles.checkLine}
                activeOpacity={0.8}
                onPress={() => setLembrar(!lembrar)}>
                <View style={[styles.bloomlyCheck, lembrar && styles.bloomlyCheckActive]}>
                  {lembrar && <Text style={styles.checkTick}>✓</Text>}
                </View>
                <Text style={styles.rememberText}>Lembrar de mim</Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.forgotPassText}>Esqueceu a senha?</Text>
              </TouchableOpacity>
            </View>

            {/* Botão Primário (Iced Denim no padrão Bloomly) */}
            <TouchableOpacity
              style={[
                styles.primaryPillBtn,
                carregando && styles.primaryPillBtnDisabled,
              ]}
              onPress={() => handleLogin()}
              disabled={carregando}
              activeOpacity={0.85}>
              {carregando ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.primaryPillBtnText}>Entrando...</Text>
                </View>
              ) : (
                <Text style={styles.primaryPillBtnText}>Entrar</Text>
              )}
            </TouchableOpacity>

            {/* Divisor "ou" */}
            <View style={styles.orDivider}>
              <View style={styles.dividerLine} />
              <Text style={styles.orText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Botão Google (EXATAMENTE COMO NA REFERÊNCIA BLOOMLY) */}
            <TouchableOpacity style={styles.googleBloomlyBtn} activeOpacity={0.85}>
              <View style={styles.googleGContainer}>
                <Text style={styles.googleGLetter}>G</Text>
              </View>
              <Text style={styles.googleBloomlyText}>Continue with Google</Text>
            </TouchableOpacity>

            {/* Rodapé: Cadastro */}
            <View style={styles.footerRow}>
              <Text style={styles.footerMuted}>Não tem uma conta? </Text>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.footerAccent}>Cadastre-se</Text>
              </TouchableOpacity>
            </View>

            {/* Atalhos Rápidos de Homologação (1 linha compacta) */}
            <View style={styles.quickHmlRow}>
              <Text style={styles.quickHmlLabel}>TESTE RÁPIDO:</Text>
              <TouchableOpacity
                style={styles.quickHmlChip}
                onPress={() => preencherRapido('camila.c.lima08@gmail.com', 'P&ix1nh0!')}>
                <Text style={styles.quickHmlChipText}>👑 Camila Lima</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickHmlChip}
                onPress={() => preencherRapido('jun.dossantos85@gmail.com', '123')}>
                <Text style={styles.quickHmlChipText}>🧁 Juliana</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // VIEWPORT FIXO 100% (ZERO SCROLL)
  viewport: {
    flex: 1,
    height: '100%',
    backgroundColor: '#E6F1FA', // Frost
    overflow: 'hidden',
  },
  viewportCenter: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    overflow: 'hidden',
  },

  // CARD CENTRAL (ESTILO BLOOMLY)
  bloomlyCard: {
    backgroundColor: '#F5F9FD', // Fundo frost suave do card
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: '#D8E8F5',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 24px 48px -12px rgba(87, 152, 215, 0.22), 0 4px 12px rgba(0, 0, 0, 0.04)',
      },
      default: {
        shadowColor: '#5798D7',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.16,
        shadowRadius: 24,
        elevation: 8,
      },
    }),
  },
  bloomlyCardDesktop: {
    width: '100%',
    maxWidth: 960,
    height: 590,
    flexDirection: 'row',
    alignItems: 'stretch',
    padding: 16,
    gap: 20,
  },
  bloomlyCardMobile: {
    width: '100%',
    maxWidth: 440,
    height: '100%',
    maxHeight: 690,
    flexDirection: 'column',
  },

  // LADO ESQUERDO: ILUSTRAÇÃO & TEXTO
  leftColumn: {
    justifyContent: 'space-between',
  },
  leftColumnDesktop: {
    flex: 1,
    padding: 20,
    paddingRight: 10,
    gap: 12,
  },
  leftColumnMobile: {
    width: '100%',
    height: 190,
    padding: 12,
  },

  // LOGO (FLOWER + KIPI)
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  flowerIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5DC', // Pistachio Light
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#B9C255',
  },
  flowerIconEmoji: {
    fontSize: 16,
  },
  logoText: {
    fontFamily: Fonts.display,
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: -0.3,
  },

  // TEXTO DE BOAS-VINDAS
  welcomeBlock: {
    gap: 4,
  },
  welcomeHeading: {
    fontFamily: Fonts.display,
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  welcomeSubheading: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    maxWidth: 320,
  },

  // FRAME DA ILUSTRAÇÃO 3D
  illustrationFrame: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  illustrationImage: {
    width: '100%',
    height: '100%',
  },

  // LADO DIREITO: CARD DO FORMULÁRIO (ELEVADO & BRANCO)
  rightCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E8F1F8',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 40px -10px rgba(87, 152, 215, 0.12)',
      },
      default: {
        shadowColor: '#5798D7',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 6,
      },
    }),
  },
  rightCardDesktop: {
    width: 410,
    height: '100%',
    padding: 28,
    justifyContent: 'space-between',
    gap: 10,
  },
  rightCardMobile: {
    flex: 1,
    padding: 18,
    gap: 10,
    justifyContent: 'space-between',
  },

  // CABEÇALHO DO CARD
  formHeader: {
    gap: 2,
  },
  cardTitle: {
    fontFamily: Fonts.display,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  cardSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },

  // ERRO
  compactError: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  compactErrorText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },

  // CAMPOS DE ENTRADA (ESTILO BLOOMLY COM BADGE COLORIDO)
  fieldGroup: {
    gap: 4,
  },
  inputLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  bloomlyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    height: 44,
  },
  bloomlyInputFocused: {
    borderColor: '#5798D7', // Iced Denim
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow: '0 0 0 3px rgba(87, 152, 215, 0.16)',
      },
    }),
  },
  iconBadgeDenim: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#EAF3FA', // Frost tint
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  iconBadgeText: {
    fontSize: 13,
  },
  textInput: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 4,
  },
  eyeBtn: {
    padding: 6,
  },
  eyeBtnText: {
    fontSize: 14,
  },

  // OPÇÕES
  rememberLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  checkLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bloomlyCheck: {
    width: 17,
    height: 17,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bloomlyCheckActive: {
    backgroundColor: '#5798D7', // Iced Denim
    borderColor: '#5798D7',
  },
  checkTick: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  rememberText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
  },
  forgotPassText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#5798D7', // Iced Denim
    fontWeight: '600',
  },

  // BOTÃO PRIMÁRIO (ICED DENIM NO FORMATO PILL BLOOMLY)
  primaryPillBtn: {
    backgroundColor: '#5798D7', // Iced Denim
    borderRadius: 14,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 18px -4px rgba(87, 152, 215, 0.4)',
      },
      default: {
        elevation: 4,
        shadowColor: '#5798D7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
  },
  primaryPillBtnDisabled: {
    opacity: 0.7,
  },
  primaryPillBtnText: {
    fontFamily: Fonts.display,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // DIVISOR
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  orText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },

  // BOTÃO GOOGLE (IDÊNTICO À REFERÊNCIA BLOOMLY)
  googleBloomlyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    height: 42,
    gap: 8,
  },
  googleGContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EA4335',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleGLetter: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  googleBloomlyText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },

  // RODAPÉ CADASTRO
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  footerMuted: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
  },
  footerAccent: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#7D8722', // Pistachio
  },

  // HOMOLOGAÇÃO
  quickHmlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  quickHmlLabel: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  quickHmlChip: {
    backgroundColor: '#E6F1FA',
    borderColor: '#D4E6F6',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  quickHmlChipText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    color: '#5798D7',
  },

  // SUCESSO
  fullScreenCenter: {
    flex: 1,
    backgroundColor: '#E6F1FA',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  authSuccessCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 32,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#D4E6F6',
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#B9C255',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarLetter: {
    fontFamily: Fonts.display,
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  successPill: {
    backgroundColor: '#F3F6DD',
    borderColor: '#B9C255',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 8,
  },
  successPillText: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: '#7D8722',
  },
  successHeading: {
    fontFamily: Fonts.display,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  successEmail: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#64748B',
    marginBottom: 16,
  },
  successDetails: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    width: '100%',
    gap: 8,
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
  },
  detailValue: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
});

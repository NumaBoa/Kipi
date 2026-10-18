import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ScrollView,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { KipiPalette } from '@/constants/theme';

export default function LoginScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 880;

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [lembrar, setLembrar] = useState(true);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [usuarioLogado, setUsuarioLogado] = useState<any | null>(null);

  // Foco dos inputs
  const [emailFocado, setEmailFocado] = useState(false);
  const [senhaFocada, setSenhaFocada] = useState(false);

  const handleLogin = async (emailParam?: string, senhaParam?: string) => {
    const loginEmail = (emailParam || email).trim().toLowerCase();
    const loginSenha = (senhaParam || senha).trim();

    if (!loginEmail) {
      setErro('Por favor, informe seu e-mail.');
      return;
    }
    if (!loginSenha) {
      setErro('Por favor, digite sua senha.');
      return;
    }

    setCarregando(true);
    setErro(null);

    try {
      // 1. Tenta buscar usuário na tabela de homologação
      const { data, error: dbError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('email', loginEmail)
        .maybeSingle();

      if (dbError) {
        throw new Error(dbError.message);
      }

      if (!data) {
        setErro('Usuário não encontrado. Verifique o e-mail ou use os atalhos de homologação abaixo.');
        setCarregando(false);
        return;
      }

      if (data.senha && data.senha !== loginSenha) {
        setErro('Senha incorreta para esta conta.');
        setCarregando(false);
        return;
      }

      // Sucesso!
      setUsuarioLogado(data);
    } catch (e: any) {
      setErro(e.message || 'Erro ao realizar login.');
    } finally {
      setCarregando(false);
    }
  };

  const preencherUsuario = (uEmail: string, uSenha: string) => {
    setEmail(uEmail);
    setSenha(uSenha);
    setErro(null);
    handleLogin(uEmail, uSenha);
  };

  const handleLogout = () => {
    setUsuarioLogado(null);
    setEmail('');
    setSenha('');
    setErro(null);
  };

  // Se o usuário estiver autenticado, exibe tela de boas-vindas da sessão
  if (usuarioLogado) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.successContainer}>
          <View style={styles.successCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {usuarioLogado.nome?.slice(0, 1)?.toUpperCase() || 'K'}
              </Text>
            </View>
            <View style={styles.badgePistachio}>
              <Text style={styles.badgePistachioText}>ACESSO AUTORIZADO • HML</Text>
            </View>
            <Text style={styles.welcomeTitle}>Olá, {usuarioLogado.nome}!</Text>
            <Text style={styles.welcomeSubtitle}>
              Você está conectado com sucesso no painel do seu ateliê.
            </Text>

            <View style={styles.userMetaBox}>
              <View style={styles.userMetaRow}>
                <Text style={styles.metaLabel}>E-mail:</Text>
                <Text style={styles.metaValue}>{usuarioLogado.email}</Text>
              </View>
              <View style={styles.userMetaRow}>
                <Text style={styles.metaLabel}>Perfil:</Text>
                <Text style={styles.metaValueBadge}>{usuarioLogado.papel}</Text>
              </View>
              <View style={styles.userMetaRow}>
                <Text style={styles.metaLabel}>Ambiente:</Text>
                <Text style={styles.metaValue}>Homologação Supabase</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleLogout}>
              <Text style={styles.primaryButtonText}>Sair da Conta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardContainer}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            isDesktop && styles.scrollContentDesktop,
          ]}
          showsVerticalScrollIndicator={false}>

          <View style={[styles.mainWrapper, isDesktop && styles.mainWrapperDesktop]}>
            {/* ========================================================= */}
            {/* PAINEL VISUAL / HERO (ESQUERDA NO DESKTOP, TOPO NO MOBILE) */}
            {/* ========================================================= */}
            <View style={[styles.heroPanel, isDesktop && styles.heroPanelDesktop]}>
              {/* Olhinhos fofos inspirados na referência */}
              <View style={styles.eyesContainer}>
                <View style={styles.eye}>
                  <View style={styles.pupil} />
                </View>
                <View style={styles.eye}>
                  <View style={styles.pupil} />
                </View>
              </View>

              {/* Logo Kipi estilizada */}
              <View style={styles.brandRow}>
                <Text style={styles.brandLogo}>kipi</Text>
                <View style={styles.brandDot} />
              </View>

              {/* Mascote 3D Kipi */}
              <View style={styles.mascotWrapper}>
                <Image
                  source={require('@/assets/images/kipi-mascot.jpg')}
                  style={isDesktop ? styles.mascotImageDesktop : styles.mascotImageMobile}
                  resizeMode="contain"
                />
              </View>

              {/* Taglines inspiradas na referência Sprout */}
              <View style={styles.heroTextContainer}>
                <Text style={styles.heroHeading}>
                  Cada grande receita começa com um sonho
                </Text>
                <Text style={styles.heroSubheading}>
                  Gerencie encomendas, precifique delícias e impulsione suas revendedoras com leveza.
                </Text>

                {/* Tags da paleta */}
                <View style={styles.pillRow}>
                  <View style={styles.pillPistachio}>
                    <Text style={styles.pillPistachioText}>#B9C255 Pistachio</Text>
                  </View>
                  <View style={styles.pillDenim}>
                    <Text style={styles.pillDenimText}>#5798D7 Iced Denim</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* ========================================================= */}
            {/* CARD DO FORMULÁRIO (DIREITA NO DESKTOP, ABAIXO NO MOBILE) */}
            {/* ========================================================= */}
            <View style={[styles.formCard, isDesktop && styles.formCardDesktop]}>
              <View style={styles.formHeader}>
                <Text style={styles.formTitle}>Entrar na sua conta</Text>
                <Text style={styles.formSubtitle}>
                  Digite seus dados para acessar o painel do ateliê.
                </Text>
              </View>

              {/* Mensagem de Erro amigável */}
              {erro && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorIcon}>⚠️</Text>
                  <Text style={styles.errorText}>{erro}</Text>
                </View>
              )}

              {/* Campo E-mail */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>E-mail</Text>
                <View
                  style={[
                    styles.inputContainer,
                    emailFocado && styles.inputContainerFocused,
                  ]}>
                  <Text style={styles.inputIconText}>✉️</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="seu.email@exemplo.com"
                    placeholderTextColor={KipiPalette.slateLight}
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

              {/* Campo Senha */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Senha</Text>
                <View
                  style={[
                    styles.inputContainer,
                    senhaFocada && styles.inputContainerFocused,
                  ]}>
                  <Text style={styles.inputIconText}>🔒</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="Sua senha secreta"
                    placeholderTextColor={KipiPalette.slateLight}
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
                    style={styles.eyeButton}>
                    <Text style={styles.eyeIconText}>
                      {mostrarSenha ? '👁️' : '🙈'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Lembrar-me & Esqueci a senha */}
              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.rememberRow}
                  activeOpacity={0.8}
                  onPress={() => setLembrar(!lembrar)}>
                  <View
                    style={[
                      styles.checkbox,
                      lembrar && styles.checkboxActive,
                    ]}>
                    {lembrar && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.rememberText}>Lembrar de mim</Text>
                </TouchableOpacity>

                <TouchableOpacity activeOpacity={0.7}>
                  <Text style={styles.forgotPasswordText}>Esqueceu a senha?</Text>
                </TouchableOpacity>
              </View>

              {/* Botão de Login Primário */}
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  carregando && styles.primaryButtonDisabled,
                ]}
                onPress={() => handleLogin()}
                disabled={carregando}
                activeOpacity={0.85}>
                {carregando ? (
                  <View style={styles.buttonLoadingRow}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.primaryButtonText}>Acessando...</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryButtonText}>Entrar no Kipi</Text>
                )}
              </TouchableOpacity>

              {/* Divisor "ou" */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>ou continue com</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Botão Google (estilo moderno da referência Sprout & Kreative) */}
              <TouchableOpacity style={styles.googleButton} activeOpacity={0.85}>
                <View style={styles.googleIconBadge}>
                  <Text style={styles.googleLetter}>G</Text>
                </View>
                <Text style={styles.googleButtonText}>Entrar com Google</Text>
              </TouchableOpacity>

              {/* Rodapé: criar conta */}
              <View style={styles.signupRow}>
                <Text style={styles.signupText}>Ainda não tem conta? </Text>
                <TouchableOpacity activeOpacity={0.7}>
                  <Text style={styles.signupLink}>Cadastre seu ateliê</Text>
                </TouchableOpacity>
              </View>

              {/* Atalhos Rápidos para Homologação */}
              <View style={styles.demoSection}>
                <Text style={styles.demoTitle}>🧪 ACESSO RÁPIDO (HOMOLOGAÇÃO)</Text>
                <View style={styles.demoButtonsRow}>
                  <TouchableOpacity
                    style={styles.demoPill}
                    onPress={() => preencherUsuario('camila.c.lima08@gmail.com', 'P&ix1nh0!')}>
                    <Text style={styles.demoPillEmoji}>👑</Text>
                    <Text style={styles.demoPillText}>Camila Lima</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.demoPill}
                    onPress={() => preencherUsuario('jun.dossantos85@gmail.com', '123')}>
                    <Text style={styles.demoPillEmoji}>🧁</Text>
                    <Text style={styles.demoPillText}>Juliana (Loja)</Text>
                  </TouchableOpacity>
                </View>
              </View>

            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: KipiPalette.frost,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContentDesktop: {
    padding: 40,
  },
  mainWrapper: {
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
    gap: 20,
  },
  mainWrapperDesktop: {
    maxWidth: 1040,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 48,
  },

  // HERO PANEL
  heroPanel: {
    alignItems: 'center',
    width: '100%',
    paddingVertical: 10,
  },
  heroPanelDesktop: {
    flex: 1,
    alignItems: 'flex-start',
    paddingRight: 20,
  },
  eyesContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  eye: {
    width: 22,
    height: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: KipiPalette.icedDenim,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pupil: {
    width: 10,
    height: 12,
    backgroundColor: KipiPalette.slateDark,
    borderRadius: 6,
    marginTop: 4,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  brandLogo: {
    fontSize: 42,
    fontWeight: '900',
    color: KipiPalette.icedDenim,
    letterSpacing: -1,
  },
  brandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: KipiPalette.pistachio,
    marginLeft: 3,
  },
  mascotWrapper: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  mascotImageMobile: {
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  mascotImageDesktop: {
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  heroTextContainer: {
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  heroHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: KipiPalette.slate,
    textAlign: 'center',
    lineHeight: 28,
  },
  heroSubheading: {
    fontSize: 14,
    color: KipiPalette.slateLight,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 360,
  },
  pillRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  pillPistachio: {
    backgroundColor: KipiPalette.pistachioLight,
    borderColor: KipiPalette.pistachio,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  pillPistachioText: {
    fontSize: 11,
    fontWeight: '700',
    color: KipiPalette.pistachioDark,
  },
  pillDenim: {
    backgroundColor: KipiPalette.icedDenimLight,
    borderColor: KipiPalette.icedDenim,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  pillDenimText: {
    fontSize: 11,
    fontWeight: '700',
    color: KipiPalette.icedDenimDark,
  },

  // CARD DO FORMULÁRIO
  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 28,
    width: '100%',
    maxWidth: 440,
    ...Platform.select({
      web: {
        boxShadow: '0 20px 40px -15px rgba(87, 152, 215, 0.18)',
      },
      default: {
        shadowColor: '#5798D7',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 8,
      },
    }),
    borderWidth: 1,
    borderColor: '#E8F1F8',
  },
  formCardDesktop: {
    padding: 36,
  },
  formHeader: {
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: KipiPalette.slate,
    marginBottom: 6,
  },
  formSubtitle: {
    fontSize: 14,
    color: KipiPalette.slateLight,
    lineHeight: 20,
  },
  errorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  errorIcon: {
    fontSize: 16,
  },
  errorText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },

  // INPUTS
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: KipiPalette.slate,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KipiPalette.inputBg,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 48,
  },
  inputContainerFocused: {
    borderColor: KipiPalette.icedDenim,
    backgroundColor: '#FFFFFF',
  },
  inputIconText: {
    fontSize: 16,
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: KipiPalette.slate,
    paddingVertical: 8,
  },
  eyeButton: {
    padding: 6,
  },
  eyeIconText: {
    fontSize: 16,
  },

  // OPÇÕES
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: KipiPalette.icedDenim,
    borderColor: KipiPalette.icedDenim,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  rememberText: {
    fontSize: 13,
    color: KipiPalette.slateMedium,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '600',
    color: KipiPalette.icedDenim,
  },

  // BOTÃO PRINCIPAL
  primaryButton: {
    backgroundColor: KipiPalette.icedDenim,
    borderRadius: 14,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 8px 16px -4px rgba(87, 152, 215, 0.35)',
      },
      default: {
        elevation: 4,
        shadowColor: KipiPalette.icedDenim,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
    }),
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  buttonLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // DIVISOR
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontSize: 12,
    color: KipiPalette.slateLight,
    fontWeight: '500',
  },

  // BOTÃO GOOGLE
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    height: 48,
    gap: 10,
  },
  googleIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EA4335',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleLetter: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
  },
  googleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: KipiPalette.slate,
  },

  // CADASTRO
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  signupText: {
    fontSize: 13,
    color: KipiPalette.slateLight,
  },
  signupLink: {
    fontSize: 13,
    fontWeight: '700',
    color: KipiPalette.pistachioDark,
  },

  // HOMOLOGAÇÃO
  demoSection: {
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    alignItems: 'center',
  },
  demoTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: KipiPalette.slateLight,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  demoPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: KipiPalette.frost,
    borderColor: '#D4E6F6',
    borderWidth: 1,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  demoPillEmoji: {
    fontSize: 14,
  },
  demoPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: KipiPalette.icedDenimDark,
  },

  // SUCESSO / BOAS-VINDAS
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  successCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    padding: 32,
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    ...Platform.select({
      web: {
        boxShadow: '0 20px 40px -15px rgba(87, 152, 215, 0.2)',
      },
    }),
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: KipiPalette.pistachio,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  badgePistachio: {
    backgroundColor: KipiPalette.pistachioLight,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  badgePistachioText: {
    color: KipiPalette.pistachioDark,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: KipiPalette.slate,
    marginBottom: 4,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: KipiPalette.slateLight,
    textAlign: 'center',
    marginBottom: 20,
  },
  userMetaBox: {
    backgroundColor: KipiPalette.frost,
    borderRadius: 14,
    padding: 16,
    width: '100%',
    gap: 8,
    marginBottom: 24,
  },
  userMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 13,
    color: KipiPalette.slateLight,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '700',
    color: KipiPalette.slate,
  },
  metaValueBadge: {
    fontSize: 12,
    fontWeight: '800',
    color: KipiPalette.icedDenimDark,
    backgroundColor: KipiPalette.icedDenimLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
});

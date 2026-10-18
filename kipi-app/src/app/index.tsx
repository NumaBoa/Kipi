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
  const { width, height } = useWindowDimensions();
  const isDesktop = width >= 800;

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
        setErro('Usuário não cadastrado');
        setCarregando(false);
        return;
      }

      if (data.senha && data.senha !== loginSenha) {
        setErro('Senha incorreta');
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
          <View style={styles.authSuccessAvatar}>
            <Text style={styles.authSuccessAvatarText}>
              {usuarioLogado.nome?.[0]?.toUpperCase() || 'K'}
            </Text>
          </View>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>SESSÃO ATIVA • HOMOLOGAÇÃO</Text>
          </View>
          <Text style={styles.authSuccessTitle}>{usuarioLogado.nome}</Text>
          <Text style={styles.authSuccessEmail}>{usuarioLogado.email}</Text>

          <View style={styles.authDetailsBox}>
            <View style={styles.authDetailRow}>
              <Text style={styles.authDetailLabel}>Perfil</Text>
              <Text style={styles.authDetailValue}>{usuarioLogado.papel}</Text>
            </View>
            <View style={styles.authDetailRow}>
              <Text style={styles.authDetailLabel}>Status</Text>
              <Text style={styles.authDetailValue}>Ativo</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.actionPillButton}
            onPress={() => setUsuarioLogado(null)}
            activeOpacity={0.85}>
            <Text style={styles.actionPillButtonText}>Desconectar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.viewport}>
      <View style={styles.viewportInner}>
        {/* CONTAINER FLUTUANTE (INSPIRADO NA REFERÊNCIA KREATIVE & SPROUT) */}
        <View
          style={[
            styles.splitCard,
            isDesktop ? styles.splitCardDesktop : styles.splitCardMobile,
          ]}>

          {/* ========================================================= */}
          {/* COLUNA ESQUERDA: ARTE 3D ABSTRATA KIPI */}
          {/* ========================================================= */}
          <View
            style={[
              styles.artColumn,
              isDesktop ? styles.artColumnDesktop : styles.artColumnMobile,
            ]}>
            <Image
              source={require('@/assets/images/kipi-abstract.jpg')}
              style={styles.artImage}
              resizeMode="cover"
            />
          </View>

          {/* ========================================================= */}
          {/* COLUNA DIREITA: FORMULÁRIO DE LOGIN LIMPO E EDITORIAL */}
          {/* ========================================================= */}
          <View
            style={[
              styles.formColumn,
              isDesktop ? styles.formColumnDesktop : styles.formColumnMobile,
            ]}>

            {/* Badge de Marca no topo do form (estilo Kreative) */}
            <View style={styles.brandBadge}>
              <View style={styles.badgeEyes}>
                <View style={styles.tinyEye}>
                  <View style={styles.tinyPupil} />
                </View>
                <View style={styles.tinyEye}>
                  <View style={styles.tinyPupil} />
                </View>
              </View>
              <Text style={styles.brandBadgeText}>kipi</Text>
            </View>

            {/* Título e Subtítulo */}
            <View style={styles.headingBlock}>
              <Text style={styles.headingTitle}>Welcome Back!</Text>
              <Text style={styles.headingSubtitle}>Enter Your Details Below</Text>
            </View>

            {/* Banner de erro compacto */}
            {erro && (
              <View style={styles.compactError}>
                <Text style={styles.compactErrorText}>⚠️ {erro}</Text>
              </View>
            )}

            {/* Campo E-mail */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Email</Text>
              <View
                style={[
                  styles.fieldInputWrap,
                  emailFocado && styles.fieldInputWrapFocused,
                ]}>
                <TextInput
                  style={styles.textInput}
                  placeholder="hello@kipi.com"
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

            {/* Campo Senha */}
            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View
                style={[
                  styles.fieldInputWrap,
                  senhaFocada && styles.fieldInputWrapFocused,
                ]}>
                <TextInput
                  style={styles.textInput}
                  placeholder="••••••••"
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
                  style={styles.eyeToggle}>
                  <Text style={styles.eyeToggleIcon}>
                    {mostrarSenha ? '👁️' : '🔒'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Lembrar-me & Esqueci a senha */}
            <View style={styles.optionsLine}>
              <TouchableOpacity
                style={styles.checkLine}
                activeOpacity={0.8}
                onPress={() => setLembrar(!lembrar)}>
                <View style={[styles.boxCheck, lembrar && styles.boxCheckActive]}>
                  {lembrar && <Text style={styles.checkIcon}>✓</Text>}
                </View>
                <Text style={styles.checkLabel}>Remember me</Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.linkForgot}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            {/* Botão Primário (Pill arredondado como no Kreative) */}
            <TouchableOpacity
              style={[
                styles.actionPillButton,
                carregando && styles.actionPillButtonDisabled,
              ]}
              onPress={() => handleLogin()}
              disabled={carregando}
              activeOpacity={0.85}>
              {carregando ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.actionPillButtonText}>Log in</Text>
              )}
            </TouchableOpacity>

            {/* Botão Google (estilo Kreative & Sprout) */}
            <TouchableOpacity style={styles.googlePillButton} activeOpacity={0.85}>
              <View style={styles.googleGContainer}>
                <Text style={styles.googleGLetter}>G</Text>
              </View>
              <Text style={styles.googlePillText}>Log in with Google</Text>
            </TouchableOpacity>

            {/* Footer: Sign up */}
            <View style={styles.footerLinkRow}>
              <Text style={styles.footerMutedText}>Don't have an account? </Text>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.footerAccentLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            {/* Atalhos discretos de Homologação (1 linha sem rolar) */}
            <View style={styles.hmlQuickBar}>
              <Text style={styles.hmlQuickLabel}>TESTAR:</Text>
              <TouchableOpacity
                style={styles.hmlChip}
                onPress={() => preencherRapido('camila.c.lima08@gmail.com', 'P&ix1nh0!')}>
                <Text style={styles.hmlChipText}>👑 Camila</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.hmlChip}
                onPress={() => preencherRapido('jun.dossantos85@gmail.com', '123')}>
                <Text style={styles.hmlChipText}>🧁 Juliana</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // LAYOUT BASE SEM SCROLL
  viewport: {
    flex: 1,
    height: '100%',
    backgroundColor: '#E6F1FA', // Frost
    overflow: 'hidden',
  },
  viewportInner: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    overflow: 'hidden',
  },

  // CARD CENTRAL FLUTUANTE (ESTILO KREATIVE)
  splitCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: '#D8E8F5',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 25px 50px -12px rgba(87, 152, 215, 0.22)',
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
  splitCardDesktop: {
    width: '100%',
    maxWidth: 920,
    height: 560,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 32,
  },
  splitCardMobile: {
    width: '100%',
    maxWidth: 440,
    height: '100%',
    maxHeight: 680,
    flexDirection: 'column',
  },

  // COLUNA DA ARTE 3D
  artColumn: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#F0F6FA',
  },
  artColumnDesktop: {
    width: 420,
    height: '100%',
  },
  artColumnMobile: {
    width: '100%',
    height: 200,
  },
  artImage: {
    width: '100%',
    height: '100%',
  },

  // COLUNA DO FORMULÁRIO
  formColumn: {
    justifyContent: 'center',
  },
  formColumnDesktop: {
    flex: 1,
    paddingRight: 16,
    paddingVertical: 10,
    gap: 12,
  },
  formColumnMobile: {
    flex: 1,
    padding: 20,
    gap: 10,
    justifyContent: 'space-between',
  },

  // MARCA NO TOPO DO FORM (ESTILO KREATIVE)
  brandBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  badgeEyes: {
    flexDirection: 'row',
    gap: 3,
  },
  tinyEye: {
    width: 14,
    height: 18,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#5798D7',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tinyPupil: {
    width: 6,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#0F172A',
  },
  brandBadgeText: {
    fontFamily: Fonts.display,
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },

  // CABEÇALHO DO FORMULÁRIO
  headingBlock: {
    gap: 2,
    marginBottom: 4,
  },
  headingTitle: {
    fontFamily: Fonts.display,
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.6,
  },
  headingSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },

  // ERRO
  compactError: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  compactErrorText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },

  // CAMPOS
  fieldBlock: {
    gap: 4,
  },
  fieldLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  fieldInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    height: 42,
  },
  fieldInputWrapFocused: {
    borderColor: '#5798D7',
    backgroundColor: '#FFFFFF',
  },
  textInput: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 4,
  },
  eyeToggle: {
    padding: 4,
  },
  eyeToggleIcon: {
    fontSize: 14,
  },

  // LINHA DE OPÇÕES
  optionsLine: {
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
  boxCheck: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxCheckActive: {
    backgroundColor: '#0F172A',
    borderColor: '#0F172A',
  },
  checkIcon: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  checkLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
  },
  linkForgot: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },

  // BOTÃO PRINCIPAL (PILL MODERNO)
  actionPillButton: {
    backgroundColor: '#0F172A', // Sleek dark slate da referência Kreative
    borderRadius: 999,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.25)',
      },
    }),
  },
  actionPillButtonDisabled: {
    opacity: 0.7,
  },
  actionPillButtonText: {
    fontFamily: Fonts.display,
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // BOTÃO GOOGLE
  googlePillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 999,
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
  googlePillText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },

  // FOOTER
  footerLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  footerMutedText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
  },
  footerAccentLink: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },

  // HOMOLOGAÇÃO
  hmlQuickBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  hmlQuickLabel: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  hmlChip: {
    backgroundColor: '#E6F1FA',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  hmlChipText: {
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
    borderRadius: 28,
    padding: 32,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D8E8F5',
  },
  authSuccessAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#B9C255',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  authSuccessAvatarText: {
    fontFamily: Fonts.display,
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  statusPill: {
    backgroundColor: '#F3F6DD',
    borderColor: '#B9C255',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    marginBottom: 10,
  },
  statusPillText: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: '#949D39',
    letterSpacing: 0.5,
  },
  authSuccessTitle: {
    fontFamily: Fonts.display,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  authSuccessEmail: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#64748B',
    marginBottom: 18,
  },
  authDetailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    width: '100%',
    gap: 8,
    marginBottom: 20,
  },
  authDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  authDetailLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
  },
  authDetailValue: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
});

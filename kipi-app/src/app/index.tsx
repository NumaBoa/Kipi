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
  const isDesktop = width >= 820;

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
      setErro('Digite seu e-mail para continuar');
      return;
    }
    if (!loginSenha) {
      setErro('Digite sua senha para entrar');
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
          <View style={styles.avatarGlow}>
            <Text style={styles.avatarGlowLetter}>
              {usuarioLogado.nome?.[0]?.toUpperCase() || 'K'}
            </Text>
          </View>
          <View style={styles.successPistachioBadge}>
            <Text style={styles.successPistachioBadgeText}>✨ ATELIÊ CONECTADO</Text>
          </View>
          <Text style={styles.successWelcomeHeading}>
            Bem-vinda, {usuarioLogado.nome}!
          </Text>
          <Text style={styles.successWelcomeSub}>
            Tudo pronto para gerenciar suas receitas e encomendas hoje.
          </Text>

          <View style={styles.successMetaBox}>
            <View style={styles.successMetaRow}>
              <Text style={styles.metaLabelText}>Conta:</Text>
              <Text style={styles.metaValueText}>{usuarioLogado.email}</Text>
            </View>
            <View style={styles.successMetaRow}>
              <Text style={styles.metaLabelText}>Função:</Text>
              <View style={styles.roleTag}>
                <Text style={styles.roleTagText}>{usuarioLogado.papel}</Text>
              </View>
            </View>
            <View style={styles.successMetaRow}>
              <Text style={styles.metaLabelText}>Ambiente:</Text>
              <Text style={styles.metaValueText}>Homologação Supabase</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryActionButton}
            onPress={() => setUsuarioLogado(null)}
            activeOpacity={0.85}>
            <Text style={styles.primaryActionButtonText}>Sair da Conta</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.viewport}>
      <View style={styles.viewportInner}>
        {/* CARD CENTRAL FLUTUANTE (ZERO SCROLL) */}
        <View
          style={[
            styles.splitCard,
            isDesktop ? styles.splitCardDesktop : styles.splitCardMobile,
          ]}>

          {/* ========================================================= */}
          {/* LADO ESQUERDO: ARTE 3D ABSTRATA KIPI */}
          {/* ========================================================= */}
          <View
            style={[
              styles.artBox,
              isDesktop ? styles.artBoxDesktop : styles.artBoxMobile,
            ]}>
            <Image
              source={require('@/assets/images/kipi-abstract.jpg')}
              style={styles.artImage}
              resizeMode="cover"
            />
          </View>

          {/* ========================================================= */}
          {/* LADO DIREITO: FORMULÁRIO COM MUITA PERSONALIDADE */}
          {/* ========================================================= */}
          <View
            style={[
              styles.formBox,
              isDesktop ? styles.formBoxDesktop : styles.formBoxMobile,
            ]}>

            {/* Topo: Badge charmosa da marca com olhinhos da paleta */}
            <View style={styles.topBrandLine}>
              <View style={styles.pistachioBadge}>
                <View style={styles.cuteEyes}>
                  <View style={styles.miniEye}>
                    <View style={styles.miniPupil} />
                  </View>
                  <View style={styles.miniEye}>
                    <View style={styles.miniPupil} />
                  </View>
                </View>
                <Text style={styles.pistachioBadgeText}>ateliê kipi</Text>
              </View>
            </View>

            {/* Título com Tipografia Editorial e Quente */}
            <View style={styles.titleSection}>
              <Text style={styles.mainTitle}>
                Que bom ter você de volta!
              </Text>
              <Text style={styles.mainSubtitle}>
                Acesse seu ateliê para gerenciar encomendas e receitas
              </Text>
            </View>

            {/* Alerta de Erro Compacto */}
            {erro && (
              <View style={styles.friendlyErrorBanner}>
                <Text style={styles.friendlyErrorText}>⚠️ {erro}</Text>
              </View>
            )}

            {/* Campo E-mail */}
            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>E-mail de acesso</Text>
              <View
                style={[
                  styles.inputWrap,
                  emailFocado && styles.inputWrapFocused,
                ]}>
                <Text style={styles.inputPrefixIcon}>✉️</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="seu.email@atelie.com"
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
            <View style={styles.inputBlock}>
              <Text style={styles.inputLabel}>Sua senha</Text>
              <View
                style={[
                  styles.inputWrap,
                  senhaFocada && styles.inputWrapFocused,
                ]}>
                <Text style={styles.inputPrefixIcon}>🔑</Text>
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
                  style={styles.eyeBtn}>
                  <Text style={styles.eyeBtnIcon}>
                    {mostrarSenha ? '👁️' : '🙈'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Lembrar-me & Esqueci a senha */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.rememberBtn}
                activeOpacity={0.8}
                onPress={() => setLembrar(!lembrar)}>
                <View style={[styles.customCheck, lembrar && styles.customCheckActive]}>
                  {lembrar && <Text style={styles.customCheckMark}>✓</Text>}
                </View>
                <Text style={styles.rememberBtnText}>Lembrar de mim</Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.forgotPassLink}>Esqueceu a senha?</Text>
              </TouchableOpacity>
            </View>

            {/* Botão Primário em Iced Denim com Destaque e Charme */}
            <TouchableOpacity
              style={[
                styles.primaryActionButton,
                carregando && styles.primaryActionButtonDisabled,
              ]}
              onPress={() => handleLogin()}
              disabled={carregando}
              activeOpacity={0.85}>
              {carregando ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.primaryActionButtonText}>Entrando...</Text>
                </View>
              ) : (
                <View style={styles.buttonLabelWithSparkle}>
                  <Text style={styles.primaryActionButtonText}>Entrar no Ateliê</Text>
                  <Text style={styles.buttonSparkle}>✨</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Botão Google com Paleta Frost e Borda Suave */}
            <TouchableOpacity style={styles.googleActionButton} activeOpacity={0.85}>
              <View style={styles.googleCircleIcon}>
                <Text style={styles.googleGText}>G</Text>
              </View>
              <Text style={styles.googleActionButtonText}>Continuar com o Google</Text>
            </TouchableOpacity>

            {/* Rodapé: Cadastro */}
            <View style={styles.signupFooter}>
              <Text style={styles.signupMuted}>Ainda não tem conta? </Text>
              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.signupHighlight}>Cadastre seu ateliê grátis</Text>
              </TouchableOpacity>
            </View>

            {/* Atalhos de Homologação (1 Linha Compacta) */}
            <View style={styles.homologationRow}>
              <Text style={styles.homologationTag}>TESTAR:</Text>
              <TouchableOpacity
                style={styles.homologationPill}
                onPress={() => preencherRapido('camila.c.lima08@gmail.com', 'P&ix1nh0!')}>
                <Text style={styles.homologationPillText}>👑 Camila Lima</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.homologationPill}
                onPress={() => preencherRapido('jun.dossantos85@gmail.com', '123')}>
                <Text style={styles.homologationPillText}>🧁 Juliana (Loja)</Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // VIEWPORT FIXO 100% (SEM SCROLL)
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

  // CARD CENTRAL FLUTUANTE
  splitCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    borderWidth: 1.5,
    borderColor: '#D4E6F6',
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: '0 24px 48px -12px rgba(87, 152, 215, 0.22), 0 4px 12px rgba(185, 194, 85, 0.08)',
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
    maxWidth: 940,
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
    maxHeight: 690,
    flexDirection: 'column',
  },

  // BOX DA ARTE 3D ABSTRATA
  artBox: {
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#F0F6FA',
  },
  artBoxDesktop: {
    width: 420,
    height: '100%',
  },
  artBoxMobile: {
    width: '100%',
    height: 190,
  },
  artImage: {
    width: '100%',
    height: '100%',
  },

  // BOX DO FORMULÁRIO
  formBox: {
    justifyContent: 'center',
  },
  formBoxDesktop: {
    flex: 1,
    paddingRight: 16,
    paddingVertical: 10,
    gap: 11,
  },
  formBoxMobile: {
    flex: 1,
    padding: 20,
    gap: 10,
    justifyContent: 'space-between',
  },

  // BADGE PISTACHIO COM OLHINHOS
  topBrandLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  pistachioBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F6DD', // Pistachio Light
    borderColor: '#B9C255',
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 8,
  },
  cuteEyes: {
    flexDirection: 'row',
    gap: 3,
  },
  miniEye: {
    width: 13,
    height: 16,
    borderRadius: 6.5,
    borderWidth: 1.5,
    borderColor: '#5798D7',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniPupil: {
    width: 5,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0F172A',
  },
  pistachioBadgeText: {
    fontFamily: Fonts.display,
    fontSize: 12,
    fontWeight: '800',
    color: '#7D8722',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },

  // TÍTULO COM PERSONALIDADE
  titleSection: {
    gap: 2,
    marginBottom: 2,
  },
  mainTitle: {
    fontFamily: Fonts.editorial || Fonts.display,
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.6,
    lineHeight: 32,
  },
  mainSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
    lineHeight: 18,
  },

  // ERRO
  friendlyErrorBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  friendlyErrorText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },

  // CAMPOS DE ENTRADA
  inputBlock: {
    gap: 4,
  },
  inputLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    height: 44,
  },
  inputWrapFocused: {
    borderColor: '#5798D7', // Iced Denim
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      web: {
        boxShadow: '0 0 0 3px rgba(87, 152, 215, 0.18)',
      },
    }),
  },
  inputPrefixIcon: {
    fontSize: 14,
    marginRight: 8,
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
  eyeBtnIcon: {
    fontSize: 14,
  },

  // OPÇÕES
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  rememberBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  customCheck: {
    width: 17,
    height: 17,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  customCheckActive: {
    backgroundColor: '#5798D7', // Iced Denim
    borderColor: '#5798D7',
  },
  customCheckMark: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  rememberBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
  },
  forgotPassLink: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#5798D7', // Iced Denim
    fontWeight: '600',
  },

  // BOTÃO PRINCIPAL (ICED DENIM COM PERSONALIDADE)
  primaryActionButton: {
    backgroundColor: '#5798D7', // Iced Denim
    borderRadius: 16,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 20px -4px rgba(87, 152, 215, 0.45)',
      },
      default: {
        elevation: 4,
        shadowColor: '#5798D7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
    }),
  },
  primaryActionButtonDisabled: {
    opacity: 0.7,
  },
  buttonLabelWithSparkle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  primaryActionButtonText: {
    fontFamily: Fonts.display,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  buttonSparkle: {
    fontSize: 14,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // BOTÃO GOOGLE
  googleActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D4E6F6', // Frost border
    borderRadius: 16,
    height: 44,
    gap: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 8px rgba(87, 152, 215, 0.08)',
      },
    }),
  },
  googleCircleIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EA4335',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleGText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
  },
  googleActionButtonText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },

  // RODAPÉ CADASTRO
  signupFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  signupMuted: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
  },
  signupHighlight: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '800',
    color: '#7D8722', // Pistachio tom marcante
  },

  // HOMOLOGAÇÃO
  homologationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  homologationTag: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  homologationPill: {
    backgroundColor: '#E6F1FA', // Frost
    borderColor: '#D4E6F6',
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
  },
  homologationPillText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '700',
    color: '#5798D7', // Iced Denim
  },

  // TELA DE SUCESSO / BOAS-VINDAS
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
    ...Platform.select({
      web: {
        boxShadow: '0 24px 48px -12px rgba(87, 152, 215, 0.25)',
      },
    }),
  },
  avatarGlow: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#B9C255', // Pistachio
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    ...Platform.select({
      web: {
        boxShadow: '0 8px 24px rgba(185, 194, 85, 0.35)',
      },
    }),
  },
  avatarGlowLetter: {
    fontFamily: Fonts.display,
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  successPistachioBadge: {
    backgroundColor: '#F3F6DD',
    borderColor: '#B9C255',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 8,
  },
  successPistachioBadgeText: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: '#7D8722',
    letterSpacing: 0.5,
  },
  successWelcomeHeading: {
    fontFamily: Fonts.editorial || Fonts.display,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 4,
  },
  successWelcomeSub: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  successMetaBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    gap: 8,
    marginBottom: 20,
  },
  successMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaLabelText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
  },
  metaValueText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  roleTag: {
    backgroundColor: '#E6F1FA',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleTagText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '800',
    color: '#5798D7',
  },
});

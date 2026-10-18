import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { KipiPalette, Fonts } from '@/constants/theme';

export default function LoginScreen() {
  const { width } = useWindowDimensions();

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
      setErro('Informe seu e-mail para entrar');
      return;
    }
    if (!loginSenha) {
      setErro('Digite sua senha');
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
        setErro('E-mail não encontrado no sistema');
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
      <View style={styles.viewport}>
        <View style={styles.loginCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>
              {usuarioLogado.nome?.[0]?.toUpperCase() || 'K'}
            </Text>
          </View>
          <View style={styles.hmlBadge}>
            <Text style={styles.hmlBadgeText}>SESSÃO ATIVA • HOMOLOGAÇÃO</Text>
          </View>
          <Text style={styles.loggedName}>{usuarioLogado.nome}</Text>
          <Text style={styles.loggedEmail}>{usuarioLogado.email}</Text>

          <View style={styles.loggedInfoBox}>
            <View style={styles.loggedInfoRow}>
              <Text style={styles.loggedInfoLabel}>Perfil:</Text>
              <Text style={styles.loggedInfoValue}>{usuarioLogado.papel}</Text>
            </View>
            <View style={styles.loggedInfoRow}>
              <Text style={styles.loggedInfoLabel}>Ambiente:</Text>
              <Text style={styles.loggedInfoValue}>Homologação Supabase</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => setUsuarioLogado(null)}
            activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Sair da Conta</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.viewport}>
      <View style={styles.centeredContainer}>
        {/* CARD CENTRAL SIMPLES E ELEGANTE (ID VISUAL ATELIERQ) */}
        <View style={styles.loginCard}>

          {/* CABEÇALHO COM LOGO E BADGES NO PADRÃO DO SISTEMA */}
          <View style={styles.headerArea}>
            <View style={styles.brandRow}>
              <View style={styles.brandIconBox}>
                <Text style={styles.brandIconLetter}>K</Text>
              </View>
              <View>
                <View style={styles.nameBadgeRow}>
                  <Text style={styles.brandName}>Kipi</Text>
                  <View style={styles.systemBadge}>
                    <Text style={styles.systemBadgeText}>SaaS GESTÃO</Text>
                  </View>
                </View>
                <Text style={styles.brandSlogan}>
                  Tecnologia e facilidade para seu negócio
                </Text>
              </View>
            </View>

            <View style={styles.titleSpacing}>
              <Text style={styles.cardTitle}>Acesse sua conta</Text>
              <Text style={styles.cardSubtitle}>
                Entre com seu e-mail e senha para gerenciar seu ateliê
              </Text>
            </View>
          </View>

          {/* ALERTA DE ERRO */}
          {erro && (
            <View style={styles.errorAlert}>
              <Text style={styles.errorAlertText}>⚠️ {erro}</Text>
            </View>
          )}

          {/* FORMULÁRIO */}
          <View style={styles.formFields}>
            {/* Campo E-mail */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>E-mail</Text>
              <View
                style={[
                  styles.inputBox,
                  emailFocado && styles.inputBoxFocused,
                ]}>
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

            {/* Campo Senha */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Senha</Text>
              <View
                style={[
                  styles.inputBox,
                  senhaFocada && styles.inputBoxFocused,
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
                  style={styles.eyeBtn}>
                  <Text style={styles.eyeBtnText}>{mostrarSenha ? '👁️' : '🔒'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Lembrar-me e Esqueci a senha */}
            <View style={styles.optionsLine}>
              <TouchableOpacity
                style={styles.rememberOption}
                activeOpacity={0.8}
                onPress={() => setLembrar(!lembrar)}>
                <View style={[styles.checkSquare, lembrar && styles.checkSquareActive]}>
                  {lembrar && <Text style={styles.checkCheck}>✓</Text>}
                </View>
                <Text style={styles.rememberLabel}>Lembrar de mim</Text>
              </TouchableOpacity>

              <TouchableOpacity activeOpacity={0.7}>
                <Text style={styles.forgotLink}>Esqueceu a senha?</Text>
              </TouchableOpacity>
            </View>

            {/* Botão Primário Iced Denim */}
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                carregando && styles.primaryBtnDisabled,
              ]}
              onPress={() => handleLogin()}
              disabled={carregando}
              activeOpacity={0.85}>
              {carregando ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.primaryBtnText}>Acessando...</Text>
                </View>
              ) : (
                <Text style={styles.primaryBtnText}>Entrar no Kipi</Text>
              )}
            </TouchableOpacity>

            {/* Divisor */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Botão Google Clean */}
            <TouchableOpacity style={styles.googleBtn} activeOpacity={0.85}>
              <View style={styles.googleCircle}>
                <Text style={styles.googleLetter}>G</Text>
              </View>
              <Text style={styles.googleBtnText}>Entrar com o Google</Text>
            </TouchableOpacity>
          </View>

          {/* RODAPÉ DO CARD */}
          <View style={styles.footerLine}>
            <Text style={styles.footerMuted}>Não tem uma conta? </Text>
            <TouchableOpacity activeOpacity={0.7}>
              <Text style={styles.footerLink}>Cadastre seu negócio</Text>
            </TouchableOpacity>
          </View>

          {/* ATALHOS RÁPIDOS DE HOMOLOGAÇÃO */}
          <View style={styles.hmlRow}>
            <Text style={styles.hmlRowTitle}>TESTE RÁPIDO:</Text>
            <TouchableOpacity
              style={styles.hmlChip}
              onPress={() => preencherRapido('camila.c.lima08@gmail.com', 'P&ix1nh0!')}>
              <Text style={styles.hmlChipText}>👑 Camila Lima</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.hmlChip}
              onPress={() => preencherRapido('jun.dossantos85@gmail.com', '123')}>
              <Text style={styles.hmlChipText}>🧁 Juliana Carvalho</Text>
            </TouchableOpacity>
          </View>

        </View>

        {/* RODAPÉ EXTERNO DO SISTEMA */}
        <Text style={styles.outerFooterText}>
          Kipi • Gestão inteligente para confeitarias, ateliês, pet shops e serviços
        </Text>
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
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  centeredContainer: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 16,
  },

  // CARD CENTRAL (ESTILO DASHBOARD ATELIERQ)
  loginCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#D4E6F6', // Frost border
    padding: 28,
    gap: 16,
    ...Platform.select({
      web: {
        boxShadow: '0 20px 40px -15px rgba(87, 152, 215, 0.16), 0 4px 12px rgba(0, 0, 0, 0.03)',
      },
      default: {
        shadowColor: '#5798D7',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.12,
        shadowRadius: 20,
        elevation: 6,
      },
    }),
  },

  // CABEÇALHO DO CARD
  headerArea: {
    gap: 14,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  brandIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#EAF3FA', // Iced Denim Light
    borderWidth: 1.5,
    borderColor: '#5798D7', // Iced Denim
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandIconLetter: {
    fontFamily: Fonts.sans,
    fontSize: 22,
    fontWeight: '800',
    color: '#5798D7', // Iced Denim
  },
  nameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandName: {
    fontFamily: Fonts.sans,
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.4,
  },
  systemBadge: {
    backgroundColor: '#F1F6D8', // Pistachio Light
    borderColor: '#B9C255', // Pistachio
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  systemBadgeText: {
    fontFamily: Fonts.sans,
    fontSize: 9,
    fontWeight: '800',
    color: '#708018',
    letterSpacing: 0.5,
  },
  brandSlogan: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },

  titleSpacing: {
    gap: 3,
  },
  cardTitle: {
    fontFamily: Fonts.sans,
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    letterSpacing: -0.3,
  },
  cardSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },

  // ERRO
  errorAlert: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  errorAlertText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#DC2626',
    fontWeight: '600',
  },

  // FORMULÁRIO
  formFields: {
    gap: 12,
  },
  inputGroup: {
    gap: 5,
  },
  inputLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  inputBoxFocused: {
    backgroundColor: '#FFFFFF',
    borderColor: '#5798D7', // Iced Denim
    ...Platform.select({
      web: {
        boxShadow: '0 0 0 3px rgba(87, 152, 215, 0.16)',
      },
    }),
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
  optionsLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
    marginBottom: 4,
  },
  rememberOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  checkSquare: {
    width: 17,
    height: 17,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkSquareActive: {
    backgroundColor: '#5798D7', // Iced Denim
    borderColor: '#5798D7',
  },
  checkCheck: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '900',
  },
  rememberLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
  },
  forgotLink: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#5798D7', // Iced Denim
    fontWeight: '600',
  },

  // BOTÃO PRIMÁRIO (ICED DENIM)
  primaryBtn: {
    backgroundColor: '#5798D7', // Iced Denim
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
    ...Platform.select({
      web: {
        boxShadow: '0 6px 16px -2px rgba(87, 152, 215, 0.35)',
      },
      default: {
        elevation: 3,
        shadowColor: '#5798D7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
    }),
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // DIVISOR
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },

  // BOTÃO GOOGLE
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    height: 42,
    gap: 10,
    ...Platform.select({
      web: {
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.03)',
      },
    }),
  },
  googleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EA4335',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleLetter: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
  },
  googleBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },

  // RODAPÉ DO CARD
  footerLine: {
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
  footerLink: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '700',
    color: '#5798D7', // Iced Denim
  },

  // HOMOLOGAÇÃO
  hmlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  hmlRowTitle: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  hmlChip: {
    backgroundColor: '#E6F1FA',
    borderColor: '#D4E6F6',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  hmlChipText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    fontWeight: '600',
    color: '#5798D7',
  },

  // RODAPÉ EXTERNO
  outerFooterText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    maxWidth: 360,
  },

  // SUCESSO
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#B9C255', // Pistachio
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  avatarLetter: {
    fontFamily: Fonts.sans,
    fontSize: 26,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  hmlBadge: {
    backgroundColor: '#F1F6D8',
    borderColor: '#B9C255',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    alignSelf: 'center',
  },
  hmlBadgeText: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    fontWeight: '800',
    color: '#708018',
  },
  loggedName: {
    fontFamily: Fonts.sans,
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  loggedEmail: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  loggedInfoBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    gap: 6,
  },
  loggedInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  loggedInfoLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
  },
  loggedInfoValue: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: '#0F172A',
  },
});

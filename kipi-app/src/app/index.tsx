import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { KipiPalette, Fonts } from '@/constants/theme';

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <Path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </Svg>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
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
      router.push('/visao-geral');
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
        <View style={styles.card}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>
              {usuarioLogado.nome?.[0]?.toUpperCase() || 'K'}
            </Text>
          </View>
          <Text style={styles.title}>{usuarioLogado.nome}</Text>
          <Text style={styles.subtitle}>{usuarioLogado.email}</Text>

          <View style={styles.sessionBox}>
            <Text style={styles.sessionLabel}>Perfil: <Text style={styles.sessionValue}>{usuarioLogado.papel}</Text></Text>
            <Text style={styles.sessionLabel}>Status: <Text style={styles.sessionValue}>Conectado</Text></Text>
          </View>

          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push('/visao-geral')}
            activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Acessar Visão Geral →</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: '#F1F5F9', marginTop: 10 }]}
            onPress={() => setUsuarioLogado(null)}
            activeOpacity={0.85}>
            <Text style={[styles.primaryBtnText, { color: '#64748B' }]}>Sair da Conta</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.viewport}>
      <View style={styles.wrapper}>
        {/* CARD PRINCIPAL COMPACTO E MINIMALISTA */}
        <View style={styles.card}>
          {/* CABEÇALHO */}
          <View style={styles.header}>
            <Text style={styles.title}>Entrar</Text>
            <Text style={styles.subtitle}>Acesse sua conta no Kipi</Text>
          </View>

          {/* MENSAGEM DE ERRO SE HOUVER */}
          {erro && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{erro}</Text>
            </View>
          )}

          {/* CAMPOS */}
          <View style={styles.form}>
            {/* Campo E-mail */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>E-mail</Text>
              <View
                style={[
                  styles.inputContainer,
                  emailFocado && styles.inputFocused,
                ]}>
                <Feather
                  name="mail"
                  size={18}
                  color={emailFocado ? KipiPalette.icedDenim : '#94A3B8'}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Digite seu e-mail"
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
                  styles.inputContainer,
                  senhaFocada && styles.inputFocused,
                ]}>
                <Feather
                  name="lock"
                  size={18}
                  color={senhaFocada ? KipiPalette.icedDenim : '#94A3B8'}
                  style={styles.inputIcon}
                />
                <TextInput
                  style={styles.input}
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
                  style={styles.eyeBtn}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Feather
                    name={mostrarSenha ? 'eye-off' : 'eye'}
                    size={18}
                    color="#94A3B8"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Esqueci a Senha */}
            <TouchableOpacity style={styles.forgotBtn} activeOpacity={0.7}>
              <Text style={styles.forgotText}>Esqueceu a senha?</Text>
            </TouchableOpacity>

            {/* Botão Entrar */}
            <TouchableOpacity
              style={[
                styles.primaryBtn,
                carregando && styles.primaryBtnDisabled,
              ]}
              onPress={() => handleLogin()}
              disabled={carregando}
              activeOpacity={0.85}>
              {carregando ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryBtnText}>Entrar</Text>
              )}
            </TouchableOpacity>

            {/* Divisor "ou" */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>ou</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Botão Entrar com o Google (Design Clean e Integrado) */}
            <TouchableOpacity
              style={styles.googleBtn}
              activeOpacity={0.85}
              onPress={() => {
                // UI pronto, aguardando integração futura
              }}>
              <GoogleIcon size={18} />
              <Text style={styles.googleBtnText}>Entrar com o Google</Text>
            </TouchableOpacity>

            {/* Criar Conta */}
            <TouchableOpacity style={styles.createAccountBtn} activeOpacity={0.7}>
              <Text style={styles.createAccountText}>Criar uma conta</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ATALHO DISCRETO DE TESTE (HOMOLOGAÇÃO) */}
        <View style={styles.devBar}>
          <Text style={styles.devBarTitle}>Atalhos:</Text>
          <TouchableOpacity
            style={styles.devChip}
            onPress={() => preencherRapido('camila.c.lima08@gmail.com', 'P&ix1nh0!')}>
            <Text style={styles.devChipText}>Camila (Proprietária)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.devChip, { backgroundColor: '#EAF3FA' }]}
            onPress={() => router.push('/visao-geral')}>
            <Text style={[styles.devChipText, { color: KipiPalette.icedDenim }]}>Visão Geral →</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  viewport: {
    flex: 1,
    height: '100%',
    backgroundColor: '#F3F6FB', // Suave e acolhedor
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  wrapper: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 16,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#D8E2F2',
    paddingVertical: 32,
    paddingHorizontal: 24,
    shadowColor: '#5798D7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontFamily: Fonts.sans,
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: '#64748B',
    marginTop: 4,
  },
  errorBox: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  errorText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#DC2626',
    textAlign: 'center',
    fontWeight: '500',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#D4DCED',
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 14,
    gap: 10,
  },
  inputFocused: {
    borderColor: KipiPalette.icedDenim,
    backgroundColor: '#FFFFFF',
  },
  inputIcon: {
    marginRight: 2,
  },
  input: {
    flex: 1,
    height: '100%',
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: 'transparent',
    outlineWidth: 0,
  },
  eyeBtn: {
    padding: 4,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: 4,
  },
  forgotText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    fontWeight: '600',
    color: KipiPalette.icedDenim,
  },
  primaryBtn: {
    backgroundColor: KipiPalette.icedDenim,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryBtnDisabled: {
    opacity: 0.65,
  },
  primaryBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  createAccountBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  createAccountText: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    fontWeight: '600',
    color: KipiPalette.icedDenim,
  },

  // DIVISOR E BOTÃO GOOGLE
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D4DCED',
    backgroundColor: '#FFFFFF',
    gap: 10,
    shadowColor: '#5798D7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  googleBtnText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },

  // BARRA DE TESTE DISCRETA
  devBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    opacity: 0.75,
  },
  devBarTitle: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#64748B',
    fontWeight: '500',
  },
  devChip: {
    paddingVertical: 3,
    paddingHorizontal: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 6,
  },
  devChipText: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: '#334155',
    fontWeight: '600',
  },

  // SESSÃO CONECTADA
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: KipiPalette.icedDenimLight,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: KipiPalette.icedDenim,
  },
  avatarLetter: {
    fontFamily: Fonts.sans,
    fontSize: 26,
    fontWeight: '800',
    color: KipiPalette.icedDenim,
  },
  sessionBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 12,
    gap: 4,
    marginVertical: 16,
  },
  sessionLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: '#64748B',
  },
  sessionValue: {
    fontWeight: '700',
    color: '#1E293B',
  },
});

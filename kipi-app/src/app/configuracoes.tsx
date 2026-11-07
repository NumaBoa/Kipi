import { paraCelular } from '@/lib/responsivo';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import Sidebar from '@/components/Sidebar';
import { useEhCelular } from '@/lib/layout';
import ConfiguracoesMobile from '@/components/configuracoes-mobile/ConfiguracoesMobile';
import { PageHeaderTitulo, TOPO_COMPACTO } from '@/components/PageHeader';
import type { TipoComissao } from '@/lib/revenda';
import {
  ConfigLoja,
  useConfigLoja,
  salvarConfigLoja,
  atualizarPerfil,
  trocarSenha,
  encerrarSessao,
} from '@/lib/configuracoes';
import { dinheiroParaCampo, lerDinheiro, mascaraDinheiro } from '@/lib/dinheiro';

// ============================================================================
// TIPOGRAFIA & CONSTANTES DE TEMA (KIPI ATELIÊ / UX SÊNIOR)
// ============================================================================
const FONT_DISPLAY = Platform.select({ web: '"Bricolage Grotesque", ui-sans-serif, system-ui, sans-serif', default: 'System' });
const FONT_SANS = Platform.select({ web: '"Instrument Sans", ui-sans-serif, system-ui, sans-serif', default: 'System' });

const KIPI_BLUE = '#9E5D25';
const KIPI_BLUE_DARK = '#7A4520';
const KIPI_BLUE_TINT = '#ECEBFA';
const KIPI_BLUE_ACCENT = '#4B4FC4';
const KIPI_FROST_BG = '#F8F6F2';
const SUCCESS_GREEN = '#2F7D55';
const SUCCESS_TINT = '#E4F1E9';
const DANGER_RED = '#B42318';
const DANGER_TINT = '#FBE7E4';

// Limite do logo salvo em base64 (~1 MB de imagem)
const TAMANHO_MAX_LOGO = 1_400_000;

// ============================================================================
// MÁSCARAS E VALIDAÇÕES
// ============================================================================
const formatarTelefone = (valor: string) => {
  const limpo = valor.replace(/\D/g, '').slice(0, 11);
  if (limpo.length <= 2) return limpo;
  if (limpo.length <= 6) return `(${limpo.slice(0, 2)}) ${limpo.slice(2)}`;
  if (limpo.length <= 10) return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
  return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
};

// CPF até 11 dígitos, CNPJ a partir do 12º
const formatarDocumento = (valor: string) => {
  const d = valor.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
    if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
};

const formatarDecimal = (valor: string) => {
  const limpo = valor.replace(/[^\d,]/g, '');
  const [inteiro, ...resto] = limpo.split(',');
  if (resto.length === 0) return inteiro;
  return `${inteiro},${resto.join('').slice(0, 2)}`;
};

const emailValido = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

const REGRAS_SENHA = [
  { id: 'tamanho', label: 'Pelo menos 8 caracteres', teste: (s: string) => s.length >= 8 },
  { id: 'letra', label: 'Pelo menos uma letra', teste: (s: string) => /[a-zA-Z]/.test(s) },
  { id: 'numero', label: 'Pelo menos um número', teste: (s: string) => /\d/.test(s) },
];

type Aviso = { tipo: 'sucesso' | 'erro'; texto: string } | null;

function AvisoInline({ aviso }: { aviso: Aviso }) {
  if (!aviso) return null;
  const sucesso = aviso.tipo === 'sucesso';
  return (
    <View style={[styles.aviso, { backgroundColor: sucesso ? SUCCESS_TINT : DANGER_TINT }]}>
      <Feather name={sucesso ? 'check-circle' : 'alert-circle'} size={14} color={sucesso ? SUCCESS_GREEN : DANGER_RED} />
      <Text style={[styles.avisoText, { color: sucesso ? SUCCESS_GREEN : DANGER_RED }]}>{aviso.texto}</Text>
    </View>
  );
}

function CampoSenha({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
}) {
  const [visivel, setVisivel] = useState(false);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={styles.passwordWrap}>
        <TextInput
          style={styles.passwordInput}
          placeholder={placeholder}
          placeholderTextColor="#9A8F87"
          secureTextEntry={!visivel}
          autoCapitalize="none"
          autoCorrect={false}
          value={value}
          onChangeText={onChangeText}
        />
        <TouchableOpacity onPress={() => setVisivel(!visivel)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name={visivel ? 'eye-off' : 'eye'} size={16} color="#9A8F87" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// Celular: lista com gavetas (components/configuracoes-mobile); computador: tela completa
export default function ConfiguracoesScreen() {
  const celular = useEhCelular();
  return celular ? <ConfiguracoesMobile /> : <ConfiguracoesDesktop />;
}

function ConfiguracoesDesktop() {
  const router = useRouter();
  const { config, sessao } = useConfigLoja();

  // ESTABELECIMENTO
  const [loja, setLoja] = useState<ConfigLoja>(config);
  const [salvandoLoja, setSalvandoLoja] = useState(false);
  const [avisoLoja, setAvisoLoja] = useState<Aviso>(null);

  // REGRA PADRÃO DE REVENDA
  const [comissaoTipo, setComissaoTipo] = useState<TipoComissao>(config.comissaoPadraoTipo);
  const [comissaoValor, setComissaoValor] = useState((config.comissaoPadraoTipo === 'valor_fixo' ? dinheiroParaCampo(config.comissaoPadraoValor) : String(config.comissaoPadraoValor).replace('.', ',')));
  const [avisoRevenda, setAvisoRevenda] = useState<Aviso>(null);

  // MINHA CONTA
  const [perfilNome, setPerfilNome] = useState(sessao?.nome || '');
  const [perfilEmail, setPerfilEmail] = useState(sessao?.email || '');
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [avisoPerfil, setAvisoPerfil] = useState<Aviso>(null);

  // TROCAR SENHA
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);
  const [avisoSenha, setAvisoSenha] = useState<Aviso>(null);

  // Quando as configurações chegam do banco, atualiza o formulário
  useEffect(() => {
    setLoja(config);
    setComissaoTipo(config.comissaoPadraoTipo);
    setComissaoValor((config.comissaoPadraoTipo === 'valor_fixo' ? dinheiroParaCampo(config.comissaoPadraoValor) : String(config.comissaoPadraoValor).replace('.', ',')));
  }, [config]);

  useEffect(() => {
    setPerfilNome(sessao?.nome || '');
    setPerfilEmail(sessao?.email || '');
  }, [sessao]);

  const alterarLoja = <K extends keyof ConfigLoja>(campo: K, valor: ConfigLoja[K]) => {
    setLoja((prev) => ({ ...prev, [campo]: valor }));
    setAvisoLoja(null);
  };

  const escolherLogo = async () => {
    const resultado = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
      base64: true,
    });
    if (resultado.canceled || !resultado.assets[0]) return;

    const imagem = resultado.assets[0];
    const dataUri = imagem.base64
      ? `data:${imagem.mimeType || 'image/jpeg'};base64,${imagem.base64}`
      : imagem.uri;

    if (dataUri.length > TAMANHO_MAX_LOGO) {
      setAvisoLoja({ tipo: 'erro', texto: 'Imagem muito grande. Escolha um arquivo de até 1 MB.' });
      return;
    }
    alterarLoja('logoUri', dataUri);
  };

  const handleSalvarLoja = async () => {
    if (!loja.nome.trim()) {
      setAvisoLoja({ tipo: 'erro', texto: 'Informe o nome do estabelecimento.' });
      return;
    }
    if (loja.email && !emailValido(loja.email)) {
      setAvisoLoja({ tipo: 'erro', texto: 'O e-mail do estabelecimento não é válido.' });
      return;
    }
    setSalvandoLoja(true);
    const noBanco = await salvarConfigLoja({
      ...config,
      ...loja,
      nome: loja.nome.trim(),
      slogan: loja.slogan.trim(),
      instagram: loja.instagram.replace(/^@/, '').trim(),
      chavePix: loja.chavePix.trim(),
      comissaoPadraoTipo: config.comissaoPadraoTipo,
      comissaoPadraoValor: config.comissaoPadraoValor,
    });
    setSalvandoLoja(false);
    setAvisoLoja(
      noBanco
        ? { tipo: 'sucesso', texto: 'Dados do estabelecimento salvos!' }
        : { tipo: 'sucesso', texto: 'Salvo neste aparelho. Rode a migração do banco para sincronizar.' }
    );
  };

  const handleSalvarRevenda = async () => {
    const valor = comissaoTipo === 'valor_fixo' ? lerDinheiro(comissaoValor) : parseFloat(comissaoValor.replace(',', '.'));
    if (isNaN(valor) || valor <= 0) {
      setAvisoRevenda({ tipo: 'erro', texto: 'Informe o valor da comissão padrão.' });
      return;
    }
    if (comissaoTipo === 'porcentagem' && valor > 100) {
      setAvisoRevenda({ tipo: 'erro', texto: 'A comissão em porcentagem não pode passar de 100%.' });
      return;
    }
    await salvarConfigLoja({ ...config, comissaoPadraoTipo: comissaoTipo, comissaoPadraoValor: valor });
    setAvisoRevenda({ tipo: 'sucesso', texto: 'Regra padrão salva! Ela já vem preenchida nas novas revendedoras.' });
  };

  const handleSalvarPerfil = async () => {
    if (!perfilNome.trim()) {
      setAvisoPerfil({ tipo: 'erro', texto: 'Informe seu nome.' });
      return;
    }
    if (!emailValido(perfilEmail)) {
      setAvisoPerfil({ tipo: 'erro', texto: 'Informe um e-mail válido. Ele é usado para entrar no sistema.' });
      return;
    }
    setSalvandoPerfil(true);
    const erro = await atualizarPerfil(perfilNome.trim(), perfilEmail.trim().toLowerCase());
    setSalvandoPerfil(false);
    setAvisoPerfil(erro ? { tipo: 'erro', texto: erro } : { tipo: 'sucesso', texto: 'Seus dados foram atualizados!' });
  };

  const regrasOk = REGRAS_SENHA.every((r) => r.teste(novaSenha));

  const handleTrocarSenha = async () => {
    if (!senhaAtual) {
      setAvisoSenha({ tipo: 'erro', texto: 'Digite sua senha atual.' });
      return;
    }
    if (!regrasOk) {
      setAvisoSenha({ tipo: 'erro', texto: 'A nova senha não atende aos requisitos.' });
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setAvisoSenha({ tipo: 'erro', texto: 'A confirmação não confere com a nova senha.' });
      return;
    }
    if (novaSenha === senhaAtual) {
      setAvisoSenha({ tipo: 'erro', texto: 'A nova senha precisa ser diferente da atual.' });
      return;
    }
    setSalvandoSenha(true);
    const erro = await trocarSenha(senhaAtual, novaSenha);
    setSalvandoSenha(false);
    if (erro) {
      setAvisoSenha({ tipo: 'erro', texto: erro });
      return;
    }
    setSenhaAtual('');
    setNovaSenha('');
    setConfirmarSenha('');
    setAvisoSenha({ tipo: 'sucesso', texto: 'Senha alterada com sucesso!' });
  };

  const handleSair = async () => {
    await encerrarSessao();
    router.replace('/');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.screenWrapper}>
        <Sidebar activeRoute="/configuracoes" />

        <View style={styles.mainContainer}>
          {/* CABEÇALHO */}
          <View style={styles.topHeader}>
            <PageHeaderTitulo
              etiqueta="SISTEMA · PREFERÊNCIAS"
              titulo="Configurações"
              subtitulo="Dados do estabelecimento, sua conta e regras padrão do sistema."
            />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.columns}>
            {/* COLUNA 1: ESTABELECIMENTO */}
            <View style={styles.column}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIcon}>
                    <Feather name="home" size={16} color={KIPI_BLUE_ACCENT} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Estabelecimento</Text>
                    <Text style={styles.cardSubtitle}>Aparece no menu e nos documentos do sistema.</Text>
                  </View>
                </View>

                {/* LOGO */}
                <View style={styles.logoRow}>
                  <TouchableOpacity style={styles.logoBox} onPress={escolherLogo} activeOpacity={0.85}>
                    {loja.logoUri ? (
                      <Image source={{ uri: loja.logoUri }} style={styles.logoImage} contentFit="cover" />
                    ) : (
                      <>
                        <Feather name="image" size={22} color="#9A8F87" />
                        <Text style={styles.logoPlaceholderText}>Logo</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <View style={{ flex: 1, gap: 8 }}>
                    <Text style={styles.cardSubtitle}>Imagem quadrada (PNG ou JPG), até 1 MB.</Text>
                    <View style={styles.inlineBtns}>
                      <TouchableOpacity style={styles.btnSecondary} onPress={escolherLogo}>
                        <Feather name="upload" size={13} color="#4A3E37" />
                        <Text style={styles.btnSecondaryText}>{loja.logoUri ? 'Trocar logo' : 'Enviar logo'}</Text>
                      </TouchableOpacity>
                      {loja.logoUri && (
                        <TouchableOpacity style={styles.btnSecondary} onPress={() => alterarLoja('logoUri', null)}>
                          <Feather name="trash-2" size={13} color={DANGER_RED} />
                          <Text style={[styles.btnSecondaryText, { color: DANGER_RED }]}>Remover</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={{ flex: 1.3, minWidth: 180 }}>
                    <Text style={styles.inputLabel}>Nome do estabelecimento *</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Ex: AtelierQ"
                      placeholderTextColor="#9A8F87"
                      value={loja.nome}
                      onChangeText={(t) => alterarLoja('nome', t)}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 160 }}>
                    <Text style={styles.inputLabel}>Slogan / subtítulo</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Ex: Pâtisserie Gourmet"
                      placeholderTextColor="#9A8F87"
                      value={loja.slogan}
                      onChangeText={(t) => alterarLoja('slogan', t)}
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={{ flex: 1, minWidth: 160 }}>
                    <Text style={styles.inputLabel}>CNPJ ou CPF</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="00.000.000/0000-00"
                      placeholderTextColor="#9A8F87"
                      keyboardType="numeric"
                      value={loja.documento}
                      onChangeText={(t) => alterarLoja('documento', formatarDocumento(t))}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 160 }}>
                    <Text style={styles.inputLabel}>Telefone / WhatsApp</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="(21) 99999-9999"
                      placeholderTextColor="#9A8F87"
                      keyboardType="phone-pad"
                      value={loja.telefone}
                      onChangeText={(t) => alterarLoja('telefone', formatarTelefone(t))}
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={{ flex: 1.3, minWidth: 180 }}>
                    <Text style={styles.inputLabel}>E-mail do estabelecimento</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="contato@atelierq.com.br"
                      placeholderTextColor="#9A8F87"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={loja.email}
                      onChangeText={(t) => alterarLoja('email', t.replace(/\s/g, '').toLowerCase())}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 160 }}>
                    <Text style={styles.inputLabel}>Instagram</Text>
                    <View style={styles.affixWrap}>
                      <Text style={styles.affixText}>@</Text>
                      <TextInput
                        style={styles.affixInput}
                        placeholder="atelierq"
                        placeholderTextColor="#9A8F87"
                        autoCapitalize="none"
                        autoCorrect={false}
                        value={loja.instagram}
                        onChangeText={(t) => alterarLoja('instagram', t.replace(/[\s@]/g, ''))}
                      />
                    </View>
                  </View>
                </View>

                <Text style={styles.inputLabel}>Chave PIX</Text>
                <TextInput
                  style={[styles.formInput, { marginBottom: 4 }]}
                  placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória"
                  placeholderTextColor="#9A8F87"
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={loja.chavePix}
                  onChangeText={(t) => alterarLoja('chavePix', t)}
                />
                <Text style={[styles.inputLabel, { fontWeight: '500', color: '#9A8F87', marginBottom: 12 }]}>
                  Vai no final da mensagem de WhatsApp de cada pedido.
                </Text>

                <Text style={styles.inputLabel}>Endereço</Text>
                <TextInput
                  style={[styles.formInput, { marginBottom: 12 }]}
                  placeholder="Rua, número, complemento e bairro"
                  placeholderTextColor="#9A8F87"
                  value={loja.endereco}
                  onChangeText={(t) => alterarLoja('endereco', t)}
                />

                <View style={styles.formRow}>
                  <View style={{ flex: 2 }}>
                    <Text style={styles.inputLabel}>Cidade</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="Rio de Janeiro"
                      placeholderTextColor="#9A8F87"
                      value={loja.cidade}
                      onChangeText={(t) => alterarLoja('cidade', t)}
                    />
                  </View>
                  <View style={{ flex: 0.6 }}>
                    <Text style={styles.inputLabel}>UF</Text>
                    <TextInput
                      style={styles.formInput}
                      placeholder="RJ"
                      placeholderTextColor="#9A8F87"
                      autoCapitalize="characters"
                      maxLength={2}
                      value={loja.estado}
                      onChangeText={(t) => alterarLoja('estado', t.replace(/[^a-zA-Z]/g, '').toUpperCase())}
                    />
                  </View>
                </View>

                <AvisoInline aviso={avisoLoja} />
                <TouchableOpacity style={styles.btnPrimary} onPress={handleSalvarLoja} disabled={salvandoLoja}>
                  {salvandoLoja ? (
                    <ActivityIndicator size="small" color="#FFFDFA" />
                  ) : (
                    <>
                      <Feather name="check" size={15} color="#FFFDFA" />
                      <Text style={styles.btnPrimaryText}>Salvar estabelecimento</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {/* REGRA PADRÃO DE REVENDA */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIcon}>
                    <Feather name="percent" size={16} color={KIPI_BLUE_ACCENT} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Comissão padrão de revenda</Text>
                    <Text style={styles.cardSubtitle}>
                      Vem preenchida ao cadastrar uma nova revendedora (dá para mudar em cada uma).
                    </Text>
                  </View>
                </View>

                <View style={styles.segmented}>
                  {[
                    { id: 'porcentagem', label: 'Porcentagem (%)', icon: 'percent' as const },
                    { id: 'valor_fixo', label: 'Valor fixo por produto (R$)', icon: 'dollar-sign' as const },
                  ].map((op) => {
                    const ativo = comissaoTipo === op.id;
                    return (
                      <TouchableOpacity
                        key={op.id}
                        style={[styles.segmentedBtn, ativo && styles.segmentedBtnActive]}
                        onPress={() => {
                          setComissaoTipo(op.id as TipoComissao);
                          setAvisoRevenda(null);
                        }}>
                        <Feather name={op.icon} size={14} color={ativo ? KIPI_BLUE_ACCENT : '#6B615A'} />
                        <Text style={[styles.segmentedText, ativo && styles.segmentedTextActive]}>{op.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <View style={[styles.affixWrap, { maxWidth: 200, marginBottom: 12 }]}>
                  {comissaoTipo === 'valor_fixo' && <Text style={styles.affixText}>R$</Text>}
                  <TextInput
                    style={styles.affixInput}
                    placeholder={comissaoTipo === 'porcentagem' ? '15' : '3,50'}
                    placeholderTextColor="#9A8F87"
                    keyboardType="decimal-pad"
                    value={comissaoValor}
                    onChangeText={(t) => {
                      setComissaoValor(comissaoTipo === 'valor_fixo' ? mascaraDinheiro(t) : formatarDecimal(t));
                      setAvisoRevenda(null);
                    }}
                  />
                  {comissaoTipo === 'porcentagem' && <Text style={styles.affixText}>%</Text>}
                </View>

                <AvisoInline aviso={avisoRevenda} />
                <TouchableOpacity style={styles.btnPrimary} onPress={handleSalvarRevenda}>
                  <Feather name="check" size={15} color="#FFFDFA" />
                  <Text style={styles.btnPrimaryText}>Salvar regra padrão</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* COLUNA 2: CONTA E SEGURANÇA */}
            <View style={styles.column}>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardIcon}>
                    <Feather name="user" size={16} color={KIPI_BLUE_ACCENT} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Minha conta</Text>
                    <Text style={styles.cardSubtitle}>Seu nome e o e-mail que você usa para entrar.</Text>
                  </View>
                </View>

                {!sessao ? (
                  <View style={styles.semSessao}>
                    <Feather name="log-in" size={16} color={KIPI_BLUE_DARK} />
                    <Text style={styles.semSessaoText}>
                      Saia e entre novamente no sistema para editar sua conta e trocar a senha.
                    </Text>
                  </View>
                ) : (
                  <>
                    <Text style={styles.inputLabel}>Nome</Text>
                    <TextInput
                      style={[styles.formInput, { marginBottom: 12 }]}
                      value={perfilNome}
                      onChangeText={(t) => {
                        setPerfilNome(t);
                        setAvisoPerfil(null);
                      }}
                    />
                    <Text style={styles.inputLabel}>E-mail de acesso</Text>
                    <TextInput
                      style={[styles.formInput, { marginBottom: 12 }]}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      value={perfilEmail}
                      onChangeText={(t) => {
                        setPerfilEmail(t.replace(/\s/g, '').toLowerCase());
                        setAvisoPerfil(null);
                      }}
                    />
                    <AvisoInline aviso={avisoPerfil} />
                    <TouchableOpacity style={styles.btnPrimary} onPress={handleSalvarPerfil} disabled={salvandoPerfil}>
                      {salvandoPerfil ? (
                        <ActivityIndicator size="small" color="#FFFDFA" />
                      ) : (
                        <>
                          <Feather name="check" size={15} color="#FFFDFA" />
                          <Text style={styles.btnPrimaryText}>Salvar meus dados</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {sessao && (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.cardIcon}>
                      <Feather name="lock" size={16} color={KIPI_BLUE_ACCENT} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardTitle}>Trocar senha</Text>
                      <Text style={styles.cardSubtitle}>Para sua segurança, confirme a senha atual.</Text>
                    </View>
                  </View>

                  <CampoSenha
                    label="Senha atual"
                    placeholder="Digite sua senha atual"
                    value={senhaAtual}
                    onChangeText={(t) => {
                      setSenhaAtual(t);
                      setAvisoSenha(null);
                    }}
                  />
                  <CampoSenha
                    label="Nova senha"
                    placeholder="Crie uma nova senha"
                    value={novaSenha}
                    onChangeText={(t) => {
                      setNovaSenha(t);
                      setAvisoSenha(null);
                    }}
                  />

                  <View style={styles.regrasBox}>
                    {REGRAS_SENHA.map((r) => {
                      const ok = r.teste(novaSenha);
                      return (
                        <View key={r.id} style={styles.regraRow}>
                          <Feather name={ok ? 'check-circle' : 'circle'} size={12} color={ok ? SUCCESS_GREEN : '#D9CFC4'} />
                          <Text style={[styles.regraText, ok && { color: SUCCESS_GREEN }]}>{r.label}</Text>
                        </View>
                      );
                    })}
                  </View>

                  <CampoSenha
                    label="Confirmar nova senha"
                    placeholder="Repita a nova senha"
                    value={confirmarSenha}
                    onChangeText={(t) => {
                      setConfirmarSenha(t);
                      setAvisoSenha(null);
                    }}
                  />
                  {confirmarSenha.length > 0 && confirmarSenha !== novaSenha && (
                    <Text style={styles.erroCampo}>As senhas não conferem.</Text>
                  )}

                  <AvisoInline aviso={avisoSenha} />
                  <TouchableOpacity style={styles.btnPrimary} onPress={handleTrocarSenha} disabled={salvandoSenha}>
                    {salvandoSenha ? (
                      <ActivityIndicator size="small" color="#FFFDFA" />
                    ) : (
                      <>
                        <Feather name="key" size={15} color="#FFFDFA" />
                        <Text style={styles.btnPrimaryText}>Alterar senha</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* SESSÃO */}
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={[styles.cardIcon, { backgroundColor: DANGER_TINT }]}>
                    <Feather name="log-out" size={16} color={DANGER_RED} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>Sair da conta</Text>
                    <Text style={styles.cardSubtitle}>
                      {sessao ? `Conectada como ${sessao.email}` : 'Encerrar o acesso neste aparelho.'}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.btnDanger} onPress={handleSair}>
                    <Text style={styles.btnDangerText}>Sair</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ============================================================================
// ESTILOS
// ============================================================================
const semOutline = Platform.select({ web: { outlineStyle: 'none' } as any });

const styles = paraCelular(StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFDFA',
  },
  screenWrapper: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: KIPI_FROST_BG,
  },
  mainContainer: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 20,
    backgroundColor: KIPI_FROST_BG,
  },

  // CABEÇALHO
  topHeader: TOPO_COMPACTO,

  // LAYOUT EM COLUNAS
  columns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingBottom: 30,
    alignItems: 'flex-start',
  },
  column: {
    flex: 1,
    minWidth: 320,
    gap: 16,
  },

  // CARDS
  card: {
    backgroundColor: '#FFFDFA',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    padding: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: KIPI_BLUE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 15,
    fontWeight: '800',
    color: '#2E211A',
  },
  cardSubtitle: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: '#6B615A',
    marginTop: 2,
  },

  // LOGO
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 16,
  },
  logoBox: {
    width: 84,
    height: 84,
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D9CFC4',
    backgroundColor: KIPI_FROST_BG,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: 4,
  },
  logoImage: {
    width: 84,
    height: 84,
  },
  logoPlaceholderText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#9A8F87',
  },
  inlineBtns: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  // FORMULÁRIO
  formRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  inputLabel: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    fontWeight: '700',
    color: '#4A3E37',
    marginBottom: 6,
  },
  formInput: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    color: '#2E211A',
    backgroundColor: KIPI_FROST_BG,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...semOutline,
  },
  affixWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KIPI_FROST_BG,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 6,
  },
  affixText: {
    fontFamily: FONT_DISPLAY,
    fontSize: 14,
    fontWeight: '800',
    color: '#6B615A',
  },
  affixInput: {
    flex: 1,
    fontFamily: FONT_SANS,
    fontSize: 13,
    color: '#2E211A',
    paddingVertical: 10,
    ...semOutline,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KIPI_FROST_BG,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 8,
  },
  passwordInput: {
    flex: 1,
    fontFamily: FONT_SANS,
    fontSize: 13,
    color: '#2E211A',
    paddingVertical: 10,
    ...semOutline,
  },
  regrasBox: {
    backgroundColor: KIPI_FROST_BG,
    borderRadius: 10,
    padding: 10,
    gap: 5,
    marginBottom: 12,
    marginTop: -4,
  },
  regraRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  regraText: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: '#6B615A',
  },
  erroCampo: {
    fontFamily: FONT_SANS,
    fontSize: 11,
    color: DANGER_RED,
    marginTop: -6,
    marginBottom: 10,
  },
  segmented: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  segmentedBtn: {
    flex: 1,
    minWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    backgroundColor: '#FFFDFA',
  },
  segmentedBtnActive: {
    borderColor: KIPI_BLUE,
    backgroundColor: KIPI_BLUE_TINT,
  },
  segmentedText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '600',
    color: '#6B615A',
  },
  segmentedTextActive: {
    color: KIPI_BLUE_ACCENT,
    fontWeight: '800',
  },
  semSessao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: KIPI_BLUE_TINT,
    borderRadius: 10,
    padding: 12,
  },
  semSessaoText: {
    flex: 1,
    fontFamily: FONT_SANS,
    fontSize: 12,
    color: KIPI_BLUE_DARK,
    lineHeight: 17,
  },

  // AVISOS
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  avisoText: {
    flex: 1,
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '600',
  },

  // BOTÕES
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    backgroundColor: KIPI_BLUE,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
    minWidth: 150,
  },
  btnPrimaryText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFDFA',
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#E8E0D6',
    backgroundColor: '#FFFDFA',
  },
  btnSecondaryText: {
    fontFamily: FONT_SANS,
    fontSize: 12,
    fontWeight: '700',
    color: '#4A3E37',
  },
  btnDanger: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F3C4BD',
    backgroundColor: '#FBE7E4',
  },
  btnDangerText: {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: '700',
    color: DANGER_RED,
  },
}));

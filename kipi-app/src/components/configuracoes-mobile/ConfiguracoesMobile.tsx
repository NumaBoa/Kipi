import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import Constants from 'expo-constants';
import TabBar from '@/components/mobile/TabBar';
import { cor, fonte, sombra } from '@/components/mobile/tema';
import { Aviso, Botao, Gaveta, T, useAviso } from '@/components/mobile/ui';
import { formatarCpfCnpj, formatarTelefone } from '@/components/ClienteFormModal';
import { atualizarPerfil, encerrarSessao, salvarConfigLoja, trocarSenha, useConfigLoja, type ConfigLoja } from '@/lib/configuracoes';
import { dinheiroParaCampo, lerDinheiro, mascaraDinheiro } from '@/lib/dinheiro';
import type { TipoComissao } from '@/lib/revenda';

// ============================================================================
// CONFIGURAÇÕES NO CELULAR — mesma regra da versão de computador, em lista:
// cada grupo abre uma gaveta com o formulário (ateliê, Pix, comissão, conta, senha).
// ============================================================================

type Painel = null | 'loja' | 'pix' | 'comissao' | 'conta' | 'senha' | 'sair';
const TAMANHO_MAX_LOGO = 1_400_000;
const emailValido = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
const REGRAS_SENHA = [
  { label: 'Pelo menos 8 caracteres', teste: (s: string) => s.length >= 8 },
  { label: 'Pelo menos uma letra', teste: (s: string) => /[a-zA-Z]/.test(s) },
  { label: 'Pelo menos um número', teste: (s: string) => /\d/.test(s) },
];
const campoWeb = Platform.select({ web: { outlineStyle: 'none' } as object, default: {} });
const iniciais = (nome: string) =>
  nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';

function Campo({ rotulo, style, ...props }: TextInputProps & { rotulo: string }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <T style={s.rotulo}>{rotulo}</T>
      <TextInput placeholderTextColor="#9A8F87" {...props} style={s.input} />
    </View>
  );
}

function Erro({ texto }: { texto: string | null }) {
  if (!texto) return null;
  return (
    <View style={s.erro} accessibilityRole="alert">
      <Feather name="alert-circle" size={16} color={cor.vermelho} />
      <T style={s.erroTexto}>{texto}</T>
    </View>
  );
}

export default function ConfiguracoesMobile() {
  const { config, sessao } = useConfigLoja();
  const { msg, avisar } = useAviso();
  const [painel, setPainel] = useState<Painel>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [loja, setLoja] = useState<ConfigLoja>(config);
  const [comissaoTipo, setComissaoTipo] = useState<TipoComissao>(config.comissaoPadraoTipo);
  const [comissaoValor, setComissaoValor] = useState('');
  const [nome, setNome] = useState(sessao?.nome ?? '');
  const [email, setEmail] = useState(sessao?.email ?? '');
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');

  // Cada gaveta abre com o que está salvo agora
  const abrir = (p: Painel) => {
    setLoja(config);
    setComissaoTipo(config.comissaoPadraoTipo);
    setComissaoValor(
      config.comissaoPadraoTipo === 'valor_fixo' ? dinheiroParaCampo(config.comissaoPadraoValor) : String(config.comissaoPadraoValor || '').replace('.', ',')
    );
    setNome(sessao?.nome ?? '');
    setEmail(sessao?.email ?? '');
    setSenhaAtual('');
    setNovaSenha('');
    setConfirmar('');
    setErro(null);
    setPainel(p);
  };
  useEffect(() => setLoja(config), [config]);

  const alterar = <K extends keyof ConfigLoja>(campo: K, valor: ConfigLoja[K]) => {
    setLoja((prev) => ({ ...prev, [campo]: valor }));
    setErro(null);
  };

  const escolherLogo = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.6, base64: true });
    if (r.canceled || !r.assets[0]) return;
    const img = r.assets[0];
    const uri = img.base64 ? `data:${img.mimeType || 'image/jpeg'};base64,${img.base64}` : img.uri;
    if (uri.length > TAMANHO_MAX_LOGO) return setErro('Imagem muito grande. Escolha um arquivo de até 1 MB.');
    alterar('logoUri', uri);
  };

  const concluir = (texto: string) => {
    setPainel(null);
    avisar(texto);
  };

  const salvarLoja = async (soPix = false) => {
    if (!soPix && !loja.nome.trim()) return setErro('Informe o nome do estabelecimento.');
    if (!soPix && loja.email && !emailValido(loja.email)) return setErro('O e-mail do estabelecimento não é válido.');
    setSalvando(true);
    const noBanco = await salvarConfigLoja({
      ...config,
      ...(soPix ? { chavePix: loja.chavePix.trim() } : { ...loja, nome: loja.nome.trim(), slogan: loja.slogan.trim(), instagram: loja.instagram.replace(/^@/, '').trim(), chavePix: config.chavePix }),
      comissaoPadraoTipo: config.comissaoPadraoTipo,
      comissaoPadraoValor: config.comissaoPadraoValor,
    });
    setSalvando(false);
    concluir(noBanco ? (soPix ? 'Chave Pix salva!' : 'Dados do ateliê salvos!') : 'Salvo neste aparelho.');
  };

  const salvarComissao = async () => {
    const valor = comissaoTipo === 'valor_fixo' ? lerDinheiro(comissaoValor) : parseFloat(comissaoValor.replace(',', '.'));
    if (isNaN(valor) || valor <= 0) return setErro('Informe o valor da comissão padrão.');
    if (comissaoTipo === 'porcentagem' && valor > 100) return setErro('A comissão em porcentagem não pode passar de 100%.');
    await salvarConfigLoja({ ...config, comissaoPadraoTipo: comissaoTipo, comissaoPadraoValor: valor });
    concluir('Regra padrão salva!');
  };

  const salvarConta = async () => {
    if (!nome.trim()) return setErro('Informe seu nome.');
    if (!emailValido(email)) return setErro('Informe um e-mail válido. Ele é usado para entrar no sistema.');
    setSalvando(true);
    const falha = await atualizarPerfil(nome.trim(), email.trim().toLowerCase());
    setSalvando(false);
    if (falha) return setErro(falha);
    concluir('Seus dados foram atualizados!');
  };

  const regrasOk = REGRAS_SENHA.every((r) => r.teste(novaSenha));
  const salvarSenha = async () => {
    if (!senhaAtual) return setErro('Digite sua senha atual.');
    if (!regrasOk) return setErro('A nova senha não atende aos requisitos.');
    if (novaSenha !== confirmar) return setErro('A confirmação não confere com a nova senha.');
    if (novaSenha === senhaAtual) return setErro('A nova senha precisa ser diferente da atual.');
    setSalvando(true);
    const falha = await trocarSenha(senhaAtual, novaSenha);
    setSalvando(false);
    if (falha) return setErro(falha);
    concluir('Senha alterada!');
  };

  const sair = async () => {
    await encerrarSessao();
    router.replace('/');
  };

  const comissaoTexto =
    config.comissaoPadraoValor > 0
      ? config.comissaoPadraoTipo === 'valor_fixo'
        ? `R$ ${dinheiroParaCampo(config.comissaoPadraoValor)} por produto`
        : `${String(config.comissaoPadraoValor).replace('.', ',')}% sobre o vendido`
      : 'Não definida';

  const grupos: { titulo: string; itens: { titulo: string; sub: string; icone: keyof typeof Feather.glyphMap; bg: string; fg: string; alerta?: boolean; painel: Painel }[] }[] = [
    {
      titulo: 'Recebimentos',
      itens: [
        {
          titulo: 'Chave Pix',
          sub: config.chavePix ? config.chavePix : 'Não cadastrada · vai no comprovante do WhatsApp',
          icone: 'zap',
          bg: cor.verdeClaro,
          fg: cor.verde,
          alerta: !config.chavePix,
          painel: 'pix',
        },
      ],
    },
    { titulo: 'Revendedoras', itens: [{ titulo: 'Comissão padrão', sub: comissaoTexto, icone: 'percent', bg: cor.mirtiloClaro, fg: cor.mirtilo, painel: 'comissao' }] },
    {
      titulo: 'Minha conta',
      itens: [
        { titulo: 'Nome e e-mail', sub: `${sessao?.nome ?? ''} · ${sessao?.email ?? ''}`, icone: 'user', bg: cor.cinzaClaro, fg: cor.textoMedio, painel: 'conta' },
        { titulo: 'Trocar senha', sub: 'Mínimo 8 caracteres, com letra e número', icone: 'lock', bg: cor.cinzaClaro, fg: cor.textoMedio, painel: 'senha' },
      ],
    },
  ];

  const titulos: Record<Exclude<Painel, null>, [string, string]> = {
    loja: ['Dados do ateliê', 'Aparecem no menu e nos comprovantes'],
    pix: ['Chave Pix', 'Para receber dos clientes'],
    comissao: ['Comissão padrão', 'Exemplo para revendedoras novas'],
    conta: ['Minha conta', 'Seu nome e o e-mail que você usa para entrar'],
    senha: ['Trocar senha', 'Para sua segurança, confirme a senha atual'],
    sair: ['Sair do sistema?', 'Você vai precisar entrar de novo com e-mail e senha'],
  };

  return (
    <SafeAreaView style={s.tela} edges={['top']}>
      <View style={s.topo}>
        <TouchableOpacity onPress={() => router.replace('/mais' as any)} style={[s.voltar, sombra]} accessibilityRole="button" accessibilityLabel="Voltar">
          <Feather name="chevron-left" size={22} color={cor.texto} />
        </TouchableOpacity>
        <T titulo style={s.titulo}>Configurações</T>
      </View>

      <ScrollView contentContainerStyle={s.conteudo} showsVerticalScrollIndicator={false}>
        {/* ATELIÊ */}
        <TouchableOpacity style={[s.atelie, sombra]} onPress={() => abrir('loja')} accessibilityRole="button" activeOpacity={0.85}>
          {config.logoUri ? (
            <Image source={{ uri: config.logoUri }} style={s.logo} contentFit="cover" />
          ) : (
            <View style={[s.logo, { backgroundColor: cor.carameloClaro }]}>
              <T titulo style={s.logoTexto}>{iniciais(config.nome)}</T>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
            <T titulo style={s.atelieNome} numberOfLines={1}>{config.nome || 'Meu ateliê'}</T>
            {!!config.slogan && <T style={s.sub} numberOfLines={1}>{config.slogan}</T>}
            <T style={s.link}>Editar dados do ateliê ›</T>
          </View>
        </TouchableOpacity>

        {grupos.map((g) => (
          <View key={g.titulo} style={{ gap: 8 }}>
            <T style={s.grupoTitulo}>{g.titulo}</T>
            <View style={[s.cartao, sombra]}>
              {g.itens.map((i, k) => (
                <TouchableOpacity key={i.titulo} style={[s.item, k > 0 && s.itemBorda]} onPress={() => abrir(i.painel)} accessibilityRole="button" activeOpacity={0.75}>
                  <View style={[s.itemIcone, { backgroundColor: i.bg }]}>
                    <Feather name={i.icone} size={17} color={i.fg} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                    <T style={s.itemTitulo}>{i.titulo}</T>
                    <T style={[s.sub, i.alerta && { color: cor.ambar }]} numberOfLines={1}>{i.sub}</T>
                  </View>
                  <Feather name="chevron-right" size={18} color="#9A8F87" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity style={[s.sair, sombra]} onPress={() => abrir('sair')} accessibilityRole="button">
          <Feather name="log-out" size={17} color={cor.vermelho} />
          <T style={s.sairTexto}>Sair do sistema</T>
        </TouchableOpacity>
        <T style={s.versao}>Versão {Constants.expoConfig?.version ?? '1.0.0'}</T>
      </ScrollView>

      <Aviso msg={msg} base={100} />
      <TabBar ativa="/mais" />

      <Gaveta aberta={!!painel} aoFechar={() => setPainel(null)} titulo={painel ? titulos[painel][0] : ''} subtitulo={painel ? titulos[painel][1] : ''}>
        <Erro texto={erro} />

        {painel === 'loja' && (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <TouchableOpacity onPress={escolherLogo} accessibilityRole="button" accessibilityLabel="Escolher logo">
                {loja.logoUri ? (
                  <Image source={{ uri: loja.logoUri }} style={[s.logo, { width: 72, height: 72 }]} contentFit="cover" />
                ) : (
                  <View style={[s.logo, s.logoVazio, { width: 72, height: 72 }]}>
                    <Feather name="image" size={20} color={cor.textoSuave} />
                    <T style={s.sub}>Logo</T>
                  </View>
                )}
              </TouchableOpacity>
              <View style={{ flex: 1, gap: 6 }}>
                <T style={s.sub}>Imagem quadrada (PNG ou JPG), até 1 MB.</T>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity onPress={escolherLogo} accessibilityRole="button">
                    <T style={s.link}>{loja.logoUri ? 'Trocar logo' : 'Enviar logo'}</T>
                  </TouchableOpacity>
                  {!!loja.logoUri && (
                    <TouchableOpacity onPress={() => alterar('logoUri', null)} accessibilityRole="button">
                      <T style={[s.link, { color: cor.vermelho }]}>Remover</T>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
            <Campo rotulo="Nome do estabelecimento *" value={loja.nome} onChangeText={(t) => alterar('nome', t)} placeholder="Ex: Ateliê da Ana" />
            <Campo rotulo="Slogan" value={loja.slogan} onChangeText={(t) => alterar('slogan', t)} placeholder="Ex: Pâtisserie Gourmet" />
            <Campo rotulo="CNPJ ou CPF" value={loja.documento} onChangeText={(t) => alterar('documento', formatarCpfCnpj(t))} placeholder="00.000.000/0000-00" keyboardType="numeric" />
            <View style={s.linha}>
              <Campo style={{ flex: 1 }} rotulo="WhatsApp" value={loja.telefone} onChangeText={(t) => alterar('telefone', formatarTelefone(t))} placeholder="(21) 99999-9999" keyboardType="phone-pad" />
              <Campo style={{ flex: 1 }} rotulo="Instagram" value={loja.instagram} onChangeText={(t) => alterar('instagram', t.replace(/^@/, ''))} placeholder="seuatelie" autoCapitalize="none" />
            </View>
            <Campo rotulo="E-mail do ateliê" value={loja.email} onChangeText={(t) => alterar('email', t)} placeholder="contato@seuatelie.com.br" keyboardType="email-address" autoCapitalize="none" />
            <Campo rotulo="Endereço" value={loja.endereco} onChangeText={(t) => alterar('endereco', t)} placeholder="Rua, número, complemento e bairro" />
            <View style={s.linha}>
              <Campo style={{ flex: 1.6 }} rotulo="Cidade" value={loja.cidade} onChangeText={(t) => alterar('cidade', t)} placeholder="Rio de Janeiro" />
              <Campo style={{ flex: 1 }} rotulo="UF" value={loja.estado} onChangeText={(t) => alterar('estado', t.toUpperCase().slice(0, 2))} placeholder="RJ" autoCapitalize="characters" />
            </View>
            <Botao rotulo={salvando ? 'Salvando...' : 'Salvar dados do ateliê'} aoTocar={() => salvarLoja()} desativado={salvando} />
          </>
        )}

        {painel === 'pix' && (
          <>
            <Campo rotulo="Chave Pix" value={loja.chavePix} onChangeText={(t) => alterar('chavePix', t)} placeholder="CPF, CNPJ, e-mail, telefone ou chave aleatória" autoCapitalize="none" />
            <View style={s.dicaVerde}>
              <T style={[s.sub, { color: cor.verde, lineHeight: 18 }]}>Vai junto no comprovante que você manda pelo WhatsApp, para o cliente pagar na hora.</T>
            </View>
            <Botao rotulo={salvando ? 'Salvando...' : 'Salvar chave Pix'} aoTocar={() => salvarLoja(true)} desativado={salvando} />
          </>
        )}

        {painel === 'comissao' && (
          <>
            <View style={s.linha}>
              {(
                [
                  ['porcentagem', '% do vendido', 'Ex: 15% de cada venda'],
                  ['valor_fixo', 'R$ por produto', 'Ex: R$ 3,50 por unidade'],
                ] as const
              ).map(([id, rotulo, sub]) => {
                const on = comissaoTipo === id;
                return (
                  <TouchableOpacity
                    key={id}
                    style={[s.tipo, on && s.tipoOn]}
                    onPress={() => {
                      if (!on) setComissaoValor('');
                      setComissaoTipo(id);
                      setErro(null);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}>
                    <T style={s.itemTitulo}>{rotulo}</T>
                    <T style={s.sub}>{sub}</T>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={s.valor}>
              {comissaoTipo === 'valor_fixo' && <T style={s.afixo}>R$</T>}
              <TextInput
                value={comissaoValor}
                onChangeText={(t) => setComissaoValor(comissaoTipo === 'valor_fixo' ? mascaraDinheiro(t) : t.replace(/[^\d,]/g, ''))}
                placeholder={comissaoTipo === 'valor_fixo' ? '0,00' : '15'}
                placeholderTextColor="#9A8F87"
                keyboardType="decimal-pad"
                style={s.valorInput}
                accessibilityLabel="Comissão padrão"
              />
              {comissaoTipo === 'porcentagem' && <T style={s.afixo}>%</T>}
            </View>
            <T style={s.sub}>Aparece como exemplo (em cinza) no cadastro de uma revendedora nova. Ela não vem preenchida: você digita a comissão de cada uma.</T>
            <Botao rotulo="Salvar regra padrão" aoTocar={salvarComissao} />
          </>
        )}

        {painel === 'conta' && (
          <>
            <Campo rotulo="Nome" value={nome} onChangeText={(t) => { setNome(t); setErro(null); }} placeholder="Seu nome" />
            <Campo rotulo="E-mail de acesso" value={email} onChangeText={(t) => { setEmail(t); setErro(null); }} keyboardType="email-address" autoCapitalize="none" placeholder="voce@email.com" />
            <T style={s.sub}>É com este e-mail que você entra no sistema.</T>
            <Botao rotulo={salvando ? 'Salvando...' : 'Salvar meus dados'} aoTocar={salvarConta} desativado={salvando} />
          </>
        )}

        {painel === 'senha' && (
          <>
            <Campo rotulo="Senha atual" value={senhaAtual} onChangeText={(t) => { setSenhaAtual(t); setErro(null); }} secureTextEntry placeholder="Digite sua senha atual" />
            <Campo rotulo="Nova senha" value={novaSenha} onChangeText={(t) => { setNovaSenha(t); setErro(null); }} secureTextEntry placeholder="Crie uma nova senha" />
            <View style={{ gap: 4 }}>
              {REGRAS_SENHA.map((r) => {
                const ok = r.teste(novaSenha);
                return (
                  <T key={r.label} style={[s.sub, { fontWeight: '700', color: ok ? cor.verde : '#9A8F87' }]}>
                    {ok ? '✓' : '○'} {r.label}
                  </T>
                );
              })}
            </View>
            <Campo rotulo="Confirmar nova senha" value={confirmar} onChangeText={(t) => { setConfirmar(t); setErro(null); }} secureTextEntry placeholder="Repita a nova senha" />
            <Botao rotulo={salvando ? 'Salvando...' : 'Trocar senha'} aoTocar={salvarSenha} desativado={salvando} />
          </>
        )}

        {painel === 'sair' && (
          <View style={s.linha}>
            <Botao rotulo="Voltar" variante="secundario" aoTocar={() => setPainel(null)} style={{ flex: 1 }} />
            <Botao rotulo="Sair" variante="perigo" aoTocar={sair} style={{ flex: 1.3 }} />
          </View>
        )}
      </Gaveta>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6 },
  voltar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFDFA', alignItems: 'center', justifyContent: 'center' },
  titulo: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  conteudo: { padding: 16, paddingBottom: 120, gap: 18 },
  atelie: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 24, backgroundColor: '#FFFDFA' },
  logo: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoVazio: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: cor.apagado, backgroundColor: cor.fundo, gap: 2 },
  logoTexto: { fontSize: 22, fontWeight: '700', color: cor.carameloEscuro },
  atelieNome: { fontSize: 18, fontWeight: '700' },
  sub: { fontSize: 12, color: cor.textoSuave },
  link: { fontSize: 13, fontWeight: '800', color: cor.mirtilo },
  grupoTitulo: { paddingHorizontal: 6, fontSize: 13, fontWeight: '800', color: cor.textoSuave },
  cartao: { borderRadius: 22, backgroundColor: '#FFFDFA', overflow: 'hidden' },
  item: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  itemBorda: { borderTopWidth: 1, borderTopColor: cor.bordaSuave },
  itemIcone: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  itemTitulo: { fontSize: 15, fontWeight: '700' },
  sair: { minHeight: 56, borderRadius: 22, backgroundColor: '#FFFDFA', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  sairTexto: { fontSize: 15, fontWeight: '800', color: cor.vermelho },
  versao: { textAlign: 'center', fontSize: 11, color: '#9A8F87' },
  erro: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: cor.vermelhoClaro },
  erroTexto: { flex: 1, fontSize: 13, fontWeight: '700', color: cor.vermelho },
  rotulo: { fontSize: 13, fontWeight: '700', color: cor.textoMedio },
  input: { height: 50, borderRadius: 14, borderWidth: 1, borderColor: cor.borda, backgroundColor: '#FFFDFA', paddingHorizontal: 14, fontSize: 15, color: cor.texto, fontFamily: fonte.texto, ...campoWeb },
  linha: { flexDirection: 'row', gap: 10 },
  dicaVerde: { padding: 12, borderRadius: 14, backgroundColor: cor.verdeClaro },
  tipo: { flex: 1, minHeight: 60, padding: 12, borderRadius: 16, borderWidth: 1.5, borderColor: cor.borda, gap: 2 },
  tipoOn: { borderColor: cor.mirtilo, backgroundColor: cor.mirtiloClaro },
  valor: { height: 56, borderRadius: 14, borderWidth: 1, borderColor: cor.borda, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14 },
  afixo: { fontSize: 16, fontWeight: '800', color: cor.textoSuave },
  valorInput: { flex: 1, minWidth: 0, fontSize: 20, fontWeight: '700', color: cor.texto, fontFamily: fonte.texto, ...campoWeb },
});

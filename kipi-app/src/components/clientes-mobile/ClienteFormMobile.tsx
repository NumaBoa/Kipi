import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, type ScrollViewInstance, type TextInputProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useRevenda } from '@/lib/revenda';
import {
  formatarCep,
  formatarCpfCnpj,
  formatarData,
  formatarTelefone,
  type ClienteCadastrado,
} from '@/components/ClienteFormModal';
import { cor, fonte } from '@/components/mobile/tema';
import { Botao, Opcao, T } from '@/components/mobile/ui';

// ============================================================================
// CADASTRO / EDIÇÃO DE CLIENTE NO CELULAR (tela inteira)
// Mesmas regras do ClienteFormModal: nome e WhatsApp obrigatórios, CPF 11 ou CNPJ 14
// dígitos, endereço pelo CEP (ViaCEP), origem direto ou de revendedora.
// ============================================================================


function Campo({ rotulo, style, ...props }: TextInputProps & { rotulo: string }) {
  const [foco, setFoco] = useState(false);
  return (
    <View style={[{ gap: 6 }, style]}>
      <T style={s.rotulo}>{rotulo}</T>
      <TextInput
        placeholderTextColor="#94A3B8"
        {...props}
        onFocus={(e) => {
          setFoco(true);
          props.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFoco(false);
          props.onBlur?.(e);
        }}
        style={[s.input, foco && s.inputFoco, props.multiline && s.textarea]}
      />
    </View>
  );
}

export default function ClienteFormMobile({
  visible,
  onClose,
  onSalvo,
  clienteInicial,
  revendedoraFixa,
}: {
  visible: boolean;
  onClose: () => void;
  onSalvo: (cliente: ClienteCadastrado) => void;
  clienteInicial?: ClienteCadastrado | null;
  revendedoraFixa?: string | null;
}) {
  const insets = useSafeAreaInsets();
  const editando = !!clienteInicial;
  const { revendedoras } = useRevenda();
  const rolagem = useRef<ScrollViewInstance>(null);

  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [aniversario, setAniversario] = useState('');
  const [doc, setDoc] = useState('');
  const [email, setEmail] = useState('');
  const [preferencias, setPreferencias] = useState('');
  const [tag, setTag] = useState('');
  const [revendedoraId, setRevendedoraId] = useState<string | null>(null);
  const [mostrarEndereco, setMostrarEndereco] = useState(false);
  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepOk, setCepOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Ao abrir: preenche com o cliente em edição ou começa limpo
  useEffect(() => {
    if (!visible) return;
    const c = clienteInicial;
    setNome(c?.nome || '');
    setTelefone(c?.telefone || '');
    setAniversario(c?.aniversario || '');
    setDoc(c?.cpfCnpj || '');
    setEmail(c?.email || '');
    setPreferencias(c?.observacoes || '');
    setTag(c?.tag || '');
    setRevendedoraId(revendedoraFixa ?? c?.revendedoraId ?? null);
    setCep(c?.cep || '');
    setRua(c?.rua || '');
    setNumero(c?.numero || '');
    setComplemento(c?.complemento || '');
    setBairro(c?.bairro || '');
    setCidade(c?.cidade || '');
    setEstado(c?.estado || '');
    setMostrarEndereco(!!(c?.cep || c?.rua || c?.bairro || c?.cidade));
    setCepOk(false);
    setErro(null);
  }, [visible, clienteInicial, revendedoraFixa]);

  const alterarCep = async (valor: string) => {
    const formatado = formatarCep(valor);
    setCep(formatado);
    setCepOk(false);
    const digitos = formatado.replace(/\D/g, '');
    if (digitos.length !== 8) return;
    setBuscandoCep(true);
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      const dados = await resposta.json();
      if (dados.erro) {
        setErro('CEP não encontrado. Preencha o endereço manualmente.');
      } else {
        setRua(dados.logradouro || '');
        setBairro(dados.bairro || '');
        setCidade(dados.localidade || '');
        setEstado(dados.uf || '');
        setCepOk(true);
        setErro(null);
      }
    } catch {
      setErro('Não foi possível buscar o CEP agora. Preencha o endereço manualmente.');
    } finally {
      setBuscandoCep(false);
    }
  };

  const falhar = (msg: string) => {
    setErro(msg);
    rolagem.current?.scrollTo({ y: 0, animated: true });
  };

  const salvar = () => {
    const nomeLimpo = nome.trim();
    const telLimpo = telefone.trim();
    const docDigitos = doc.replace(/\D/g, '');
    if (!nomeLimpo) return falhar('Informe o nome do cliente.');
    if (!telLimpo || telLimpo.length < 10) return falhar('Informe um WhatsApp válido, com DDD.');
    if (docDigitos && docDigitos.length !== 11 && docDigitos.length !== 14) return falhar('CPF deve ter 11 dígitos e CNPJ 14 (ou deixe em branco).');
    setErro(null);
    const revendedora = revendedoras.find((r) => r.id === revendedoraId) || null;
    onSalvo({
      id: clienteInicial?.id || `cli_${Date.now()}`,
      nome: nomeLimpo,
      telefone: telLimpo,
      tag: tag.trim(),
      cpfCnpj: doc.trim() || null,
      cep: cep.trim() || null,
      rua: rua.trim() || null,
      numero: numero.trim() || null,
      complemento: complemento.trim() || null,
      bairro: bairro.trim() || null,
      cidade: cidade.trim() || null,
      estado: estado.trim().toUpperCase() || null,
      aniversario: aniversario.trim() || null,
      email: email.trim() || null,
      observacoes: preferencias.trim() || null,
      revendedoraId: revendedora?.id || null,
      revendedoraNome: revendedora?.nome || null,
    });
  };

  const origens: { id: string | null; nome: string }[] = [
    { id: null, nome: 'Cliente direto (ateliê)' },
    ...revendedoras.map((r) => ({ id: r.id, nome: `Cliente de ${r.nome.split(' ')[0]}` })),
  ];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <SafeAreaView style={s.tela} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.topo}>
            <View style={{ flex: 1, gap: 1 }}>
              <T titulo style={s.titulo}>{editando ? 'Editar cliente' : 'Novo cliente'}</T>
              <T style={s.sub}>Só nome e WhatsApp são obrigatórios</T>
            </View>
            <TouchableOpacity onPress={onClose} style={s.fechar} accessibilityRole="button" accessibilityLabel="Fechar">
              <Feather name="x" size={18} color={cor.textoMedio} />
            </TouchableOpacity>
          </View>

          <ScrollView ref={rolagem} contentContainerStyle={s.conteudo} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {!!erro && (
              <View style={s.erro} accessibilityRole="alert">
                <Feather name="alert-circle" size={16} color={cor.vermelho} />
                <T style={s.erroTexto}>{erro}</T>
              </View>
            )}

            <View style={s.bloco}>
              <Campo rotulo="Nome *" value={nome} onChangeText={setNome} placeholder="Ex: Mariana Albuquerque" autoCapitalize="words" />
              <View style={s.linha}>
                <Campo style={{ flex: 1.25 }} rotulo="WhatsApp *" value={telefone} onChangeText={(t) => setTelefone(formatarTelefone(t))} placeholder="(21) 98844-3321" keyboardType="phone-pad" />
                <Campo style={{ flex: 1 }} rotulo="Tag" value={tag} onChangeText={setTag} placeholder="Ex: Vizinha" />
              </View>
              <View style={s.linha}>
                <Campo style={{ flex: 1 }} rotulo="Aniversário" value={aniversario} onChangeText={(t) => setAniversario(formatarData(t))} placeholder="DD/MM/AAAA" keyboardType="numeric" />
                <Campo style={{ flex: 1 }} rotulo="CPF / CNPJ" value={doc} onChangeText={(t) => setDoc(formatarCpfCnpj(t))} placeholder="Opcional" keyboardType="numeric" />
              </View>
              <Campo rotulo="E-mail" value={email} onChangeText={setEmail} placeholder="exemplo@gmail.com" keyboardType="email-address" autoCapitalize="none" />
            </View>

            <View style={[s.bloco, { gap: 6 }]}>
              <Campo
                rotulo="Preferências e restrições"
                value={preferencias}
                onChangeText={setPreferencias}
                placeholder="Alergias, intolerâncias, sabores favoritos, cor da fita…"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              <T style={s.dica}>Aparece em destaque na ficha do cliente.</T>
            </View>

            {/* ORIGEM: só a dona escolhe (a revendedora cadastra sempre cliente dela) */}
            {!revendedoraFixa && (
              <View style={[s.bloco, { gap: 10 }]}>
                <T style={s.rotulo}>De quem é a cliente?</T>
                <View style={s.chips}>
                  {origens.map((o) => (
                    <Opcao key={o.id ?? 'direto'} rotulo={o.nome} ativo={revendedoraId === o.id} aoTocar={() => setRevendedoraId(o.id)} style={s.chip} textoStyle={s.chipTexto} />
                  ))}
                </View>
              </View>
            )}

            {!mostrarEndereco ? (
              <TouchableOpacity style={s.addEndereco} onPress={() => setMostrarEndereco(true)} activeOpacity={0.85} accessibilityRole="button">
                <Feather name="map-pin" size={16} color={cor.azulTexto} />
                <T style={s.addEnderecoTexto}>Adicionar endereço de entrega</T>
              </TouchableOpacity>
            ) : (
              <View style={s.bloco}>
                <View style={s.enderecoTopo}>
                  <T style={s.enderecoTitulo}>Endereço de entrega</T>
                  <TouchableOpacity onPress={() => setMostrarEndereco(false)} accessibilityRole="button" style={{ minHeight: 32, justifyContent: 'center' }}>
                    <T style={s.ocultar}>Ocultar</T>
                  </TouchableOpacity>
                </View>
                <View style={{ gap: 4 }}>
                  <Campo rotulo="CEP" value={cep} onChangeText={alterarCep} placeholder="00000-000" keyboardType="numeric" />
                  {buscandoCep && (
                    <View style={s.cepInfo}>
                      <ActivityIndicator size="small" color={cor.azulBotao} />
                      <T style={s.dica}>Buscando endereço…</T>
                    </View>
                  )}
                  {cepOk && !buscandoCep && <T style={s.cepOk}>✓ Endereço preenchido pelo CEP</T>}
                </View>
                <Campo rotulo="Rua" value={rua} onChangeText={setRua} placeholder="Ex: Rua Barata Ribeiro" />
                <View style={s.linha}>
                  <Campo style={{ flex: 1 }} rotulo="Número" value={numero} onChangeText={setNumero} placeholder="450" keyboardType="numeric" />
                  <Campo style={{ flex: 1.6 }} rotulo="Complemento" value={complemento} onChangeText={setComplemento} placeholder="Apto, bloco…" />
                </View>
                <Campo rotulo="Bairro" value={bairro} onChangeText={setBairro} placeholder="Copacabana" />
                <View style={s.linha}>
                  <Campo style={{ flex: 1.6 }} rotulo="Cidade" value={cidade} onChangeText={setCidade} placeholder="Rio de Janeiro" />
                  <Campo style={{ flex: 1 }} rotulo="UF" value={estado} onChangeText={(t) => setEstado(t.replace(/[^a-zA-Z]/g, '').toUpperCase())} placeholder="RJ" maxLength={2} autoCapitalize="characters" />
                </View>
              </View>
            )}
          </ScrollView>

          <View style={[s.rodape, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
            <Botao rotulo={editando ? 'Salvar alterações' : 'Cadastrar cliente'} aoTocar={salvar} altura={54} />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 20, paddingRight: 12, paddingTop: 8, paddingBottom: 6 },
  titulo: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  sub: { fontSize: 12, color: cor.textoSuave },
  fechar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  conteudo: { padding: 16, paddingTop: 8, gap: 12, paddingBottom: 32 },
  erro: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: cor.vermelhoClaro },
  erroTexto: { flex: 1, fontSize: 13, fontWeight: '700', color: cor.vermelho },
  bloco: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 16, gap: 14 },
  linha: { flexDirection: 'row', gap: 10 },
  rotulo: { fontSize: 13, fontWeight: '700', color: cor.textoMedio },
  input: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: cor.borda,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    fontSize: 15,
    color: cor.texto,
    fontFamily: fonte.texto,
    ...Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }),
  },
  inputFoco: { borderColor: cor.azulBotao },
  textarea: { height: 96, paddingTop: 12 },
  dica: { fontSize: 12, color: cor.textoSuave },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { height: 38, paddingHorizontal: 14, borderRadius: 19, flexGrow: 0 },
  chipTexto: { fontSize: 13 },
  addEndereco: {
    minHeight: 56,
    borderRadius: 22,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#9CC3E8',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addEnderecoTexto: { fontSize: 14, fontWeight: '800', color: cor.azulTexto },
  enderecoTopo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  enderecoTitulo: { fontSize: 13, fontWeight: '800' },
  ocultar: { fontSize: 13, fontWeight: '800', color: cor.textoSuave },
  cepInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cepOk: { fontSize: 12, fontWeight: '700', color: cor.verde },
  rodape: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: cor.borda },
});

import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, type ScrollViewInstance, type TextInputProps } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { salvarRevendedora, type Revendedora, type TipoComissao } from '@/lib/revenda';
import { SENHA_PADRAO_REVENDEDORA } from '@/lib/acesso';
import { formatarCep, formatarTelefone } from '@/components/ClienteFormModal';
import { cor, fonte } from '@/components/mobile/tema';
import { Botao, T } from '@/components/mobile/ui';
import { dinheiroParaCampo, lerDinheiro, mascaraDinheiro } from '@/lib/dinheiro';

// ============================================================================
// CADASTRO / EDIÇÃO DE REVENDEDORA NO CELULAR — mesmas validações do computador.
// Comissão e observações nunca vêm preenchidas no cadastro novo.
// ============================================================================

const formatarCpf = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
};
const formatarDecimal = (v: string) => {
  const limpo = v.replace(/[^\d,]/g, '');
  const [inteiro, ...resto] = limpo.split(',');
  return resto.length === 0 ? inteiro : `${inteiro},${resto.join('').slice(0, 2)}`;
};
const emailValido = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
const cpfValido = (cpf: string) => {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (base: string, peso: number) => {
    const soma = base.split('').reduce((acc, n, i) => acc + Number(n) * (peso - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(d.slice(0, 9), 10) === Number(d[9]) && digito(d.slice(0, 10), 11) === Number(d[10]);
};
const campoWeb = Platform.select({ web: { outlineStyle: 'none' } as object, default: {} });

function Campo({ rotulo, style, ...props }: TextInputProps & { rotulo: string }) {
  return (
    <View style={[{ gap: 6 }, style]}>
      <T style={s.rotulo}>{rotulo}</T>
      <TextInput placeholderTextColor="#9A8F87" {...props} style={s.input} />
    </View>
  );
}

export default function RevendedoraFormMobile({
  visivel,
  revendedora,
  aoFechar,
  aoSalvo,
}: {
  visivel: boolean;
  revendedora: Revendedora | null; // null = cadastro novo
  aoFechar: () => void;
  aoSalvo: (msg: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const rolagem = useRef<ScrollViewInstance>(null);
  const editando = !!revendedora;
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [tag, setTag] = useState('');
  const [cpf, setCpf] = useState('');
  const [email, setEmail] = useState('');
  const [tipo, setTipo] = useState<TipoComissao>('porcentagem');
  const [valor, setValor] = useState('');
  const [mostrarEndereco, setMostrarEndereco] = useState(false);
  const [cep, setCep] = useState('');
  const [rua, setRua] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [obs, setObs] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!visivel) return;
    const r = revendedora;
    setNome(r?.nome ?? '');
    setTelefone(r?.telefone ?? '');
    setTag(r?.tag ?? '');
    setCpf(r?.cpf ?? '');
    setEmail(r?.email ?? '');
    setTipo(r?.tipoComissao ?? 'porcentagem');
    setValor(!r ? '' : r.tipoComissao === 'valor_fixo' ? dinheiroParaCampo(r.valorComissao) : String(r.valorComissao).replace('.', ','));
    setCep(r?.cep ?? '');
    setRua(r?.rua ?? '');
    setNumero(r?.numero ?? '');
    setComplemento(r?.complemento ?? '');
    setBairro(r?.bairro ?? '');
    setCidade(r?.cidade ?? '');
    setEstado(r?.estado ?? '');
    setMostrarEndereco(!!(r?.cep || r?.rua || r?.bairro || r?.cidade));
    setObs(r?.observacoes ?? '');
    setErro(null);
  }, [visivel, revendedora]);

  const falhar = (m: string) => {
    setErro(m);
    rolagem.current?.scrollTo({ y: 0, animated: true });
  };

  const salvar = () => {
    const valorNum = tipo === 'valor_fixo' ? lerDinheiro(valor) : parseFloat(valor.replace(',', '.'));
    if (!nome.trim()) return falhar('Informe o nome da revendedora.');
    if (telefone.replace(/\D/g, '').length < 10) return falhar('Informe um WhatsApp válido com DDD.');
    if (email.trim() && !emailValido(email.trim())) return falhar('O e-mail informado não é válido. Ex: nome@gmail.com');
    if (cpf.trim() && !cpfValido(cpf)) return falhar('O CPF informado não é válido. Confira os números.');
    if (isNaN(valorNum) || valorNum <= 0) return falhar('Informe o valor da comissão.');
    if (tipo === 'porcentagem' && valorNum > 100) return falhar('A comissão em porcentagem não pode passar de 100%.');
    const r: Revendedora = {
      ...(revendedora ?? {}),
      id: revendedora?.id || `rev_${Date.now()}`,
      nome: nome.trim(),
      telefone: telefone.trim(),
      email: email.trim() || null,
      cpf: cpf.trim() || null,
      tag: tag.trim() || null,
      tipoComissao: tipo,
      valorComissao: valorNum,
      cep: cep.trim() || null,
      rua: rua.trim() || null,
      numero: numero.trim() || null,
      complemento: complemento.trim() || null,
      bairro: bairro.trim() || null,
      cidade: cidade.trim() || null,
      estado: estado.trim().toUpperCase() || null,
      observacoes: obs.trim() || null,
    };
    salvarRevendedora(r);
    aoSalvo(editando ? `Dados de ${r.nome} atualizados!` : `Revendedora ${r.nome} cadastrada!`);
  };

  const comAcesso = emailValido(email.trim());

  return (
    <Modal visible={visivel} animationType="slide" onRequestClose={aoFechar} statusBarTranslucent>
      <SafeAreaView style={s.tela} edges={['top']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={s.topo}>
            <View style={{ flex: 1, gap: 1 }}>
              <T titulo style={s.titulo}>{editando ? 'Editar revendedora' : 'Nova revendedora'}</T>
              <T style={s.sub}>Nome, WhatsApp e comissão são obrigatórios</T>
            </View>
            <TouchableOpacity onPress={aoFechar} style={s.fechar} accessibilityRole="button" accessibilityLabel="Fechar">
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
              <Campo rotulo="Nome completo *" value={nome} onChangeText={setNome} placeholder="Ex: Juliana Martins Costa" autoCapitalize="words" />
              <View style={s.linha}>
                <Campo style={{ flex: 1.25 }} rotulo="WhatsApp *" value={telefone} onChangeText={(t) => setTelefone(formatarTelefone(t))} placeholder="(21) 99999-9999" keyboardType="phone-pad" />
                <Campo style={{ flex: 1 }} rotulo="Tag" value={tag} onChangeText={setTag} placeholder="Ex: Consignado" />
              </View>
              <Campo rotulo="CPF" value={cpf} onChangeText={(t) => setCpf(formatarCpf(t))} placeholder="000.000.000-00" keyboardType="numeric" />
            </View>

            <View style={[s.bloco, { gap: 10 }]}>
              <Campo rotulo="E-mail de acesso" value={email} onChangeText={(t) => setEmail(t.replace(/\s/g, '').toLowerCase())} placeholder="nome@gmail.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
              <View style={[s.aviso, { backgroundColor: comAcesso ? cor.verdeClaro : cor.ambarFundo }]}>
                <T style={[s.avisoTexto, { color: comAcesso ? cor.verde : cor.ambarTexto }]}>
                  🔑 {comAcesso ? `Ela entra no app com este e-mail · senha inicial ${SENHA_PADRAO_REVENDEDORA}` : `Sem e-mail ela não tem acesso ao app. Com e-mail, entra com a senha inicial ${SENHA_PADRAO_REVENDEDORA}.`}
                </T>
              </View>
            </View>

            <View style={[s.bloco, { gap: 10 }]}>
              <T style={s.rotulo}>Comissão *</T>
              <View style={s.linha}>
                {([
                  ['porcentagem', '% do vendido', 'Ex: 15% de cada venda'],
                  ['valor_fixo', 'R$ por produto', 'Ex: R$ 3,50 por unidade'],
                ] as const).map(([id, rot, sub]) => {
                  const on = tipo === id;
                  return (
                    <TouchableOpacity key={id} style={[s.tipo, on && s.tipoOn]} onPress={() => {
                      if (id !== tipo) setValor('');
                      setTipo(id);
                    }} accessibilityRole="radio" accessibilityState={{ selected: on }}>
                      <T style={s.tipoTitulo}>{rot}</T>
                      <T style={s.dica}>{sub}</T>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={s.valorCaixa}>
                {tipo === 'valor_fixo' && <T style={s.afixo}>R$</T>}
                <TextInput
                  value={valor}
                  onChangeText={(t) => setValor(tipo === 'valor_fixo' ? mascaraDinheiro(t) : formatarDecimal(t))}
                  placeholder={tipo === 'porcentagem' ? 'Ex: 15' : 'Ex: 3,50'}
                  placeholderTextColor="#9A8F87"
                  keyboardType="decimal-pad"
                  style={s.valorInput}
                  accessibilityLabel="Valor da comissão"
                />
                {tipo === 'porcentagem' && <T style={s.afixo}>%</T>}
              </View>
              <T style={s.dica}>{tipo === 'porcentagem' ? 'Ex: 15% → numa venda de R$ 100,00 ela recebe R$ 15,00.' : 'Ex: R$ 3,50 → a cada produto vendido ela recebe R$ 3,50.'}</T>
            </View>

            {!mostrarEndereco ? (
              <TouchableOpacity style={s.addEndereco} onPress={() => setMostrarEndereco(true)} accessibilityRole="button">
                <Feather name="map-pin" size={16} color={cor.azulTexto} />
                <T style={s.addEnderecoTexto}>Adicionar endereço</T>
              </TouchableOpacity>
            ) : (
              <View style={s.bloco}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <T style={[s.rotulo, { color: cor.texto }]}>Endereço</T>
                  <TouchableOpacity onPress={() => setMostrarEndereco(false)} style={{ minHeight: 32, justifyContent: 'center' }} accessibilityRole="button">
                    <T style={[s.rotulo, { color: cor.textoSuave }]}>Ocultar</T>
                  </TouchableOpacity>
                </View>
                <View style={s.linha}>
                  <Campo style={{ flex: 1 }} rotulo="CEP" value={cep} onChangeText={(t) => setCep(formatarCep(t))} placeholder="00000-000" keyboardType="numeric" />
                  <Campo style={{ flex: 0.7 }} rotulo="Número" value={numero} onChangeText={setNumero} placeholder="84" />
                </View>
                <Campo rotulo="Rua" value={rua} onChangeText={setRua} placeholder="Ex: Rua General Severiano" />
                <View style={s.linha}>
                  <Campo style={{ flex: 1 }} rotulo="Complemento" value={complemento} onChangeText={setComplemento} placeholder="Apto, bloco…" />
                  <Campo style={{ flex: 1 }} rotulo="Bairro" value={bairro} onChangeText={setBairro} placeholder="Ex: Botafogo" />
                </View>
                <View style={s.linha}>
                  <Campo style={{ flex: 1.6 }} rotulo="Cidade" value={cidade} onChangeText={setCidade} placeholder="Ex: Rio de Janeiro" />
                  <Campo style={{ flex: 1 }} rotulo="UF" value={estado} onChangeText={(t) => setEstado(t.replace(/[^a-zA-Z]/g, '').toUpperCase())} placeholder="RJ" maxLength={2} autoCapitalize="characters" />
                </View>
              </View>
            )}

            <View style={s.bloco}>
              <View style={{ gap: 6 }}>
                <T style={s.rotulo}>Observações</T>
                <TextInput value={obs} onChangeText={setObs} placeholder="Opcional" placeholderTextColor="#9A8F87" multiline numberOfLines={3} textAlignVertical="top" style={[s.input, { height: 90, paddingTop: 12 }]} />
              </View>
            </View>
          </ScrollView>

          <View style={[s.rodape, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
            <Botao rotulo={editando ? 'Salvar alterações' : 'Cadastrar revendedora'} aoTocar={salvar} altura={54} />
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
  fechar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFDFA', alignItems: 'center', justifyContent: 'center' },
  conteudo: { padding: 16, paddingTop: 8, gap: 12, paddingBottom: 32 },
  erro: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: cor.vermelhoClaro },
  erroTexto: { flex: 1, fontSize: 13, fontWeight: '700', color: cor.vermelho },
  bloco: { backgroundColor: '#FFFDFA', borderRadius: 22, padding: 16, gap: 14 },
  linha: { flexDirection: 'row', gap: 10 },
  rotulo: { fontSize: 13, fontWeight: '700', color: cor.textoMedio },
  dica: { fontSize: 12, color: cor.textoSuave },
  input: { height: 50, borderRadius: 14, borderWidth: 1, borderColor: cor.borda, backgroundColor: '#FFFDFA', paddingHorizontal: 14, fontSize: 15, color: cor.texto, fontFamily: fonte.texto, ...campoWeb },
  aviso: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12 },
  avisoTexto: { fontSize: 12, fontWeight: '600' },
  tipo: { flex: 1, minHeight: 58, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1.5, borderColor: cor.borda, gap: 1, justifyContent: 'center' },
  tipoOn: { borderColor: cor.azulBotao, backgroundColor: cor.azulClaro },
  tipoTitulo: { fontSize: 14, fontWeight: '800' },
  valorCaixa: { height: 54, borderRadius: 14, borderWidth: 1, borderColor: cor.borda, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14 },
  afixo: { fontSize: 16, fontWeight: '800', color: cor.textoSuave },
  valorInput: { flex: 1, minWidth: 0, fontSize: 20, fontWeight: '800', color: cor.texto, fontFamily: fonte.texto, padding: 0, ...campoWeb },
  addEndereco: { minHeight: 56, borderRadius: 22, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#D6D7F3', backgroundColor: '#FFFDFA', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  addEnderecoTexto: { fontSize: 14, fontWeight: '800', color: cor.azulTexto },
  rodape: { paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFFDFA', borderTopWidth: 1, borderTopColor: cor.borda },
});

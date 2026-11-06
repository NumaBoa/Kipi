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
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRevenda } from '@/lib/revenda';

// ============================================================================
// FORMULÁRIO DE CADASTRO DE CLIENTE (USADO EM CLIENTES E NO NOVO PEDIDO)
// ============================================================================
const FONT_DISPLAY = Platform.select({ web: '"Sora", ui-sans-serif, system-ui, sans-serif', default: 'System' });
const FONT_SANS = Platform.select({ web: '"Manrope", ui-sans-serif, system-ui, sans-serif', default: 'System' });

const ATELIE_GREEN = '#2D7A58';
const ATELIE_TINT = '#EAF5F1';

export interface ClienteCadastrado {
  id: string;
  nome: string;
  telefone: string;
  tag: string;
  cpfCnpj: string | null;
  cep: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  aniversario: string | null;
  email: string | null;
  observacoes: string | null;
  revendedoraId: string | null; // null = cliente direto do ateliê
  revendedoraNome: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onSalvo: (cliente: ClienteCadastrado) => void;
  clienteInicial?: ClienteCadastrado | null; // preenchido = modo edição
  revendedoraFixa?: string | null; // tela da revendedora: o cliente é sempre dela
}

// MÁSCARAS
export const formatarTelefone = (valor: string) => {
  const limpo = valor.replace(/\D/g, '').slice(0, 11);
  if (limpo.length <= 2) return limpo;
  if (limpo.length <= 6) return `(${limpo.slice(0, 2)}) ${limpo.slice(2)}`;
  if (limpo.length <= 10) return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 6)}-${limpo.slice(6)}`;
  return `(${limpo.slice(0, 2)}) ${limpo.slice(2, 7)}-${limpo.slice(7)}`;
};

export const formatarCep = (valor: string) => {
  const limpo = valor.replace(/\D/g, '').slice(0, 8);
  if (limpo.length <= 5) return limpo;
  return `${limpo.slice(0, 5)}-${limpo.slice(5)}`;
};

export const formatarData = (valor: string) => {
  const limpo = valor.replace(/\D/g, '').slice(0, 8);
  if (limpo.length <= 2) return limpo;
  if (limpo.length <= 4) return `${limpo.slice(0, 2)}/${limpo.slice(2)}`;
  return `${limpo.slice(0, 2)}/${limpo.slice(2, 4)}/${limpo.slice(4)}`;
};

// CPF até 11 dígitos, CNPJ a partir do 12º
export const formatarCpfCnpj = (valor: string) => {
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

export default function ClienteFormModal({ visible, onClose, onSalvo, clienteInicial, revendedoraFixa }: Props) {
  const editando = !!clienteInicial;
  // Revendedoras cadastradas em Acessos (lista compartilhada)
  const { revendedoras } = useRevenda();
  const [formNome, setFormNome] = useState('');
  const [formTelefone, setFormTelefone] = useState('');
  const [formTag, setFormTag] = useState('');
  const [formCpfCnpj, setFormCpfCnpj] = useState('');
  const [formCep, setFormCep] = useState('');
  const [formRua, setFormRua] = useState('');
  const [formNumero, setFormNumero] = useState('');
  const [formComplemento, setFormComplemento] = useState('');
  const [formBairro, setFormBairro] = useState('');
  const [formCidade, setFormCidade] = useState('');
  const [formEstado, setFormEstado] = useState('');
  const [formDataNascimento, setFormDataNascimento] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPreferencias, setFormPreferencias] = useState('');
  const [formRevendedoraId, setFormRevendedoraId] = useState<string | null>(null);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [mostrarEndereco, setMostrarEndereco] = useState(false);
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  // Ao abrir: preenche com o cliente em edição ou começa limpo
  useEffect(() => {
    if (visible) {
      const c = clienteInicial;
      setFormNome(c?.nome || '');
      setFormTelefone(c?.telefone || '');
      setFormTag(c?.tag || ''); // cliente novo começa sem tag
      setFormCpfCnpj(c?.cpfCnpj || '');
      setFormCep(c?.cep || '');
      setFormRua(c?.rua || '');
      setFormNumero(c?.numero || '');
      setFormComplemento(c?.complemento || '');
      setFormBairro(c?.bairro || '');
      setFormCidade(c?.cidade || '');
      setFormEstado(c?.estado || '');
      setFormDataNascimento(c?.aniversario || '');
      setFormEmail(c?.email || '');
      setFormPreferencias(c?.observacoes || '');
      setFormRevendedoraId(revendedoraFixa ?? c?.revendedoraId ?? null);
      setErroForm(null);
      setMostrarEndereco(!!(c?.cep || c?.rua || c?.bairro || c?.cidade));
    }
  }, [visible, clienteInicial, revendedoraFixa]);

  // Busca o endereço pelo CEP (ViaCEP) quando os 8 dígitos são digitados
  const alterarCep = async (valor: string) => {
    const cepFormatado = formatarCep(valor);
    setFormCep(cepFormatado);
    const digitos = cepFormatado.replace(/\D/g, '');
    if (digitos.length !== 8) return;

    setBuscandoCep(true);
    try {
      const resposta = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      const dados = await resposta.json();
      if (dados.erro) {
        setErroForm('CEP não encontrado. Preencha o endereço manualmente.');
      } else {
        setFormRua(dados.logradouro || '');
        setFormBairro(dados.bairro || '');
        setFormCidade(dados.localidade || '');
        setFormEstado(dados.uf || '');
        setErroForm(null);
      }
    } catch {
      setErroForm('Não foi possível buscar o CEP agora. Preencha o endereço manualmente.');
    } finally {
      setBuscandoCep(false);
    }
  };

  const handleSalvarCliente = () => {
    const nomeLimpo = formNome.trim();
    const telLimpo = formTelefone.trim();
    const docDigitos = formCpfCnpj.replace(/\D/g, '');

    if (!nomeLimpo) {
      setErroForm('Por favor, informe o nome do cliente.');
      return;
    }
    if (!telLimpo || telLimpo.length < 10) {
      setErroForm('Por favor, informe um telefone/WhatsApp válido.');
      return;
    }
    if (docDigitos && docDigitos.length !== 11 && docDigitos.length !== 14) {
      setErroForm('CPF deve ter 11 dígitos e CNPJ 14 dígitos (ou deixe em branco).');
      return;
    }

    setSalvandoCliente(true);
    setErroForm(null);

    const revendedora = revendedoras.find((r) => r.id === formRevendedoraId) || null;
    const cliente: ClienteCadastrado = {
      id: clienteInicial?.id || `cli_${Date.now()}`,
      nome: nomeLimpo,
      telefone: telLimpo,
      tag: formTag.trim(),
      cpfCnpj: formCpfCnpj.trim() || null,
      cep: formCep.trim() || null,
      rua: formRua.trim() || null,
      numero: formNumero.trim() || null,
      complemento: formComplemento.trim() || null,
      bairro: formBairro.trim() || null,
      cidade: formCidade.trim() || null,
      estado: formEstado.trim().toUpperCase() || null,
      aniversario: formDataNascimento.trim() || null,
      email: formEmail.trim() || null,
      observacoes: formPreferencias.trim() || null,
      revendedoraId: revendedora?.id || null,
      revendedoraNome: revendedora?.nome || null,
    };

    // Fase de testes: só dados de exemplo, nada é gravado no banco
    setSalvandoCliente(false);
    onSalvo(cliente);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalNovoClienteContent}>

          {/* CABEÇALHO DO MODAL */}
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderIconWrap}>
              <Feather name="user-plus" size={20} color={ATELIE_GREEN} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalHeaderSub}>{editando ? 'ATELIÊ · EDITAR CLIENTE' : 'ATELIÊ · NOVO CLIENTE'}</Text>
              <Text style={styles.modalHeaderTitle}>{editando ? 'Editar Cliente' : 'Cadastrar Novo Cliente'}</Text>
              <Text style={styles.modalHeaderDesc}>
                Só nome e WhatsApp são obrigatórios; o resto é opcional.
              </Text>
            </View>
            <TouchableOpacity style={styles.modalCloseCircle} onPress={onClose}>
              <Feather name="x" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* ALERTA DE ERRO */}
          {erroForm && (
            <View style={styles.errorAlertBar}>
              <Feather name="alert-circle" size={14} color="#DC2626" />
              <Text style={styles.errorAlertText}>{erroForm}</Text>
            </View>
          )}

          {/* FORMULÁRIO ROLÁVEL */}
          <ScrollView style={styles.formScroll} contentContainerStyle={styles.formScrollContent}>

            {/* SEÇÃO 1: DADOS BÁSICOS */}
            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>IDENTIFICAÇÃO</Text>

              <View style={styles.formRow}>
                <View style={{ flex: 1.4 }}>
                  <Text style={styles.formLabel}>Nome Completo *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Ex: Mariana Albuquerque"
                    placeholderTextColor="#94A3B8"
                    value={formNome}
                    onChangeText={setFormNome}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Telefone / WhatsApp *</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="(21) 98844-3321"
                    placeholderTextColor="#94A3B8"
                    keyboardType="phone-pad"
                    value={formTelefone}
                    onChangeText={(t) => setFormTelefone(formatarTelefone(t))}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.formLabel}>E-mail</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="exemplo@gmail.com"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    value={formEmail}
                    onChangeText={setFormEmail}
                  />
                </View>

                <View style={{ flex: 0.8 }}>
                  <Text style={styles.formLabel}>Data de Nascimento</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="DD/MM/AAAA"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={formDataNascimento}
                    onChangeText={(t) => setFormDataNascimento(formatarData(t))}
                  />
                </View>

                <View style={{ flex: 0.8 }}>
                  <Text style={styles.formLabel}>Tag / Segmento</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Ex: VIP, Noiva..."
                    placeholderTextColor="#94A3B8"
                    value={formTag}
                    onChangeText={setFormTag}
                  />
                </View>
              </View>

              {/* SUGESTÕES RÁPIDAS DE TAGS */}
              <View style={styles.tagsQuickRow}>
                <Text style={styles.tagsQuickLabel}>Sugestões:</Text>
                {['VIP', 'Noiva', 'Corporativo', 'Festa Infantil', 'Frequente'].map((tg) => (
                  <TouchableOpacity
                    key={tg}
                    style={[styles.tagQuickChip, formTag === tg && styles.tagQuickChipActive]}
                    onPress={() => setFormTag(tg)}>
                    <Text style={[styles.tagQuickChipText, formTag === tg && styles.tagQuickChipTextActive]}>
                      {tg}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 0.8 }}>
                  <Text style={styles.formLabel}>CPF / CNPJ (opcional)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="000.000.000-00"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={formCpfCnpj}
                    onChangeText={(t) => setFormCpfCnpj(formatarCpfCnpj(t))}
                  />
                </View>

                <View style={{ flex: 1.2 }}>
                  <Text style={styles.formLabel}>Origem do cliente</Text>
                  <View style={styles.tagsQuickRow}>
                    {((revendedoraFixa ? [{ id: revendedoraFixa, nome: 'Minha cliente' }] : [{ id: null, nome: 'Cliente direto (ateliê)' }, ...revendedoras.map((r) => ({ id: r.id, nome: `Cliente de ${r.nome.split(' ')[0]}` }))]) as { id: string | null; nome: string }[]).map((op) => {
                      const ativo = formRevendedoraId === op.id;
                      return (
                        <TouchableOpacity
                          key={op.id || 'direto'}
                          style={[styles.tagQuickChip, ativo && styles.tagQuickChipActive]}
                          onPress={() => setFormRevendedoraId(op.id)}>
                          <Text style={[styles.tagQuickChipText, ativo && styles.tagQuickChipTextActive]}>{op.nome}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              </View>
            </View>

            {/* SEÇÃO 2: ENDEREÇO DE ENTREGA (recolhido; abre só se a pessoa quiser cadastrar) */}
            {!mostrarEndereco ? (
              <TouchableOpacity style={styles.btnAddEndereco} onPress={() => setMostrarEndereco(true)} activeOpacity={0.8}>
                <Feather name="map-pin" size={14} color={ATELIE_GREEN} />
                <Text style={styles.btnAddEnderecoText}>Adicionar endereço de entrega</Text>
                <Feather name="chevron-down" size={14} color={ATELIE_GREEN} />
              </TouchableOpacity>
            ) : (
            <View style={styles.formSection}>
              <View style={styles.enderecoTitulo}>
                <Text style={styles.formSectionTitle}>ENDEREÇO DE ENTREGA</Text>
                <TouchableOpacity onPress={() => setMostrarEndereco(false)}>
                  <Text style={styles.enderecoOcultar}>Ocultar</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.formRow}>
                <View style={{ width: 140 }}>
                  <Text style={styles.formLabel}>CEP</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="22040-002"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={formCep}
                    onChangeText={alterarCep}
                  />
                  {buscandoCep && (
                    <View style={styles.cepLoadingRow}>
                      <ActivityIndicator size="small" color={ATELIE_GREEN} />
                      <Text style={styles.cepLoadingText}>Buscando endereço...</Text>
                    </View>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Rua / Logradouro</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Ex: Rua Barata Ribeiro"
                    placeholderTextColor="#94A3B8"
                    value={formRua}
                    onChangeText={setFormRua}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ width: 100 }}>
                  <Text style={styles.formLabel}>Número</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="450"
                    placeholderTextColor="#94A3B8"
                    value={formNumero}
                    onChangeText={setFormNumero}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Complemento / Ap</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Apto 802, Bloco 1..."
                    placeholderTextColor="#94A3B8"
                    value={formComplemento}
                    onChangeText={setFormComplemento}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Bairro</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Copacabana"
                    placeholderTextColor="#94A3B8"
                    value={formBairro}
                    onChangeText={setFormBairro}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.formLabel}>Cidade</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="Rio de Janeiro"
                    placeholderTextColor="#94A3B8"
                    value={formCidade}
                    onChangeText={setFormCidade}
                  />
                </View>

                <View style={{ width: 80 }}>
                  <Text style={styles.formLabel}>UF</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="RJ"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                    maxLength={2}
                    value={formEstado}
                    onChangeText={(t) => setFormEstado(t.replace(/[^a-zA-Z]/g, '').toUpperCase())}
                  />
                </View>
              </View>
            </View>
            )}

            {/* SEÇÃO 3: PREFERÊNCIAS E RESTRIÇÕES */}
            <View style={styles.formSection}>
              <Text style={styles.formSectionTitle}>PREFERÊNCIAS E RESTRIÇÕES</Text>
              <Text style={styles.formHint}>
                Anote alergias, intolerâncias (glúten/lactose), doces favoritos, cores de fita ou cuidados especiais.
              </Text>
              <TextInput
                style={styles.formTextarea}
                placeholder="Ex: Alérgica a nozes e amendoim. Adora ganache de pistache e sempre pede laço rosa de presente..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={3}
                value={formPreferencias}
                onChangeText={setFormPreferencias}
              />
            </View>

          </ScrollView>

          {/* FOOTER DO MODAL DE CADASTRO */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.btnModalCancel}
              onPress={onClose}>
              <Text style={styles.btnModalCancelText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnModalSave}
              onPress={handleSalvarCliente}
              disabled={salvandoCliente}>
              {salvandoCliente ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Feather name="check" size={15} color="#FFFFFF" />
                  <Text style={styles.btnModalSaveText}>{editando ? 'Salvar Alterações' : 'Salvar Cliente'}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = paraCelular(StyleSheet.create({
  btnAddEndereco: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#A7D7C0',
    backgroundColor: '#F3FAF6',
  },
  btnAddEnderecoText: { fontSize: 12, fontWeight: '700', color: ATELIE_GREEN },
  enderecoTitulo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  enderecoOcultar: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  cepLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  cepLoadingText: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: FONT_SANS,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalNovoClienteContent: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '90%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
    flexDirection: 'column',
    ...Platform.select({
      web: {
        boxShadow: '0 25px 50px -12px rgba(15, 23, 42, 0.25)',
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  modalHeaderIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: ATELIE_TINT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalHeaderSub: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: ATELIE_GREEN,
    fontFamily: FONT_SANS,
  },
  modalHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    fontFamily: FONT_DISPLAY,
  },
  modalHeaderDesc: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: FONT_SANS,
  },
  modalCloseCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorAlertBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderBottomWidth: 1,
    borderBottomColor: '#FECACA',
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  errorAlertText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    fontFamily: FONT_SANS,
  },
  formScroll: {
    flex: 1,
  },
  formScrollContent: {
    padding: 22,
    gap: 20,
  },
  formSection: {
    gap: 10,
  },
  formSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#475569',
    fontFamily: FONT_SANS,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
    fontFamily: FONT_SANS,
  },
  formInput: {
    height: 38,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    fontSize: 12,
    color: '#0F172A',
    fontFamily: FONT_SANS,
  },
  tagsQuickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  tagsQuickLabel: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: FONT_SANS,
  },
  tagQuickChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  tagQuickChipActive: {
    backgroundColor: ATELIE_TINT,
  },
  tagQuickChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748B',
  },
  tagQuickChipTextActive: {
    color: ATELIE_GREEN,
    fontWeight: '800',
  },
  formHint: {
    fontSize: 11,
    color: '#64748B',
    fontFamily: FONT_SANS,
    marginTop: -4,
  },
  formTextarea: {
    height: 70,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
    color: '#0F172A',
    fontFamily: FONT_SANS,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    gap: 12,
  },
  btnModalCancel: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  btnModalCancelText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    fontFamily: FONT_SANS,
  },
  btnModalSave: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: ATELIE_GREEN,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
  },
  btnModalSaveText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: FONT_DISPLAY,
  },
}));

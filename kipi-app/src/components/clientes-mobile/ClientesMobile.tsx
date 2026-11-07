import React, { useMemo, useRef, useState } from 'react';
import { Linking, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import {
  alternarStatusCliente,
  cadastroDoFormulario,
  metricasCliente,
  salvarCliente,
  useClientes,
  usePedidos,
  type ClienteCompleto,
  type Pedido,
} from '@/lib/clientesPedidos';
import { pedidosDoEscopo, useEscopoRevendedora } from '@/lib/minhaRevenda';
import type { ClienteCadastrado } from '@/components/ClienteFormModal';
import TabBar from '@/components/mobile/TabBar';
import { brl, cor, fonte, numeros, sombra } from '@/components/mobile/tema';
import { Aviso, Botao, Gaveta, T, useAviso } from '@/components/mobile/ui';
import DetalhePedidoMobile from '@/components/pedidos-mobile/DetalhePedidoMobile';
import NovoPedidoMobile from '@/components/pedidos-mobile/NovoPedidoMobile';
import { ligar } from '@/components/pedidos-mobile/acoes';
import ClienteFormMobile from './ClienteFormMobile';

// ============================================================================
// CLIENTES NO CELULAR: lista, ficha e cadastro (mesmos dados e regras da versão de computador)
// ============================================================================

type Aba = 'todos' | 'ativos' | 'inativos';
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const COR_TAG: Record<string, [string, string]> = {
  VIP: [cor.pistacheClaro, cor.pistacheTexto],
  Corporativo: [cor.azulClaro, cor.azulTexto],
  Noiva: ['#FCE7F3', '#9D174D'],
  'Festa Infantil': ['#FBF0DC', '#9A6516'],
  Frequente: ['#E4F1E9', cor.verde],
};
const corDaTag = (t: string) => COR_TAG[t] ?? [cor.cinzaClaro, cor.textoMedio];

const iniciais = (nome: string) =>
  nome
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase();
const diaDoAniversario = (data?: string | null) => {
  const d = data ? parseInt(data.split(/[-/]/)[0], 10) : NaN;
  return Number.isFinite(d) ? d : 99;
};
// Mesmo cálculo da tela de Pedidos: o que falta receber do pedido
const saldoDoPedido = (p: Pedido) => (p.saldoNaEntrega > 0 ? p.saldoNaEntrega : p.total - p.valorSinalPago);
const abrirUrl = (url: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.open(url, '_blank');
  else Linking.openURL(url).catch(() => {});
};
const enderecoCompleto = (c: ClienteCompleto) =>
  [
    c.rua ? `${c.rua}, ${c.numero || 'S/N'}` : null,
    c.complemento || null,
    c.bairro || null,
    c.cidade ? `${c.cidade}${c.estado ? ` - ${c.estado}` : ''}` : null,
    c.cep ? `CEP ${c.cep}` : null,
  ]
    .filter(Boolean)
    .join(', ');

// Conversão para o formulário compartilhado (igual à versão de computador)
const paraFormulario = (c: ClienteCompleto): ClienteCadastrado => ({
  id: c.id,
  nome: c.nome,
  telefone: c.telefone,
  tag: c.tag || '',
  cpfCnpj: c.cpf_cnpj || null,
  cep: c.cep || null,
  rua: c.rua || null,
  numero: c.numero || null,
  complemento: c.complemento || null,
  bairro: c.bairro || null,
  cidade: c.cidade || null,
  estado: c.estado || null,
  aniversario: c.aniversario || null,
  email: c.email || null,
  observacoes: c.observacoes || null,
  revendedoraId: c.revendedoraId || null,
  revendedoraNome: c.revendedoraNome || null,
});

export default function ClientesMobile() {
  const insets = useSafeAreaInsets();
  const { msg, avisar } = useAviso();
  const escopo = useEscopoRevendedora();
  const rev = escopo.ehRevendedora;
  const todosPedidos = usePedidos();
  const todosClientes = useClientes();
  // Revendedora: só os clientes dela, com os totais só das vendas dela
  const pedidos = useMemo(() => (rev ? pedidosDoEscopo(todosPedidos, escopo.revendedoraId) : todosPedidos), [rev, todosPedidos, escopo.revendedoraId]);
  const clientes = useMemo(
    () =>
      rev
        ? todosClientes.filter((c) => c.revendedoraId === escopo.revendedoraId).map((c) => ({ ...c, ...metricasCliente(c, pedidos) }))
        : todosClientes,
    [rev, todosClientes, escopo.revendedoraId, pedidos]
  );

  // Pedidos com saldo em aberto, por cliente
  const pendentesPorCliente = useMemo(() => {
    const m = new Map<string, Pedido[]>();
    pedidos.forEach((p) => {
      if (p.deletado || p.status !== 'pendente' || !p.clienteId || saldoDoPedido(p) <= 0) return;
      m.set(p.clienteId, [...(m.get(p.clienteId) ?? []), p]);
    });
    return m;
  }, [pedidos]);
  const deveDe = (id: string) => (pendentesPorCliente.get(id) ?? []).reduce((a, p) => a + saldoDoPedido(p), 0);

  const [aba, setAba] = useState<Aba>('todos');
  const [busca, setBusca] = useState('');
  const [soNiver, setSoNiver] = useState(false);
  const [fabCompacto, setFabCompacto] = useState(false);
  const ultimoY = useRef(0);
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [novoCliente, setNovoCliente] = useState(false);

  const mesAtual = new Date().getMonth() + 1;
  const cont = {
    todos: clientes.length,
    ativos: clientes.filter((c) => c.status === 'ativo').length,
    inativos: clientes.filter((c) => c.status === 'inativo').length,
  };
  const somaCompras = clientes.reduce((a, c) => a + c.totalGasto, 0);
  const aniversariantes = clientes.filter((c) => c.mesAniversario === mesAtual).sort((a, b) => diaDoAniversario(a.aniversario) - diaDoAniversario(b.aniversario));
  const proximo = aniversariantes.find((c) => diaDoAniversario(c.aniversario) >= new Date().getDate()) ?? aniversariantes[0];

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const r = clientes.filter((c) => {
      const casa =
        !termo ||
        c.nome.toLowerCase().includes(termo) ||
        c.telefone.toLowerCase().includes(termo) ||
        (!!c.email && c.email.toLowerCase().includes(termo)) ||
        (!!c.bairro && c.bairro.toLowerCase().includes(termo)) ||
        (!!c.rua && c.rua.toLowerCase().includes(termo)) ||
        (!!c.tag && c.tag.toLowerCase().includes(termo)) ||
        (!!c.observacoes && c.observacoes.toLowerCase().includes(termo));
      if (!casa) return false;
      if (aba === 'ativos' && c.status !== 'ativo') return false;
      if (aba === 'inativos' && c.status !== 'inativo') return false;
      if (soNiver && c.mesAniversario !== mesAtual) return false;
      return true;
    });
    return soNiver ? r.sort((a, b) => diaDoAniversario(a.aniversario) - diaDoAniversario(b.aniversario)) : r;
  }, [clientes, busca, aba, soNiver, mesAtual]);

  const ficha = clientes.find((c) => c.id === fichaId) ?? null;

  const salvo = (cad: ClienteCadastrado) => {
    salvarCliente(cadastroDoFormulario(cad));
    setNovoCliente(false);
    avisar(`Cliente ${cad.nome} cadastrado!`);
  };

  const abas: { id: Aba; rotulo: string }[] = [
    { id: 'todos', rotulo: 'Todos' },
    { id: 'ativos', rotulo: 'Ativos' },
    { id: 'inativos', rotulo: 'Inativos' },
  ];

  return (
    <SafeAreaView style={s.tela} edges={['top']}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 170 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={64}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          const compacto = y > ultimoY.current && y > 80;
          if (compacto !== fabCompacto) setFabCompacto(compacto);
          ultimoY.current = y;
        }}>
        <View style={s.topo}>
          <T titulo style={s.titulo}>{rev ? 'Meus clientes' : 'Clientes'}</T>
          <T style={[s.subtitulo, numeros]}>
            {cont.todos} {cont.todos === 1 ? 'cliente' : 'clientes'} · {brl(somaCompras)} em compras
          </T>
        </View>

        {/* BUSCA */}
        <View style={[s.busca, sombra]}>
          <Feather name="search" size={18} color="#9A8F87" />
          <TextInput
            value={busca}
            onChangeText={setBusca}
            placeholder="Nome, telefone, bairro, tag…"
            placeholderTextColor="#9A8F87"
            style={s.buscaInput}
            accessibilityLabel="Buscar cliente"
          />
          {!!busca && (
            <TouchableOpacity onPress={() => setBusca('')} style={s.limpar} accessibilityRole="button" accessibilityLabel="Limpar busca">
              <Feather name="x" size={14} color={cor.textoMedio} />
            </TouchableOpacity>
          )}
        </View>

        {/* SITUAÇÃO */}
        <View style={s.segmento} accessibilityRole="tablist">
          {abas.map((a) => {
            const on = aba === a.id;
            return (
              <TouchableOpacity key={a.id} style={[s.segItem, on && s.segItemOn]} onPress={() => setAba(a.id)} accessibilityRole="tab" accessibilityState={{ selected: on }}>
                <T style={[s.segTexto, on && s.segTextoOn]}>{a.rotulo}</T>
                <T style={[s.segNum, numeros]}>{cont[a.id]}</T>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ANIVERSARIANTES DO MÊS (atalho que vira filtro) */}
        {(aniversariantes.length > 0 || soNiver) && (
          <TouchableOpacity
            style={[s.niver, soNiver && s.niverOn, !soNiver && sombra]}
            onPress={() => setSoNiver(!soNiver)}
            accessibilityRole="button"
            accessibilityState={{ selected: soNiver }}
            activeOpacity={0.85}>
            <View style={s.niverIcone}>
              <T style={{ fontSize: 16 }}>🎂</T>
            </View>
            <View style={{ flex: 1, gap: 1 }}>
              <T style={s.niverTitulo}>
                {soNiver ? 'Mostrando aniversariantes' : `${aniversariantes.length} ${aniversariantes.length === 1 ? 'aniversariante' : 'aniversariantes'} em ${MESES[mesAtual - 1]}`}
              </T>
              <T style={s.niverSub} numberOfLines={1}>
                {soNiver
                  ? `${aniversariantes.length} em ${MESES[mesAtual - 1]}`
                  : proximo
                    ? `${proximo.nome.split(' ')[0]} faz aniversário dia ${diaDoAniversario(proximo.aniversario)}`
                    : ''}
              </T>
            </View>
            <T style={s.niverAcao}>{soNiver ? 'Ver todos' : 'Ver'}</T>
          </TouchableOpacity>
        )}

        {/* LISTA */}
        {lista.length === 0 ? (
          <View style={s.vazio}>
            <T titulo style={s.vazioTitulo}>Nenhum cliente encontrado</T>
            <T style={s.vazioTexto}>Tente outra busca ou outro filtro.</T>
            <Botao
              rotulo="Limpar busca e filtros"
              variante="secundario"
              altura={44}
              aoTocar={() => {
                setBusca('');
                setAba('todos');
                setSoNiver(false);
              }}
            />
          </View>
        ) : (
          <View style={[s.lista, sombra]}>
            {lista.map((c, i) => {
              const ativo = c.status === 'ativo';
              const deve = deveDe(c.id);
              const ehNiver = c.mesAniversario === mesAtual;
              const [tagBg, tagFg] = corDaTag(c.tag || '');
              const partes = soNiver
                ? [`Aniversário ${c.aniversario?.slice(0, 5) ?? ''}`, c.telefone]
                : [
                    `${c.quantidadePedidos} ${c.quantidadePedidos === 1 ? 'pedido' : 'pedidos'}`,
                    c.bairro || null,
                    !rev && c.revendedoraId ? `de ${c.revendedoraNome?.split(' ')[0] || 'revendedora'}` : null,
                  ];
              return (
                <TouchableOpacity
                  key={c.id}
                  style={[s.linha, i > 0 && s.linhaBorda, !ativo && { opacity: 0.6 }]}
                  onPress={() => setFichaId(c.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Abrir ficha de ${c.nome}`}
                  activeOpacity={0.7}>
                  <View style={[s.avatar, { backgroundColor: ativo ? cor.azulClaro : cor.cinzaClaro }]}>
                    <T style={[s.avatarTexto, { color: ativo ? cor.azulTexto : '#9A8F87' }]}>{iniciais(c.nome)}</T>
                    {ehNiver && (
                      <View style={s.avatarNiver} accessibilityLabel="Aniversaria este mês">
                        <T style={{ fontSize: 11 }}>🎂</T>
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
                    <T style={s.nome} numberOfLines={1}>{c.nome}</T>
                    <View style={s.nomeLinha}>
                      {!!c.tag && (
                        <View style={[s.tag, { backgroundColor: tagBg }]}>
                          <T style={[s.tagTexto, { color: tagFg }]} numberOfLines={1}>{c.tag}</T>
                        </View>
                      )}
                      <T style={[s.linhaSub, numeros, { flex: 1 }]} numberOfLines={1}>{partes.filter(Boolean).join(' · ')}</T>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 2 }}>
                    <T style={[s.total, numeros]}>{c.quantidadePedidos ? brl(c.totalGasto) : '—'}</T>
                    {!ativo ? (
                      <T style={[s.nota, { color: '#9A8F87' }]}>Inativo</T>
                    ) : deve > 0 ? (
                      <T style={[s.nota, numeros, { color: cor.vermelho }]}>deve {brl(deve)}</T>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* NOVO CLIENTE */}
      <TouchableOpacity
        style={[s.fab, fabCompacto && s.fabCompacto, { bottom: 78 + Math.max(insets.bottom, 8) }]}
        onPress={() => setNovoCliente(true)}
        accessibilityRole="button"
        accessibilityLabel="Novo cliente"
        activeOpacity={0.9}>
        <Feather name="user-plus" size={20} color="#FFFDFA" />
        {!fabCompacto && <T style={s.fabTexto}>Novo cliente</T>}
      </TouchableOpacity>

      <Aviso msg={msg} base={150 + insets.bottom} />
      <TabBar ativa="/clientes" />

      {ficha && (
        <FichaCliente
          cliente={ficha}
          rev={rev}
          revendedoraFixa={escopo.revendedoraId}
          pendentes={pendentesPorCliente.get(ficha.id) ?? []}
          mesAtual={mesAtual}
          aoFechar={() => setFichaId(null)}
        />
      )}

      {/* NOVO CLIENTE (a edição abre de dentro da ficha) */}
      <ClienteFormMobile visible={novoCliente} onClose={() => setNovoCliente(false)} onSalvo={salvo} revendedoraFixa={escopo.revendedoraId} />
    </SafeAreaView>
  );
}

// ============================================================================
// FICHA DO CLIENTE (tela inteira)
// ============================================================================
function FichaCliente({
  cliente: c,
  rev,
  revendedoraFixa,
  pendentes,
  mesAtual,
  aoFechar,
}: {
  cliente: ClienteCompleto;
  rev: boolean;
  revendedoraFixa: string | null;
  pendentes: Pedido[];
  mesAtual: number;
  aoFechar: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { msg, avisar } = useAviso();
  const [editando, setEditando] = useState(false);
  const [novoPedido, setNovoPedido] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);
  const aoEditar = () => setEditando(true);
  const aoNovoPedido = () => setNovoPedido(true);
  const aoAbrirPedido = setDetalheId;
  const [gaveta, setGaveta] = useState<null | 'mais' | 'inativar' | 'pendentes'>(null);
  const ativo = c.status === 'ativo';
  const primeiroNome = c.nome.split(' ')[0];
  const deve = pendentes.reduce((a, p) => a + saldoDoPedido(p), 0);
  const ehNiver = c.mesAniversario === mesAtual;
  const [tagBg, tagFg] = corDaTag(c.tag || '');
  const endereco = enderecoCompleto(c);
  const tel = c.telefone.replace(/\D/g, '');
  const docRotulo = c.cpf_cnpj ? (c.cpf_cnpj.replace(/\D/g, '').length > 11 ? 'CNPJ' : 'CPF') : null;

  const whatsapp = () => abrirUrl(tel ? `https://wa.me/55${tel}` : 'https://wa.me/');
  const parabenizar = () => {
    const texto = encodeURIComponent(`Oi, ${primeiroNome}! 🎂 Feliz aniversário! Que seu dia seja doce. Um carinho do nosso ateliê pra você 💛`);
    abrirUrl(tel ? `https://wa.me/55${tel}?text=${texto}` : `https://wa.me/?text=${texto}`);
  };
  const copiarEndereco = async () => {
    setGaveta(null);
    if (!endereco) return avisar('Este cliente não tem endereço cadastrado.');
    await Clipboard.setStringAsync(`${c.nome}\n${endereco}`);
    avisar('Endereço copiado!');
  };
  const alternar = () => {
    alternarStatusCliente(c.id);
    setGaveta(null);
    avisar(ativo ? `Cliente ${c.nome} inativado.` : `Cliente ${c.nome} reativado!`);
  };

  const dados: [string, string][] = [
    ['WhatsApp', c.telefone || 'Não informado'],
    ['E-mail', c.email || 'Não informado'],
  ];
  if (docRotulo) dados.push([docRotulo, c.cpf_cnpj as string]);

  return (
    <Modal visible animationType="slide" onRequestClose={aoFechar} statusBarTranslucent>
      <SafeAreaView style={s.tela} edges={['top']}>
        <View style={s.fichaTopo}>
          <TouchableOpacity onPress={aoFechar} style={[s.redondo, sombra]} accessibilityRole="button" accessibilityLabel="Voltar para clientes">
            <Feather name="chevron-left" size={22} color={cor.texto} />
          </TouchableOpacity>
          <T style={s.fichaTopoTexto}>{rev ? 'Meus clientes' : 'Clientes'}</T>
          <TouchableOpacity onPress={() => setGaveta('mais')} style={[s.redondo, sombra]} accessibilityRole="button" accessibilityLabel="Mais ações">
            <Feather name="more-horizontal" size={20} color={cor.textoMedio} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
          {/* IDENTIDADE */}
          <View style={s.identidade}>
            <View style={[s.avatarGrande, { backgroundColor: ativo ? cor.azulClaro : cor.cinzaClaro }]}>
              <T titulo style={[s.avatarGrandeTexto, { color: ativo ? cor.azulTexto : '#9A8F87' }]}>{iniciais(c.nome)}</T>
            </View>
            <T titulo style={s.fichaNome}>{c.nome}</T>
            <View style={s.etiquetas}>
              {!!c.tag && (
                <View style={[s.tagGrande, { backgroundColor: tagBg }]}>
                  <T style={[s.tagGrandeTexto, { color: tagFg }]}>{c.tag}</T>
                </View>
              )}
              {!rev && (
                <View style={[s.tagGrande, { backgroundColor: c.revendedoraId ? '#F3F2FC' : cor.azulClaro }]}>
                  <T style={[s.tagGrandeTexto, { color: c.revendedoraId ? '#3A3D9E' : cor.azulTexto }]}>
                    {c.revendedoraId ? `Cliente de ${c.revendedoraNome?.split(' ')[0] || 'revendedora'}` : 'Cliente direto'}
                  </T>
                </View>
              )}
              {!ativo && (
                <View style={[s.tagGrande, { backgroundColor: '#FBE7E4' }]}>
                  <T style={[s.tagGrandeTexto, { color: cor.vermelho }]}>Inativo</T>
                </View>
              )}
            </View>
          </View>

          {/* AÇÕES RÁPIDAS */}
          <View style={s.acoes}>
            <TouchableOpacity style={[s.acao, sombra]} onPress={whatsapp} accessibilityRole="button">
              <Feather name="message-circle" size={20} color={cor.verde} />
              <T style={[s.acaoTexto, { color: cor.verde }]}>WhatsApp</T>
            </TouchableOpacity>
            <TouchableOpacity style={[s.acao, sombra, !tel && { opacity: 0.5 }]} onPress={() => ligar(c.telefone)} disabled={!tel} accessibilityRole="button">
              <Feather name="phone" size={20} color={cor.azulTexto} />
              <T style={[s.acaoTexto, { color: cor.azulTexto }]}>Ligar</T>
            </TouchableOpacity>
            <TouchableOpacity style={[s.acao, { backgroundColor: cor.azulBotao }]} onPress={aoNovoPedido} accessibilityRole="button">
              <Feather name="plus" size={20} color="#FFFDFA" />
              <T style={[s.acaoTexto, { color: '#FFFDFA' }]}>Novo pedido</T>
            </TouchableOpacity>
          </View>

          {/* PREFERÊNCIAS E RESTRIÇÕES */}
          <View style={[s.pref, { backgroundColor: c.observacoes ? cor.ambarFundo : '#FFFDFA' }]}>
            <View style={[s.prefIcone, { backgroundColor: c.observacoes ? cor.ambarClaro : cor.cinzaClaro }]}>
              <Feather name="heart" size={16} color={c.observacoes ? cor.ambar : '#9A8F87'} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <T style={[s.prefTitulo, { color: c.observacoes ? cor.ambarTexto : cor.textoSuave }]}>Preferências e restrições</T>
              <T style={[s.prefTexto, !c.observacoes && { color: cor.textoSuave }]}>
                {c.observacoes || 'Nada anotado. Toque em Editar dados para registrar alergias, sabores preferidos ou cuidados.'}
              </T>
            </View>
          </View>

          {/* FALTA RECEBER */}
          {deve > 0 && (
            <TouchableOpacity
              style={s.deve}
              onPress={() => (pendentes.length === 1 ? aoAbrirPedido(pendentes[0].id) : setGaveta('pendentes'))}
              accessibilityRole="button"
              activeOpacity={0.85}>
              <View style={{ flex: 1 }}>
                <T style={s.deveTitulo}>Falta receber</T>
                <T style={s.deveSub}>
                  {pendentes.length} {pendentes.length === 1 ? 'pedido com saldo em aberto' : 'pedidos com saldo em aberto'}
                </T>
              </View>
              <T titulo style={[s.deveValor, numeros]}>{brl(deve)}</T>
              <Feather name="chevron-right" size={16} color={cor.vermelho} />
            </TouchableOpacity>
          )}

          {/* NÚMEROS */}
          <View style={[s.cartao, sombra]}>
            <View style={s.numeros}>
              {[
                ['Total gasto', brl(c.totalGasto)],
                ['Pedidos', String(c.quantidadePedidos)],
                ['Ticket médio', brl(c.ticketMedio)],
              ].map(([r, v]) => (
                <View key={r} style={{ flex: 1, gap: 2 }}>
                  <T style={s.numRotulo}>{r}</T>
                  <T titulo style={[s.numValor, numeros]}>{v}</T>
                </View>
              ))}
            </View>
            {!!c.produtoMaisComprado && (
              <View style={s.favorito}>
                <T style={{ fontSize: 15 }}>🏆</T>
                <T style={s.favoritoTexto} numberOfLines={1}>
                  Mais pede <T style={[s.favoritoTexto, { fontWeight: '800' }]}>{c.produtoMaisComprado}</T>
                </T>
              </View>
            )}
          </View>

          {/* O QUE JÁ COMPROU */}
          <View style={[s.cartao, sombra, { paddingBottom: 8 }]}>
            <View style={s.cartaoTopo}>
              <T titulo style={s.cartaoTitulo}>O que já comprou</T>
              <T style={s.cartaoSub}>
                {c.produtosComprados.length} {c.produtosComprados.length === 1 ? 'produto' : 'produtos'}
              </T>
            </View>
            {c.produtosComprados.length === 0 ? (
              <T style={[s.cartaoSub, { paddingVertical: 8 }]}>Ainda não fez nenhum pedido.</T>
            ) : (
              c.produtosComprados.map((p, i) => (
                <View key={p.id + i} style={[s.produto, i > 0 && s.linhaBorda]}>
                  <View style={s.produtoEmoji}>
                    <T style={{ fontSize: 18 }}>{p.emoji}</T>
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
                    <T style={s.produtoNome} numberOfLines={1}>{p.nome}</T>
                    <T style={[s.cartaoSub, numeros]} numberOfLines={1}>
                      {p.categoria} · última em {p.dataUltimaCompra}
                    </T>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <T style={[s.produtoTotal, numeros]}>{brl(p.totalGasto)}</T>
                    <T style={[s.cartaoSub, numeros, { fontSize: 11 }]}>{p.quantidade} un</T>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* DADOS */}
          <View style={[s.cartao, sombra, { padding: 0, gap: 0 }]}>
            <View style={s.dadoLinha}>
              <Feather name="map-pin" size={18} color={cor.textoSuave} style={{ marginTop: 2 }} />
              <View style={{ flex: 1, gap: 2 }}>
                <T style={s.dadoForte}>{c.rua ? `${c.rua}, ${c.numero || 'S/N'}` : 'Endereço não informado'}</T>
                {(c.complemento || c.bairro || c.cidade || c.cep) && (
                  <T style={s.cartaoSub}>
                    {[
                      c.complemento,
                      [c.bairro, c.cidade && `${c.cidade}${c.estado ? ` - ${c.estado}` : ''}`].filter(Boolean).join(', '),
                      c.cep ? `CEP ${c.cep}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </T>
                )}
              </View>
              {!!endereco && (
                <TouchableOpacity style={s.miniBotao} onPress={copiarEndereco} accessibilityRole="button" accessibilityLabel="Copiar endereço">
                  <T style={s.miniBotaoTexto}>Copiar</T>
                </TouchableOpacity>
              )}
            </View>
            <View style={[s.dadoLinha, s.linhaBorda, { alignItems: 'center' }]}>
              <T style={{ fontSize: 16, width: 18, textAlign: 'center' }}>🎂</T>
              <View style={{ flex: 1, gap: 1 }}>
                <T style={s.dadoForte}>{c.aniversario || 'Aniversário não informado'}</T>
                {ehNiver && <T style={[s.cartaoSub, { color: '#9D174D' }]}>Faz aniversário este mês</T>}
              </View>
              {ehNiver && (
                <TouchableOpacity style={[s.miniBotao, { borderWidth: 0, backgroundColor: cor.verdeClaro }]} onPress={parabenizar} accessibilityRole="button">
                  <T style={[s.miniBotaoTexto, { color: cor.verde }]}>Parabenizar</T>
                </TouchableOpacity>
              )}
            </View>
            {dados.map(([r, v]) => (
              <View key={r} style={[s.dadoLinha, s.linhaBorda, { alignItems: 'center', paddingVertical: 12 }]}>
                <T style={s.dadoRotulo}>{r}</T>
                <T style={[s.dadoValor, numeros, v === 'Não informado' && { color: '#9A8F87' }]} selectable>{v}</T>
              </View>
            ))}
          </View>
        </ScrollView>

        {/* RODAPÉ */}
        <View style={[s.rodape, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          <Botao rotulo="Editar dados" icone="edit-2" variante="secundario" aoTocar={aoEditar} style={{ flex: 1 }} />
          {!ativo && <Botao rotulo="Reativar cliente" variante="verde" aoTocar={alternar} style={{ flex: 1 }} />}
        </View>

        <Aviso msg={msg} base={100 + insets.bottom} />

        <Gaveta aberta={gaveta === 'mais'} aoFechar={() => setGaveta(null)} titulo={c.nome} subtitulo="O que você quer fazer?">
          <View>
            {[
              { rotulo: 'Editar dados', icone: 'edit-2' as const, cor: cor.texto, acao: () => { setGaveta(null); aoEditar(); } },
              { rotulo: 'Copiar endereço', icone: 'copy' as const, cor: cor.texto, acao: copiarEndereco },
              ativo
                ? { rotulo: 'Inativar cliente', icone: 'user-x' as const, cor: cor.vermelho, acao: () => setGaveta('inativar') }
                : { rotulo: 'Reativar cliente', icone: 'rotate-ccw' as const, cor: cor.verde, acao: alternar },
            ].map((o, i) => (
              <TouchableOpacity key={o.rotulo} style={[s.menuItem, i > 0 && s.linhaBorda]} onPress={o.acao} accessibilityRole="button">
                <Feather name={o.icone} size={18} color={o.cor} />
                <T style={[s.menuTexto, { color: o.cor }]}>{o.rotulo}</T>
              </TouchableOpacity>
            ))}
          </View>
        </Gaveta>

        <Gaveta aberta={gaveta === 'inativar'} aoFechar={() => setGaveta(null)} titulo="Inativar cliente?" subtitulo="Dá para desfazer depois">
          <T style={s.explica}>
            {c.nome} sai da lista de ativos. O histórico de compras continua guardado e você pode reativar quando quiser.
          </T>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Botao rotulo="Voltar" variante="secundario" aoTocar={() => setGaveta(null)} style={{ flex: 1 }} />
            <Botao rotulo="Sim, inativar" variante="perigo" aoTocar={alternar} style={{ flex: 1.3 }} />
          </View>
        </Gaveta>

        <Gaveta aberta={gaveta === 'pendentes'} aoFechar={() => setGaveta(null)} titulo="Falta receber" subtitulo={`${brl(deve)} em ${pendentes.length} pedidos`}>
          <View>
            {pendentes.map((p, i) => (
              <TouchableOpacity
                key={p.id}
                style={[s.menuItem, i > 0 && s.linhaBorda]}
                onPress={() => {
                  setGaveta(null);
                  aoAbrirPedido(p.id);
                }}
                accessibilityRole="button">
                <View style={{ flex: 1, gap: 2 }}>
                  <T style={s.dadoForte}>{p.codigoDisplay} · {p.dataDisplay}</T>
                  <T style={s.cartaoSub} numberOfLines={1}>{p.itens.map((it) => `${it.quantidade}× ${it.nome}`).join(', ')}</T>
                </View>
                <T style={[s.dadoForte, numeros, { color: cor.vermelho }]}>{brl(saldoDoPedido(p))}</T>
                <Feather name="chevron-right" size={16} color="#9A8F87" />
              </TouchableOpacity>
            ))}
          </View>
        </Gaveta>

        <ClienteFormMobile
          visible={editando}
          onClose={() => setEditando(false)}
          onSalvo={(cad) => {
            salvarCliente(cadastroDoFormulario(cad, c.status));
            setEditando(false);
            avisar(`Dados de ${cad.nome} atualizados!`);
          }}
          clienteInicial={paraFormulario(c)}
          revendedoraFixa={revendedoraFixa}
        />
        {novoPedido && (
          <NovoPedidoMobile
            clienteInicialId={c.id}
            aoFechar={() => setNovoPedido(false)}
            aoSalvo={(p) => avisar(`Pedido ${p.codigoDisplay} registrado com sucesso!`)}
          />
        )}
        {detalheId && <DetalhePedidoMobile pedidoId={detalheId} ocultarCustos={rev} aoFechar={() => setDetalheId(null)} aoEditar={() => setDetalheId(null)} />}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  topo: { paddingHorizontal: 20, paddingTop: 10, gap: 2 },
  titulo: { fontSize: 28, fontWeight: '700', letterSpacing: -0.6 },
  subtitulo: { fontSize: 13, fontWeight: '600', color: cor.textoSuave },
  busca: { marginHorizontal: 16, marginTop: 14, height: 48, paddingHorizontal: 14, borderRadius: 16, backgroundColor: '#FFFDFA', flexDirection: 'row', alignItems: 'center', gap: 10 },
  buscaInput: {
    flex: 1,
    minWidth: 0,
    height: 44,
    fontSize: 15,
    color: cor.texto,
    fontFamily: fonte.texto,
    ...Platform.select({ web: { outlineStyle: 'none' } as object, default: {} }),
  },
  limpar: { width: 32, height: 32, borderRadius: 16, backgroundColor: cor.cinzaClaro, alignItems: 'center', justifyContent: 'center' },
  segmento: { flexDirection: 'row', marginHorizontal: 16, marginTop: 10, padding: 4, gap: 4, borderRadius: 16, backgroundColor: '#F3EEE7' },
  segItem: { flex: 1, height: 40, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  segItemOn: { backgroundColor: '#FFFDFA', shadowColor: '#2E211A', shadowOpacity: 0.1, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segTexto: { fontSize: 13, fontWeight: '600', color: cor.textoMedio },
  segTextoOn: { fontWeight: '800', color: cor.texto },
  segNum: { fontSize: 12, fontWeight: '800', color: cor.textoSuave },
  niver: { marginHorizontal: 16, marginTop: 10, minHeight: 52, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1.5, borderColor: '#FFFDFA', backgroundColor: '#FFFDFA', flexDirection: 'row', alignItems: 'center', gap: 12 },
  niverOn: { backgroundColor: '#FDF2F8', borderColor: '#F9A8D4' },
  niverIcone: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#FCE7F3', alignItems: 'center', justifyContent: 'center' },
  niverTitulo: { fontSize: 14, fontWeight: '800' },
  niverSub: { fontSize: 12, color: cor.textoSuave },
  niverAcao: { fontSize: 12, fontWeight: '800', color: '#9D174D' },
  lista: { marginHorizontal: 16, marginTop: 12, borderRadius: 22, backgroundColor: '#FFFDFA', overflow: 'hidden' },
  linha: { minHeight: 72, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  linhaBorda: { borderTopWidth: 1, borderTopColor: cor.bordaSuave },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { fontSize: 14, fontWeight: '800' },
  avatarNiver: { position: 'absolute', right: -3, bottom: -3, width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFFDFA', alignItems: 'center', justifyContent: 'center' },
  nomeLinha: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  nome: { flexShrink: 1, fontSize: 15, fontWeight: '700' },
  tag: { paddingHorizontal: 7, paddingVertical: 1, borderRadius: 7, maxWidth: '55%' },
  tagTexto: { fontSize: 11, fontWeight: '800' },
  linhaSub: { fontSize: 12, color: cor.textoSuave },
  total: { fontSize: 14, fontWeight: '800' },
  nota: { fontSize: 11, fontWeight: '700' },
  vazio: { margin: 16, marginTop: 24, padding: 28, borderRadius: 22, backgroundColor: '#FFFDFA', alignItems: 'center', gap: 6 },
  vazioTitulo: { fontSize: 16, fontWeight: '700' },
  vazioTexto: { fontSize: 13, color: cor.textoSuave, marginBottom: 8 },
  fab: {
    position: 'absolute',
    right: 16,
    height: 56,
    paddingLeft: 18,
    paddingRight: 22,
    borderRadius: 28,
    backgroundColor: cor.azulBotao,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: cor.azulBotao,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  fabCompacto: { width: 56, paddingLeft: 0, paddingRight: 0, justifyContent: 'center' },
  fabTexto: { color: '#FFFDFA', fontSize: 15, fontWeight: '800' },

  // FICHA
  fichaTopo: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 },
  fichaTopoTexto: { flex: 1, fontSize: 15, fontWeight: '700', color: cor.textoMedio },
  redondo: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFFDFA', alignItems: 'center', justifyContent: 'center' },
  identidade: { paddingHorizontal: 20, paddingTop: 4, alignItems: 'center', gap: 6 },
  avatarGrande: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center' },
  avatarGrandeTexto: { fontSize: 24, fontWeight: '700' },
  fichaNome: { marginTop: 4, fontSize: 22, fontWeight: '700', letterSpacing: -0.4, textAlign: 'center' },
  etiquetas: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 },
  tagGrande: { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 8 },
  tagGrandeTexto: { fontSize: 12, fontWeight: '800' },
  acoes: { flexDirection: 'row', gap: 8, marginHorizontal: 16, marginTop: 16 },
  acao: { flex: 1, height: 64, borderRadius: 18, backgroundColor: '#FFFDFA', alignItems: 'center', justifyContent: 'center', gap: 4 },
  acaoTexto: { fontSize: 12, fontWeight: '800' },
  pref: { marginHorizontal: 16, marginTop: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 20, flexDirection: 'row', gap: 12 },
  prefIcone: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  prefTitulo: { fontSize: 12, fontWeight: '800' },
  prefTexto: { fontSize: 14, lineHeight: 20 },
  deve: { marginHorizontal: 16, marginTop: 8, minHeight: 56, paddingHorizontal: 16, borderRadius: 20, backgroundColor: cor.vermelhoClaro, flexDirection: 'row', alignItems: 'center', gap: 10 },
  deveTitulo: { fontSize: 12, fontWeight: '800', color: cor.vermelho },
  deveSub: { fontSize: 12, color: '#8A1C12' },
  deveValor: { fontSize: 18, fontWeight: '700', color: cor.vermelho },
  cartao: { marginHorizontal: 16, marginTop: 12, padding: 16, borderRadius: 22, backgroundColor: '#FFFDFA', gap: 12 },
  cartaoTopo: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  cartaoTitulo: { fontSize: 15, fontWeight: '700' },
  cartaoSub: { fontSize: 12, color: cor.textoSuave },
  numeros: { flexDirection: 'row', gap: 6 },
  numRotulo: { fontSize: 11, fontWeight: '700', color: cor.textoSuave },
  numValor: { fontSize: 15, fontWeight: '700', letterSpacing: -0.3 },
  favorito: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: cor.pistacheClaro, flexDirection: 'row', alignItems: 'center', gap: 8 },
  favoritoTexto: { flex: 1, fontSize: 13, color: cor.pistacheTexto },
  produto: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  produtoEmoji: { width: 36, height: 36, borderRadius: 12, backgroundColor: cor.fundo, alignItems: 'center', justifyContent: 'center' },
  produtoNome: { fontSize: 14, fontWeight: '700' },
  produtoTotal: { fontSize: 13, fontWeight: '800' },
  dadoLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  dadoForte: { fontSize: 14, fontWeight: '700' },
  dadoRotulo: { width: 74, fontSize: 12, fontWeight: '700', color: cor.textoSuave },
  dadoValor: { flex: 1, fontSize: 14, fontWeight: '600' },
  miniBotao: { height: 34, paddingHorizontal: 12, borderRadius: 17, borderWidth: 1, borderColor: cor.borda, backgroundColor: '#FFFDFA', alignItems: 'center', justifyContent: 'center' },
  miniBotaoTexto: { fontSize: 12, fontWeight: '800', color: cor.azulTexto },
  rodape: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#FFFDFA', borderTopWidth: 1, borderTopColor: cor.borda },
  menuItem: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12 },
  menuTexto: { fontSize: 15, fontWeight: '700' },
  explica: { fontSize: 14, lineHeight: 20, color: cor.textoMedio },
});

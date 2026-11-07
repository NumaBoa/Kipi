import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { atualizarPedido, chaveDoDia, rotuloEntrega, useClientes, usePedidos, type Pedido } from '@/lib/clientesPedidos';
import { custoUnitarioProduto } from '@/lib/estoqueVitrine';
import { useConfigLoja } from '@/lib/configuracoes';
import { Aviso, Botao, Etiqueta, T, useAviso } from '@/components/mobile/ui';
import { brl, cor, ETAPAS_PRODUCAO, NOME_FORMA, numeros, sombra } from '@/components/mobile/tema';
import { abrirWhatsApp, copiarComprovante, ligar, textoWhatsApp } from './acoes';
import { GavetaAcoes, GavetaCancelar, GavetaReceber, type AcaoPedido } from './GavetasPedido';

// ============================================================================
// DETALHE DO PEDIDO (celular) — no topo, quem é, quando entrega e o que falta;
// depois produção, pagamento, itens e comprovante. A ação principal fica embaixo.
// ============================================================================
export default function DetalhePedidoMobile({
  pedidoId,
  ocultarCustos,
  aoFechar,
  aoEditar,
}: {
  pedidoId: string | null;
  ocultarCustos: boolean; // revendedora não vê custo nem lucro do ateliê
  aoFechar: () => void;
  aoEditar: (p: Pedido) => void;
}) {
  const insets = useSafeAreaInsets();
  const pedido = usePedidos().find((p) => p.id === pedidoId) ?? null;
  const clientes = useClientes();
  const { config } = useConfigLoja();
  const { msg, avisar } = useAviso();
  const [verLucro, setVerLucro] = useState(false);
  const [verMsg, setVerMsg] = useState(false);
  const [receber, setReceber] = useState<Pedido | null>(null);
  const [acoes, setAcoes] = useState<Pedido | null>(null);
  const [cancelar, setCancelar] = useState<Pedido | null>(null);

  if (!pedido) return null;

  const tag = pedido.clienteId ? clientes.find((c) => c.id === pedido.clienteId)?.tag || null : null;
  const pendente = pedido.status === 'pendente';
  const falta = pedido.saldoNaEntrega > 0 ? pedido.saldoNaEntrega : pedido.total - pedido.valorSinalPago;
  const pct = pedido.total > 0 ? Math.min(100, Math.round((pedido.valorSinalPago / pedido.total) * 100)) : 0;
  const idxEtapa = Math.max(0, ETAPAS_PRODUCAO.findIndex((e) => e.id === pedido.statusProducao));
  const etapa = ETAPAS_PRODUCAO[idxEtapa];
  const temProducao = !pedido.revendedoraId;
  const endereco = pedido.observacoes?.startsWith('Entrega: ') ? pedido.observacoes.slice(9) : null;
  const cuidado = endereco ? null : pedido.observacoes;
  const encomenda = pedido.tipoPedido === 'sob_encomenda';
  const custo = pedido.custoTotal ?? pedido.itens.reduce((a, it) => a + it.quantidade * (it.custoUnitario ?? custoUnitarioProduto({ produtoId: it.produtoId, nome: it.nome, quantidade: 0 })), 0);
  const lucro = pedido.total - custo;
  const margem = pedido.total > 0 ? Math.round((lucro / pedido.total) * 100) : 0;
  const qtdItens = pedido.itens.reduce((a, it) => a + it.quantidade, 0);
  const tipoTexto = pedido.revendedoraId ? 'Revenda' : encomenda ? 'Encomenda' : 'Pronta entrega';
  const iniciais = pedido.clienteNome.split(' ').filter(Boolean).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const mudarEtapa = (i: number) => {
    const e = ETAPAS_PRODUCAO[i];
    atualizarPedido({ ...pedido, statusProducao: e.id });
    avisar(`${pedido.codigoDisplay} agora está: ${e.label}`);
  };
  const copiar = async () => {
    await copiarComprovante(pedido, config);
    avisar('Mensagem formatada copiada para o WhatsApp!');
  };
  const escolher = (a: AcaoPedido) => {
    setAcoes(null);
    if (a === 'receber') setReceber(pedido);
    if (a === 'comprovante') copiar();
    if (a === 'editar') aoEditar(pedido);
    if (a === 'cancelar') setCancelar(pedido);
  };

  return (
    <Modal visible animationType="slide" onRequestClose={aoFechar} presentationStyle="fullScreen">
      <SafeAreaView style={s.tela} edges={['top']}>
        <View style={s.topo}>
          <TouchableOpacity onPress={aoFechar} style={s.icone44} accessibilityRole="button" accessibilityLabel="Voltar para pedidos">
            <Feather name="chevron-left" size={24} color={cor.texto} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <T style={s.topoTitulo}>Pedido {pedido.codigoDisplay}</T>
            <T style={s.topoSub}>{pedido.diaChave === chaveDoDia(new Date()) ? 'Hoje' : pedido.dataDisplay}, {pedido.horaDisplay}</T>
          </View>
          <TouchableOpacity onPress={() => setAcoes(pedido)} style={s.icone44} accessibilityRole="button" accessibilityLabel="Mais ações">
            <Feather name="more-horizontal" size={22} color={cor.texto} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={[s.conteudo, { paddingBottom: 130 + insets.bottom }]} showsVerticalScrollIndicator={false}>
          {/* 1. O QUE FOI PEDIDO */}
          <View style={[s.bloco, sombra, { gap: 14 }]}>
            <View style={s.linhaWrap}>
              <Etiqueta texto={tipoTexto} bg={encomenda ? cor.ambarClaro : cor.azulClaro} fg={encomenda ? cor.ambarTexto : cor.azulTexto} />
              <Etiqueta texto={endereco ? 'Delivery' : 'Retirada'} />
            </View>
            {encomenda && (
              <View style={[s.entrega, { backgroundColor: cor.ambarFundo }]}>
                <Feather name="calendar" size={20} color={cor.ambar} />
                <View style={{ flex: 1 }}>
                  <T style={[s.entregaSub, { color: cor.ambarTexto, fontWeight: '700' }]}>Entregar em</T>
                  <T style={[s.entregaTitulo, { color: '#6E4A10' }]}>{rotuloEntrega(pedido.dataEntrega)}</T>
                </View>
              </View>
            )}
            {!!endereco && (
              <View style={[s.entrega, { backgroundColor: cor.fundo }]}>
                <Feather name="truck" size={18} color={cor.textoMedio} />
                <T style={[s.entregaTitulo, { flex: 1, fontWeight: '700' }]}>{endereco}</T>
              </View>
            )}
            {pedido.itens.map((it) => (
              <View key={it.id} style={s.item}>
                <View style={s.qtd}>
                  <T style={[s.qtdTexto, numeros]}>{it.quantidade}x</T>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <T style={s.itemNome}>{it.nome}</T>
                  <T style={[s.suavePequeno, numeros]} numberOfLines={1}>
                    {it.comDesconto && !!it.desconto
                      ? `${it.categoria} · Valor original ${brl(it.precoUnitario + it.desconto)}`
                      : `${it.categoria} · ${brl(it.precoUnitario)} un.`}
                  </T>
                  {it.comDesconto && !!it.desconto && (
                    <T style={s.promo} numberOfLines={1}>🏷️ {it.motivoPromocao || 'Promoção'} · −{brl(it.desconto)}/un</T>
                  )}
                </View>
                <T style={[s.itemTotal, numeros]}>{brl(it.totalItem)}</T>
              </View>
            ))}
            {!!cuidado && (
              <View style={s.nota}>
                <Feather name="edit-3" size={17} color={cor.textoMedio} />
                <T style={s.notaTexto}>{cuidado}</T>
              </View>
            )}
            <View style={[s.linhaEntre, s.divisa]}>
              <T style={s.medio}>Total · {qtdItens} {qtdItens === 1 ? 'item' : 'itens'}</T>
              <T titulo style={[s.total, numeros]}>{brl(pedido.total)}</T>
            </View>
          </View>

          {/* 2. PAGAMENTO: a cor já diz a situação */}
          <View style={[s.bloco, sombra, { gap: 10, backgroundColor: pendente ? cor.vermelhoClaro : cor.verdeClaro }]}>
            <View style={s.linha}>
              <View style={[s.redondo, { width: 40, height: 40, backgroundColor: pendente ? '#FFFDFA' : '#E4F1E9' }]}>
                <Feather name={pendente ? 'clock' : 'check'} size={20} color={pendente ? cor.vermelho : cor.verde} />
              </View>
              <View style={{ flex: 1 }}>
                <T style={[s.pagTitulo, { color: pendente ? cor.vermelho : cor.verde }]}>{pendente ? `Falta receber ${brl(falta)}` : 'Pago'}</T>
                <T style={[s.medio, numeros, { fontWeight: '500' }]}>
                  {pendente
                    ? pedido.valorSinalPago > 0
                      ? `Sinal pago ${brl(pedido.valorSinalPago)} de ${brl(pedido.total)}`
                      : 'Nada pago ainda'
                    : `${brl(pedido.total)} no ${NOME_FORMA[pedido.formaPagamento]}`}
                </T>
              </View>
            </View>
            {pendente && (
              <View style={[s.trilho, { backgroundColor: '#FFFDFA' }]}>
                <View style={[s.trilhoCheio, { width: `${pct}%` }]} />
              </View>
            )}
            {!ocultarCustos && (
              <>
                <TouchableOpacity
                  style={[s.expandir, { borderTopColor: pendente ? '#F3C4BD' : cor.verdeBorda }]}
                  onPress={() => setVerLucro((v) => !v)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: verLucro }}>
                  <T style={s.medio}>Custo e lucro deste pedido</T>
                  <Feather name={verLucro ? 'chevron-up' : 'chevron-down'} size={18} color={cor.textoMedio} />
                </TouchableOpacity>
                {verLucro && (
                  <View style={s.linha}>
                    <View style={[s.mini, { backgroundColor: '#FFFDFA' }]}>
                      <T style={s.miniRotulo}>Custo (ficha técnica)</T>
                      <T style={[s.miniValor, numeros]}>{brl(custo)}</T>
                    </View>
                    <View style={[s.mini, { backgroundColor: '#FFFDFA' }]}>
                      <T style={[s.miniRotulo, { color: cor.verde }]}>Lucro estimado</T>
                      <T style={[s.miniValor, numeros, { color: cor.verde }]}>{brl(lucro)} · {margem}%</T>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>

          {/* 3. PRODUÇÃO (encomenda: 4 etapas) / ENTREGA (pronta entrega: uma linha) */}
          {temProducao && encomenda && (
            <View style={[s.bloco, sombra]}>
              <View style={s.linhaEntre}>
                <T titulo style={s.blocoTitulo}>Produção</T>
                <T style={[s.forte, { color: etapa.fg }]}>{etapa.label}</T>
              </View>
              <View style={s.etapas}>
                {ETAPAS_PRODUCAO.map((e, i) => (
                  <TouchableOpacity key={e.id} style={s.etapa} onPress={() => mudarEtapa(i)} accessibilityRole="button" accessibilityState={{ selected: i === idxEtapa }} accessibilityLabel={`Mudar para ${e.label}`}>
                    <View style={[s.etapaBarra, { backgroundColor: i <= idxEtapa ? etapa.fg : cor.borda }]} />
                    <T style={[s.etapaTexto, i <= idxEtapa && { color: cor.texto }, i === idxEtapa && { fontWeight: '800' }]}>{e.label}</T>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
          {/* Retirada/delivery: entregue na hora, sem etapa para registrar */}

          {/* 4. CLIENTE (discreto) */}
          <View style={[s.blocoBaixo, sombra, { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
            <View style={s.linha}>
              <View style={s.avatar}>
                <T style={s.avatarTexto}>{iniciais}</T>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={s.linhaWrap}>
                  <T style={s.itemNome} numberOfLines={1}>{pedido.clienteNome}</T>
                  {!!tag && <Etiqueta texto={tag} />}
                </View>
                <T style={s.suavePequeno}>{pedido.clienteTelefone || 'Telefone não cadastrado'}</T>
              </View>
              {!!pedido.clienteTelefone && (
                <TouchableOpacity style={[s.redondo, { width: 40, height: 40, backgroundColor: cor.fundo }]} onPress={() => ligar(pedido.clienteTelefone)} accessibilityLabel="Ligar">
                  <Feather name="phone" size={17} color={cor.textoMedio} />
                </TouchableOpacity>
              )}
              <TouchableOpacity style={[s.redondo, { width: 40, height: 40, backgroundColor: cor.verdeClaro }]} onPress={() => abrirWhatsApp(pedido, config)} accessibilityLabel="WhatsApp">
                <Feather name="message-circle" size={17} color={cor.verde} />
              </TouchableOpacity>
            </View>
            <T style={s.suavePequeno}>
              Atendido por <T style={[s.suavePequeno, { fontWeight: '800', color: cor.textoMedio }]}>{pedido.vendedor}</T>
            </T>
          </View>

          {/* 5. COMPROVANTE (fechado) */}
          <View style={[s.blocoBaixo, sombra, { flexDirection: 'column', alignItems: 'stretch', gap: 12 }]}>
            <TouchableOpacity style={s.linha} onPress={() => setVerMsg((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: verMsg }}>
              <Feather name="message-circle" size={18} color={cor.verde} />
              <T style={[s.itemNome, { flex: 1, fontSize: 14 }]}>Comprovante para WhatsApp</T>
              <Feather name={verMsg ? 'chevron-up' : 'chevron-down'} size={18} color={cor.textoMedio} />
            </TouchableOpacity>
            {verMsg && (
              <>
                <View style={s.mensagem}>
                  <T style={s.mensagemTexto}>{textoWhatsApp(pedido, config)}</T>
                </View>
                <View style={s.linha}>
                  <Botao rotulo="Copiar texto" variante="secundario" altura={44} aoTocar={copiar} style={{ flex: 1, borderColor: cor.verdeBorda }} />
                  <Botao rotulo="Abrir WhatsApp" variante="verde" altura={44} aoTocar={() => abrirWhatsApp(pedido, config)} style={{ flex: 1 }} />
                </View>
              </>
            )}
          </View>
        </ScrollView>

        {/* AÇÃO PRINCIPAL: o que falta fazer; se já está tudo feito, enviar o comprovante */}
        <View style={[s.rodape, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
          {temProducao && encomenda && idxEtapa < 3 && (
            <Botao rotulo={['Iniciar produção', 'Marcar pronto', 'Marcar entregue'][idxEtapa]} variante="secundario" aoTocar={() => mudarEtapa(idxEtapa + 1)} style={{ flex: 1 }} />
          )}
          {pendente && <Botao rotulo={`Receber ${brl(falta)}`} aoTocar={() => setReceber(pedido)} style={{ flex: 1.3 }} />}
          {!pendente && !(temProducao && encomenda && idxEtapa < 3) && (
            <Botao rotulo="Enviar comprovante" icone="message-circle" variante="verde" aoTocar={() => abrirWhatsApp(pedido, config)} style={{ flex: 1 }} />
          )}
        </View>

        <Aviso msg={msg} base={110 + insets.bottom} />
        <GavetaReceber pedido={receber} aoFechar={() => setReceber(null)} avisar={avisar} />
        <GavetaAcoes pedido={acoes} aoFechar={() => setAcoes(null)} aoEscolher={escolher} comDetalhes={false} />
        <GavetaCancelar pedido={cancelar} aoFechar={() => setCancelar(null)} aoCancelado={aoFechar} avisar={avisar} />
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cor.fundo },
  topo: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4 },
  topoTitulo: { textAlign: 'center', fontSize: 15, fontWeight: '800' },
  topoSub: { fontSize: 12, fontWeight: '600', color: cor.textoSuave },
  blocoBaixo: { backgroundColor: '#FFFDFA', borderRadius: 20, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  ponto: { width: 10, height: 10, borderRadius: 5 },
  botaoPequeno: { height: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1.5, borderColor: cor.apagado, justifyContent: 'center' },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: cor.azulClaro, alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { fontSize: 13, fontWeight: '800', color: cor.azulTexto },
  pagTitulo: { fontSize: 15, fontWeight: '800' },
  divisa: { borderTopWidth: 1, borderTopColor: cor.bordaSuave, paddingTop: 12 },
  icone44: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  conteudo: { paddingHorizontal: 16, paddingTop: 6, gap: 12 },
  bloco: { backgroundColor: '#FFFDFA', borderRadius: 24, padding: 18, gap: 12 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linhaWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  linhaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nome: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  suave: { fontSize: 13, color: cor.textoSuave },
  suavePequeno: { fontSize: 12, color: cor.textoSuave },
  forte: { fontSize: 13, fontWeight: '800', color: cor.textoForte },
  medio: { fontSize: 13, fontWeight: '700', color: cor.textoMedio },
  redondo: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  entrega: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 16 },
  entregaTitulo: { fontSize: 14, fontWeight: '800' },
  entregaSub: { fontSize: 12, color: cor.textoMedio },
  blocoTitulo: { fontSize: 15, fontWeight: '700' },
  etapas: { flexDirection: 'row', gap: 4 },
  etapa: { flex: 1, gap: 8, paddingVertical: 4 },
  etapaBarra: { height: 6, borderRadius: 3 },
  etapaTexto: { fontSize: 11, lineHeight: 14, fontWeight: '600', color: cor.textoSuave },
  total: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  trilho: { height: 8, borderRadius: 4, backgroundColor: cor.cinzaClaro, overflow: 'hidden' },
  trilhoCheio: { height: '100%', borderRadius: 4, backgroundColor: cor.pistache },
  falta: { fontSize: 14, fontWeight: '800', color: cor.vermelho },
  expandir: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 42, borderTopWidth: 1, borderTopColor: cor.bordaSuave },
  mini: { flex: 1, padding: 12, borderRadius: 14, gap: 2 },
  miniRotulo: { fontSize: 11, fontWeight: '700', color: cor.textoSuave },
  miniValor: { fontSize: 15, fontWeight: '800' },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  qtd: { width: 34, height: 34, borderRadius: 10, backgroundColor: cor.fundo, alignItems: 'center', justifyContent: 'center' },
  qtdTexto: { fontSize: 13, fontWeight: '800' },
  itemNome: { fontSize: 15, fontWeight: '700' },
  itemTotal: { fontSize: 15, fontWeight: '800' },
  promo: { fontSize: 12, fontWeight: '800', color: cor.ambar },
  nota: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 14, backgroundColor: cor.fundo },
  notaTexto: { flex: 1, fontSize: 13, lineHeight: 19, color: '#3D312A' },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 16, backgroundColor: cor.fundo, justifyContent: 'center' },
  chipTexto: { fontSize: 12, fontWeight: '800', color: cor.azulTexto },
  mensagem: { padding: 14, borderRadius: 16, backgroundColor: cor.verdeClaro },
  mensagemTexto: { fontSize: 13, lineHeight: 19, color: '#24603F' },
  rodape: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#FFFDFA',
    borderTopWidth: 1,
    borderTopColor: cor.borda,
  },
});

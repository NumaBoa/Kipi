import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import PaginaPortal, { Pill, estilosPortal as s, COR, FONT_DISPLAY, FONT_SANS, money, useAviso } from '@/components/PaginaPortal';
import { BarrasVerticais, BarrasHorizontais, BarraSegmentada, Progresso } from '@/components/admin/GraficosKipi';
import {
  useEstabelecimentos,
  situacaoMensalidade,
  mensalidadesEmAberto,
  proximoVencimento,
  criarEstabelecimento,
  atualizarEstabelecimento,
  registrarMensalidade,
  usuariosDoEstabelecimento,
  PLANOS,
  type Estabelecimento,
  type PlanoKipi,
} from '@/lib/acesso';

// ============================================================================
// PAINEL KIPI (ADMINISTRAÇÃO DO SISTEMA) — o negócio Kipi: receita, cobrança, planos e
// crescimento. Daqui não se vê nada de dentro das empresas (vendas, clientes, receitas).
// ============================================================================
type Filtro = 'todos' | 'em_dia' | 'a_vencer' | 'atrasada' | 'teste' | 'bloqueado';

const DIAS_DE_TESTE = 14;
const POR_PAGINA = 8;
const DIA_MS = 86400000;

const SITUACAO = {
  em_dia: { texto: 'Em dia', cor: COR.verde, fundo: COR.verdeClaro },
  a_vencer: { texto: 'A vencer', cor: COR.azulForte, fundo: COR.azulClaro },
  atrasada: { texto: 'Atrasada', cor: COR.vermelho, fundo: COR.vermelhoClaro },
  teste: { texto: 'Em teste', cor: COR.ambar, fundo: COR.ambarClaro },
};

const FORM_VAZIO = { nome: '', donaNome: '', donaEmail: '', senha: '', telefone: '', cidade: '', plano: 'Profissional' as PlanoKipi, dia: '10', emTeste: true };

const moneyCurto = (v: number) => (v >= 1000 ? `R$ ${(v / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil` : money(v).replace(',00', ''));
const iniciais = (nome: string) => nome.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
const mesCurto = (mesesAtras: number) => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - mesesAtras, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
};
const mesmoMes = (iso: string, mesesAtras: number) => {
  const d = new Date(iso);
  const ref = new Date();
  const alvo = new Date(ref.getFullYear(), ref.getMonth() - mesesAtras, 1);
  return d.getFullYear() === alvo.getFullYear() && d.getMonth() === alvo.getMonth();
};

// Cartão de indicador do topo
function CartaoKpi(props: { icone: keyof typeof Feather.glyphMap; cor: string; fundo: string; rotulo: string; valor: string; sub: React.ReactNode; children?: React.ReactNode; onPress?: () => void }) {
  const Corpo = (
    <>
      <View style={st.kpiTopo}>
        <View style={[st.kpiIcone, { backgroundColor: props.fundo }]}>
          <Feather name={props.icone} size={15} color={props.cor} />
        </View>
        <Text style={st.kpiRotulo}>{props.rotulo}</Text>
      </View>
      <Text style={st.kpiValor}>{props.valor}</Text>
      {props.children}
      <Text style={st.kpiSub}>{props.sub}</Text>
    </>
  );
  return props.onPress ? (
    <TouchableOpacity style={st.kpiCard} onPress={props.onPress} activeOpacity={0.85}>
      {Corpo}
    </TouchableOpacity>
  ) : (
    <View style={st.kpiCard}>{Corpo}</View>
  );
}

export default function PainelKipi() {
  const estabelecimentos = useEstabelecimentos();
  const { aviso, avisar } = useAviso();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [busca, setBusca] = useState('');
  const [novoAberto, setNovoAberto] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<Estabelecimento | null>(null);
  const [edicao, setEdicao] = useState({ plano: 'Profissional' as PlanoKipi, mensalidade: '', dia: '' });
  const [pagina, setPagina] = useState(1);
  const [menuAcoes, setMenuAcoes] = useState<string | null>(null);

  // Filtro ou busca novos voltam para a primeira página
  useEffect(() => {
    setPagina(1);
    setMenuAcoes(null);
  }, [filtro, busca]);

  useEffect(() => {
    if (editando) setEdicao({ plano: editando.plano, mensalidade: String(editando.mensalidade).replace('.', ','), dia: String(editando.diaVencimento) });
  }, [editando]);

  // ==========================================================================
  // NÚMEROS DO NEGÓCIO
  // ==========================================================================
  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const ativos = estabelecimentos.filter((e) => e.status === 'ativo');
  const emTeste = estabelecimentos.filter((e) => e.status === 'teste');
  const bloqueados = estabelecimentos.filter((e) => e.status === 'bloqueado');

  // Receita recorrente: soma das mensalidades de quem está ativo
  const mrr = ativos.reduce((a, e) => a + e.mensalidade, 0);
  const mrrAnterior = ativos.filter((e) => new Date(e.criadoEm) < inicioMes).reduce((a, e) => a + e.mensalidade, 0);
  const crescimentoMrr = mrrAnterior > 0 ? Math.round(((mrr - mrrAnterior) / mrrAnterior) * 100) : 0;
  const ticketMedio = ativos.length > 0 ? mrr / ativos.length : 0;

  const pagamentosDoMes = (m: number) => estabelecimentos.flatMap((e) => e.pagamentos.filter((p) => mesmoMes(p.data, m)));
  const recebidoMes = pagamentosDoMes(0).reduce((a, p) => a + p.valor, 0);
  const pctRecebido = mrr > 0 ? Math.round((recebidoMes / mrr) * 100) : 0;

  const atrasados = estabelecimentos
    .filter((e) => e.status !== 'teste')
    .map((e) => ({ e, abertas: mensalidadesEmAberto(e) }))
    .filter((x) => x.abertas.length > 0)
    .sort((a, b) => b.abertas.length - a.abertas.length);
  const valorEmAberto = atrasados.reduce((a, x) => a + x.abertas.length * x.e.mensalidade, 0);
  const novos30 = estabelecimentos.filter((e) => hoje.getTime() - new Date(e.criadoEm).getTime() <= 30 * DIA_MS).length;

  // Gráficos (últimos 6 meses)
  const meses = [5, 4, 3, 2, 1, 0];
  const receitaPorMes = meses.map((m) => {
    const lista = pagamentosDoMes(m);
    return { rotulo: mesCurto(m), valor: lista.reduce((a, p) => a + p.valor, 0), detalhe: `${lista.length} pagamentos` };
  });
  const novosPorMes = meses.map((m) => {
    const n = estabelecimentos.filter((e) => mesmoMes(e.criadoEm, m)).length;
    return { rotulo: mesCurto(m), valor: n, detalhe: n === 1 ? '1 empresa' : `${n} empresas` };
  });
  const situacoes = estabelecimentos.map((e) => (e.status === 'bloqueado' ? 'bloqueado' : situacaoMensalidade(e)));
  const contar = (sit: string) => situacoes.filter((x) => x === sit).length;
  const receitaPorPlano = PLANOS.map((p) => {
    const doPlano = ativos.filter((e) => e.plano === p.id);
    const valor = doPlano.reduce((a, e) => a + e.mensalidade, 0);
    return {
      rotulo: p.id,
      valor,
      detalhe: `${doPlano.length} ${doPlano.length === 1 ? 'empresa' : 'empresas'} · ${mrr > 0 ? Math.round((valor / mrr) * 100) : 0}% da receita`,
    };
  });

  // Atenção agora: testes acabando e vencimentos dos próximos 7 dias
  const testes = emTeste
    .map((e) => ({ e, restam: DIAS_DE_TESTE - Math.floor((hoje.getTime() - new Date(e.criadoEm).getTime()) / DIA_MS) }))
    .sort((a, b) => a.restam - b.restam);
  const vencendo = ativos
    .filter((e) => situacaoMensalidade(e) === 'a_vencer')
    .map((e) => ({ e, data: proximoVencimento(e) }))
    .filter((x) => x.data.getTime() - hoje.getTime() <= 7 * DIA_MS)
    .sort((a, b) => a.data.getTime() - b.data.getTime());

  // Tabela
  const filtrar = (e: Estabelecimento) => {
    if (filtro === 'todos') return true;
    if (filtro === 'bloqueado') return e.status === 'bloqueado';
    return e.status !== 'bloqueado' && situacaoMensalidade(e) === filtro;
  };
  const termo = busca.trim().toLowerCase();
  const lista = estabelecimentos
    .filter(filtrar)
    .filter((e) => !termo || [e.nome, e.donaNome, e.donaEmail, e.cidade].some((t) => t.toLowerCase().includes(termo)));

  // Paginação da tabela e menu de ações (um por linha)
  const totalPaginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicioPagina = (paginaAtual - 1) * POR_PAGINA;
  const paginaLista = lista.slice(inicioPagina, inicioPagina + POR_PAGINA);
  const acao = (fn: () => void) => {
    setMenuAcoes(null);
    fn();
  };

  const receber = (e: Estabelecimento) => {
    registrarMensalidade(e.id, e.mensalidade);
    avisar(`💰 Mensalidade de ${e.nome} registrada (${money(e.mensalidade)})`);
  };

  const criar = () => {
    if (!form.nome.trim() || !form.donaNome.trim()) return setErro('Informe o nome da empresa e do responsável.');
    if (!/^\S+@\S+\.\S+$/.test(form.donaEmail.trim())) return setErro('Informe um e-mail válido para o acesso do responsável.');
    if (form.senha.length < 6) return setErro('A senha inicial precisa de pelo menos 6 caracteres.');
    const dia = parseInt(form.dia, 10);
    if (!(dia >= 1 && dia <= 28)) return setErro('Dia de vencimento entre 1 e 28.');
    const falha = criarEstabelecimento({ ...form, diaVencimento: dia });
    if (falha) return setErro(falha);
    avisar(`✨ ${form.nome.trim()} criada · o responsável já entra com ${form.donaEmail.trim().toLowerCase()}`);
    setNovoAberto(false);
  };

  const salvarEdicao = () => {
    if (!editando) return;
    const mensalidade = parseFloat(edicao.mensalidade.replace(',', '.'));
    const dia = parseInt(edicao.dia, 10);
    if (!(mensalidade > 0) || !(dia >= 1 && dia <= 28)) return;
    atualizarEstabelecimento(editando.id, { plano: edicao.plano, mensalidade, diaVencimento: dia });
    avisar(`✓ ${editando.nome} atualizada`);
    setEditando(null);
  };

  return (
    <PaginaPortal
      rota="/admin"
      etiqueta="KIPI · PAINEL DO SISTEMA"
      titulo="Visão do negócio"
      subtitulo={`${hoje.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })} · receita, cobrança e crescimento das empresas`}
      aviso={aviso}
      acoes={
        <TouchableOpacity
          style={s.btnPri}
          onPress={() => {
            setForm(FORM_VAZIO);
            setErro(null);
            setNovoAberto(true);
          }}>
          <Feather name="plus" size={14} color="#FFFFFF" />
          <Text style={s.btnPriText}>Nova empresa</Text>
        </TouchableOpacity>
      }>
      {/* ===================== INDICADORES ===================== */}
      <View style={st.kpiGrid}>
        <CartaoKpi
          icone="trending-up"
          cor={COR.azulForte}
          fundo={COR.azulClaro}
          rotulo="RECEITA RECORRENTE"
          valor={money(mrr)}
          sub={
            <>
              <Text style={{ color: crescimentoMrr >= 0 ? COR.verde : COR.vermelho, fontWeight: '800' }}>
                {crescimentoMrr >= 0 ? '▲' : '▼'} {Math.abs(crescimentoMrr)}%
              </Text>{' '}
              vs mês passado · {moneyCurto(mrr * 12)}/ano
            </>
          }
        />
        <CartaoKpi icone="dollar-sign" cor={COR.verde} fundo={COR.verdeClaro} rotulo="RECEBIDO NO MÊS" valor={money(recebidoMes)} sub={`${pctRecebido}% de ${money(mrr)} esperados`}>
          <Progresso pct={pctRecebido} cor={COR.verde} />
        </CartaoKpi>
        <CartaoKpi
          icone="home"
          cor="#334155"
          fundo="#F1F5F9"
          rotulo="EMPRESAS PAGANTES"
          valor={String(ativos.length)}
          sub={`+${novos30} novos em 30 dias · ticket ${money(ticketMedio)}`}
        />
        <CartaoKpi
          icone="alert-triangle"
          cor={atrasados.length > 0 ? COR.vermelho : COR.verde}
          fundo={atrasados.length > 0 ? COR.vermelhoClaro : COR.verdeClaro}
          rotulo="INADIMPLÊNCIA"
          valor={money(valorEmAberto)}
          sub={`${atrasados.length} ${atrasados.length === 1 ? 'empresa' : 'empresas'} · ${mrr > 0 ? Math.round((valorEmAberto / mrr) * 100) : 0}% da receita`}
          onPress={() => setFiltro('atrasada')}
        />
        <CartaoKpi
          icone="clock"
          cor={COR.ambar}
          fundo={COR.ambarClaro}
          rotulo="EM TESTE"
          valor={String(emTeste.length)}
          sub={`${money(emTeste.reduce((a, e) => a + e.mensalidade, 0))}/mês se converterem`}
          onPress={() => setFiltro('teste')}
        />
      </View>

      {/* ===================== GRÁFICOS ===================== */}
      <View style={st.linhaCards}>
        <View style={[s.card, { flexBasis: 520 }]}>
          <View style={s.cardHeader}>
            <View>
              <Text style={s.cardTitle}>Receita recebida por mês</Text>
              <Text style={s.cardSub}>Mensalidades pagas nos últimos 6 meses</Text>
            </View>
            <Text style={st.destaque}>{money(receitaPorMes.reduce((a, d) => a + d.valor, 0))}</Text>
          </View>
          <BarrasVerticais dados={receitaPorMes} formatar={moneyCurto} altura={170} />
        </View>

        <View style={[s.card, { flexBasis: 300 }]}>
          <View style={s.cardHeader}>
            <View>
              <Text style={s.cardTitle}>Situação das mensalidades</Text>
              <Text style={s.cardSub}>{estabelecimentos.length} empresas cadastradas</Text>
            </View>
          </View>
          <BarraSegmentada
            segmentos={[
              { rotulo: 'Em dia', valor: contar('em_dia'), cor: COR.verde, icone: '✓' },
              { rotulo: 'A vencer', valor: contar('a_vencer'), cor: '#93C5FD', icone: '◷' },
              { rotulo: 'Atrasada', valor: contar('atrasada'), cor: COR.vermelho, icone: '!' },
              { rotulo: 'Em teste', valor: contar('teste'), cor: '#FBBF24', icone: '◔' },
              { rotulo: 'Bloqueada', valor: bloqueados.length, cor: '#94A3B8', icone: '🔒' },
            ]}
          />
        </View>
      </View>

      <View style={st.linhaCards}>
        <View style={[s.card, { flexBasis: 280 }]}>
          <View style={s.cardHeader}>
            <View>
              <Text style={s.cardTitle}>Receita por plano</Text>
              <Text style={s.cardSub}>Mensalidades ativas</Text>
            </View>
          </View>
          <BarrasHorizontais dados={receitaPorPlano} formatar={money} />
        </View>

        <View style={[s.card, { flexBasis: 280 }]}>
          <View style={s.cardHeader}>
            <View>
              <Text style={s.cardTitle}>Novas empresas</Text>
              <Text style={s.cardSub}>Cadastros por mês</Text>
            </View>
            <Text style={st.destaque}>+{novosPorMes.reduce((a, d) => a + d.valor, 0)}</Text>
          </View>
          <BarrasVerticais dados={novosPorMes} formatar={(v) => String(Math.round(v))} altura={130} />
        </View>

        <View style={[s.card, { flexBasis: 320 }]}>
          <View style={s.cardHeader}>
            <View>
              <Text style={s.cardTitle}>Atenção agora</Text>
              <Text style={s.cardSub}>Cobranças, testes e vencimentos da semana</Text>
            </View>
          </View>
          {atrasados.length + testes.length + vencendo.length === 0 && <Text style={s.vazio}>Tudo em dia 🎉</Text>}
          {atrasados.map(({ e, abertas }) => (
            <View key={`atr-${e.id}`} style={s.linha}>
              <View style={[st.ponto, { backgroundColor: COR.vermelho }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.linhaNome} numberOfLines={1}>{e.nome}</Text>
                <Text style={s.linhaSub}>
                  {abertas.length} {abertas.length === 1 ? 'mensalidade' : 'mensalidades'} em aberto · {money(abertas.length * e.mensalidade)}
                  {e.status === 'bloqueado' ? ' · bloqueada' : ''}
                </Text>
              </View>
              <TouchableOpacity style={s.btnMini} onPress={() => receber(e)}>
                <Text style={[s.btnMiniText, { color: COR.verde }]}>Recebi</Text>
              </TouchableOpacity>
            </View>
          ))}
          {testes.map(({ e, restam }) => (
            <View key={`tst-${e.id}`} style={s.linha}>
              <View style={[st.ponto, { backgroundColor: COR.ambar }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.linhaNome} numberOfLines={1}>{e.nome}</Text>
                <Text style={s.linhaSub}>
                  {restam > 0 ? `Teste termina em ${restam} ${restam === 1 ? 'dia' : 'dias'}` : 'Teste encerrado'} · {e.plano}
                </Text>
              </View>
              <TouchableOpacity style={s.btnMini} onPress={() => receber(e)}>
                <Text style={[s.btnMiniText, { color: COR.azulForte }]}>Ativar</Text>
              </TouchableOpacity>
            </View>
          ))}
          {vencendo.map(({ e, data }) => (
            <View key={`vnc-${e.id}`} style={s.linha}>
              <View style={[st.ponto, { backgroundColor: COR.azul }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.linhaNome} numberOfLines={1}>{e.nome}</Text>
                <Text style={s.linhaSub}>Vence {data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} · {money(e.mensalidade)}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* ===================== EMPRESAS ===================== */}
      <View style={[s.card, st.tabelaCard]}>
        <View style={[s.cardHeader, { flexWrap: 'wrap' }]}>
          <View>
            <Text style={s.cardTitle}>Empresas</Text>
            <Text style={s.cardSub}>{lista.length} de {estabelecimentos.length}</Text>
          </View>
          <View style={s.busca}>
            <Feather name="search" size={14} color="#94A3B8" />
            <TextInput style={s.buscaInput} placeholder="Empresa, responsável, e-mail ou cidade" placeholderTextColor="#94A3B8" value={busca} onChangeText={setBusca} />
          </View>
        </View>
        <View style={s.filtros}>
          {([
            { id: 'todos', label: 'Todas', n: estabelecimentos.length },
            { id: 'em_dia', label: 'Em dia', n: contar('em_dia') },
            { id: 'a_vencer', label: 'A vencer', n: contar('a_vencer') },
            { id: 'atrasada', label: 'Atrasadas', n: contar('atrasada') },
            { id: 'teste', label: 'Em teste', n: contar('teste') },
            { id: 'bloqueado', label: 'Bloqueadas', n: bloqueados.length },
          ] as { id: Filtro; label: string; n: number }[]).map((f) => (
            <TouchableOpacity key={f.id} style={[s.chip, filtro === f.id && s.chipAtivo]} onPress={() => setFiltro(f.id)}>
              <Text style={[s.chipText, filtro === f.id && s.chipTextAtivo]}>
                {f.label} · {f.n}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={st.cabecalho}>
          <Text style={[st.th, st.colEmpresa]}>EMPRESA</Text>
          <Text style={[st.th, st.colCidade]}>CIDADE · ACESSOS</Text>
          <Text style={[st.th, st.colPlano]}>PLANO</Text>
          <Text style={[st.th, st.colValor, { textAlign: 'right' }]}>MENSALIDADE</Text>
          <Text style={[st.th, st.colSituacao, { textAlign: 'right' }]}>SITUAÇÃO</Text>
          <Text style={[st.th, st.colAcoes, { textAlign: 'right' }]}>AÇÕES</Text>
        </View>
        {paginaLista.length === 0 ? (
          <Text style={s.vazio}>Nenhuma empresa neste filtro.</Text>
        ) : (
          paginaLista.map((e) => {
            const situacao = situacaoMensalidade(e);
            const bloqueado = e.status === 'bloqueado';
            const acessos = usuariosDoEstabelecimento(e.id).length;
            const abertas = mensalidadesEmAberto(e).length;
            const menuAberto = menuAcoes === e.id;
            return (
              // A linha com o menu aberto fica por cima das de baixo
              <View key={e.id} style={[s.linha, { paddingVertical: 9 }, menuAberto && { zIndex: 20 }]}>
                <View style={[st.colEmpresa, { flexDirection: 'row', alignItems: 'center', gap: 10 }, bloqueado && { opacity: 0.6 }]}>
                  <View style={st.avatar}>
                    <Text style={st.avatarTexto}>{iniciais(e.nome)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.linhaNome} numberOfLines={1}>{e.nome}</Text>
                    <Text style={s.linhaSub} numberOfLines={1}>{e.donaNome} · {e.donaEmail}</Text>
                  </View>
                </View>
                <View style={[st.colCidade, bloqueado && { opacity: 0.6 }]}>
                  <Text style={s.linhaSub} numberOfLines={1}>{e.cidade || '—'}</Text>
                  <Text style={s.linhaSub} numberOfLines={1}>
                    {acessos} {acessos === 1 ? 'acesso' : 'acessos'} · desde {new Date(e.criadoEm).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                  </Text>
                </View>
                <View style={st.colPlano}>
                  <Pill texto={e.plano} cor="#334155" fundo="#F1F5F9" />
                </View>
                <View style={st.colValor}>
                  <Text style={s.linhaValor}>{money(e.mensalidade)}</Text>
                  <Text style={[s.linhaSub, { textAlign: 'right' }]}>vence dia {e.diaVencimento}</Text>
                </View>
                <View style={[st.colSituacao, { alignItems: 'flex-end' }]}>
                  {bloqueado ? <Pill texto="🔒 Bloqueada" cor={COR.suave} fundo="#F1F5F9" /> : <Pill {...SITUACAO[situacao]} />}
                  {abertas > 0 && <Text style={[s.linhaSub, { color: COR.vermelho }]}>{abertas} em aberto</Text>}
                </View>
                <View style={[st.colAcoes, { alignItems: 'flex-end' }]}>
                  <TouchableOpacity style={[s.btnMini, st.btnAcoes, menuAberto && st.btnAcoesAtivo]} onPress={() => setMenuAcoes(menuAberto ? null : e.id)}>
                    <Text style={s.btnMiniText}>Ações</Text>
                    <Feather name={menuAberto ? 'chevron-up' : 'chevron-down'} size={13} color="#334155" />
                  </TouchableOpacity>
                  {menuAberto && (
                    <View style={st.menu}>
                      {!bloqueado && situacao !== 'em_dia' && (
                        <TouchableOpacity style={st.menuItem} onPress={() => acao(() => receber(e))}>
                          <Feather name="dollar-sign" size={13} color={COR.verde} />
                          <Text style={[st.menuTexto, { color: COR.verde }]}>{situacao === 'teste' ? 'Ativar (recebi 1ª mensalidade)' : 'Registrar pagamento'}</Text>
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity style={st.menuItem} onPress={() => acao(() => setEditando(e))}>
                        <Feather name="sliders" size={13} color="#334155" />
                        <Text style={st.menuTexto}>Plano e cobrança</Text>
                      </TouchableOpacity>
                      <View style={st.menuDivisor} />
                      <TouchableOpacity
                        style={st.menuItem}
                        onPress={() =>
                          acao(() => {
                            atualizarEstabelecimento(e.id, { status: bloqueado ? 'ativo' : 'bloqueado' });
                            avisar(bloqueado ? `🔓 ${e.nome} desbloqueada` : `🔒 ${e.nome} bloqueada · ninguém da empresa consegue entrar`);
                          })
                        }>
                        <Feather name={bloqueado ? 'unlock' : 'lock'} size={13} color={bloqueado ? COR.verde : COR.vermelho} />
                        <Text style={[st.menuTexto, { color: bloqueado ? COR.verde : COR.vermelho }]}>{bloqueado ? 'Desbloquear acesso' : 'Bloquear acesso'}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}

        {/* PAGINAÇÃO */}
        {totalPaginas > 1 && (
          <View style={st.paginacao}>
            <Text style={s.linhaSub}>
              {inicioPagina + 1}–{Math.min(inicioPagina + POR_PAGINA, lista.length)} de {lista.length}
            </Text>
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <TouchableOpacity style={[s.btnMini, paginaAtual === 1 && { opacity: 0.4 }]} disabled={paginaAtual === 1} onPress={() => setPagina(paginaAtual - 1)}>
                <Feather name="chevron-left" size={13} color="#334155" />
              </TouchableOpacity>
              {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((n) => (
                <TouchableOpacity key={n} style={[s.btnMini, n === paginaAtual && st.paginaAtiva]} onPress={() => setPagina(n)}>
                  <Text style={[s.btnMiniText, n === paginaAtual && { color: '#FFFFFF' }]}>{n}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity style={[s.btnMini, paginaAtual === totalPaginas && { opacity: 0.4 }]} disabled={paginaAtual === totalPaginas} onPress={() => setPagina(paginaAtual + 1)}>
                <Feather name="chevron-right" size={13} color="#334155" />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* NOVA EMPRESA: cria a empresa (vazia) e o acesso do responsável */}
      <Modal visible={novoAberto} transparent animationType="fade" onRequestClose={() => setNovoAberto(false)}>
        <View style={s.overlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>Nova empresa</Text>
            <Text style={s.cardSub}>A empresa começa vazia; só o responsável vê e cadastra os dados dela.</Text>
            <ScrollView style={{ flexShrink: 1 }}>
              {erro && <Text style={s.erro}>{erro}</Text>}
              <Text style={s.label}>NOME DA EMPRESA</Text>
              <TextInput style={s.input} value={form.nome} onChangeText={(t) => setForm({ ...form, nome: t })} placeholder="Ex.: Doces da Lu Ltda." placeholderTextColor="#94A3B8" />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>RESPONSÁVEL</Text>
                  <TextInput style={s.input} value={form.donaNome} onChangeText={(t) => setForm({ ...form, donaNome: t })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>TELEFONE</Text>
                  <TextInput style={s.input} value={form.telefone} onChangeText={(t) => setForm({ ...form, telefone: t })} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1.4 }}>
                  <Text style={s.label}>E-MAIL DE ACESSO</Text>
                  <TextInput style={s.input} autoCapitalize="none" keyboardType="email-address" value={form.donaEmail} onChangeText={(t) => setForm({ ...form, donaEmail: t })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>SENHA INICIAL</Text>
                  <TextInput style={s.input} value={form.senha} onChangeText={(t) => setForm({ ...form, senha: t })} placeholder="mín. 6" placeholderTextColor="#94A3B8" />
                </View>
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1.4 }}>
                  <Text style={s.label}>CIDADE/UF</Text>
                  <TextInput style={s.input} value={form.cidade} onChangeText={(t) => setForm({ ...form, cidade: t })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>DIA DE VENCIMENTO</Text>
                  <TextInput style={s.input} keyboardType="numeric" value={form.dia} onChangeText={(t) => setForm({ ...form, dia: t.replace(/\D/g, '').slice(0, 2) })} />
                </View>
              </View>
              <Text style={s.label}>PLANO</Text>
              <View style={{ gap: 6 }}>
                {PLANOS.map((p) => {
                  const ativo = form.plano === p.id;
                  return (
                    <TouchableOpacity key={p.id} style={[s.linha, { borderTopWidth: 0, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: ativo ? COR.azul : COR.borda, backgroundColor: ativo ? COR.azulClaro : '#FFFFFF' }]} onPress={() => setForm({ ...form, plano: p.id })}>
                      <Feather name={ativo ? 'check-circle' : 'circle'} size={14} color={ativo ? COR.azulForte : '#94A3B8'} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.linhaNome}>{p.id}</Text>
                        <Text style={s.linhaSub}>{p.descricao}</Text>
                      </View>
                      <Text style={s.linhaValor}>{money(p.preco)}/mês</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity style={[s.chip, { alignSelf: 'flex-start', marginTop: 10 }, form.emTeste && s.chipAtivo]} onPress={() => setForm({ ...form, emTeste: !form.emTeste })}>
                <Text style={[s.chipText, form.emTeste && s.chipTextAtivo]}>{form.emTeste ? '✓ ' : ''}Começa em período de teste</Text>
              </TouchableOpacity>
            </ScrollView>
            <View style={s.rodape}>
              <TouchableOpacity style={s.btnSec} onPress={() => setNovoAberto(false)}>
                <Text style={s.btnSecText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnPri} onPress={criar}>
                <Text style={s.btnPriText}>Criar empresa e acesso</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* PLANO E COBRANÇA DA EMPRESA */}
      <Modal visible={editando !== null} transparent animationType="fade" onRequestClose={() => setEditando(null)}>
        <View style={s.overlay}>
          {editando && (
            <View style={s.modal}>
              <Text style={s.modalTitle}>{editando.nome}</Text>
              <Text style={s.cardSub}>Plano, mensalidade e pagamentos recebidos</Text>
              <Text style={s.label}>PLANO</Text>
              <View style={s.filtros}>
                {PLANOS.map((p) => (
                  <TouchableOpacity
                    key={p.id}
                    style={[s.chip, edicao.plano === p.id && s.chipAtivo]}
                    onPress={() => setEdicao({ ...edicao, plano: p.id, mensalidade: String(p.preco).replace('.', ',') })}>
                    <Text style={[s.chipText, edicao.plano === p.id && s.chipTextAtivo]}>{p.id}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[s.label, { marginTop: 0 }]}>MENSALIDADE (R$)</Text>
                  <TextInput style={s.input} keyboardType="decimal-pad" value={edicao.mensalidade} onChangeText={(t) => setEdicao({ ...edicao, mensalidade: t })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.label, { marginTop: 0 }]}>DIA DE VENCIMENTO</Text>
                  <TextInput style={s.input} keyboardType="numeric" value={edicao.dia} onChangeText={(t) => setEdicao({ ...edicao, dia: t.replace(/\D/g, '').slice(0, 2) })} />
                </View>
              </View>
              <Text style={s.label}>PAGAMENTOS</Text>
              {editando.pagamentos.length === 0 ? (
                <Text style={s.vazio}>Nenhum pagamento ainda.</Text>
              ) : (
                editando.pagamentos.slice(0, 6).map((p) => (
                  <View key={p.id} style={s.linha}>
                    <Text style={s.linhaNome}>Competência {p.competencia.split('-').reverse().join('/')}</Text>
                    <Text style={s.linhaSub}>{new Date(p.data).toLocaleDateString('pt-BR')}</Text>
                    <Text style={[s.linhaValor, { width: 80 }]}>{money(p.valor)}</Text>
                  </View>
                ))
              )}
              <View style={s.rodape}>
                <TouchableOpacity style={s.btnSec} onPress={() => setEditando(null)}>
                  <Text style={s.btnSecText}>Fechar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.btnPri} onPress={salvarEdicao}>
                  <Text style={s.btnPriText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </PaginaPortal>
  );
}

const st = StyleSheet.create({
  // Tabela de empresas: o card cresce com as linhas (sem altura fixa) e o menu pode sair por baixo
  tabelaCard: { flexBasis: 'auto', marginTop: 14, overflow: 'visible', zIndex: 1 },
  colEmpresa: { flex: 2.2, minWidth: 0 },
  colCidade: { flex: 1.3, minWidth: 0 },
  colPlano: { flex: 0.9 },
  colValor: { flex: 0.9 },
  colSituacao: { flex: 0.9 },
  colAcoes: { width: 96, position: 'relative' },
  btnAcoes: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  btnAcoesAtivo: { borderColor: COR.azul, backgroundColor: COR.azulClaro },
  menu: {
    position: 'absolute',
    top: 32,
    right: 0,
    width: 230,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COR.borda,
    paddingVertical: 4,
    zIndex: 30,
    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.14)',
  } as any,
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
  menuTexto: { fontFamily: FONT_SANS, fontSize: 12, fontWeight: '700', color: '#334155' },
  menuDivisor: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 2 },
  paginacao: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, marginTop: 4, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  paginaAtiva: { backgroundColor: COR.azul, borderColor: COR.azul },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 14 },
  kpiCard: { flexGrow: 1, flexBasis: 190, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: COR.borda, padding: 14 },
  kpiTopo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  kpiIcone: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  kpiRotulo: { fontFamily: FONT_SANS, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, color: COR.suave },
  kpiValor: { fontFamily: FONT_DISPLAY, fontSize: 22, fontWeight: '800', color: COR.texto, marginTop: 10, letterSpacing: -0.4 },
  kpiSub: { fontFamily: FONT_SANS, fontSize: 11, color: COR.suave, marginTop: 6 },
  linhaCards: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'stretch', marginBottom: 14 },
  destaque: { fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: '800', color: COR.texto },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 0, borderBottomWidth: 1, borderBottomColor: COR.borda },
  th: { fontFamily: FONT_SANS, fontSize: 9, fontWeight: '800', letterSpacing: 0.6, color: '#94A3B8' },
  avatar: { width: 32, height: 32, borderRadius: 9, backgroundColor: COR.azulClaro, alignItems: 'center', justifyContent: 'center' },
  avatarTexto: { fontFamily: FONT_DISPLAY, fontSize: 11, fontWeight: '800', color: COR.azulForte },
});

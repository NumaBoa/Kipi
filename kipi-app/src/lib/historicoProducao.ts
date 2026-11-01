import { useEffect, useState } from 'react';
import { nomeUsuarioAtual, registrarDadosDoEstabelecimento } from '@/lib/acesso';

// ============================================================================
// HISTÓRICO DE PRODUÇÃO — compartilhado: toda massa que entra no freezer,
// fornada assada, perda ou ajuste vira um registro, venha da tela que vier
// (Produção, Estoque Central ou cadastro de Produtos).
// Fase de testes: só dados de exemplo em memória, nada é lido ou gravado no banco.
// ============================================================================
export type TipoRegistroProducao = 'preparo_massa' | 'assar_fornada' | 'perda' | 'ajuste';

export interface RegistroProducao {
  id: string;
  tipo: TipoRegistroProducao;
  produtoId: string;
  produtoNome: string;
  quantidade: number;
  data: string; // ISO
  horario: string;
  responsavel: string;
  detalhes?: string;
  // Descarte (perda): motivo, de onde saiu e custo de material perdido (R$)
  motivo?: string;
  origem?: 'vitrine' | 'freezer';
  custo?: number;
}

const diasAtras = (dias: number, hora: number, minuto: number) => {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(hora, minuto, 0, 0);
  return d.toISOString();
};

const registro = (
  id: string,
  tipo: TipoRegistroProducao,
  produtoId: string,
  produtoNome: string,
  quantidade: number,
  dias: number,
  hora: number,
  minuto: number,
  responsavel: string,
  detalhes: string
): RegistroProducao => ({
  id,
  tipo,
  produtoId,
  produtoNome,
  quantidade,
  data: diasAtras(dias, hora, minuto),
  horario: `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`,
  responsavel,
  detalhes,
});

const HISTORICO_INICIAL: RegistroProducao[] = [
  registro('forn-1', 'assar_fornada', 'prod-1', 'Cookie Black Nutella', 12, 0, 10, 45, 'Camila Lima', 'Fornada dourada e macia. Direto para a vitrine.'),
  registro('forn-2', 'preparo_massa', 'prod-1', 'Cookie Black Nutella', 24, 0, 9, 30, 'Juliana Carvalho', 'Lote #88 modelado e guardado no freezer a -18°C.'),
  registro('forn-3', 'assar_fornada', 'prod-11', 'Croissant Francês Folhado Manteiga', 6, 0, 8, 15, 'Camila Lima', 'Fornada da manhã para o balcão.'),
  registro('forn-4', 'perda', 'prod-11', 'Croissant Francês Folhado Manteiga', 2, 1, 17, 20, 'Juliana Carvalho', 'Queimou no forno'),
  registro('forn-5', 'assar_fornada', 'prod-4', 'Bento Cake Pistache & Framboesa', 4, 1, 11, 0, 'Camila Lima', '4 unidades assadas e adicionadas à vitrine.'),
  registro('forn-6', 'preparo_massa', 'prod-2', 'Cookie Tradicional Gotas Belga', 36, 2, 9, 10, 'Juliana Carvalho', '36 massas preparadas e armazenadas no freezer.'),
  registro('forn-7', 'assar_fornada', 'prod-2', 'Cookie Tradicional Gotas Belga', 18, 3, 14, 30, 'Camila Lima', '18 unidades assadas e adicionadas à vitrine.'),
  registro('forn-8', 'preparo_massa', 'prod-12', 'Pão de Mel Artesanal Recheado', 20, 5, 8, 40, 'Camila Lima', '20 massas preparadas e armazenadas no freezer.'),
  registro('forn-9', 'perda', 'prod-12', 'Pão de Mel Artesanal Recheado', 3, 6, 18, 0, 'Camila Lima', 'Passou da validade'),
  registro('forn-10', 'assar_fornada', 'prod-12', 'Pão de Mel Artesanal Recheado', 20, 9, 10, 15, 'Juliana Carvalho', '20 unidades assadas e adicionadas à vitrine.'),
  registro('forn-11', 'preparo_massa', 'prod-4', 'Bento Cake Pistache & Framboesa', 10, 12, 9, 0, 'Camila Lima', '10 massas preparadas e armazenadas no freezer.'),
  registro('forn-12', 'assar_fornada', 'prod-1', 'Cookie Black Nutella', 24, 20, 15, 0, 'Camila Lima', '24 unidades assadas e adicionadas à vitrine.'),
  registro('forn-13', 'preparo_massa', 'prod-11', 'Croissant Francês Folhado Manteiga', 30, 35, 8, 30, 'Juliana Carvalho', '30 massas preparadas e armazenadas no freezer.'),
];

// Descartes de exemplo: motivo, origem e custo de material perdido
const DESCARTES_EXEMPLO: Record<string, Pick<RegistroProducao, 'motivo' | 'origem' | 'custo'>> = {
  'forn-4': { motivo: 'Queimou / quebrou', origem: 'vitrine', custo: 8.4 },
  'forn-9': { motivo: 'Vencido', origem: 'vitrine', custo: 8.7 },
  'forn-14': { motivo: 'Doação / brinde', origem: 'vitrine', custo: 8 },
};

let registros: RegistroProducao[] = [
  ...HISTORICO_INICIAL,
  registro('forn-14', 'perda', 'prod-2', 'Cookie Tradicional Gotas Belga', 4, 2, 16, 0, 'Camila Lima', 'Doação / brinde — degustação na feira do bairro'),
]
  .map((r) => ({ ...r, ...DESCARTES_EXEMPLO[r.id] }))
  .sort((a, b) => b.data.localeCompare(a.data));
const ouvintes = new Set<() => void>();
const notificar = () => ouvintes.forEach((fn) => fn());

export const useHistoricoProducao = () => {
  const [, forcarRender] = useState(0);
  useEffect(() => {
    const ouvinte = () => forcarRender((n) => n + 1);
    ouvintes.add(ouvinte);
    return () => {
      ouvintes.delete(ouvinte);
    };
  }, []);
  return registros;
};

registrarDadosDoEstabelecimento('historicoProducao', {
  exportar: () => registros,
  importar: (estado) => {
    registros = (estado as RegistroProducao[] | undefined) ?? [];
    notificar();
  },
});

export const registrarProducao = (
  dados: Omit<RegistroProducao, 'id' | 'data' | 'horario' | 'responsavel'> & { responsavel?: string }
) => {
  if (dados.quantidade <= 0) return;
  const agora = new Date();
  registros = [
    {
      ...dados,
      id: `hist-${agora.getTime()}-${registros.length}`,
      data: agora.toISOString(),
      horario: agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      responsavel: dados.responsavel ?? nomeUsuarioAtual(),
    },
    ...registros,
  ];
  notificar();
};

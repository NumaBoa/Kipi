import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TipoComissao } from '@/lib/revenda';
import {
  useSessao,
  sair,
  atualizarDadosDoUsuario,
  trocarSenhaDoUsuario,
  estabelecimentoAtualId,
  nomeDoEstabelecimento,
  registrarDadosDoEstabelecimento,
  ESTABELECIMENTO_EXEMPLO,
} from '@/lib/acesso';

// ============================================================================
// CONFIGURAÇÕES DO ESTABELECIMENTO (cada ateliê tem as suas)
// ============================================================================
export interface ConfigLoja {
  nome: string;
  slogan: string;
  logoUri: string | null; // data URI (base64) da imagem
  documento: string; // CNPJ ou CPF
  telefone: string;
  email: string;
  instagram: string;
  endereco: string;
  cidade: string;
  estado: string;
  chavePix: string; // vai na mensagem de WhatsApp do pedido
  comissaoPadraoTipo: TipoComissao;
  comissaoPadraoValor: number;
}

export const CONFIG_PADRAO: ConfigLoja = {
  nome: 'AtelierQ',
  slogan: 'Pâtisserie Gourmet',
  logoUri: null,
  documento: '',
  telefone: '',
  email: '',
  instagram: '',
  endereco: '',
  cidade: '',
  estado: '',
  chavePix: '',
  comissaoPadraoTipo: 'porcentagem',
  comissaoPadraoValor: 15,
};

// O ateliê de exemplo continua usando a chave antiga (não perde o que já foi salvo)
const chaveConfig = (id: string) => (id === ESTABELECIMENTO_EXEMPLO ? 'kipi:config-loja' : `kipi:config-loja:${id}`);
const configInicial = (id: string): ConfigLoja =>
  id === ESTABELECIMENTO_EXEMPLO ? CONFIG_PADRAO : { ...CONFIG_PADRAO, nome: nomeDoEstabelecimento(id) || 'Meu Ateliê', slogan: '' };

// Estado compartilhado entre telas (menu lateral, configurações, acessos...)
let configAtual: ConfigLoja = CONFIG_PADRAO;
let carregadoPara: string | null = null;
const ouvintes = new Set<() => void>();
const notificar = () => ouvintes.forEach((fn) => fn());

// Banco ligado (lib/sincronizacao): a configuração do ateliê vem da tabela empresas
interface FonteConfig {
  atende: (id: string) => boolean;
  ler: (id: string) => Promise<Partial<ConfigLoja> | null>;
  gravar: (id: string, config: ConfigLoja) => Promise<void>;
}
let fonteRemota: FonteConfig | null = null;
export const usarFonteRemotaConfig = (fonte: FonteConfig) => {
  fonteRemota = fonte;
  carregadoPara = null; // relê na próxima vez
};

// Sem banco: configurações ficam só no aparelho
const carregarConfig = async () => {
  const id = estabelecimentoAtualId();
  if (carregadoPara === id) return;
  carregadoPara = id;
  configAtual = configInicial(id);
  notificar();
  if (fonteRemota?.atende(id)) {
    try {
      const lida = await fonteRemota.ler(id);
      if (lida && carregadoPara === id) {
        configAtual = { ...configInicial(id), ...lida };
        notificar();
      }
    } catch {
      // mantém os padrões
    }
    return;
  }
  try {
    const salva = await AsyncStorage.getItem(chaveConfig(id));
    if (salva && carregadoPara === id) {
      configAtual = { ...configInicial(id), ...JSON.parse(salva) };
      notificar();
    }
  } catch {
    // mantém os padrões
  }
};

registrarDadosDoEstabelecimento('config', {
  exportar: () => null,
  importar: () => {
    carregarConfig();
  },
});

const assinarConfig = (fn: () => void) => {
  ouvintes.add(fn);
  carregarConfig();
  return () => {
    ouvintes.delete(fn);
  };
};

// useSyncExternalStore: a tela sempre recebe a configuração atual (seguro com o React Compiler)
export const useConfigLoja = () => {
  const config = useSyncExternalStore(assinarConfig, () => configAtual, () => configAtual);
  const { sessao } = useSessao();
  return { config, sessao };
};

// ============================================================================
// AÇÕES
// ============================================================================
export const encerrarSessao = sair;

// Salva só no aparelho (fase de testes). Mantém o retorno para a tela mostrar o aviso de sucesso.
export const salvarConfigLoja = async (nova: ConfigLoja): Promise<boolean> => {
  configAtual = nova;
  notificar();
  const id = estabelecimentoAtualId();
  if (fonteRemota?.atende(id)) {
    try {
      await fonteRemota.gravar(id, nova);
      return true;
    } catch {
      return false;
    }
  }
  try {
    await AsyncStorage.setItem(chaveConfig(estabelecimentoAtualId()), JSON.stringify(nova));
  } catch {
    // fica só em memória
  }
  return true;
};

export const atualizarPerfil = (nome: string, email: string): Promise<string | null> => atualizarDadosDoUsuario(nome, email);

// Fase de testes: confere e troca a senha do usuário de teste (some ao recarregar a página)
// Retorna null em caso de sucesso, ou a mensagem de erro
export const trocarSenha = async (senhaAtual: string, novaSenha: string): Promise<string | null> => {
  if (!senhaAtual) return 'Informe a senha atual.';
  return trocarSenhaDoUsuario(senhaAtual, novaSenha);
};

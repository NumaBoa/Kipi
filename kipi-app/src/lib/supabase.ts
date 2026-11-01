import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// ============================================================================
// BANCO — só liga quando o kipi-app/.env tem URL e chave (sem .env: dados de exemplo).
// A área (schema) vem do .env: "hml" nos testes, "public" depois da virada.
// Sem valores fixos aqui: nada aponta para um banco sem querer.
// ============================================================================
const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const chave = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const SCHEMA_BANCO = process.env.EXPO_PUBLIC_SUPABASE_SCHEMA || 'hml';

export const bancoLigado = url.startsWith('http') && chave.length > 0;

export const supabase: SupabaseClient<any, string, any> | null = bancoLigado
  ? createClient<any, string, any>(url, chave, {
      db: { schema: SCHEMA_BANCO },
      auth: {
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

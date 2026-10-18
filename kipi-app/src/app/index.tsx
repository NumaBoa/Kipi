import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [dbStatus, setDbStatus] = useState<{
    produtosCount: number;
    vendasCount: number;
    empresaNome: string;
    error?: string;
  } | null>(null);

  const testConnection = async () => {
    setLoading(true);
    try {
      const { data: emp, error: empErr } = await supabase.from('empresas').select('nome').limit(1).maybeSingle();
      const { count: prodCount, error: prodErr } = await supabase.from('produtos').select('*', { count: 'exact', head: true });
      const { count: venCount, error: venErr } = await supabase.from('vendas').select('*', { count: 'exact', head: true });

      if (empErr || prodErr || venErr) {
        setDbStatus({
          produtosCount: 0,
          vendasCount: 0,
          empresaNome: '',
          error: empErr?.message || prodErr?.message || venErr?.message,
        });
      } else {
        setDbStatus({
          produtosCount: prodCount || 0,
          vendasCount: venCount || 0,
          empresaNome: emp?.nome || 'Ateliê',
        });
      }
    } catch (e: any) {
      setDbStatus({
        produtosCount: 0,
        vendasCount: 0,
        empresaNome: '',
        error: e.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    testConnection();
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.badge}>KIPI • HOMOLOGAÇÃO</Text>
          <Text style={styles.title}>React Native + Expo</Text>
          <Text style={styles.subtitle}>
            Ambiente mobile e web inicializado e conectado ao novo Supabase.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Status do Banco de Dados</Text>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color="#6366f1" />
              <Text style={styles.loadingText}>Verificando dados em tempo real...</Text>
            </View>
          ) : dbStatus?.error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>Erro de conexão: {dbStatus.error}</Text>
            </View>
          ) : (
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>✅ Conectado</Text>
                <Text style={styles.statLabel}>{dbStatus?.empresaNome}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{dbStatus?.produtosCount}</Text>
                <Text style={styles.statLabel}>Produtos em Estoque</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{dbStatus?.vendasCount}</Text>
                <Text style={styles.statLabel}>Vendas Clonadas</Text>
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.button} onPress={testConnection}>
            <Text style={styles.buttonText}>Atualizar Conexão</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>🎨 Próximo Passo:</Text>
          <Text style={styles.infoDesc}>
            Envie a prototipação e o design system (cores, tipografia, telas) para iniciarmos a primeira página do aplicativo!
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    padding: 24,
    alignItems: 'center',
    gap: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  badge: {
    backgroundColor: '#312e81',
    color: '#818cf8',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f8fafc',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
    maxWidth: 400,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 480,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f1f5f9',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  errorBox: {
    backgroundColor: '#451a1a',
    padding: 12,
    borderRadius: 8,
  },
  errorText: {
    color: '#f87171',
    fontSize: 13,
  },
  statsGrid: {
    gap: 12,
  },
  statItem: {
    backgroundColor: '#0f172a',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  statNumber: {
    color: '#38bdf8',
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2,
  },
  button: {
    backgroundColor: '#4f46e5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  infoCard: {
    backgroundColor: '#1e1b4b',
    borderColor: '#4338ca',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    width: '100%',
    maxWidth: 480,
    gap: 6,
  },
  infoTitle: {
    color: '#a5b4fc',
    fontWeight: '700',
    fontSize: 14,
  },
  infoDesc: {
    color: '#e0e7ff',
    fontSize: 13,
    lineHeight: 20,
  },
});

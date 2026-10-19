import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Platform } from 'react-native';
import '../global.css';

// On Web, ensure browser autofill does not render blue background
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const styleId = 'kipi-autofill-fix';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `
      input:-webkit-autofill,
      input:-webkit-autofill:hover,
      input:-webkit-autofill:focus,
      input:-webkit-autofill:active {
        -webkit-box-shadow: 0 0 0 1000px #FFFFFF inset !important;
        box-shadow: 0 0 0 1000px #FFFFFF inset !important;
        -webkit-text-fill-color: #0F172A !important;
        transition: background-color 50000s ease-in-out 0s;
        background-color: transparent !important;
      }
      input {
        background-color: transparent !important;
      }
    `;
    document.head.appendChild(style);
  }
}

export default function RootLayout() {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="visao-geral" options={{ headerShown: false }} />
        <Stack.Screen name="pedidos" options={{ headerShown: false }} />
        <Stack.Screen name="explore" options={{ headerShown: false }} />
      </Stack>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E6F1FA',
  },
});

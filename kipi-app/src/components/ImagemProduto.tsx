import React from 'react';
import { Platform, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';

// ============================================================================
// IMAGEM DO PRODUTO — foto (quando a pessoa anexou) ou o ícone escolhido.
// A foto é guardada como data URI JPEG pequena (até 480px), no próprio produto.
// ============================================================================

export function ImagemProduto({
  foto,
  emoji,
  tamanho,
  raio,
  fundo = 'transparent',
  style,
}: {
  foto?: string | null;
  emoji?: string | null;
  tamanho: number;
  raio?: number;
  fundo?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const r = raio ?? Math.round(tamanho * 0.28);
  return (
    <View style={[{ width: tamanho, height: tamanho, borderRadius: r, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: fundo }, style]}>
      {foto ? (
        <Image source={{ uri: foto }} style={{ width: tamanho, height: tamanho }} contentFit="cover" accessibilityIgnoresInvertColors />
      ) : (
        <Text style={{ fontSize: Math.round(tamanho * 0.52) }}>{emoji || '🧁'}</Text>
      )}
    </View>
  );
}

const LADO_MAX = 480;
const TAMANHO_MAX = 450_000; // ~330 KB de imagem

// Na web, reduz a foto num canvas (fotos de celular têm vários MB)
const reduzirNaWeb = (uri: string) =>
  new Promise<string>((resolve, reject) => {
    const img = new (globalThis as any).Image();
    img.onload = () => {
      const escala = Math.min(1, LADO_MAX / Math.max(img.width, img.height));
      const canvas = (globalThis as any).document.createElement('canvas');
      canvas.width = Math.round(img.width * escala);
      canvas.height = Math.round(img.height * escala);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = reject;
    img.src = uri;
  });

// Abre a galeria e devolve a foto pronta para guardar, ou uma mensagem de erro
export const escolherFotoProduto = async (): Promise<{ foto?: string; erro?: string } | null> => {
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: [1, 1],
    quality: Platform.OS === 'web' ? 1 : 0.35,
    base64: Platform.OS !== 'web',
  });
  if (r.canceled || !r.assets[0]) return null;
  const a = r.assets[0];
  try {
    const foto = Platform.OS === 'web' ? await reduzirNaWeb(a.uri) : a.base64 ? `data:image/jpeg;base64,${a.base64}` : a.uri;
    if (foto.length > TAMANHO_MAX) return { erro: 'Foto muito grande. Tente outra imagem ou recorte mais perto do produto.' };
    return { foto };
  } catch {
    return { erro: 'Não foi possível abrir essa imagem. Tente outra.' };
  }
};

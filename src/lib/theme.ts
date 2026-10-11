import { useCallback, useEffect, useState } from "react";

const KEY = "tema-ateliê";

export type Tema = "light" | "dark";

export function aplicarTema(tema: Tema) {
  const root = document.documentElement;
  root.classList.toggle("dark", tema === "dark");
  root.style.colorScheme = tema;
}

export function useTema() {
  const [tema, setTema] = useState<Tema>("light");

  useEffect(() => {
    const salvo = window.localStorage.getItem(KEY) as Tema | null;
    const inicial: Tema =
      salvo ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    setTema(inicial);
    aplicarTema(inicial);
  }, []);

  const alternar = useCallback(() => {
    setTema((atual) => {
      const proximo: Tema = atual === "dark" ? "light" : "dark";
      window.localStorage.setItem(KEY, proximo);
      aplicarTema(proximo);
      return proximo;
    });
  }, []);

  return { tema, alternar };
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/receitas")({
  component: PaginaReceitasRedirect,
});

function PaginaReceitasRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/produtos", search: { aba: "receitas" } as any });
  }, [navigate]);
  return null;
}

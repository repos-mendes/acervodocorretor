import { createFileRoute, redirect } from "@tanstack/react-router";

// A tela de "Início" foi removida para simplificar o app: a experiência do
// corretor é uma única tela com os cards dos empreendimentos. A rota raiz
// apenas encaminha para lá.
export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: () => {
    throw redirect({ to: "/empreendimentos" });
  },
});

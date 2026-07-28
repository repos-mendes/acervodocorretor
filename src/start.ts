import { createStart, createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

import { tratarArquivo } from "./lib/db/arquivos";
import { renderErrorPage } from "./lib/error-page";

// Os arquivos do acervo (capas, materiais, avatares) ficam num bucket privado
// do R2 e são entregues por este atalho, que confere a sessão antes. Precisa
// vir antes do roteamento normal: /arquivos/... não é uma página do site.
const arquivosMiddleware = createMiddleware().server(async ({ next }) => {
  const resposta = await tratarArquivo(getRequest());
  return resposta ?? next();
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [errorMiddleware, arquivosMiddleware],
}));

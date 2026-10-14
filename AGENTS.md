# AGENTS.md

## Diretrizes de Eficiência (obrigatórias)

1. **Planejamento antes de executar**: monte plano interno curto; identifique o objetivo real e corte subtarefas que não impactem o resultado pedido.
2. **Redução de custo**: busque ≥50% menos execuções/tokens que uma abordagem ingênua; combine etapas (buscas/edições em lote), evite repetir contexto já obtido e gere resposta curta quando ela resolve.
3. **Critério de pare**: execute só o necessário; pare ao atingir o objetivo, sem polir além do pedido; escolha sempre o caminho mais curto sem perda de qualidade.
4. **Transparência mínima**: entregue o resultado direto, sem narrar otimizações, salvo pedido.
5. **Qualidade não-negociável**: nunca sacrifique precisão, segurança ou completude essencial; em tarefas profundas, economize cortando redundância, não conteúdo necessário.

## Repo shape

- Site estático de venda (FALITA, pt-BR) em **um único `index.html`** (~36 KB): todo CSS e JS estão inline. Não há build, lint, testes ou CI.
- `package.json` existe apenas como devDependency do CLI `supabase` (sem scripts; `package.json`, `package-lock.json` e `node_modules/` estão untracked no git e não fazem parte do deploy). Não há diretório `supabase/` nem `.env`.
- `Dockerfile` = `nginx:alpine` copiando `index.html` para `/usr/share/nginx/html`.
  - Build/run: `docker build -t falita .` && `docker run -p 8080:80 falita`
  - Dev local: abrir `index.html` direto ou qualquer servidor estático (ex.: `npx serve .`).

## Gotchas

- **Assets são hotlinks externos** (`COCONUDIMUDIAL.b-cdn.net`): imagens, poster e vídeo da VSL não estão no repo. URLs quebradas/renomeadas no CDN derrubam o visual — não "mova" nem regenere assets sem confirmar origem.
- **Bug conhecido (confirmado)**: o script falha em `twObs.observe(document.getElementById('typewriter'))` (`index.html:469`) — o elemento `#typewriter` não existe no HTML. Isso interrompe o `<script>` e impede o `addEventListener('ended')` do hero video de ser registrado (o `onclick="playVideo()"` continua funcionando por hoisting). Ao editar o bloco de script, preserve/contorne essa ordem.
- **Checkout**: CTA "Garantir minha vaga" aponta para `https://pay.kiwify.com.br/TJvEFrx`. Os `href="#"` restantes são CTAs intencionais de play de vídeo/bônus — não troque nenhuma dessas URLs sem pedido explícito.
- Preço da comunidade: `R$ 297,00` (preenchido).
- SEO/OG/JSON-LD vivem no `<head>` do mesmo arquivo; mantenha sincronizados se mudar título/oferta.

## Convenções

- Respostas curtas e diretas (máx. ~4 linhas de texto, exceto quando pedido detalhe); prefira resultados a processos.
- Não gere documentação não solicitada.

## Referências

- Instruções de agente/opencode deste repo: este arquivo; não há `opencode.json`, `CLAUDE.md` ou regras de editor.

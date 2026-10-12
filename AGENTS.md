# AGENTS.md

## Diretrizes de Eficiência (obrigatórias)

1. **Planejamento antes de executar**: monte plano interno curto; identifique o objetivo real e corte subtarefas que não impactem o resultado pedido.
2. **Redução de custo**: busque ≥50% menos execuções/tokens que uma abordagem ingênua; combine etapas (buscas/edições em lote), evite repetir contexto já obtido e gere resposta curta quando ela resolve.
3. **Critério de pare**: execute só o necessário; pare ao atingir o objetivo, sem polir além do pedido; escolha sempre o caminho mais curto sem perda de qualidade.
4. **Transparência mínima**: entregue o resultado direto, sem narrar otimizações, salvo pedido.
5. **Qualidade não-negociável**: nunca sacrifique precisão, segurança ou completude essencial; em tarefas profundas, economize cortando redundância, não conteúdo necessário.

## Repo shape

- Site estático de venda (FALITA, pt-BR) em **um único `index.html`**: todo CSS e JS estão inline. Não há package.json, build, lint, testes ou CI.
- `Dockerfile` = `nginx:alpine` copiando `index.html` para `/usr/share/nginx/html`.
  - Build/run: `docker build -t falita .` && `docker run -p 8080:80 falita`
  - Dev local: abrir `index.html` direto ou qualquer servidor estático (ex.: `npx serve .`).

## Gotchas

- **Assets são hotlinks externos** (`COCONUDIMUDIAL.b-cdn.net`): imagens, poster e vídeo da VSL não estão no repo. URLs quebradas/renomeadas no CDN derrubam o visual — não "mova" nem regenere assets sem confirmar origem.
- **Bug conhecido**: o script falha em `twObs.observe(document.getElementById('typewriter'))` — o elemento `#typewriter` não existe. Isso interrompe o `<script>` e impede o `addEventListener('ended')` do hero video de ser registrado (o `onclick="playVideo()"` continua funcionando por hoisting). Ao editar o bloco de script, preserve/contorne essa ordem.
- **Placeholders**: preço da comunidade = `R$ 297,00` (preenchido); CTA de pagamento ainda aponta `href="#"` — não invente URL de checkout.
- SEO/OG/JSON-LD vivem no `<head>` do mesmo arquivo; mantenha sincronizados se mudar título/oferta.

## Convenções

- Respostas curtas e diretas (máx. ~4 linhas de texto, exceto quando pedido detalhe); prefira resultados a processos.
- Não gere documentação não solicitada.

## Referências

- Instruções de agente/opencode deste repo: este arquivo; não há `opencode.json`, `CLAUDE.md` ou regras de editor.

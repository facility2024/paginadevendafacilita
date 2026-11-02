# Óculos Assistivos

Aplicação web independente para assistência visual por câmera, comandos de voz, leitura de texto, localização, rotas e SOS. O app principal fica em `index.html`; `server.js` oferece integração opcional com a API da Anthropic e envio automático de alertas.

## Requisitos e execução

- Node.js 18 ou superior.
- Para iniciar: `node server.js` dentro desta pasta. Acesse `http://localhost:3000`.
- Para preencher as chaves pelo app, prepare o acesso administrativo uma vez no PowerShell:

```powershell
Copy-Item .\oculos-assistivos\.env.example .\oculos-assistivos\.env
notepad .\oculos-assistivos\.env
```

Defina `SETUP_PASSWORD` com uma senha forte, salve o arquivo e inicie/reinicie o servidor com `node .\oculos-assistivos\server.js` a partir da raiz. Depois abra **Configurar cuidador > Configurar IA e WAPI no servidor**, escolha o provedor (OpenAI, Anthropic/Claude ou Google Gemini) e informe essa senha para gravar a chave no `.env` pelo formulário. Não compartilhe o `.env`.

Para configurar a IA sem usar a tela, preencha `ANTHROPIC_API_KEY` diretamente em `.env`. Para iniciar com variável de ambiente no PowerShell:

```powershell
$env:ANTHROPIC_API_KEY="sua_chave"
node server.js
```

- Alternativamente, copie `.env.example` para `.env` nesta pasta e preencha a chave no servidor. O arquivo `.env` está no `.gitignore`; nunca cole tokens na tela do app nem publique esse arquivo.
- Para preencher chaves na seção **Configurar IA e WAPI no servidor** dentro do app, primeiro copie `.env.example` para `.env` e substitua `SETUP_PASSWORD` por uma senha forte (mínimo recomendado: 16 caracteres). Reinicie o servidor e informe essa senha no formulário. O endpoint limita tentativas e não devolve nem mantém as chaves no navegador.

- Em celular, câmera, microfone e localização exigem HTTPS. Use um túnel HTTPS para a porta 3000 ou publique o diretório em um serviço com HTTPS.
- A detecção de objetos e o OCR carregam bibliotecas e modelos via CDN; é necessária conexão à internet. O reconhecimento de voz funciona melhor no Chrome.
- O provedor escolhido (OpenAI, Anthropic/Claude ou Google Gemini) responde perguntas sobre uma imagem da câmera. Detecção de objetos usa COCO-SSD, OCR usa Tesseract.js, fala/reconhecimento usam Web Speech API e GPS usa a API de geolocalização do navegador; portanto, uma chave de IA não substitui essas permissões e componentes.

## Instalação PWA

O app pode ser instalado no Android pelo menu do Chrome (**Instalar app**), no iPhone/iPad pelo Safari (**Compartilhar > Adicionar à Tela de Início**) e no desktop pelo botão de instalação do Chrome ou Edge. Use HTTPS fora do computador local. A interface principal fica disponível offline depois do primeiro acesso, mas visão computacional, OCR, voz do navegador e IA dependem dos modelos/serviços correspondentes.

## Docker

O Dockerfile desta pasta é separado do site de vendas. Na raiz do repositório, execute:

```powershell
docker build -t oculos-assistivos .\oculos-assistivos
Copy-Item .\oculos-assistivos\.env.example .\oculos-assistivos\.env
# Edite .env, defina SETUP_PASSWORD e depois execute:
docker run --rm --name oculos-assistivos -p 3000:3000 --env-file .\oculos-assistivos\.env -v ${PWD}\oculos-assistivos\.env:/app/.env oculos-assistivos
```

O volume mantém as chaves que forem salvas pelo formulário mesmo depois que o container for removido. Não inclua `.env` na imagem nem o envie ao repositório.

## Câmera e tela

Ao ativar a câmera, navegadores compatíveis recebem um pedido de Screen Wake Lock para manter a tela acesa. O pedido é refeito quando o app volta ao primeiro plano. O navegador não pode garantir câmera ativa com o celular bloqueado ou com o app suspenso; o iOS pode não oferecer Wake Lock. Para esse cenário é necessário um aplicativo nativo com permissões e comportamento próprios do sistema operacional. Desative o bloqueio automático da tela durante o uso e mantenha o app em primeiro plano.

## Cuidador e alertas

Em **Configurar cuidador**, salve WhatsApp, e-mail, raio de segurança e, opcionalmente, defina o local seguro. Sem credenciais de envio automático, o SOS abre links preenchidos para WhatsApp e e-mail. Para envio automático, inicie o servidor com:

- WhatsApp: `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_WHATSAPP_FROM`.
- E-mail: `SENDGRID_KEY`, `MAIL_FROM`.
- Destinatários automáticos permitidos no servidor: `CAREGIVER_PHONE` e `CAREGIVER_EMAIL`. Eles devem corresponder ao contato salvo no app; isso impede que a rota de SOS envie mensagens a destinatários arbitrários.
- O app possui campos de servidor para a instância WAPI (`WAPI_INSTANCE_ID`), chave (`WAPI_TOKEN`) e URL (`WAPI_API_URL`) no `.env.example`. A chamada de envio WAPI ainda precisa ser ligada ao endpoint e formato de autenticação do provedor específico; enquanto isso, o SOS usa os links manuais ou Twilio configurado.
- As credenciais Anthropic e WAPI também podem ser enviadas pelo formulário autenticado; os campos secretos são limpos após salvar. Para remover uma chave configurada, edite e reinicie o servidor com o `.env` atualizado.

## GPS

Toque em **Ativar GPS** no app e aceite a permissão do navegador. Para celular, abra o app por HTTPS. O rastreamento em segundo plano no navegador só funciona enquanto a página estiver aberta; definir um local seguro e salvar as configurações ativa também a verificação do raio.

Enquanto o SOS estiver ativo, a localização é atualizada e reenviada a cada 60 segundos.

## Limites de segurança

A distância é estimada pelo tamanho aparente do objeto. A câmera do celular não mede profundidade; vidro, buracos, degraus e obstáculos pouco contrastantes podem não ser detectados. Este protótipo não substitui bengala, cão-guia ou acompanhamento. Teste com uma pessoa de confiança e não dependa do app para decidir se um caminho é seguro.
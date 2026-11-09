# Studio HomeFit: como ligar o banco, o login, o painel e os pagamentos

Enquanto o `.env` não tiver a chave do Supabase, o site funciona no **modo demonstração**: os cursos vêm do
`src/dados/conteudo.js`, não há login nem painel e as "compras" ficam só no navegador. Siga os passos abaixo
uma vez e tudo passa a funcionar de verdade.

Projeto: `https://ouxmqebhjtbqiwdihyvq.supabase.co`

---

## 1. Chaves no arquivo `.env` (2 minutos)

1. No Supabase: **Project Settings > API Keys**.
2. Copie a chave **anon public** (ou a **publishable key**, que começa com `sb_publishable_`).
3. Cole em `VITE_SUPABASE_ANON_KEY=` no arquivo `.env` da raiz do projeto.
4. Pare e rode de novo o `npm run dev` (o Vite só lê o `.env` ao iniciar).

> Nunca coloque no `.env` a **service_role / secret key** nem o token do Mercado Pago. Essas ficam só nos
> *Secrets* das Edge Functions (passo 6). O `.env` já está no `.gitignore`.

## 2. Criar o banco (3 minutos)

No Supabase: **SQL Editor > New query**.

1. Cole todo o arquivo `supabase/migrations/0001_estrutura.sql` e clique em **Run**.
2. Nova query: cole `supabase/migrations/0002_cursos_iniciais.sql` (os 8 cursos atuais, com módulos e aulas) e **Run**.
3. Nova query: cole `supabase/migrations/0003_videos.sql` (local privado para os vídeos enviados pelo painel) e **Run**.
4. Nova query: cole `supabase/migrations/0004_pagamentos_seguros.sql` (regras de pagamento e registro de eventos) e **Run**.
5. Nova query: cole `supabase/migrations/0005_protecao_reembolso.sql` (liberação gradual das aulas e registro das aulas
   abertas) e **Run**.
6. Nova query: cole `supabase/migrations/0006_apresentacao_do_curso.sql` (vídeo de apresentação de cada curso) e **Run**.
7. Nova query: cole `supabase/migrations/0007_professores.sql` (cards dos professores editáveis em **Painel > Configurações**) e **Run**.
8. Nova query: cole `supabase/migrations/0008_vendas_manuais.sql` (vendas registradas ao liberar cursos) e **Run**.
9. Nova query: cole `supabase/migrations/0009_plano_completo_manual.sql` (venda manual do plano completo pelo valor do plano) e **Run**.

Os arquivos podem ser rodados de novo sem duplicar nada. **Sempre na ordem**: se rodar um arquivo de novo, rode também
todos os que vêm depois dele (cada um substitui algumas regras dos anteriores).

### Apresentação do curso

Em **Painel > Cursos > (curso) > Aulas**, acima do Módulo 1, fica o bloco **Apresentação do curso** (opcional): um vídeo
curto falando do curso, para quem é e o que a pessoa vai aprender. O vídeo é sempre **enviado como arquivo** (MP4, WebM
ou MOV): arraste para a área ou clique em **Escolher vídeo**. Ele aparece para **todos, mesmo sem comprar**, na página do
curso e na área do aluno, sempre antes do Módulo 1. Só esse arquivo fica aberto ao público; as aulas continuam protegidas.
No plano grátis do Supabase o limite é 50 MB por arquivo, o que dá para uma apresentação de 1 a 3 minutos.

### Proteção contra "assistir tudo e pedir reembolso"

O direito de desistir em 7 dias (Código de Defesa do Consumidor, art. 49) não pode ser recusado. O que o 0005 faz:

- **Liberação gradual** (Painel > Configurações, ligada por padrão): nas compras pagas, o 1º módulo de cada curso libera
  na hora e os outros vão abrindo até o 8º dia (o número de dias é ajustável). Quem compra só para copiar e pedir o
  dinheiro de volta não consegue ver o curso inteiro dentro do prazo. Cursos liberados à mão em Alunos, compras de teste
  e cupons de 100% ficam liberados por completo. A regra é conferida no banco, não só na tela.
- **Registro das aulas abertas:** o link de cada vídeo só é entregue aula por aula, pela função `open_lesson`, que
  registra a abertura. O link temporário de um arquivo enviado só é gerado nos 10 minutos depois desse registro.
- **No painel:** o pedido (Vendas) mostra quantas aulas o aluno abriu, quando, e se ele já teve reembolsos antes;
  a lista de Alunos mostra quantos reembolsos cada um teve. Serve para responder uma contestação no Mercado Pago.
- **Transparência:** a página do curso, a finalização da compra, os Termos de Uso e a Política de Privacidade avisam
  sobre a liberação gradual e o registro.
- **Limite real:** quem já tem acesso a uma aula consegue gravar a tela. A liberação gradual reduz o que dá para levar
  dentro do prazo, mas não impede cópia do que já foi liberado.

O que o `0001_estrutura.sql` cria:

| Parte | Para que serve |
|---|---|
| `profiles` | Nome, WhatsApp e papel (aluno/admin) de cada conta |
| `courses`, `modules`, `lessons` | Cursos, módulos e aulas (o que aparece no site) |
| `lesson_media` | Link do vídeo de cada aula, **só visível para quem comprou** |
| `orders`, `order_items` | Pedidos e o que foi comprado em cada um |
| `enrollments` | Quem tem acesso a qual curso |
| `lesson_progress` | Aulas concluídas por aluno |
| `coupons` | Cupons de desconto |
| `settings` | Preço do combo, contatos, modo de teste |
| Bucket `course-images` | Imagens de capa enviadas pelo painel |

E o `0003_videos.sql` cria o bucket **privado** `lesson-videos`, com os vídeos enviados como arquivo.

### Vídeos das aulas: arquivo ou link

No painel, em **Cursos > (curso) > Aulas**, cada aula tem duas opções:

- **Enviar vídeo:** escolha o arquivo (MP4, WebM ou MOV). Aparece uma barra de progresso, e a duração da aula é
  preenchida sozinha. Se a internet cair, o envio continua de onde parou. Se fechar a página, envie o mesmo arquivo
  de novo na mesma aula e ele retoma o envio. Depois dá para **Assistir**, **Trocar** ou **Remover**, e o arquivo
  antigo é apagado do servidor.
- **Colar link:** YouTube (não listado), Vimeo, Panda etc.

Quem assiste um vídeo enviado recebe um link temporário (2 horas), gerado só para quem comprou o curso (e para o
admin). Esse link não serve como endereço fixo para compartilhar. Nenhuma aula abre para quem não comprou.

**Limites do plano do Supabase (importante):**

| | Plano Free | Plano Pro (US$ 25/mês) |
|---|---|---|
| Tamanho máximo por arquivo | **50 MB** (cerca de 3 a 5 min em 1080p) | Ajustável até 500 GB em **Storage > Settings** |
| Espaço total | 1 GB | 100 GB inclusos |
| Tráfego por mês (alunos assistindo) | 5 GB | 250 GB inclusos |

Para aulas longas, ou com muitos alunos, o mais econômico é exportar em **MP4 720p** e usar o plano Pro, ou hospedar
no **Panda Video**, **Bunny Stream** ou **Vimeo** e colar o link. As duas formas podem ser usadas no mesmo curso.

## 3. Configurar o login (3 minutos) 

No Supabase: **Authentication**.

1. **URL Configuration**
   - *Site URL*: o endereço do site (ex.: `https://studiohomefit.com.br`).
   - *Redirect URLs*: adicione `https://studiohomefit.com.br/**`, `http://localhost:5173/**` e `http://localhost:4173/**`.
2. **Sign In / Providers > Email**
   - **Confirm email**: ligado (o dono só vira admin depois de confirmar o e-mail).
   - **Secure password change** e **Secure email change**: ligados.
   - **Minimum password length**: 8, e em *Password requirements* escolha **letras e números**.
3. **E-mails de verdade (importante):** o envio padrão do Supabase só manda e-mails para os membros da equipe
   do projeto e tem limite por hora. Para os alunos receberem a confirmação e o "esqueci minha senha", configure
   um SMTP em **Authentication > Emails > SMTP Settings** (Resend, Brevo e Amazon SES têm planos grátis).
4. Opcional: traduza os modelos de e-mail em **Authentication > Emails > Templates**.

## 4. Criar a conta do dono (1 minuto)

Faça isso **o quanto antes**: enquanto a conta do dono não existe, outra pessoa poderia tentar cadastrar esse e-mail primeiro.

1. Rode o site, clique no ícone de usuário e **Criar conta** com **gabrielooopi98@gmail.com**.
2. Confirme o e-mail pelo link que chegar.
3. O site pede para você **criar a senha do painel** na hora. Isso garante que só você sabe a senha, mesmo que alguém tenha cadastrado o e-mail antes, e desconecta qualquer outro aparelho.
4. Pronto: a conta vira administradora e o menu mostra **Painel de ADM**.

Se o login com a sua senha não funcionar depois de confirmar, use **Esqueci minha senha**: o link do e-mail também cria uma senha nova e derruba os outros acessos.

Para ter mais administradores: **Painel > Alunos > (pessoa) > Tornar administrador**.

## Vendas por fora do site

Depois de aplicar a migração `0008_vendas_manuais.sql`, em **Painel > Alunos > (aluno)**,
selecione um curso e clique em **Liberar**. Confira o valor já recebido pelo curso
(o preço atual é sugerido) e a forma de pagamento. Informe **0** para cortesia.
**Registrar e liberar** cria uma venda manual paga e libera os cursos na mesma transação,
sem cobrar o aluno. O faturamento, o ranking de cursos, as vendas e o total gasto do aluno
passam a incluir esses valores. Descontos são informados diretamente no valor recebido de cada curso.

Liberações anteriores não são convertidas em vendas. Repetir a mesma solicitação não duplica o registro.
**Remover acesso** mantém a venda e o faturamento; a conciliação não restaura acessos de vendas manuais.
Para descontar o faturamento e remover os acessos do pedido, registre **Estornar e remover acesso**
em **Vendas**. A devolução do dinheiro é feita por fora do site. Em uma venda com vários cursos,
o estorno é do pedido inteiro.

### Plano completo

Com a migração `0009_plano_completo_manual.sql`, use **Liberar plano completo** no aluno.
O valor sugerido é o mesmo do plano no site, configurado em **Configurações**; confirme o
valor efetivamente recebido (0 para cortesia). O plano vira **um único item Combo**, e o
faturamento conta esse valor apenas uma vez, sem somar os preços dos cursos.
São liberados os cursos publicados atuais ainda pendentes; acessos anteriores são preservados.
O botão só aparece com o plano ativo, cursos pendentes e sem outra compra paga do plano.
Para vender um curso avulso, selecione-o na lista e use **Liberar**.
O estorno do plano desconta seu valor e remove os acessos vinculados ao pedido, sem remover
acessos anteriores independentes. Cursos futuros não são liberados automaticamente.

## 5. Testar tudo antes do Mercado Pago (opcional)

**Painel > Configurações > Pagamentos > Modo de teste**: com ele ligado, **administradores** "compram" sem pagar
(serve para testar a compra, a área do aluno e os números do painel). Alunos não conseguem finalizar compras
enquanto ele estiver ligado, então esquecer ligado não dá curso de graça para ninguém.
**Desligue antes de divulgar o site.**

## 6. Ligar o Mercado Pago (Pix e cartão)

A conta do Mercado Pago tem que ser de quem recebe o dinheiro das vendas: cada venda cai na conta dona da credencial.

1. **Banco**: rode o `supabase/migrations/0004_pagamentos_seguros.sql` (passo 2), se ainda não rodou.
2. **Aplicação no Mercado Pago**: em <https://www.mercadopago.com.br/developers/panel/app>, crie uma aplicação
   (Pagamentos online > Checkout Pro) e abra **Credenciais**. Comece pelas **credenciais de teste**.
3. **Secrets** (no Supabase: **Edge Functions > Secrets**, um por linha, Key e Value):

   | Key | Value | |
   |---|---|---|
   | `MP_ACCESS_TOKEN` | o Access Token do Mercado Pago | obrigatório |
   | `SITE_URL` | `https://studio-home-fit-cursos.vercel.app` (ou o seu domínio) | obrigatório |
   | `MP_WEBHOOK_SECRET` | a assinatura secreta do webhook (passo 5) | obrigatório |
   | `CONCILIACAO_SECRET` | uma senha longa qualquer, inventada por você | opcional (passo 6) |

   Cole os valores **direto no Supabase**. Nunca no `.env`, no código, no GitHub, na Vercel ou em conversas.
   Sem `MP_WEBHOOK_SECRET` o webhook recusa todos os avisos (por segurança), mas o aluno ainda recebe o curso
   ao voltar para o site, porque a página do pedido confere o pagamento direto no Mercado Pago.
4. **Publicar as funções** (no terminal, na pasta do projeto):

   ```bash
   npx supabase login
   npx supabase link --project-ref ouxmqebhjtbqiwdihyvq
   npx supabase functions deploy criar-pagamento
   npx supabase functions deploy webhook-mercadopago
   npx supabase functions deploy conferir-pagamento
   ```

   O `supabase/config.toml` deixa as três sem a checagem automática de token: `criar-pagamento` e
   `conferir-pagamento` conferem o login dentro da função, e o Mercado Pago não manda token de usuário (o webhook
   confere a assinatura).
5. **Webhook**: no Mercado Pago, em *Suas integrações > (sua aplicação) > Webhooks > Configurar notificações*:
   - URL (modo de teste e modo produtivo): `https://ouxmqebhjtbqiwdihyvq.supabase.co/functions/v1/webhook-mercadopago`
   - Evento: **Pagamentos**
   - Salve, copie a **assinatura secreta** e cadastre como `MP_WEBHOOK_SECRET` (passo 3).
   - O site não manda `notification_url` na preferência de propósito: todos os avisos vêm deste webhook, que é o
     que a documentação garante que chega assinado.
6. **Conferência automática (opcional, recomendado)**: no Supabase, em **Integrations > Cron**, crie uma rotina
   a cada 30 minutos que faz um **POST** para
   `https://ouxmqebhjtbqiwdihyvq.supabase.co/functions/v1/conferir-pagamento` com o cabeçalho
   `x-conciliacao-secret: <o mesmo valor do CONCILIACAO_SECRET>` e o corpo `{"todos": true}`.
   Sem ela, a mesma conferência pode ser feita à mão em **Painel > Vendas > Conferir pagamentos**.
7. **Teste** com a credencial de teste, usando os usuários e cartões de teste do Mercado Pago (nenhum dinheiro de
   verdade). Depois troque o `MP_ACCESS_TOKEN` pelo de produção e **desligue o modo de teste** no painel.
   Não é preciso publicar as funções de novo para trocar um secret.

### Como funciona

1. O aluno logado (e-mail confirmado) clica em pagar. O navegador manda só os ids dos cursos, o cupom e os dados
   do pagador.
2. A função `criar-pagamento` cria o pedido com o **preço calculado no banco** (`create_order`), no nome de quem
   está logado, e abre a página segura do Mercado Pago. Nenhum dado de cartão passa pelo site.
3. O Mercado Pago avisa a função `webhook-mercadopago`. Ela confere a **assinatura**, busca o pagamento **direto
   na API** do Mercado Pago e confere se foi recebido **pela nossa conta**. Depois o banco (`apply_payment`)
   confere **pedido, valor e moeda** e só então libera os cursos.
4. O aluno volta para o site (`/?pedido=...`). A página do pedido pede para a função `conferir-pagamento`
   consultar o Mercado Pago, e assim o curso é liberado mesmo se o aviso atrasar ou se perder.
5. Estorno ou chargeback removem o acesso daquele pedido. Se o aluno pagou duas vezes e só um pagamento foi
   devolvido, o acesso continua.

### Regras dos pagamentos (o que o banco faz com cada aviso)

| Situação | O que acontece |
|---|---|
| Aprovado, valor e moeda certos | Libera os cursos do pedido (uma vez só, mesmo com avisos repetidos) |
| Valor diferente ou moeda que não é real | Nada é liberado; aparece como alerta em **Vendas** |
| Pagamento de outra conta, ou que já pagou outro pedido | Nada é liberado |
| Pendente / em análise | Pedido continua pendente |
| Recusado | Pedido fica como recusado; se o aluno tentar de novo e pagar, libera |
| Aviso atrasado de "pendente" ou "recusado" depois de aprovado | Ignorado (o pedido continua pago) |
| Estorno ou chargeback | Remove o acesso daquele pedido, sem tirar cursos pagos em outros pedidos |
| Aviso atrasado de "aprovado" depois de estornado ou cancelado | Ignorado: só o admin reativa (Vendas > Marcar como pago) |
| Pago duas vezes | Alerta em **Vendas** para devolver um dos pagamentos no Mercado Pago |
| Disputa em andamento (`in_mediation`) | O acesso continua até o resultado |

Cada aviso fica registrado na tabela `payment_events` (só o admin lê), e **Painel > Vendas** mostra o que precisa
de atenção: pedidos pagos sem acesso, acesso de pedido não pago, pendentes antigos e alertas.

## Segurança: o que já está protegido

- **RLS em todas as tabelas.** Mesmo com a chave pública (que é visível no navegador), ninguém lê ou altera o
  que não pode.
- **Admin exige papel `admin` e e-mail confirmado.** Ninguém consegue se promover: o banco bloqueia, e testamos isso.
- **O valor da compra nunca vem do navegador.** É calculado no banco (`quote_order`), e o banco confere o valor e
  a moeda pagos contra o total do pedido.
- **Pedidos e matrículas só nascem no servidor:** Edge Functions com a chave secreta, ou compra de teste de um
  admin com o modo de teste ligado.
- **O navegador nunca confirma pagamento.** Voltar para a página de "sucesso" não libera nada: quem decide é o
  servidor, consultando o Mercado Pago.
- **Vídeos protegidos.** Só quem comprou o curso consegue ler o link. Os
  arquivos enviados ficam num bucket privado: só o admin envia ou apaga, e quem assiste recebe um link que expira
  em 2 horas. Para links externos, use YouTube "não listado", Vimeo ou Panda com domínio restrito.
  Nenhuma proteção impede alguém que comprou de gravar a tela.
- **Webhook com assinatura (HMAC) obrigatória**, pagamento consultado direto no Mercado Pago e conta recebedora
  conferida. Avisos repetidos ou fora de ordem não liberam nada duas vezes nem desfazem um pagamento.
- **Freios contra abuso:** no máximo 10 pedidos pendentes em 10 minutos por conta, e no máximo uma consulta ao
  Mercado Pago a cada 5 segundos por pedido (contados no banco). Pedido de outra pessoa responde igual a pedido
  que não existe.
- **Login:**
  - mensagens que não revelam se o e-mail existe;
  - pausa crescente depois de 5 senhas erradas;
  - senha forte obrigatória;
  - campo contra robôs no cadastro;
  - links de e-mail com código de uso único (PKCE);
  - limite de tentativas do próprio Supabase.
- **Sempre existe pelo menos um administrador:** o último não consegue se remover.
- **Trocar a senha desconecta os outros aparelhos**, tanto pelo "esqueci minha senha" quanto em Minha conta.
- **Cabeçalhos de segurança no site publicado** (`vercel.json`): o navegador só carrega scripts do próprio site e só envia dados para o Supabase. O site também não pode ser aberto dentro de outro site, o que evita cliques falsos.
- **Testes automáticos** (`npm test`): os cenários de pagamento rodam contra o banco de verdade (PostgreSQL) com
  um Mercado Pago simulado. Nenhuma cobrança real.

Arquivos do servidor:

- `supabase/migrations/0001_estrutura.sql`: tabelas, regras (RLS), funções e permissões.
- `supabase/migrations/0002_cursos_iniciais.sql`: cursos iniciais.
- `supabase/migrations/0003_videos.sql`: bucket privado dos vídeos e quem pode assistir.
- `supabase/migrations/0004_pagamentos_seguros.sql`: regras de pagamento, registro de eventos e conferência.
- `supabase/migrations/0005_protecao_reembolso.sql`: liberação gradual das aulas e registro das aulas abertas.
- `supabase/migrations/0006_apresentacao_do_curso.sql`: vídeo de apresentação de cada curso, aberto para todos.
- `supabase/migrations/0007_professores.sql`: cards dos professores editáveis no painel.
- `supabase/migrations/0008_vendas_manuais.sql`: registro atômico de venda manual ao liberar cursos, sem alterar liberações antigas.
- `supabase/migrations/0009_plano_completo_manual.sql`: venda manual do plano completo como um único item Combo.
- `supabase/functions/criar-pagamento`: cria o pedido e o pagamento.
- `supabase/functions/webhook-mercadopago`: confirma pagamentos, estornos e chargebacks.
- `supabase/functions/conferir-pagamento`: confere pedidos direto no Mercado Pago (volta do aluno, painel e rotina).
- `supabase/functions/_compartilhado`: as regras (`pagamentos.js`, `mercadopago.js`) e a ligação com o Supabase e o
  Mercado Pago (`servicos.js`).

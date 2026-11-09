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

> Nunca coloque a **service_role / secret key** no `.env` ou no navegador. Essa chave deve ficar
> somente em ambientes de servidor confiáveis. O `.env` já está no `.gitignore`.

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
10. Nova query: cole `supabase/migrations/0010_limpar_pedidos_recentes.sql` (limpeza visual dos pedidos recentes) e **Run**.
11. Nova query: cole `supabase/migrations/0011_ocultar_vendas_de_teste.sql` (oculta pedidos de teste dos relatórios administrativos sem apagá-los) e **Run**.

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
  a lista de Alunos mostra quantos reembolsos cada um teve. Essas informações ajudam a analisar solicitações de reembolso.
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

### Limpar pedidos recentes

Após aplicar `0010_limpar_pedidos_recentes.sql`, use **Painel > Pedidos recentes > Limpar recentes**
e confirme. A limpeza é compartilhada entre administradores e persiste após recarregar a página.
Ela oculta apenas os pedidos criados até a confirmação: novas vendas voltam a aparecer normalmente.
Nada é apagado de **Vendas** e nenhum valor de faturamento, acesso ou estorno é alterado.
Outras sessões abertas refletem a limpeza ao recarregar o painel.

A lista continua limitada a **8 pedidos**, com índice por data para a consulta. Essa limpeza visual
não reduz o tamanho do banco nem substitui uma política de retenção ou arquivamento.

## 5. Operar pagamentos por Pix manual

O site não cobra nem confirma pagamentos automaticamente. O botão de compra abre uma conversa no WhatsApp
da loja com os cursos selecionados; por lá, a equipe combina o Pix ou a transferência diretamente com o cliente.

1. Configure o WhatsApp correto em **Painel > Configurações > Contatos e redes**.
2. Peça ao cliente para criar uma conta no site com o e-mail que usará para acessar os cursos.
3. Confirme o recebimento do valor na conta da loja; não libere acesso com base apenas em comprovante enviado.
4. Em **Painel > Alunos**, encontre a conta do cliente, selecione os cursos e registre a venda pelo valor recebido,
   escolhendo **Pix** como forma de pagamento. O registro e a liberação dos cursos acontecem juntos.
5. Para devolver um pagamento, faça a transferência de volta por fora do site e depois use
   **Painel > Vendas > Estornar e remover acesso** para atualizar o faturamento e o acesso.

Não é necessário cadastrar credenciais, webhooks ou rotinas de conciliação de pagamentos online. O fluxo manual
depende da confirmação humana do recebimento e não cria automaticamente um pedido quando a pessoa clica no WhatsApp.

## Segurança: o que já está protegido

- **RLS em todas as tabelas.** Mesmo com a chave pública (que é visível no navegador), ninguém lê ou altera o
  que não pode.
- **Admin exige papel `admin` e e-mail confirmado.** Ninguém consegue se promover: o banco bloqueia, e testamos isso.
- **Venda manual:** somente o administrador registra o valor recebido e libera o curso pela ação transacional do
  banco. Confirme o crédito na conta da loja antes de registrar a venda.
- **Vídeos protegidos.** Só quem comprou o curso consegue ler o link. Os
  arquivos enviados ficam num bucket privado: só o admin envia ou apaga, e quem assiste recebe um link que expira
  em 2 horas. Para links externos, use YouTube "não listado", Vimeo ou Panda com domínio restrito.
  Nenhuma proteção impede alguém que comprou de gravar a tela.
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
- **Testes automáticos** (`npm test`): rodam contra PostgreSQL local e simulam integrações legadas. Nenhuma cobrança real.

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
- `supabase/migrations/0010_limpar_pedidos_recentes.sql`: limpeza visual compartilhada dos recentes e índice por data.
- `supabase/functions/`: código legado de pagamento online; não implantar nem configurar para usar Pix manual.

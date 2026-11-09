# Studio HomeFit: site de cursos

Site de venda de cursos online de execução correta dos exercícios, com área do aluno e painel de administração.

- **Tecnologias:** React 19 e Vite.
- **Banco, login e arquivos:** Supabase.
- **Pagamentos:** Mercado Pago.

## Como rodar no computador

```bash
npm install      # só na primeira vez
npm run dev      # abre em http://localhost:5173
```

Outros comandos:

| Comando | Para que serve |
|---|---|
| `npm run build` | Gera o site pronto para publicar, na pasta `dist/` |
| `npm run preview` | Abre o site gerado pelo build, para conferir antes de publicar |
| `npm run lint` | Procura erros comuns no código |
| `npm test` | Testes de segurança do pagamento e do banco (banco PostgreSQL de teste + Mercado Pago simulado) |

As chaves do Supabase ficam no arquivo `.env` (modelo em `.env.example`). Sem elas, o site abre em **modo demonstração**: sem login nem painel, com as compras salvas só no navegador. O passo a passo do banco, do login e dos pagamentos está no [SUPABASE.md](SUPABASE.md).

## Organização das pastas

```
home-fit-cursos/
├── index.html            página base (o React monta o site dentro dela)
├── vite.config.js        configuração do Vite
├── vercel.json           cabeçalhos de segurança do site publicado (também usados no npm run preview)
├── .env                  chaves públicas do Supabase (não vai para o Git)
├── publico/              arquivos copiados como estão: ícones, manifest, página 404
├── originais/            arquivos de imagem originais (não entram no site)
├── supabase/             tudo o que roda no servidor (ver abaixo)
├── testes/               testes automáticos (npm test); apoio/ tem o banco de teste e o Mercado Pago simulado
└── src/                  código do site
    ├── main.jsx          ponto de entrada (liga o React na página)
    ├── Site.jsx          o site inteiro: páginas pelo endereço (#/...), carrinho e página inicial
    │
    ├── secoes/           partes da página inicial, na ordem em que aparecem
    │   ├── Cabecalho.jsx     menu do topo
    │   ├── Banner.jsx        banner com a foto da academia
    │   ├── Beneficios.jsx    faixa de benefícios e seção "problema"
    │   ├── Cursos.jsx        cursos com filtro por nível
    │   ├── Professores.jsx   a dupla de professores
    │   ├── Planos.jsx        Combo Completo
    │   ├── Duvidas.jsx       perguntas frequentes
    │   └── Rodape.jsx        rodapé
    │
    ├── paginas/          telas que abrem por endereço próprio
    │   ├── PaginaDoCurso.jsx     página de cada curso (#/curso/<link>): aulas e compra
    │   ├── Entrar.jsx            login, cadastro e recuperar senha
    │   ├── FinalizarCompra.jsx   dados do comprador, cupom e pagamento
    │   ├── Pedido.jsx            acompanhar o pedido depois de pagar
    │   ├── AreaDoAluno.jsx       "Meus cursos" e o player das aulas
    │   ├── MinhaConta.jsx        dados pessoais, senha e pedidos
    │   ├── Documento.jsx         Termos de Uso e Política de Privacidade
    │   └── NaoEncontrada.jsx     página 404
    │
    ├── componentes/      peças reutilizadas em várias telas
    │   ├── Icone.jsx, Logo.jsx, Janela.jsx (modal), EtiquetaStatus.jsx
    │   ├── Carrinho.jsx, Esqueletos.jsx (telas de carregamento)
    │   └── Seguranca.jsx (selos e formas de pagamento)
    │
    ├── painel/           painel de ADM (#/admin)
    │   ├── Painel.jsx        estrutura: menu lateral e permissão de acesso
    │   ├── Resumo.jsx        faturamento, gráficos e últimos pedidos
    │   ├── ListaDeCursos.jsx, EditorDeCurso.jsx, PrecoEDesconto.jsx
    │   ├── Vendas.jsx, Alunos.jsx, Cupons.jsx, Configuracoes.jsx
    │   ├── interface.jsx     peças de tela do painel (cartão, campo, confirmação...)
    │   ├── graficos.jsx      gráficos de área e de barras
    │   └── hooks.js, contexto.js, formatos.js, precos.js
    │
    ├── servicos/         comunicação com o banco e regras que não são tela
    │   ├── banco.js          TODAS as leituras e gravações passam por aqui
    │   ├── banco.simulado.js banco de mentira, usado só nos testes automáticos
    │   ├── supabase.js, supabaseCliente.js   conexão com o Supabase
    │   ├── envioDeVideo.js   envio de vídeos em partes (painel)
    │   └── video.js, duracao.js, pedidos.js, senha.js, formatos.js
    │
    ├── estado/           estado global (catálogo, login, cursos do aluno)
    ├── dados/            conteúdo fixo: textos, cursos de demonstração, contatos
    ├── imagens/          imagens e formas usadas pelo site
    └── estilos/
        ├── global.css        cores, fontes e base de todas as páginas
        ├── site.css          junta os arquivos de estilos/site/ na ordem certa
        ├── site/             um arquivo por parte do site (01-base.css ... 31-conta-login-pedidos.css)
        ├── login.css         telas de login e cadastro
        └── painel.css        painel de ADM
```

### Servidor (pasta `supabase/`)

| Caminho | O que é |
|---|---|
| `migrations/0001_estrutura.sql` | Tabelas, regras de segurança (RLS), funções e permissões |
| `migrations/0002_cursos_iniciais.sql` | Os 8 cursos iniciais, com módulos e aulas |
| `migrations/0003_videos.sql` | Local privado para os vídeos enviados pelo painel |
| `migrations/0004_pagamentos_seguros.sql` | Regras de pagamento (valor, moeda, estornos), registro de eventos e conferência |
| `migrations/0005_protecao_reembolso.sql` | Liberação gradual das aulas e registro das aulas abertas (contra "assistir tudo e pedir reembolso") |
| `migrations/0006_apresentacao_do_curso.sql` | Vídeo de apresentação de cada curso (opcional, aberto para todos, antes do Módulo 1) |
| `migrations/0007_professores.sql` | Cards dos professores editáveis em Painel > Configurações |
| `migrations/0008_vendas_manuais.sql` | Liberação de cursos com venda manual, valor recebido e atualização do faturamento |
| `migrations/0009_plano_completo_manual.sql` | Plano completo registrado uma única vez pelo valor recebido pelo plano |
| `functions/criar-pagamento/` | Cria o pedido e abre o pagamento no Mercado Pago |
| `functions/webhook-mercadopago/` | Recebe o aviso do Mercado Pago e libera (ou remove) os cursos |
| `functions/conferir-pagamento/` | Consulta o Mercado Pago na volta do aluno, no painel e na rotina agendada |
| `functions/_compartilhado/` | `pagamentos.js` e `mercadopago.js` (as regras, testadas em `testes/`) e `servicos.js` (ligação com o Supabase e o Mercado Pago) |
| `config.toml` | Configuração das funções |

As funções são em JavaScript e rodam no Deno (servidor do Supabase). As regras ficam separadas da ligação com o
Supabase justamente para os testes rodarem as mesmas regras no Node.

## Onde mexer para...

| Quero mudar... | Arquivo |
|---|---|
| Cores e fontes | `src/estilos/global.css` |
| Visual de uma seção | `src/estilos/site/` (o nome do arquivo diz a seção) |
| Textos fixos: benefícios, professores, perguntas | `src/dados/conteudo.js` |
| Termos de Uso e Política de Privacidade | `src/dados/termos.js` e `src/dados/privacidade.js` (dados da empresa em `src/dados/empresa.js`) |
| WhatsApp, Instagram, e-mail | Painel > Configurações (ou `src/dados/site.js` no modo demonstração) |
| Cursos, preços, aulas, vídeos, cupons | Painel de ADM, sem mexer no código |
| Ordem das seções da página inicial | `src/Site.jsx` |

## Padrões do código

- **Nomes:** pastas e arquivos em português. Componentes com letra maiúscula (`Cabecalho.jsx`), o resto com minúscula (`banco.js`).
- **Comentário no topo:** todo arquivo começa dizendo para que serve.
- **Acesso ao banco:** as telas nunca falam direto com o Supabase. Elas usam `backend` de `servicos/banco.js`, e é por isso que os testes conseguem trocar o banco real pelo simulado.
- **Termos técnicos:** alguns nomes continuam em inglês porque são da biblioteca ou do banco de dados. É o caso de `useState`, `hooks`, das colunas como `price` e das classes de CSS.

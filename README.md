# Rifa Beneficente

Site para gerenciamento de rifas com painel administrativo, autenticação e dados em tempo real via [Supabase](https://supabase.com).

## Funcionalidades

- Página pública para visualizar e reservar números
- Painel admin com login seguro (Supabase Auth)
- Aprovação e rejeição de solicitações
- Chave Pix configurável
- Atualização em tempo real para o admin e para os visitantes
- Imagem de fundo e foto do prêmio configuráveis

## Configuração

### 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com)
2. No **SQL Editor**, rode o conteúdo de `schema.sql` e depois de `schema_rpc_admin.sql`
3. Em **Authentication → Users**, crie o usuário administrador

### 2. Credenciais

```bash
cp supabase-config.example.js supabase-config.js
```

Abra `supabase-config.js` e preencha com a **Project URL** e a **anon public key** do seu projeto (`Settings → API`).

### 3. Rodar localmente

Abra `index.html` com um servidor local (ex: extensão **Live Server** do VS Code).

## Estrutura

| Arquivo | Descrição |
|---|---|
| `index.html` | Página pública |
| `admin.html` | Painel administrativo |
| `app.js` | Cliente Supabase e estado compartilhado |
| `public.js` | Lógica da página pública |
| `admin.js` | Lógica do painel admin |
| `schema.sql` | Tabelas e políticas de segurança (RLS) |
| `schema_rpc_admin.sql` | Funções para aprovar/rejeitar solicitações |
| `supabase-config.example.js` | Template de credenciais |

-- ============================================================
--  RIFA BENEFICENTE — Schema Supabase
--  Cole este SQL no SQL Editor do seu projeto Supabase
-- ============================================================

-- ── Tabelas ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rifa_config (
  id       integer PRIMARY KEY DEFAULT 1,
  nome     text    NOT NULL DEFAULT 'Rifa Beneficente da Família',
  total    integer NOT NULL DEFAULT 200,
  preco    decimal(10,2) NOT NULL DEFAULT 20.00,
  contato  text    DEFAULT '',
  pix_chave text   DEFAULT '',
  bg_imagem text                      -- base64
);
INSERT INTO rifa_config (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS premio (
  id        integer PRIMARY KEY DEFAULT 1,
  nome      text DEFAULT '',
  descricao text DEFAULT '',
  imagem    text                      -- base64
);
INSERT INTO premio (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS numeros (
  numero       integer PRIMARY KEY,
  status       text    NOT NULL DEFAULT 'disponivel'
                 CHECK (status IN ('disponivel','pendente','vendido')),
  nome         text,
  telefone     text,
  comprador_id text
);

CREATE TABLE IF NOT EXISTS compradores (
  id         text  PRIMARY KEY,
  nome       text  NOT NULL,
  telefone   text  DEFAULT '',
  numeros    integer[] NOT NULL DEFAULT '{}',
  data       text  NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS solicitacoes (
  id         text PRIMARY KEY,
  nome       text NOT NULL,
  telefone   text NOT NULL,
  obs        text DEFAULT '',
  numeros    integer[] NOT NULL DEFAULT '{}',
  data       text NOT NULL,
  hora       text NOT NULL,
  status     text NOT NULL DEFAULT 'pendente',
  created_at timestamptz DEFAULT now()
);

-- ── Row Level Security ────────────────────────────────────────

ALTER TABLE rifa_config  ENABLE ROW LEVEL SECURITY;
ALTER TABLE premio       ENABLE ROW LEVEL SECURITY;
ALTER TABLE numeros      ENABLE ROW LEVEL SECURITY;
ALTER TABLE compradores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitacoes ENABLE ROW LEVEL SECURITY;

-- rifa_config: leitura pública, escrita só admin
CREATE POLICY "pub_read_config"   ON rifa_config  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_write_config" ON rifa_config FOR ALL    TO authenticated        USING (true) WITH CHECK (true);

-- premio: leitura pública, escrita só admin
CREATE POLICY "pub_read_premio"   ON premio  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_write_premio" ON premio FOR ALL    TO authenticated        USING (true) WITH CHECK (true);

-- numeros: leitura pública, escrita só admin (e via função SECURITY DEFINER)
CREATE POLICY "pub_read_numeros"   ON numeros  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admin_write_numeros" ON numeros FOR ALL    TO authenticated        USING (true) WITH CHECK (true);

-- compradores: só admin
CREATE POLICY "admin_compradores" ON compradores FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- solicitacoes: visitante pode criar, admin gerencia tudo
CREATE POLICY "pub_insert_sol"  ON solicitacoes FOR INSERT TO anon             WITH CHECK (true);
CREATE POLICY "admin_sol"       ON solicitacoes FOR ALL    TO authenticated    USING (true) WITH CHECK (true);

-- ── Função: criar solicitação de forma atômica ────────────────
-- Chamada pelo público via sb.rpc('criar_solicitacao', {...})
-- SECURITY DEFINER permite atualizar numeros mesmo sendo anon

CREATE OR REPLACE FUNCTION criar_solicitacao(
  p_id       text,
  p_nome     text,
  p_telefone text,
  p_obs      text,
  p_numeros  integer[],
  p_data     text,
  p_hora     text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conflito integer[];
BEGIN
  -- Verificar conflitos
  SELECT array_agg(numero) INTO conflito
  FROM numeros
  WHERE numero = ANY(p_numeros) AND status <> 'disponivel';

  IF conflito IS NOT NULL AND array_length(conflito, 1) > 0 THEN
    RETURN json_build_object('erro', true, 'numeros', conflito);
  END IF;

  -- Marcar como pendente
  UPDATE numeros
  SET status       = 'pendente',
      nome         = p_nome,
      telefone     = p_telefone,
      comprador_id = p_id
  WHERE numero = ANY(p_numeros);

  -- Criar solicitação
  INSERT INTO solicitacoes (id, nome, telefone, obs, numeros, data, hora, status)
  VALUES (p_id, p_nome, p_telefone, p_obs, p_numeros, p_data, p_hora, 'pendente');

  RETURN json_build_object('ok', true);
END;
$$;

-- Permitir que visitantes (anon) chamem a função
GRANT EXECUTE ON FUNCTION criar_solicitacao TO anon;

-- ── Inicializar números (200 padrão) ─────────────────────────
INSERT INTO numeros (numero)
SELECT generate_series(1, 200)
ON CONFLICT DO NOTHING;

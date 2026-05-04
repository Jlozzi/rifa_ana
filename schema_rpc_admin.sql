-- ============================================================
--  Cole no SQL Editor do Supabase para habilitar aprovação
--  e rejeição de solicitações de forma atômica (transação única)
-- ============================================================

CREATE OR REPLACE FUNCTION aprovar_solicitacao(p_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sol solicitacoes%ROWTYPE;
BEGIN
  SELECT * INTO sol FROM solicitacoes WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada: %', p_id; END IF;

  UPDATE numeros
  SET status = 'vendido', nome = sol.nome, telefone = sol.telefone, comprador_id = sol.id
  WHERE numero = ANY(sol.numeros);

  INSERT INTO compradores (id, nome, telefone, numeros, data)
  VALUES (sol.id, sol.nome, sol.telefone, sol.numeros, sol.data);

  DELETE FROM solicitacoes WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION rejeitar_solicitacao(p_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sol solicitacoes%ROWTYPE;
BEGIN
  SELECT * INTO sol FROM solicitacoes WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada: %', p_id; END IF;

  UPDATE numeros
  SET status = 'disponivel', nome = null, telefone = null, comprador_id = null
  WHERE numero = ANY(sol.numeros);

  DELETE FROM solicitacoes WHERE id = p_id;
END;
$$;

-- Apenas admins autenticados podem chamar estas funções
GRANT EXECUTE ON FUNCTION aprovar_solicitacao TO authenticated;
GRANT EXECUTE ON FUNCTION rejeitar_solicitacao TO authenticated;

-- Script para criar usuário admin no PostgreSQL
-- Email: kalebe.caldas@hotmail.com
-- Senha: mxskqgltne

-- Deletar admin se já existir (para recriar)
DELETE FROM usuarios WHERE email = 'kalebe.caldas@hotmail.com';

-- Inserir novo admin
INSERT INTO usuarios (email, senha, nome, tipo, ativo, created_at, updated_at)
VALUES (
    'kalebe.caldas@hotmail.com',
    '$2a$10$aIKof1zLdCzx2KjuQGWLjOjecZy.HxtcG3rnU5kEJXhq2SHO8jS4a',
    'Kalebe Caldas',
    'admin',
    true,
    NOW(),
    NOW()
);

-- Verificar se foi criado
SELECT id, email, nome, tipo, ativo FROM usuarios WHERE email = 'kalebe.caldas@hotmail.com';

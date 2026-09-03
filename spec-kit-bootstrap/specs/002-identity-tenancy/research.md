# Pesquisa Técnica: Identidade e Multi-Tenancy

**Feature:** `002-identity-tenancy`  
**Data:** 2026-09-03  
**Status:** Decisões resolvidas

## 1. Hash de senha

**Decisão:** Argon2id com `m=19456 KiB`, `t=2`, `p=1`.

**Motivo:** algoritmo memory-hard adequado ao armazenamento de senhas. A biblioteca deve
produzir salt individual e codificar parâmetros no hash.

**Alternativas rejeitadas:** SHA-256 por ser rápido; criptografia reversível porque senha não
deve ser recuperável; bcrypt porque Argon2id é a escolha preferencial para um sistema novo.

## 2. Política de senha

**Decisão:** 8–128 caracteres, exigindo minúscula, maiúscula, número e símbolo, com bloqueio
de senhas comuns/comprometidas.

**Observação:** registrada como `SEC-EXC-001`. A decisão diverge de recomendações atuais de
comprimento maior sem composição. Deve ser revista antes de produção ou MFA.

## 3. Modelo de sessão

**Decisão:** access JWT de 15 minutos e refresh token rotativo em cookies seguros, com
registro autoritativo de sessão no MySQL.

**Motivo:** preserva contratos JWT sem perder revogação, timeout inativo, duração absoluta e
detecção de reutilização.

**Alternativas rejeitadas:** JWT em `localStorage`, pelo risco de exposição a scripts; JWT
totalmente stateless, por não atender revogação imediata; sessão opaca pura, porque o Product
Owner escolheu access/refresh JWT.

## 4. Proteção CSRF

**Decisão:** double-submit token, `SameSite=Lax`, validação de `Origin`/`Referer` e cookies
`HttpOnly` para credenciais.

**Motivo:** cookies são enviados automaticamente pelo navegador; SameSite isoladamente é
defesa adicional, não controle único.

## 5. E-mail local

**Decisão:** Nodemailer por `MailPort` e Mailpit local em SMTP `1025`, UI `8025`.

**Motivo:** captura mensagens sem entrega externa, permite testar templates e mantém o
provedor substituível.

**Alternativas rejeitadas:** imprimir tokens completos no console; Ethereal por depender de
serviço externo; Mercury/XAMPP por acoplar o projeto a um servidor menos conveniente para
inspeção automatizada.

## 6. Autorização multi-tenant

**Decisão:** `AuthenticationGuard` + `TenantContextResolver` + `PolicyService` + repositórios
com `organizationId` obrigatório.

**Motivo:** defesa em profundidade. O cliente escolhe o contexto, mas o servidor comprova a
membership e aplica a política.

**Alternativas rejeitadas:** somente guard de rota; filtro global automático do Prisma como
única defesa; papéis autoritativos dentro do JWT.

## 7. Identificadores e relações

**Decisão:** UUIDs, relações explícitas, tabelas associativas e status de ciclo de vida.

**Motivo:** evita exposição de sequência, oferece identificadores portáveis e mantém
histórico/auditoria. Constraints compostas garantem unicidade.

## 8. Auditoria

**Decisão:** `AuditEvent` append-only, metadados em allowlist e retenção inicial de 180 dias.

**Motivo:** eventos de segurança precisam de rastreabilidade separada de logs técnicos, com
minimização e política explícita de descarte.

## 9. Testes de isolamento

**Decisão:** unitários de políticas, integração em MySQL real e E2E com dois tenants, usuário
multi-organização e contexto pessoal.

**Motivo:** mocks não validam constraints, transações nem filtros reais. SQLite não reproduz
adequadamente o comportamento escolhido para MySQL.

## 10. Catálogo de papéis

**Decisão:** papéis fixos sem editor dinâmico nesta feature: `INSTITUTION_ADMIN`, `TEACHER`,
`REVIEWER`, `PARTICIPANT` e `SAAS_ADMIN` separado em atribuição global.

**Motivo:** reduz o escopo e impede que a administração institucional conceda privilégio
global. Capacidades acadêmicas serão adicionadas pelas features correspondentes.


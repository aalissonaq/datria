# Plano de Implementação: Identidade e Multi-Tenancy

**Branch:** `002-identity-tenancy`  
**Data:** 2026-09-03  
**Especificação:** [spec.md](spec.md)  
**Status:** Revisado — pronto para decomposição em tarefas

## Resumo

Implementar cadastro público, verificação de e-mail, autenticação por senha, recuperação de
acesso, sessões revogáveis, contexto pessoal, múltiplas organizações, convites, papéis
institucionais e administração SaaS separada. A solução usará JWT de acesso curto e refresh
token rotativo em cookies seguros, mantendo a sessão autoritativa no MySQL. Toda operação
institucional será protegida por contexto de tenant resolvido no servidor, políticas de
autorização e repositórios que exigem `organizationId`.

## Contexto Técnico

**Linguagem/runtime:** TypeScript estrito, Node.js 24 LTS  
**Frontend:** React + Vite  
**Backend:** NestJS, API REST versionada  
**Persistência:** MySQL + Prisma ORM  
**Senha:** Argon2id (`m=19456 KiB`, `t=2`, `p=1`)  
**Sessão:** access JWT + refresh token rotativo + registro de sessão no MySQL  
**E-mail local:** Nodemailer + Mailpit (`SMTP 1025`, interface `8025`)  
**Testes:** Vitest; Jest + Supertest; Playwright; MySQL real para integração  
**CI:** GitHub Actions com MySQL de teste e Mailpit quando necessário  
**Documentação:** OpenAPI 3.1  
**Escopo:** identidade, sessões, organizações, memberships, papéis, convites e auditoria

## Constitution Check — Pré-design

| Princípio | Resultado | Evidência |
|---|---|---|
| I. Spec Kit como fonte de verdade | PASS | Decisões registradas neste plano, pesquisa, modelo e contratos |
| II. Entregas verticais | PASS | Histórias P1 permitem cadastro, login e contexto antes das capacidades P2/P3 |
| III. Isolamento por tenant | PASS | Guard central, políticas e `organizationId` obrigatório nos repositórios |
| IV. Segurança e privacidade | PASS com exceção | Exceção `SEC-EXC-001` documentada e compensada |
| V. Test-first em comportamentos críticos | PASS | Autenticação, tokens, autorização e isolamento exigem teste anterior ao código |
| VI. UX acessível e resiliente | PASS | Todos os fluxos terão estados, teclado, foco e mensagens seguras |
| VII. Operação observável e reversível | PASS | Auditoria append-only, migrations versionadas e sessões revogáveis |

**Resultado do gate:** aprovado. A exceção de senha não elimina nenhum controle obrigatório.

## Decisões de Segurança

### Senhas e Argon2id

- Hash com Argon2id: `memoryCost=19456`, `timeCost=2`, `parallelism=1`.
- Cada hash terá salt aleatório produzido pela biblioteca; nenhum salt será compartilhado.
- Mínimo de 8 e máximo de 128 caracteres.
- Exigir pelo menos uma letra minúscula, uma maiúscula, um número e um símbolo.
- Bloquear senhas comuns ou comprometidas por lista local versionada/serviço com consulta
  que não revele a senha completa.
- Aceitar colagem, espaços válidos, Unicode e gerenciadores de senha.
- Não truncar silenciosamente, não aplicar troca periódica e não usar perguntas secretas.
- Rehash oportunista quando os parâmetros forem elevados.

### Exceção SEC-EXC-001

O mínimo de 8 caracteres e as regras de composição divergem da recomendação atual para
autenticação de fator único. A decisão foi mantida pelo Product Owner.

Controles compensatórios obrigatórios:

- Argon2id com parâmetros definidos acima;
- bloqueio de senhas comuns/comprometidas;
- verificação de e-mail antes do uso protegido;
- rate limiting por combinação de conta normalizada, IP e janela temporal;
- mensagens neutras contra enumeração;
- auditoria de falhas conforme limiar, sem registrar senha;
- bloqueio progressivo temporário, nunca bloqueio permanente automático;
- revisão obrigatória antes de produção ou introdução de MFA.

### Cookies, JWT e CSRF

- Access JWT: 15 minutos; contém `sub`, `sid`, `iat`, `exp`, `iss`, `aud` e `jti`.
- Não incluir papéis ou tenant como autorização definitiva no JWT.
- Refresh token aleatório e rotativo; armazenar somente hash e `jti`/família no MySQL.
- Detectar reutilização de refresh token já rotacionado e revogar toda a família.
- Cookies `HttpOnly`, `SameSite=Lax`, `Path=/`; `Secure` obrigatório fora do ambiente local.
- Nenhum token de autenticação em `localStorage` ou `sessionStorage`.
- CSRF por double-submit: cookie não `HttpOnly` + cabeçalho `X-CSRF-Token`.
- Comparação constante entre cookie e cabeçalho; validar também `Origin`/`Referer`.
- Rotacionar identificadores após login, elevação de privilégio e recuperação de senha.
- Respostas de autenticação usam `Cache-Control: no-store`.

### Prazos

| Item | Prazo | Regra |
|---|---:|---|
| Access JWT | 15 minutos | Não renovado sem refresh válido |
| Inatividade da sessão | 30 minutos | Aplicada no servidor |
| Duração absoluta | 8 horas | Não estendida por atividade |
| Verificação de e-mail | 24 horas | Uso único |
| Recuperação de senha | 30 minutos | Uso único; revoga sessões após sucesso |
| Convite institucional | 7 dias | Uso único, revogável |

Não haverá “lembrar de mim” neste incremento.

## Arquitetura de Autorização

```text
HTTP Request
  -> AuthenticationGuard
  -> SessionValidator
  -> TenantContextResolver
  -> PolicyService
  -> ApplicationService
  -> TenantAwareRepository(organizationId obrigatório)
  -> Prisma / MySQL
```

### Regras

- `TenantContext` tem `type=PERSONAL` com `ownerUserId`, ou `type=ORGANIZATION` com
  `organizationId`, `membershipId` e papéis atuais.
- Contexto organizacional exige usuário, organização e membership ativos.
- `organizationId` recebido do cliente indica o contexto desejado, não prova autorização.
- O `TenantContextResolver` obtém a membership atual no servidor.
- `PolicyService` aplica deny-by-default e verifica ações específicas.
- Repositórios institucionais recebem `organizationId` como argumento obrigatório.
- Recursos pessoais usam `ownerUserId`; não usar `organizationId=null` como escopo implícito.
- Serviço SaaS global usa guard/política próprios e não herda acesso ao conteúdo do tenant.
- Recurso inexistente e recurso de outro tenant produzem resposta externa equivalente.

## Estrutura de Código Prevista

```text
apps/api/src/modules/
├── identity/
│   ├── application/
│   ├── domain/
│   ├── infrastructure/
│   └── presentation/
├── sessions/
├── organizations/
├── memberships/
├── invitations/
├── authorization/
├── audit/
└── mail/

apps/web/src/features/
├── auth/
├── account/
├── context-switcher/
├── organizations/
└── member-management/

prisma/
├── schema.prisma
├── migrations/
└── seed.ts

tests/
├── integration/
└── e2e/
```

O monólito continuará modular. Módulos não poderão importar diretamente a infraestrutura
interna de outro módulo; integração ocorrerá por serviços públicos e contratos definidos.

## Fase 0 — Pesquisa

As decisões e alternativas estão registradas em [research.md](research.md). Não há marcador
`NEEDS CLARIFICATION` pendente.

## Fase 1 — Design

### Persistência

O modelo detalhado está em [data-model.md](data-model.md). As entidades mínimas são:

- `User`, `PasswordCredential`, `Session`;
- `EmailVerificationToken`, `PasswordResetToken`;
- `Organization`, `Membership`, `Role`, `MembershipRole`;
- `PlatformRoleAssignment`;
- `Invitation`, `InvitationRole`;
- `ConsentRecord`, `AuditEvent`.

Todos os IDs serão UUID. Relações N:N terão tabelas explícitas. Status substituirá exclusão
física em registros de identidade e autorização auditáveis.

### E-mails

- Criar `MailPort` na camada de aplicação.
- Implementar `NodemailerMailAdapter` na infraestrutura.
- Mailpit é exclusivo de desenvolvimento/teste.
- Templates: verificação, recuperação e convite.
- Links recebem token bruto somente durante composição/envio; persistência guarda hash.
- Falha de entrega não deve gerar duplicação de usuário, invitation ou token.

### Contratos

O contrato inicial está em [contracts/identity.openapi.yaml](contracts/identity.openapi.yaml).
Erros devem seguir envelope estável com `status`, `code`, `message`, `correlationId` e
`timestamp`, sem detalhes internos.

### Auditoria

- `AuditEvent` append-only com retenção padrão de 180 dias.
- Retenção futuramente configurável por categoria.
- Metadados por allowlist; sem senha, JWT ou tokens.
- IP e User-Agent somente pseudonimizados quando necessários à detecção de abuso.
- Nenhuma rota comum de update/delete para auditoria.
- Limpeza por job controlado, auditado e limitado à política de retenção.

## Estratégia de Testes

### Unitários — Jest

- política de senha e bloqueio de senhas comprometidas;
- normalização de e-mail;
- geração, hash, expiração e consumo de tokens;
- rotação/reutilização de refresh token;
- `TenantContextResolver` e `PolicyService`;
- mudanças de status e regra do último administrador;
- filtragem de metadados de auditoria.

### Integração — Jest + Supertest + MySQL real

- índices e constraints Prisma;
- concorrência em cadastro e membership;
- sessão, rotação, revogação e detecção de reuse;
- tokens de uso único e expiração;
- consultas com `organizationId` obrigatório;
- proteção do último Admin institucional sob concorrência;
- append-only da auditoria;
- Mailpit/adapter substituído por fake determinístico quando a entrega não for o objeto do teste.

SQLite é proibido para integração deste incremento.

### E2E — Playwright

O cenário mínimo contém usuário A/organização A, usuário B/organização B, um usuário membro
das duas organizações e um contexto pessoal. Testar leitura e escrita cruzadas, IDs válidos
de outro tenant, troca de contexto, suspensão e alteração de papel durante sessão ativa,
refresh reuse, recuperação de senha e tentativa institucional de atribuir Admin SaaS.

## Migração e Seed

- Criar migration inicial de identidade com nome descritivo.
- Seed somente com catálogo de papéis fixos.
- Admin SaaS será criado por comando operacional explícito, idempotente e sem senha fixa no
  repositório.
- Não inserir usuário real, organização real ou credencial padrão.
- A migration deve ser aplicada em banco vazio no CI e testada por `prisma migrate deploy`.

## Observabilidade

- Correlation ID por requisição.
- Métricas de sucesso/falha de login, rate limiting, refresh reuse, falha de e-mail e
  negação cross-tenant, sem labels de alta cardinalidade com PII.
- Logs estruturados sem senha, tokens, cookies ou `DATABASE_URL`.
- Eventos de auditoria distintos de logs técnicos.

## Constitution Check — Pós-design

| Princípio | Resultado | Evidência de design |
|---|---|---|
| I | PASS | Plan, research, data model, quickstart e contrato consistentes |
| II | PASS | Ordem permite demonstrar cadastro/login antes de gestão institucional |
| III | PASS | Context resolver, policy e repository boundary em três camadas |
| IV | PASS com `SEC-EXC-001` | Exceção delimitada, compensada e com revisão obrigatória |
| V | PASS | Testes definidos para todos os comportamentos críticos |
| VI | PASS | Fluxos web incluem acessibilidade, mensagens e estados completos |
| VII | PASS | Sessões revogáveis, auditoria, migration e observabilidade previstas |

**Resultado do gate:** aprovado para `/speckit.tasks`.

## Sequência de Implementação

1. Schema Prisma, migration e seed de papéis.
2. Infraestrutura de configuração, criptografia, tokens, sessão, CSRF e e-mail.
3. Cadastro, verificação, login, refresh, logout e recuperação.
4. Contexto pessoal e criação de organização.
5. Memberships, papéis, convites e troca de contexto.
6. Administração SaaS separada.
7. Auditoria, rate limiting e observabilidade.
8. Interfaces web acessíveis.
9. Testes de integração e E2E de isolamento.
10. Documentação, análise Spec Kit e verificação Superpowers.

## Riscos

| ID | Risco | Impacto | Mitigação |
|---|---|---|---|
| SEC-EXC-001 | Política de senha abaixo da recomendação atual | Alto | Controles compensatórios e revisão antes de produção |
| R-002 | JWT manter autorização obsoleta | Alto | JWT não é fonte de papel/tenant; revalidar estado no servidor |
| R-003 | Roubo/reuso de refresh token | Crítico | Rotação, hash, família, reuse detection e revogação |
| R-004 | IDOR/cross-tenant | Crítico | Guard + Policy + repository scope + testes A/B |
| R-005 | Último admin removido por concorrência | Alto | Transação, lock/constraint aplicável e teste concorrente |
| R-006 | E-mail local divergir da produção | Médio | Porta `MailPort`, adapter substituível e contratos independentes |
| R-007 | Auditoria armazenar PII excessiva | Alto | Allowlist, pseudonimização e retenção de 180 dias |

## Complexity Tracking

| Item | Justificativa | Alternativa rejeitada |
|---|---|---|
| Sessão persistida apesar de JWT | Necessária para revogação, idle timeout e reuse detection | JWT totalmente stateless não cumpre bloqueio/revogação imediata |
| Tabelas explícitas de papéis | Permitem múltiplos papéis e auditoria sem arrays opacos | Enum direto em Membership limita evolução e rastreabilidade |
| Três camadas multi-tenant | Falha única não pode expor outro tenant | Somente guard de rota é insuficiente |


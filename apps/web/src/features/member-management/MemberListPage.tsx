import React, { useState, useEffect, useCallback } from "react";
import { apiClient, ApiError } from "../../lib/api-client";
import { useAuth } from "../auth/AuthProvider";
import { InviteMemberModal } from "./InviteMemberModal";

export interface MemberItem {
  id: string;
  userId: string;
  status: "ACTIVE" | "SUSPENDED" | "REMOVED";
  joinedAt: string;
  suspendedAt?: string | null;
  roles: string[];
}

export const MemberListPage: React.FC = () => {
  const { activeContext } = useAuth();
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const orgId =
    activeContext?.type === "ORGANIZATION"
      ? activeContext.organizationId
      : null;

  const isAdmin =
    activeContext?.type === "ORGANIZATION" &&
    activeContext.roles.includes("INSTITUTION_ADMIN");

  const loadMembers = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.get<{ members: MemberItem[] }>(
        `/organizations/${orgId}/members`,
      );
      setMembers(res.members);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Erro ao carregar lista de membros.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const handleToggleStatus = async (
    membershipId: string,
    currentStatus: "ACTIVE" | "SUSPENDED" | "REMOVED",
  ) => {
    if (!orgId) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

    try {
      await apiClient.patch(
        `/organizations/${orgId}/members/${membershipId}/status`,
        { status: newStatus },
      );
      setSuccessMessage(`Status do membro atualizado para ${newStatus}.`);
      await loadMembers();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "LAST_ADMIN_PROTECTED") {
          setErrorMessage(
            "Operação bloqueada: Não é permitido suspender ou remover o último administrador ativo da organização.",
          );
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage("Erro ao alterar status do membro.");
      }
    }
  };

  if (!orgId) {
    return (
      <div className="card">
        <h2>Gestão de Membros</h2>
        <p style={{ color: "#94a3b8" }}>
          Selecione uma organização no seletor de contexto para gerenciar seus
          membros.
        </p>
      </div>
    );
  }

  return (
    <section className="card" aria-labelledby="members-heading">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h2 id="members-heading" style={{ fontSize: "1.25rem", margin: 0 }}>
          Membros da Organização
        </h2>
        {isAdmin && (
          <button
            id="btn-open-invite-modal"
            type="button"
            className="btn btn-primary"
            onClick={() => setIsInviteModalOpen(true)}
          >
            + Convidar Membro
          </button>
        )}
      </div>

      {errorMessage && (
        <div
          className="alert alert-error"
          role="alert"
          style={{ marginBottom: "16px" }}
        >
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div
          className="alert alert-success"
          role="status"
          style={{ marginBottom: "16px" }}
        >
          {successMessage}
        </div>
      )}

      {isLoading ? (
        <p style={{ color: "#94a3b8" }}>Carregando membros...</p>
      ) : members.length === 0 ? (
        <p style={{ color: "#94a3b8" }}>Nenhum membro encontrado.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              textAlign: "left",
              fontSize: "14px",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--border-subtle, #334155)",
                }}
              >
                <th style={{ padding: "10px 12px" }}>ID do Usuário</th>
                <th style={{ padding: "10px 12px" }}>Papéis</th>
                <th style={{ padding: "10px 12px" }}>Status</th>
                <th style={{ padding: "10px 12px" }}>Data de Ingresso</th>
                {isAdmin && <th style={{ padding: "10px 12px" }}>Ações</th>}
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr
                  key={member.id}
                  style={{
                    borderBottom: "1px solid rgba(51, 65, 85, 0.4)",
                  }}
                >
                  <td style={{ padding: "10px 12px", fontFamily: "monospace" }}>
                    {member.userId}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    {member.roles.map((r) => (
                      <span
                        key={r}
                        style={{
                          background: "#1e293b",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          fontSize: "12px",
                          marginRight: "4px",
                          color:
                            r === "INSTITUTION_ADMIN" ? "#38bdf8" : "#94a3b8",
                        }}
                      >
                        {r}
                      </span>
                    ))}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        backgroundColor:
                          member.status === "ACTIVE"
                            ? "rgba(34, 197, 94, 0.15)"
                            : "rgba(239, 68, 68, 0.15)",
                        color:
                          member.status === "ACTIVE" ? "#4ade80" : "#f87171",
                      }}
                    >
                      {member.status}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#94a3b8" }}>
                    {new Date(member.joinedAt).toLocaleDateString()}
                  </td>
                  {isAdmin && (
                    <td style={{ padding: "10px 12px" }}>
                      <button
                        id={`btn-toggle-status-${member.id}`}
                        type="button"
                        className="btn btn-secondary"
                        onClick={() =>
                          handleToggleStatus(member.id, member.status)
                        }
                        style={{
                          fontSize: "12px",
                          padding: "4px 8px",
                          borderRadius: "4px",
                        }}
                      >
                        {member.status === "ACTIVE" ? "Suspender" : "Reativar"}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {orgId && (
        <InviteMemberModal
          isOpen={isInviteModalOpen}
          onClose={() => setIsInviteModalOpen(false)}
          organizationId={orgId}
          onInvited={loadMembers}
        />
      )}
    </section>
  );
};

import React, { useState, useEffect, useCallback } from "react";
import { apiClient, ApiError } from "../../lib/api-client";

export interface PlatformOrganizationItem {
  id: string;
  name: string;
  slug: string;
  status: "ACTIVE" | "SUSPENDED";
  timezone: string;
  createdAt: string;
  updatedAt: string;
  membersCount: number;
}

export const PlatformOrganizationsPage: React.FC = () => {
  const [organizations, setOrganizations] = useState<
    PlatformOrganizationItem[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Dialog state for status update
  const [selectedOrg, setSelectedOrg] =
    useState<PlatformOrganizationItem | null>(null);
  const [newStatus, setNewStatus] = useState<"ACTIVE" | "SUSPENDED">(
    "SUSPENDED",
  );
  const [reason, setReason] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const loadOrganizations = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await apiClient.get<{
        organizations: PlatformOrganizationItem[];
      }>("/platform/organizations");
      setOrganizations(res.organizations);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 403) {
          setErrorMessage(
            "Acesso Negado: Esta área é restrita a Administradores da Plataforma (SaaS Admin).",
          );
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage("Erro ao listar organizações da plataforma.");
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  const handleOpenStatusModal = (
    org: PlatformOrganizationItem,
    targetStatus: "ACTIVE" | "SUSPENDED",
  ) => {
    setSelectedOrg(org);
    setNewStatus(targetStatus);
    setReason("");
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleConfirmStatusChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrg) return;

    if (!reason.trim() || reason.trim().length < 5) {
      setErrorMessage(
        "Por favor, forneça uma justificativa detalhada (mínimo 5 caracteres).",
      );
      return;
    }

    setIsUpdating(true);

    try {
      await apiClient.patch(
        `/platform/organizations/${selectedOrg.id}/status`,
        {
          status: newStatus,
          reason: reason.trim(),
        },
      );

      setSuccessMessage(
        `Organização "${selectedOrg.name}" atualizada com sucesso para ${newStatus}.`,
      );
      setSelectedOrg(null);
      await loadOrganizations();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Erro ao atualizar status da organização.");
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <section className="card" aria-labelledby="platform-orgs-heading">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h2
          id="platform-orgs-heading"
          style={{ fontSize: "1.25rem", margin: 0 }}
        >
          Administração da Plataforma — Organizações
        </h2>
        <span
          style={{
            background: "rgba(56, 189, 248, 0.15)",
            color: "#38bdf8",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: 600,
          }}
        >
          SaaS Admin
        </span>
      </div>

      <p style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "20px" }}>
        Visualização global e controle de conformidade institucional de todos os
        tenants cadastrados no sistema.
      </p>

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
        <p style={{ color: "#94a3b8" }}>
          Carregando organizações da plataforma...
        </p>
      ) : organizations.length === 0 ? (
        <p style={{ color: "#94a3b8" }}>Nenhuma organização cadastrada.</p>
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
                <th style={{ padding: "10px 12px" }}>Nome</th>
                <th style={{ padding: "10px 12px" }}>Slug</th>
                <th style={{ padding: "10px 12px" }}>Status</th>
                <th style={{ padding: "10px 12px" }}>Membros</th>
                <th style={{ padding: "10px 12px" }}>Criado em</th>
                <th style={{ padding: "10px 12px" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((org) => (
                <tr
                  key={org.id}
                  style={{
                    borderBottom: "1px solid rgba(51, 65, 85, 0.4)",
                  }}
                >
                  <td style={{ padding: "10px 12px", fontWeight: 500 }}>
                    {org.name}
                  </td>
                  <td
                    style={{
                      padding: "10px 12px",
                      fontFamily: "monospace",
                      color: "#94a3b8",
                    }}
                  >
                    {org.slug}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        backgroundColor:
                          org.status === "ACTIVE"
                            ? "rgba(34, 197, 94, 0.15)"
                            : "rgba(239, 68, 68, 0.15)",
                        color: org.status === "ACTIVE" ? "#4ade80" : "#f87171",
                      }}
                    >
                      {org.status}
                    </span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>{org.membersCount}</td>
                  <td style={{ padding: "10px 12px", color: "#94a3b8" }}>
                    {new Date(org.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <button
                      id={`btn-platform-toggle-status-${org.id}`}
                      type="button"
                      className="btn btn-secondary"
                      onClick={() =>
                        handleOpenStatusModal(
                          org,
                          org.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE",
                        )
                      }
                      style={{ fontSize: "12px", padding: "4px 8px" }}
                    >
                      {org.status === "ACTIVE" ? "Suspender" : "Reativar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedOrg && (
        <div
          className="modal-backdrop"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            backdropFilter: "blur(4px)",
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="status-modal-title"
        >
          <div
            className="modal-content"
            style={{
              background: "#0f172a",
              border: "1px solid var(--border-subtle, #334155)",
              borderRadius: "12px",
              padding: "24px",
              width: "100%",
              maxWidth: "480px",
              color: "#f8fafc",
            }}
          >
            <h2
              id="status-modal-title"
              style={{ fontSize: "1.25rem", margin: "0 0 8px 0" }}
            >
              {newStatus === "SUSPENDED"
                ? "Suspender Organização"
                : "Reativar Organização"}
            </h2>
            <p
              style={{
                fontSize: "14px",
                color: "#94a3b8",
                margin: "0 0 16px 0",
              }}
            >
              Organização: <strong>{selectedOrg.name}</strong> (
              {selectedOrg.slug})
            </p>

            <form onSubmit={handleConfirmStatusChange}>
              <div className="form-group" style={{ marginBottom: "16px" }}>
                <label
                  htmlFor="suspend-reason-input"
                  style={{
                    display: "block",
                    marginBottom: "6px",
                    fontSize: "14px",
                  }}
                >
                  Justificativa Auditada (Obrigatória)
                </label>
                <textarea
                  id="suspend-reason-input"
                  className="form-input"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  rows={3}
                  placeholder="Informe o motivo da alteração de status operacional..."
                  disabled={isUpdating}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: "6px",
                    color: "#f8fafc",
                  }}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "12px",
                }}
              >
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSelectedOrg(null)}
                  disabled={isUpdating}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    background: "transparent",
                    border: "1px solid #475569",
                    color: "#94a3b8",
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  id="confirm-suspend-btn"
                  type="submit"
                  className="btn btn-primary"
                  disabled={
                    isUpdating || !reason.trim() || reason.trim().length < 5
                  }
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    background:
                      newStatus === "SUSPENDED" ? "#ef4444" : "#0284c7",
                    border: "none",
                    color: "#ffffff",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  {isUpdating
                    ? "Salvando..."
                    : newStatus === "SUSPENDED"
                      ? "Confirmar Suspensão"
                      : "Confirmar Reativação"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
};

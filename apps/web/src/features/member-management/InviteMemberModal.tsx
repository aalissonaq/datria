import React, { useState } from "react";
import { apiClient, ApiError } from "../../lib/api-client";

export interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  organizationId: string;
  onInvited?: () => void;
}

export const AVAILABLE_ROLES = [
  { code: "TEACHER", label: "Professor (TEACHER)" },
  { code: "REVIEWER", label: "Revisor (REVIEWER)" },
  { code: "PARTICIPANT", label: "Participante (PARTICIPANT)" },
  { code: "INSTITUTION_ADMIN", label: "Administrador Institucional" },
];

export const InviteMemberModal: React.FC<InviteMemberModalProps> = ({
  isOpen,
  onClose,
  organizationId,
  onInvited,
}) => {
  const [email, setEmail] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(["TEACHER"]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRoleToggle = (code: string) => {
    if (selectedRoles.includes(code)) {
      if (selectedRoles.length > 1) {
        setSelectedRoles(selectedRoles.filter((r) => r !== code));
      }
    } else {
      setSelectedRoles([...selectedRoles, code]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage("Por favor, informe o e-mail do membro.");
      return;
    }

    if (selectedRoles.length === 0) {
      setErrorMessage("Selecione ao menos um papel.");
      return;
    }

    setIsLoading(true);

    try {
      await apiClient.post(`/organizations/${organizationId}/invitations`, {
        email: email.trim(),
        roles: selectedRoles,
      });

      setEmail("");
      setSelectedRoles(["TEACHER"]);
      if (onInvited) onInvited();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Erro ao enviar convite.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
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
      aria-labelledby="invite-modal-title"
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
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
        }}
      >
        <h2
          id="invite-modal-title"
          style={{ fontSize: "1.25rem", margin: "0 0 8px 0" }}
        >
          Convidar Membro
        </h2>
        <p style={{ fontSize: "14px", color: "#94a3b8", margin: "0 0 16px 0" }}>
          O convite será enviado por e-mail com validade de 7 dias.
        </p>

        {errorMessage && (
          <div
            className="alert alert-error"
            role="alert"
            style={{
              background: "rgba(239, 68, 68, 0.1)",
              border: "1px solid #ef4444",
              color: "#fca5a5",
              padding: "10px",
              borderRadius: "6px",
              marginBottom: "16px",
              fontSize: "14px",
            }}
          >
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: "16px" }}>
            <label
              htmlFor="invite-email"
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "14px",
              }}
            >
              E-mail do Convidado
            </label>
            <input
              id="invite-email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="docente@exemplo.edu.br"
              disabled={isLoading}
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

          <div className="form-group" style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "8px",
                fontSize: "14px",
              }}
            >
              Papéis na Organização
            </label>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "8px" }}
            >
              {AVAILABLE_ROLES.map((role) => (
                <label
                  key={role.code}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role.code)}
                    onChange={() => handleRoleToggle(role.code)}
                    disabled={isLoading}
                  />
                  {role.label}
                </label>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
            }}
          >
            <button
              id="invite-cancel-btn"
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isLoading}
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
              id="invite-submit-btn"
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || !email.trim()}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                background: "#0284c7",
                border: "none",
                color: "#ffffff",
                cursor: "pointer",
                fontWeight: 500,
              }}
            >
              {isLoading ? "Enviando..." : "Enviar Convite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

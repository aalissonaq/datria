import React, { useState, useEffect } from "react";
import { apiClient, ApiError } from "../../lib/api-client";
import { useAuth } from "../auth/AuthProvider";

export interface AcceptInvitationPageProps {
  onNavigate?: (path: string) => void;
}

export const AcceptInvitationPage: React.FC<AcceptInvitationPageProps> = ({
  onNavigate,
}) => {
  const { user, refreshContext } = useAuth();
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const t = urlParams.get("token");
      if (t) setToken(t);
    }
  }, []);

  const handleAccept = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    if (!token.trim()) {
      setErrorMessage("Token de convite não informado.");
      return;
    }

    if (!user) {
      setErrorMessage(
        "Você precisa estar autenticado para aceitar um convite.",
      );
      return;
    }

    setIsLoading(true);

    try {
      const res = await apiClient.post<{
        message: string;
        organization: { id: string; name: string; slug: string };
      }>(`/invitations/${token.trim()}/accept`);

      setIsSuccess(true);
      setOrgName(res.organization.name);
      await refreshContext();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(
          "Não foi possível aceitar o convite. Ele pode estar expirado ou já utilizado.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="auth-card"
      role="region"
      aria-label="Aceite de Convite Institucional"
    >
      <h1 className="auth-title">Convite Institucional</h1>
      <p className="auth-subtitle">
        Aceite o convite para colaborar na organização parceira.
      </p>

      {errorMessage && (
        <div className="alert alert-error" role="alert" aria-live="assertive">
          {errorMessage}
        </div>
      )}

      {isSuccess ? (
        <div
          className="alert alert-success"
          role="status"
          aria-live="polite"
          style={{ textAlign: "center" }}
        >
          <h3 style={{ margin: "0 0 8px 0" }}>Convite Aceito!</h3>
          <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.5" }}>
            Você agora faz parte da organização <strong>{orgName}</strong>. O
            contexto institucional já está disponível no seletor.
          </p>
          <div style={{ marginTop: "20px" }}>
            <button
              id="goto-dashboard-btn"
              type="button"
              className="btn btn-primary"
              onClick={() =>
                onNavigate ? onNavigate("/") : (window.location.href = "/")
              }
            >
              Ir para o Início
            </button>
          </div>
        </div>
      ) : !user ? (
        <div style={{ textAlign: "center", padding: "16px 0" }}>
          <p
            style={{ color: "#94a3b8", fontSize: "14px", marginBottom: "16px" }}
          >
            Para aceitar este convite, faça login na sua conta existente ou
            cadastre-se.
          </p>
          <div
            style={{ display: "flex", gap: "12px", justifyContent: "center" }}
          >
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                onNavigate
                  ? onNavigate("/login")
                  : (window.location.href = "/login")
              }
            >
              Fazer Login
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                onNavigate
                  ? onNavigate("/register")
                  : (window.location.href = "/register")
              }
            >
              Criar Conta
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleAccept}>
          {!new URLSearchParams(window.location.search).get("token") && (
            <div className="form-group">
              <label htmlFor="accept-invite-token">Código do Convite</label>
              <input
                id="accept-invite-token"
                type="text"
                className="form-input"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                placeholder="Cole o código do convite recebido"
                disabled={isLoading}
              />
            </div>
          )}

          <p
            style={{ fontSize: "14px", color: "#94a3b8", marginBottom: "16px" }}
          >
            Conectado como: <strong>{user.email}</strong> ({user.displayName})
          </p>

          <button
            id="accept-invite-btn"
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%" }}
            disabled={isLoading || !token.trim()}
          >
            {isLoading ? "Processando..." : "Aceitar e Vincular à Organização"}
          </button>
        </form>
      )}
    </div>
  );
};

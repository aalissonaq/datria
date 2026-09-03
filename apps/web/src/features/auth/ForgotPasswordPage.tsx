import React, { useState } from "react";
import { apiClient, ApiError } from "../../lib/api-client";

export interface ForgotPasswordPageProps {
  onNavigate?: (path: string) => void;
}

export const ForgotPasswordPage: React.FC<ForgotPasswordPageProps> = ({
  onNavigate,
}) => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage("Por favor, informe seu e-mail.");
      return;
    }

    setIsLoading(true);

    try {
      await apiClient.post("/auth/forgot-password", {
        email: email.trim(),
      });
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Erro ao solicitar recuperação. Tente novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-card" role="region" aria-label="Recuperação de Acesso">
      <h1 className="auth-title">Recuperar Senha</h1>
      <p className="auth-subtitle">
        Informe seu e-mail cadastrado para receber as instruções de recuperação.
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
          <h3 style={{ margin: "0 0 8px 0" }}>Solicitação Enviada!</h3>
          <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.5" }}>
            Se o e-mail estiver cadastrado em nossa plataforma, você receberá um
            link com validade de 30 minutos para cadastrar sua nova senha.
          </p>
          <div style={{ marginTop: "20px" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                onNavigate
                  ? onNavigate("/login")
                  : (window.location.href = "/login")
              }
            >
              Voltar para o Login
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="forgot-email">E-mail Cadastrado</label>
            <input
              id="forgot-email"
              type="email"
              className="form-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="seu.email@exemplo.com"
              disabled={isLoading}
            />
          </div>

          <button
            id="forgot-submit-btn"
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "16px" }}
            disabled={isLoading || !email.trim()}
          >
            {isLoading ? "Enviando..." : "Enviar Instruções"}
          </button>
        </form>
      )}

      <div
        className="auth-footer"
        style={{ marginTop: "24px", textAlign: "center" }}
      >
        <button
          type="button"
          onClick={() =>
            onNavigate
              ? onNavigate("/login")
              : (window.location.href = "/login")
          }
          style={{
            background: "none",
            border: "none",
            color: "#38bdf8",
            cursor: "pointer",
            textDecoration: "underline",
            fontSize: "14px",
          }}
        >
          Voltar para o Login
        </button>
      </div>
    </div>
  );
};

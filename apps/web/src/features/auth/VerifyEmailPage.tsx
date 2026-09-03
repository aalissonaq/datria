import React, { useState, useEffect } from "react";
import { apiClient, ApiError } from "../../lib/api-client";

export interface VerifyEmailPageProps {
  onNavigate?: (path: string) => void;
}

export const VerifyEmailPage: React.FC<VerifyEmailPageProps> = ({
  onNavigate,
}) => {
  const [tokenInput, setTokenInput] = useState("");
  const [resendEmail, setResendEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "verifying" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [isResending, setIsResending] = useState(false);

  // Auto-verify if token is present in URL search parameters
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");

    if (urlToken) {
      setTokenInput(urlToken);
      performVerification(urlToken);
    }
  }, []);

  const performVerification = async (tokenToVerify: string) => {
    if (!tokenToVerify.trim()) {
      setErrorMessage("Por favor, forneça o código de verificação.");
      return;
    }

    setStatus("verifying");
    setErrorMessage(null);

    try {
      await apiClient.post("/auth/verify-email", {
        token: tokenToVerify.trim(),
      });
      setStatus("success");
    } catch (err) {
      setStatus("error");
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(
          "Código de ativação inválido, expirado ou já utilizado.",
        );
      }
    }
  };

  const handleManualVerify = (e: React.FormEvent) => {
    e.preventDefault();
    performVerification(tokenInput);
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !resendEmail.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resendEmail.trim())
    ) {
      setResendStatus("Informe um e-mail válido.");
      return;
    }

    setIsResending(true);
    setResendStatus(null);

    try {
      const res = await apiClient.post<{ message: string }>(
        "/auth/resend-verification",
        {
          email: resendEmail.trim(),
        },
      );
      setResendStatus(res.message || "Se elegível, um novo link foi enviado.");
    } catch (err) {
      if (err instanceof ApiError) {
        setResendStatus(err.message);
      } else {
        setResendStatus(
          "Não foi possível reenviar. Tente novamente mais tarde.",
        );
      }
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="auth-card" role="region" aria-label="Ativação de Conta">
      <h1 className="auth-title">Ativação de Conta</h1>

      {status === "verifying" && (
        <div className="alert alert-info" role="status">
          <p>Validando seu link de confirmação... Por favor, aguarde.</p>
        </div>
      )}

      {status === "success" && (
        <div className="alert alert-success" role="alert">
          <h3>Conta Ativada com Sucesso!</h3>
          <p>
            Seu endereço de e-mail foi confirmado. Você já pode acessar sua
            conta pessoal.
          </p>
          <div style={{ marginTop: "16px" }}>
            <button
              id="goto-login-btn"
              type="button"
              className="btn btn-primary"
              onClick={() =>
                onNavigate
                  ? onNavigate("/login")
                  : (window.location.href = "/login")
              }
            >
              Ir para o Login
            </button>
          </div>
        </div>
      )}

      {status === "error" && (
        <div className="alert alert-error" role="alert" aria-live="assertive">
          <h3>Falha na Ativação</h3>
          <p>{errorMessage || "O link é inválido ou já expirou."}</p>
        </div>
      )}

      {status !== "success" && (
        <>
          <form onSubmit={handleManualVerify} style={{ marginTop: "20px" }}>
            <div className="form-group">
              <label htmlFor="tokenInput">Código de Confirmação (Token)</label>
              <input
                id="tokenInput"
                type="text"
                className="form-input"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Cole o código do e-mail"
                disabled={status === "verifying"}
              />
            </div>
            <button
              id="verify-submit-btn"
              type="submit"
              className="btn btn-secondary"
              style={{ width: "100%", marginTop: "8px" }}
              disabled={status === "verifying" || !tokenInput.trim()}
            >
              Verificar Código
            </button>
          </form>

          <hr style={{ margin: "24px 0", borderColor: "#334155" }} />

          <div>
            <h2
              style={{
                fontSize: "16px",
                color: "#f8fafc",
                marginBottom: "8px",
              }}
            >
              Precisa de um novo link?
            </h2>
            <p
              style={{
                fontSize: "13px",
                color: "#94a3b8",
                marginBottom: "12px",
              }}
            >
              Insira o e-mail cadastrado para enviarmos um novo link de
              ativação.
            </p>

            {resendStatus && (
              <div
                className="alert alert-info"
                role="status"
                style={{ fontSize: "13px" }}
              >
                {resendStatus}
              </div>
            )}

            <form onSubmit={handleResend}>
              <div className="form-group">
                <input
                  id="resend-email"
                  type="email"
                  className="form-input"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  placeholder="seu.email@exemplo.com"
                  disabled={isResending}
                />
              </div>
              <button
                id="resend-btn"
                type="submit"
                className="btn btn-secondary"
                style={{ width: "100%", marginTop: "8px" }}
                disabled={isResending || !resendEmail.trim()}
              >
                {isResending ? "Enviando..." : "Reenviar Link de Confirmação"}
              </button>
            </form>
          </div>
        </>
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
          }}
        >
          Voltar para o Login
        </button>
      </div>
    </div>
  );
};

import React, { useState, useEffect } from "react";
import { apiClient, ApiError } from "../../lib/api-client";

export interface ResetPasswordPageProps {
  onNavigate?: (path: string) => void;
}

export const ResetPasswordPage: React.FC<ResetPasswordPageProps> = ({
  onNavigate,
}) => {
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const tokenParam = urlParams.get("token");
      if (tokenParam) {
        setToken(tokenParam);
      }
    }
  }, []);

  const passwordCriteria = {
    length: newPassword.length >= 8 && newPassword.length <= 128,
    hasUpper: /[A-Z]/.test(newPassword),
    hasLower: /[a-z]/.test(newPassword),
    hasDigit: /[0-9]/.test(newPassword),
    hasSymbol: /[^A-Za-z0-9]/.test(newPassword),
    matchesConfirm: newPassword.length > 0 && newPassword === confirmPassword,
  };

  const isPasswordValid =
    passwordCriteria.length &&
    passwordCriteria.hasUpper &&
    passwordCriteria.hasLower &&
    passwordCriteria.hasDigit &&
    passwordCriteria.hasSymbol &&
    passwordCriteria.matchesConfirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!token.trim()) {
      setErrorMessage("Token de recuperação ausente ou inválido.");
      return;
    }

    if (!isPasswordValid) {
      setErrorMessage(
        "A nova senha deve cumprir todos os requisitos de segurança e coincidir na confirmação.",
      );
      return;
    }

    setIsLoading(true);

    try {
      await apiClient.post("/auth/reset-password", {
        token: token.trim(),
        newPassword,
      });
      setIsSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage(
          "Não foi possível redefinir sua senha. O link pode estar expirado ou já utilizado.",
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
      aria-label="Definição de Nova Senha"
    >
      <h1 className="auth-title">Nova Senha</h1>
      <p className="auth-subtitle">
        Cadastre sua nova senha de acesso à plataforma Datria.
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
          <h3 style={{ margin: "0 0 8px 0" }}>Senha Redefinida!</h3>
          <p style={{ margin: 0, fontSize: "14px", lineHeight: "1.5" }}>
            Sua nova senha foi cadastrada com sucesso e todas as sessões ativas
            foram encerradas por segurança.
          </p>
          <div style={{ marginTop: "20px" }}>
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
              Fazer Login com a Nova Senha
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          {!new URLSearchParams(window.location.search).get("token") && (
            <div className="form-group">
              <label htmlFor="reset-token">Token de Recuperação</label>
              <input
                id="reset-token"
                type="text"
                className="form-input"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                required
                placeholder="Cole o código recebido por e-mail"
                disabled={isLoading}
              />
            </div>
          )}

          <div className="form-group">
            <label htmlFor="reset-new-password">Nova Senha</label>
            <div style={{ position: "relative" }}>
              <input
                id="reset-new-password"
                type={showPassword ? "text" : "password"}
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Mínimo de 8 caracteres fortes"
                disabled={isLoading}
              />
              <button
                type="button"
                className="btn-toggle-password"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Ocultar senha" : "Exibir senha"}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                }}
              >
                {showPassword ? "Ocultar" : "Exibir"}
              </button>
            </div>

            <div
              className="password-criteria"
              style={{
                marginTop: "8px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "4px",
                fontSize: "12px",
              }}
            >
              <span
                style={{
                  color: passwordCriteria.length ? "#4ade80" : "#94a3b8",
                }}
              >
                {passwordCriteria.length ? "✓" : "○"} 8 a 128 caracteres
              </span>
              <span
                style={{
                  color: passwordCriteria.hasUpper ? "#4ade80" : "#94a3b8",
                }}
              >
                {passwordCriteria.hasUpper ? "✓" : "○"} Letra maiúscula
              </span>
              <span
                style={{
                  color: passwordCriteria.hasLower ? "#4ade80" : "#94a3b8",
                }}
              >
                {passwordCriteria.hasLower ? "✓" : "○"} Letra minúscula
              </span>
              <span
                style={{
                  color: passwordCriteria.hasDigit ? "#4ade80" : "#94a3b8",
                }}
              >
                {passwordCriteria.hasDigit ? "✓" : "○"} Pelo menos 1 número
              </span>
              <span
                style={{
                  color: passwordCriteria.hasSymbol ? "#4ade80" : "#94a3b8",
                }}
              >
                {passwordCriteria.hasSymbol ? "✓" : "○"} Símbolo especial
              </span>
              <span
                style={{
                  color: passwordCriteria.matchesConfirm
                    ? "#4ade80"
                    : "#94a3b8",
                }}
              >
                {passwordCriteria.matchesConfirm ? "✓" : "○"} Senhas coincidem
              </span>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="reset-confirm-password">Confirmar Nova Senha</label>
            <input
              id="reset-confirm-password"
              type={showPassword ? "text" : "password"}
              className="form-input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Digite a nova senha novamente"
              disabled={isLoading}
            />
          </div>

          <button
            id="reset-submit-btn"
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: "16px" }}
            disabled={isLoading || !token.trim() || !isPasswordValid}
          >
            {isLoading ? "Salvando..." : "Redefinir Senha"}
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

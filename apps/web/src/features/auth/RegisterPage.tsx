import React, { useState } from "react";
import { apiClient, ApiError } from "../../lib/api-client";

export interface RegisterPageProps {
  onNavigate?: (path: string) => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onNavigate }) => {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Real-time password validation indicators
  const hasMinLength = password.length >= 8 && password.length <= 128;
  const hasLowerCase = /[a-z]/.test(password);
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9\s]/.test(password);
  const isPasswordValid =
    hasMinLength && hasLowerCase && hasUpperCase && hasNumber && hasSymbol;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!displayName.trim() || displayName.trim().length < 2) {
      setErrorMessage("O nome de exibição deve ter pelo menos 2 caracteres.");
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setErrorMessage("Por favor, insira um endereço de e-mail válido.");
      return;
    }

    if (!isPasswordValid) {
      setErrorMessage("A senha não atende a todos os critérios de segurança.");
      return;
    }

    if (!termsAccepted) {
      setErrorMessage(
        "Você deve aceitar os termos de serviço para prosseguir.",
      );
      return;
    }

    setIsLoading(true);

    try {
      await apiClient.post("/auth/register", {
        displayName: displayName.trim(),
        email: email.trim(),
        password,
        termsVersion: "v1.0",
      });

      setIsSuccess(true);
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Ocorreu um erro inesperado. Tente novamente.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div
        className="auth-card"
        role="region"
        aria-label="Confirmação de Registro"
      >
        <h1 className="auth-title">Verifique seu e-mail</h1>
        <div className="alert alert-success" role="alert">
          <p>
            Um link de ativação foi enviado para <strong>{email}</strong>.
          </p>
          <p>
            Por favor, verifique sua caixa de entrada (ou pasta de spam) para
            confirmar sua conta.
          </p>
        </div>
        <div className="auth-footer" style={{ marginTop: "24px" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              onNavigate
                ? onNavigate("/verify-email")
                : (window.location.href = "/verify-email")
            }
          >
            Já tem o link? Inserir código
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-card" role="region" aria-label="Cadastro de Usuário">
      <h1 className="auth-title">Criar Conta na Datria</h1>
      <p className="auth-subtitle">
        Cadastre-se para acessar seu ambiente de aprendizagem e avaliação.
      </p>

      {errorMessage && (
        <div className="alert alert-error" role="alert" aria-live="assertive">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="displayName">Nome Completo</label>
          <input
            id="displayName"
            type="text"
            className="form-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            autoComplete="name"
            placeholder="Ex: Maria Silva"
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
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

        <div className="form-group">
          <label htmlFor="password">Senha</label>
          <div style={{ position: "relative" }}>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Crie uma senha forte"
              disabled={isLoading}
              aria-describedby="password-rules"
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
            id="password-rules"
            className="password-rules"
            style={{ marginTop: "12px", fontSize: "13px" }}
          >
            <div style={{ color: hasMinLength ? "#4ade80" : "#94a3b8" }}>
              {hasMinLength ? "✓" : "○"} Mínimo de 8 caracteres (máx. 128)
            </div>
            <div style={{ color: hasLowerCase ? "#4ade80" : "#94a3b8" }}>
              {hasLowerCase ? "✓" : "○"} Ao menos uma letra minúscula
            </div>
            <div style={{ color: hasUpperCase ? "#4ade80" : "#94a3b8" }}>
              {hasUpperCase ? "✓" : "○"} Ao menos uma letra maiúscula
            </div>
            <div style={{ color: hasNumber ? "#4ade80" : "#94a3b8" }}>
              {hasNumber ? "✓" : "○"} Ao menos um número
            </div>
            <div style={{ color: hasSymbol ? "#4ade80" : "#94a3b8" }}>
              {hasSymbol ? "✓" : "○"} Ao menos um símbolo especial
            </div>
          </div>
        </div>

        <div
          className="form-group"
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            marginTop: "16px",
          }}
        >
          <input
            id="termsAccepted"
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            required
            disabled={isLoading}
            style={{ marginTop: "4px" }}
          />
          <label
            htmlFor="termsAccepted"
            style={{ fontSize: "14px", color: "#cbd5e1" }}
          >
            Concordo com os Termos de Serviço (v1.0) e a Política de Privacidade
            da plataforma.
          </label>
        </div>

        <button
          id="register-submit-btn"
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%", marginTop: "24px" }}
          disabled={isLoading || !isPasswordValid || !termsAccepted}
        >
          {isLoading ? "Processando..." : "Criar Conta"}
        </button>
      </form>

      <div
        className="auth-footer"
        style={{ marginTop: "24px", textAlign: "center" }}
      >
        <span style={{ color: "#94a3b8", fontSize: "14px" }}>
          Já possui uma conta?{" "}
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
            Fazer login
          </button>
        </span>
      </div>
    </div>
  );
};

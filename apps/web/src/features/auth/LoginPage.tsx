import React, { useState } from "react";
import { useAuth } from "./AuthProvider";
import { ApiError } from "../../lib/api-client";

export interface LoginPageProps {
  onNavigate?: (path: string) => void;
  onSuccess?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onNavigate,
  onSuccess,
}) => {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage("Por favor, preencha o e-mail e a senha.");
      return;
    }

    setIsLoading(true);

    try {
      await login(email.trim(), password);
      if (onSuccess) {
        onSuccess();
      } else if (onNavigate) {
        onNavigate("/");
      } else {
        window.location.href = "/";
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("E-mail ou senha inválidos.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-card" role="region" aria-label="Acesso ao Sistema">
      <h1 className="auth-title">Entrar na Datria</h1>
      <p className="auth-subtitle">
        Acesse sua conta pessoal ou seus ambientes institucionais.
      </p>

      {errorMessage && (
        <div className="alert alert-error" role="alert" aria-live="assertive">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="login-email">E-mail</label>
          <input
            id="login-email"
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
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.5rem",
            }}
          >
            <label htmlFor="login-password" style={{ margin: 0 }}>
              Senha
            </label>
            <button
              type="button"
              onClick={() =>
                onNavigate
                  ? onNavigate("/forgot-password")
                  : (window.location.href = "/forgot-password")
              }
              style={{
                background: "none",
                border: "none",
                color: "#38bdf8",
                fontSize: "13px",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Esqueceu a senha?
            </button>
          </div>

          <div style={{ position: "relative" }}>
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Sua senha de acesso"
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
        </div>

        <button
          id="login-submit-btn"
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%", marginTop: "16px" }}
          disabled={isLoading || !email.trim() || !password}
        >
          {isLoading ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <div
        className="auth-footer"
        style={{ marginTop: "24px", textAlign: "center" }}
      >
        <span style={{ color: "#94a3b8", fontSize: "14px" }}>
          Não tem uma conta?{" "}
          <button
            type="button"
            onClick={() =>
              onNavigate
                ? onNavigate("/register")
                : (window.location.href = "/register")
            }
            style={{
              background: "none",
              border: "none",
              color: "#38bdf8",
              cursor: "pointer",
              textDecoration: "underline",
            }}
          >
            Cadastre-se gratuitamente
          </button>
        </span>
      </div>
    </div>
  );
};

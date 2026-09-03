import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "../features/auth/AuthProvider";
import { RegisterPage } from "../features/auth/RegisterPage";
import { VerifyEmailPage } from "../features/auth/VerifyEmailPage";
import { LoginPage } from "../features/auth/LoginPage";
import { ForgotPasswordPage } from "../features/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "../features/auth/ResetPasswordPage";
import { AcceptInvitationPage } from "../features/invitations/AcceptInvitationPage";
import { MemberListPage } from "../features/member-management/MemberListPage";
import { PlatformOrganizationsPage } from "../features/platform/PlatformOrganizationsPage";
import { ContextSwitcher } from "../features/context/ContextSwitcher";

interface HealthState {
  status: "loading" | "ok" | "unavailable" | "error";
  service?: string;
  timestamp?: string;
  database?: "up" | "down" | "unknown";
  message?: string;
}

const AppContent: React.FC = () => {
  const { user, logout, activeContext } = useAuth();
  const [currentPath, setCurrentPath] = useState(
    typeof window !== "undefined" ? window.location.pathname : "/",
  );

  const [health, setHealth] = useState<HealthState>({
    status: "loading",
  });

  const apiBaseUrl =
    (import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } }).env
      ?.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const navigate = (path: string) => {
    window.history.pushState({}, "", path);
    setCurrentPath(path);
  };

  useEffect(() => {
    let isMounted = true;

    async function checkHealth() {
      try {
        const response = await fetch(`${apiBaseUrl}/health/ready`, {
          headers: { Accept: "application/json" },
        });

        const data = await response.json();

        if (isMounted) {
          if (response.ok && data.status === "ok") {
            setHealth({
              status: "ok",
              service: data.service,
              timestamp: data.timestamp,
              database: data.checks?.database || "up",
            });
          } else if (response.status === 503) {
            setHealth({
              status: "unavailable",
              service: data.service,
              timestamp: data.timestamp,
              database: data.checks?.database || "down",
              message: "Database dependency is currently unreachable.",
            });
          } else {
            setHealth({
              status: "error",
              message: `API returned unexpected status: ${response.status}`,
            });
          }
        }
      } catch {
        if (isMounted) {
          setHealth({
            status: "error",
            message: "API service offline or connection refused.",
          });
        }
      }
    }

    checkHealth();
    return () => {
      isMounted = false;
    };
  }, [apiBaseUrl]);

  return (
    <div className="container">
      <header className="header">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            width: "100%",
            flexWrap: "wrap",
            gap: "12px",
          }}
        >
          <div
            className="title-container"
            style={{ cursor: "pointer" }}
            onClick={() => navigate("/")}
          >
            <h1>Datria</h1>
            <span className="badge-codename" aria-label="Codename notice">
              Codename
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            {user && <ContextSwitcher />}

            <nav style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => navigate("/")}
                style={{
                  background: "none",
                  border: "none",
                  color: currentPath === "/" ? "#38bdf8" : "#94a3b8",
                  fontWeight: currentPath === "/" ? 600 : 400,
                  cursor: "pointer",
                }}
              >
                Início
              </button>

              {!user ? (
                <>
                  <button
                    id="nav-login-btn"
                    type="button"
                    onClick={() => navigate("/login")}
                    style={{
                      background: "none",
                      border: "none",
                      color: currentPath === "/login" ? "#38bdf8" : "#94a3b8",
                      fontWeight: currentPath === "/login" ? 600 : 400,
                      cursor: "pointer",
                    }}
                  >
                    Entrar
                  </button>
                  <button
                    id="nav-register-btn"
                    type="button"
                    onClick={() => navigate("/register")}
                    style={{
                      background: "none",
                      border: "none",
                      color:
                        currentPath === "/register" ? "#38bdf8" : "#94a3b8",
                      fontWeight: currentPath === "/register" ? 600 : 400,
                      cursor: "pointer",
                    }}
                  >
                    Cadastrar
                  </button>
                  <button
                    id="nav-verify-btn"
                    type="button"
                    onClick={() => navigate("/verify-email")}
                    style={{
                      background: "none",
                      border: "none",
                      color:
                        currentPath === "/verify-email" ? "#38bdf8" : "#94a3b8",
                      fontWeight: currentPath === "/verify-email" ? 600 : 400,
                      cursor: "pointer",
                    }}
                  >
                    Ativar Conta
                  </button>
                </>
              ) : (
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  {activeContext?.type === "ORGANIZATION" && (
                    <button
                      id="nav-members-btn"
                      type="button"
                      onClick={() => navigate("/members")}
                      style={{
                        background: "none",
                        border: "none",
                        color:
                          currentPath === "/members" ? "#38bdf8" : "#94a3b8",
                        fontWeight: currentPath === "/members" ? 600 : 400,
                        cursor: "pointer",
                      }}
                    >
                      Membros
                    </button>
                  )}
                  <span
                    id="user-display"
                    style={{ color: "#f8fafc", fontSize: "14px" }}
                  >
                    {user.displayName}
                  </span>
                  <button
                    id="nav-logout-btn"
                    type="button"
                    className="btn btn-secondary"
                    onClick={async () => {
                      await logout();
                      navigate("/");
                    }}
                    style={{ padding: "6px 12px", fontSize: "13px" }}
                  >
                    Sair
                  </button>
                </div>
              )}
            </nav>
          </div>
        </div>
        <p className="lead">
          Project foundation and development baseline initialized successfully.
        </p>
      </header>

      <main>
        {currentPath === "/login" && <LoginPage onNavigate={navigate} />}
        {currentPath === "/forgot-password" && (
          <ForgotPasswordPage onNavigate={navigate} />
        )}
        {currentPath === "/reset-password" && (
          <ResetPasswordPage onNavigate={navigate} />
        )}
        {currentPath === "/register" && <RegisterPage onNavigate={navigate} />}
        {currentPath === "/verify-email" && (
          <VerifyEmailPage onNavigate={navigate} />
        )}
        {currentPath === "/accept-invitation" && (
          <AcceptInvitationPage onNavigate={navigate} />
        )}
        {currentPath === "/members" && <MemberListPage />}
        {currentPath === "/platform/organizations" && (
          <PlatformOrganizationsPage />
        )}

        {currentPath !== "/login" &&
          currentPath !== "/forgot-password" &&
          currentPath !== "/reset-password" &&
          currentPath !== "/register" &&
          currentPath !== "/verify-email" &&
          currentPath !== "/accept-invitation" &&
          currentPath !== "/members" &&
          currentPath !== "/platform/organizations" && (
            <section className="card" aria-labelledby="baseline-heading">
              <h2
                id="baseline-heading"
                style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}
              >
                Baseline Status
              </h2>
              <p
                style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}
              >
                The temporary web experience loaded without errors. This serves
                as a development checkpoint confirming workspace installation
                and frontend build integrity.
              </p>

              <div className="status-grid">
                <div className="status-card">
                  <span className="status-label">Web Client</span>
                  <span className="status-value">
                    <span className="status-pill ok">
                      <span className="indicator-dot ok" />
                      Baseline loaded successfully
                    </span>
                  </span>
                </div>

                <div className="status-card" data-testid="health-status">
                  <span className="status-label">API Service Status</span>
                  <span className="status-value">
                    {health.status === "loading" && (
                      <span className="status-pill loading">
                        <span className="indicator-dot loading" />
                        Connecting...
                      </span>
                    )}
                    {health.status === "ok" && (
                      <span className="status-pill ok">
                        <span className="indicator-dot ok" />
                        Online ({health.service})
                      </span>
                    )}
                    {health.status === "unavailable" && (
                      <span className="status-pill down">
                        <span className="indicator-dot down" />
                        Dependency Unavailable
                      </span>
                    )}
                    {health.status === "error" && (
                      <span className="status-pill down">
                        <span className="indicator-dot down" />
                        Service offline
                      </span>
                    )}
                  </span>
                </div>

                <div className="status-card">
                  <span className="status-label">Database Dependency</span>
                  <span className="status-value">
                    {health.database === "up" && (
                      <span className="status-pill ok">
                        <span className="indicator-dot ok" />
                        Healthy
                      </span>
                    )}
                    {health.database === "down" && (
                      <span className="status-pill down">
                        <span className="indicator-dot down" />
                        Unreachable
                      </span>
                    )}
                    {health.database === "unknown" && (
                      <span className="status-pill warn">
                        <span className="indicator-dot loading" />
                        Unknown
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {!user && (
                <div
                  style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}
                >
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => navigate("/login")}
                  >
                    Entrar na Plataforma
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => navigate("/register")}
                  >
                    Criar Nova Conta
                  </button>
                </div>
              )}
            </section>
          )}
      </main>

      <footer className="footer">
        <p>
          Datria &mdash; Confidential internal baseline &bull; Identity and
          Multi-Tenancy platform
        </p>
      </footer>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;

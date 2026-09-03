import React, { useState, useEffect } from "react";

interface HealthState {
  status: "loading" | "ok" | "unavailable" | "error";
  service?: string;
  timestamp?: string;
  database?: "up" | "down" | "unknown";
  message?: string;
}

export const App: React.FC = () => {
  const [health, setHealth] = useState<HealthState>({
    status: "loading",
  });

  const apiBaseUrl =
    (import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } }).env
      ?.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

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
        <div className="title-container">
          <h1>Datria</h1>
          <span className="badge-codename" aria-label="Codename notice">
            Codename
          </span>
        </div>
        <p className="lead">
          Project foundation and development baseline initialized successfully.
        </p>
      </header>

      <main>
        <section className="card" aria-labelledby="baseline-heading">
          <h2
            id="baseline-heading"
            style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}
          >
            Baseline Status
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "1rem" }}>
            The temporary web experience loaded without errors. This serves as a
            development checkpoint confirming workspace installation and
            frontend build integrity.
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
                {health.status === "loading" && (
                  <span className="status-pill loading">Checking...</span>
                )}
                {health.database === "up" && (
                  <span className="status-pill ok">
                    <span className="indicator-dot ok" />
                    Connected (MySQL)
                  </span>
                )}
                {(health.database === "down" || health.status === "error") && (
                  <span className="status-pill down">
                    <span className="indicator-dot down" />
                    Unreachable
                  </span>
                )}
              </span>
            </div>
          </div>

          {health.message && (
            <div
              style={{
                marginTop: "1.25rem",
                color: "var(--status-warn-text)",
                fontSize: "0.875rem",
              }}
            >
              ⚠️ {health.message}
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="endpoints-heading">
          <h2
            id="endpoints-heading"
            style={{ fontSize: "1.25rem", marginBottom: "0.75rem" }}
          >
            Operational Endpoints
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "0.5rem" }}>
            Health and readiness contracts according to{" "}
            <code>contracts/health.openapi.yaml</code>:
          </p>
          <div className="code-block">
            GET {apiBaseUrl}/health/live — Process Liveness
            <br />
            GET {apiBaseUrl}/health/ready — Dependency Readiness (MySQL)
            <br />
            GET {apiBaseUrl}/docs — OpenAPI Swagger Documentation
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>
          Datria Engineering Baseline • TypeScript Monorepo • Node.js 24 LTS
        </p>
      </footer>
    </div>
  );
};

export default App;

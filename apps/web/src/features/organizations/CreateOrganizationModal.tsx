import React, { useState } from "react";
import { apiClient, ApiError } from "../../lib/api-client";
import { useAuth } from "../auth/AuthProvider";

export interface CreateOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (org: { id: string; name: string; slug: string }) => void;
}

export const CreateOrganizationModal: React.FC<
  CreateOrganizationModalProps
> = ({ isOpen, onClose, onCreated }) => {
  const { refreshContext, switchContext } = useAuth();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [autoSlug, setAutoSlug] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) {
    return null;
  }

  const generateSlug = (val: string) => {
    return val
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-");
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (autoSlug) {
      setSlug(generateSlug(val));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAutoSlug(false);
    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim() || name.trim().length < 2) {
      setErrorMessage(
        "O nome da organização deve ter pelo menos 2 caracteres.",
      );
      return;
    }

    if (!slug.trim() || slug.trim().length < 3) {
      setErrorMessage(
        "O identificador (slug) deve ter pelo menos 3 caracteres.",
      );
      return;
    }

    setIsLoading(true);

    try {
      const res = await apiClient.post<{
        organization: {
          id: string;
          name: string;
          slug: string;
          status: string;
        };
        membership: { id: string; roles: string[] };
      }>("/organizations", {
        name: name.trim(),
        slug: slug.trim(),
      });

      await refreshContext();
      switchContext(res.organization.id);

      if (onCreated) {
        onCreated(res.organization);
      }
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === "ORGANIZATION_SLUG_CONFLICT") {
          setErrorMessage(
            "Já existe uma organização com este identificador (slug).",
          );
        } else {
          setErrorMessage(err.message);
        }
      } else {
        setErrorMessage("Erro ao criar organização. Tente novamente.");
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
      aria-labelledby="create-org-title"
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
          id="create-org-title"
          style={{ fontSize: "1.25rem", margin: "0 0 8px 0" }}
        >
          Criar Nova Organização
        </h2>
        <p
          style={{
            fontSize: "14px",
            color: "#94a3b8",
            margin: "0 0 16px 0",
          }}
        >
          Você será definido automaticamente como Administrador Institucional da
          nova organização.
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
              htmlFor="create-org-name"
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "14px",
              }}
            >
              Nome da Organização
            </label>
            <input
              id="create-org-name"
              type="text"
              className="form-input"
              value={name}
              onChange={handleNameChange}
              required
              placeholder="Ex: Universidade Federal"
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
              htmlFor="create-org-slug"
              style={{
                display: "block",
                marginBottom: "6px",
                fontSize: "14px",
              }}
            >
              Identificador Único (Slug)
            </label>
            <input
              id="create-org-slug"
              type="text"
              className="form-input"
              value={slug}
              onChange={handleSlugChange}
              required
              placeholder="ex: universidade-federal"
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
            <span
              style={{
                fontSize: "12px",
                color: "#64748b",
                marginTop: "4px",
                display: "block",
              }}
            >
              Apenas letras minúsculas, números e hífens.
            </span>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "12px",
            }}
          >
            <button
              id="create-org-cancel-btn"
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
              id="create-org-submit-btn"
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || !name.trim() || !slug.trim()}
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
              {isLoading ? "Criando..." : "Criar Organização"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

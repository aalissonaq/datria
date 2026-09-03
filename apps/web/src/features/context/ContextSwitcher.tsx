import React, { useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { CreateOrganizationModal } from "../organizations/CreateOrganizationModal";

export const ContextSwitcher: React.FC = () => {
  const { activeContext, availableOrganizations, switchContext, user } =
    useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!user) {
    return null;
  }

  const currentOrgId =
    activeContext?.type === "ORGANIZATION" ? activeContext.organizationId : "";

  const handleContextChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOrgId = e.target.value;
    switchContext(selectedOrgId || null);
  };

  return (
    <>
      <div
        className="context-switcher"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(15, 23, 42, 0.6)",
          padding: "6px 12px",
          borderRadius: "8px",
          border: "1px solid var(--border-subtle, #334155)",
          fontSize: "14px",
        }}
      >
        <span style={{ color: "#94a3b8" }}>Contexto:</span>
        <select
          id="context-select"
          value={currentOrgId}
          onChange={handleContextChange}
          style={{
            background: "transparent",
            color: "#f8fafc",
            border: "none",
            outline: "none",
            cursor: "pointer",
            fontWeight: 500,
          }}
          aria-label="Selecionar contexto da organização"
        >
          <option value="" style={{ background: "#1e293b", color: "#f8fafc" }}>
            Ambiente Pessoal
          </option>
          {availableOrganizations.map((org) => (
            <option
              key={org.id}
              value={org.id}
              style={{ background: "#1e293b", color: "#f8fafc" }}
            >
              {org.name} ({org.roles.join(", ")})
            </option>
          ))}
        </select>

        <button
          id="btn-open-create-org"
          type="button"
          onClick={() => setIsModalOpen(true)}
          style={{
            background: "transparent",
            border: "1px dashed #64748b",
            borderRadius: "4px",
            color: "#38bdf8",
            cursor: "pointer",
            fontSize: "12px",
            padding: "2px 6px",
            marginLeft: "4px",
          }}
          title="Criar nova organização"
        >
          + Nova Org
        </button>
      </div>

      <CreateOrganizationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};

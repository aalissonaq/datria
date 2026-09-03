import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RegisterPage } from "./RegisterPage";
import { VerifyEmailPage } from "./VerifyEmailPage";
import { apiClient } from "../../lib/api-client";

vi.mock("../../lib/api-client", () => ({
  apiClient: {
    post: vi.fn(),
  },
  ApiError: class extends Error {
    constructor(public data: { message: string }) {
      super(data.message);
    }
  },
}));

describe("Auth Pages", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("RegisterPage", () => {
    it("renders all required form controls and keeps submit disabled until valid", () => {
      render(<RegisterPage />);

      expect(screen.getByLabelText(/Nome Completo/i)).toBeDefined();
      expect(screen.getByLabelText(/E-mail/i)).toBeDefined();
      expect(screen.getByLabelText(/^Senha$/i)).toBeDefined();
      expect(screen.getByLabelText(/Termos de Serviço/i)).toBeDefined();

      const submitBtn = screen.getByRole("button", { name: /Criar Conta/i });
      expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
    });

    it("enables submit when inputs satisfy password policy and terms are accepted", () => {
      render(<RegisterPage />);

      fireEvent.change(screen.getByLabelText(/Nome Completo/i), {
        target: { value: "Aluno Teste" },
      });
      fireEvent.change(screen.getByLabelText(/E-mail/i), {
        target: { value: "aluno@exemplo.com" },
      });
      fireEvent.change(screen.getByLabelText(/^Senha$/i), {
        target: { value: "SenhaForte!2026" },
      });
      fireEvent.click(screen.getByLabelText(/Termos de Serviço/i));

      const submitBtn = screen.getByRole("button", { name: /Criar Conta/i });
      expect((submitBtn as HTMLButtonElement).disabled).toBe(false);
    });

    it("submits registration and displays confirmation card", async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({
        message: "If the email is valid, a verification link has been sent.",
      });

      render(<RegisterPage />);

      fireEvent.change(screen.getByLabelText(/Nome Completo/i), {
        target: { value: "Aluno Teste" },
      });
      fireEvent.change(screen.getByLabelText(/E-mail/i), {
        target: { value: "aluno@exemplo.com" },
      });
      fireEvent.change(screen.getByLabelText(/^Senha$/i), {
        target: { value: "SenhaForte!2026" },
      });
      fireEvent.click(screen.getByLabelText(/Termos de Serviço/i));

      const submitBtn = screen.getByRole("button", { name: /Criar Conta/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/Verifique seu e-mail/i)).toBeDefined();
      });
    });
  });

  describe("VerifyEmailPage", () => {
    it("renders token input and resend form", () => {
      render(<VerifyEmailPage />);

      expect(screen.getByLabelText(/Código de Confirmação/i)).toBeDefined();
      expect(
        screen.getByPlaceholderText(/seu.email@exemplo.com/i),
      ).toBeDefined();
    });

    it("handles manual verification click", async () => {
      vi.mocked(apiClient.post).mockResolvedValueOnce({});

      render(<VerifyEmailPage />);

      const tokenInput = screen.getByLabelText(/Código de Confirmação/i);
      fireEvent.change(tokenInput, { target: { value: "valid-token-12345" } });

      const verifyBtn = screen.getByRole("button", {
        name: /Verificar Código/i,
      });
      fireEvent.click(verifyBtn);

      await waitFor(() => {
        expect(screen.getByText(/Conta Ativada com Sucesso!/i)).toBeDefined();
      });
    });
  });

  describe("LoginPage", () => {
    it("renders email and password inputs and submit button", async () => {
      const { LoginPage } = await import("./LoginPage");
      const { AuthProvider } = await import("./AuthProvider");

      render(
        <AuthProvider>
          <LoginPage />
        </AuthProvider>,
      );

      expect(screen.getByLabelText(/E-mail/i)).toBeDefined();
      expect(screen.getByLabelText(/^Senha$/i)).toBeDefined();
      expect(screen.getByRole("button", { name: /^Entrar$/i })).toBeDefined();
    });
  });

  describe("ForgotPasswordPage", () => {
    it("renders email input and submit button", async () => {
      const { ForgotPasswordPage } = await import("./ForgotPasswordPage");

      render(<ForgotPasswordPage />);

      expect(screen.getByLabelText(/E-mail/i)).toBeDefined();
      expect(
        screen.getByRole("button", { name: /Enviar Instruções/i }),
      ).toBeDefined();
    });
  });

  describe("ResetPasswordPage", () => {
    it("renders password inputs and criteria", async () => {
      const { ResetPasswordPage } = await import("./ResetPasswordPage");

      render(<ResetPasswordPage />);

      expect(screen.getByLabelText(/^Nova Senha$/i)).toBeDefined();
      expect(screen.getByLabelText(/Confirmar Nova Senha/i)).toBeDefined();
      expect(
        screen.getByRole("button", { name: /Redefinir Senha/i }),
      ).toBeDefined();
    });
  });
});

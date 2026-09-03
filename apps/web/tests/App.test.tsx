import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "../src/app/App";

describe("App", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders Datria header, codename disclaimer, and baseline loaded state", async () => {
    // Mock successful fetch for health check
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "ok",
        service: "datria-api",
        timestamp: "2026-09-02T00:00:00.000Z",
        checks: { database: "up" },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    render(<App />);

    // FR-009: Product identified as Datria
    expect(screen.getByRole("heading", { name: /Datria/i })).toBeDefined();

    // FR-009: Explicitly marked as a codename
    expect(screen.getByText(/codename/i)).toBeDefined();

    // FR-009: Visible indication that development baseline loaded successfully
    expect(screen.getByText(/baseline loaded successfully/i)).toBeDefined();

    // Health state verification
    const onlineIndicator = await screen.findByText(/Online/i);
    expect(onlineIndicator).toBeDefined();
  });

  it("displays service offline notice when API is unreachable without crashing", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network Error"));
    vi.stubGlobal("fetch", mockFetch);

    render(<App />);

    const offlineIndicators = await screen.findAllByText(/Service offline/i);
    expect(offlineIndicators.length).toBeGreaterThan(0);
  });
});

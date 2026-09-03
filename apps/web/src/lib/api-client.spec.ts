import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiClient, ApiError } from "./api-client";

describe("ApiClient", () => {
  let client: ApiClient;

  beforeEach(() => {
    vi.resetAllMocks();
    client = new ApiClient("http://localhost:3000/api/v1");
  });

  it("adds credentials: 'include' and Accept header to requests", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: "success" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await client.get("/me");

    expect(result).toEqual({ data: "success" });
    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/v1/me",
      expect.objectContaining({
        credentials: "include",
        method: "GET",
      }),
    );
  });

  it("attaches X-Organization-Id header when organization context is set", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve([]),
    });
    vi.stubGlobal("fetch", mockFetch);

    client.setOrganizationContext("org-uuid-123");
    await client.get("/organizations/org-uuid-123/members");

    const callArgs = mockFetch.mock.calls[0];
    const calledHeaders = callArgs?.[1]?.headers as Headers;
    expect(calledHeaders.get("X-Organization-Id")).toBe("org-uuid-123");
  });

  it("fetches CSRF token if cookie is missing on POST requests", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ csrfToken: "csrf-token-123" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: "user-1" }),
      });
    vi.stubGlobal("fetch", mockFetch);

    await client.post("/auth/register", { email: "test@example.com" });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    // First call to /auth/csrf
    expect(mockFetch.mock.calls[0]?.[0]).toBe(
      "http://localhost:3000/api/v1/auth/csrf",
    );
    // Second call with X-CSRF-Token header
    const secondCall = mockFetch.mock.calls[1];
    const postHeaders = secondCall?.[1]?.headers as Headers;
    expect(postHeaders.get("X-CSRF-Token")).toBe("csrf-token-123");
  });

  it("throws ApiError with formatted error envelope on failure", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () =>
        Promise.resolve({
          status: 404,
          code: "NOT_FOUND",
          message: "Resource not found or inaccessible",
          correlationId: "corr-123",
        }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await expect(client.get("/organizations/invalid-id")).rejects.toThrow(
      ApiError,
    );
  });
});

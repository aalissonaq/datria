export interface ApiErrorResponse {
  status: number;
  code: string;
  message: string;
  correlationId?: string;
  timestamp?: string;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly correlationId?: string;

  constructor(data: ApiErrorResponse) {
    super(data.message || "An unexpected error occurred");
    this.name = "ApiError";
    this.status = data.status || 500;
    this.code = data.code || "UNKNOWN_ERROR";
    this.correlationId = data.correlationId;
  }
}

export interface RequestOptions extends RequestInit {
  organizationId?: string | null;
  skipCsrf?: boolean;
  skipAutoRefresh?: boolean;
}

export class ApiClient {
  private baseUrl: string;
  private currentOrgId: string | null = null;
  private isRefreshing = false;
  private refreshSubscribers: Array<() => void> = [];

  constructor(
    baseUrl = (typeof import.meta !== "undefined" &&
      (import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } }).env
        ?.VITE_API_BASE_URL) ||
      "http://localhost:3000/api/v1",
  ) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  setOrganizationContext(orgId: string | null): void {
    this.currentOrgId = orgId;
  }

  getOrganizationContext(): string | null {
    return this.currentOrgId;
  }

  getCookie(name: string): string | null {
    if (typeof document === "undefined") {
      return null;
    }
    const match = document.cookie.match(
      new RegExp(`(^|;\\s*)(${name})=([^;]*)`),
    );
    return match && match[3] ? decodeURIComponent(match[3]) : null;
  }

  async ensureCsrfToken(): Promise<string> {
    const existingToken = this.getCookie("datria_csrf");
    if (existingToken) {
      return existingToken;
    }

    // Request new CSRF token from server
    const res = await fetch(`${this.baseUrl}/auth/csrf`, {
      method: "GET",
      credentials: "include",
    });

    if (!res.ok) {
      throw new Error("Failed to initialize CSRF token");
    }

    const data = (await res.json()) as { csrfToken: string };
    return data.csrfToken;
  }

  async request<T = unknown>(
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const url = endpoint.startsWith("http")
      ? endpoint
      : `${this.baseUrl}/${endpoint.replace(/^\/+/, "")}`;

    const method = (options.method || "GET").toUpperCase();
    const headers = new Headers(options.headers || {});

    headers.set("Accept", "application/json");

    // Organization context header
    const activeOrgId =
      options.organizationId !== undefined
        ? options.organizationId
        : this.currentOrgId;
    if (activeOrgId) {
      headers.set("X-Organization-Id", activeOrgId);
    }

    // CSRF header for state-mutating requests
    if (
      !options.skipCsrf &&
      ["POST", "PUT", "PATCH", "DELETE"].includes(method)
    ) {
      if (!endpoint.includes("/auth/csrf")) {
        const csrfToken = await this.ensureCsrfToken();
        if (csrfToken) {
          headers.set("X-CSRF-Token", csrfToken);
        }
      }
    }

    if (
      options.body &&
      typeof options.body === "object" &&
      !(options.body instanceof FormData)
    ) {
      headers.set("Content-Type", "application/json");
      options.body = JSON.stringify(options.body);
    }

    const fetchOptions: RequestInit = {
      ...options,
      method,
      headers,
      credentials: "include",
    };

    let response = await fetch(url, fetchOptions);

    // Automatic session refresh on 401
    if (
      response.status === 401 &&
      !options.skipAutoRefresh &&
      !endpoint.includes("/auth/login") &&
      !endpoint.includes("/auth/refresh") &&
      !endpoint.includes("/auth/csrf")
    ) {
      const refreshed = await this.handleTokenRefresh();
      if (refreshed) {
        // Retry original request once
        response = await fetch(url, {
          ...fetchOptions,
          headers: new Headers(fetchOptions.headers),
        });
      }
    }

    if (!response.ok) {
      let errorData: ApiErrorResponse;
      try {
        errorData = await response.json();
      } catch {
        errorData = {
          status: response.status,
          code: "HTTP_ERROR",
          message: response.statusText || "Request failed",
        };
      }
      throw new ApiError(errorData);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private async handleTokenRefresh(): Promise<boolean> {
    if (this.isRefreshing) {
      return new Promise<boolean>((resolve) => {
        this.refreshSubscribers.push(() => resolve(true));
      });
    }

    this.isRefreshing = true;

    try {
      const csrfToken = await this.ensureCsrfToken();
      const res = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        headers: {
          "X-CSRF-Token": csrfToken,
        },
      });

      if (res.ok) {
        this.refreshSubscribers.forEach((callback) => callback());
        this.refreshSubscribers = [];
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "GET" });
  }

  async post<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: body as BodyInit,
    });
  }

  async patch<T>(
    endpoint: string,
    body?: unknown,
    options?: RequestOptions,
  ): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body as BodyInit,
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: "DELETE" });
  }
}

export const apiClient = new ApiClient();

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { apiClient } from "../../lib/api-client";

export interface User {
  id: string;
  email: string;
  displayName: string;
}

export interface AvailableOrganization {
  id: string;
  name: string;
  slug: string;
  status: string;
  membershipId: string;
  roles: string[];
}

export type TenantContext =
  | { type: "PERSONAL"; userId: string }
  | {
      type: "ORGANIZATION";
      userId: string;
      organizationId: string;
      organizationName: string;
      organizationSlug: string;
      membershipId: string;
      roles: string[];
    };

export interface AuthContextType {
  user: User | null;
  activeContext: TenantContext | null;
  availableOrganizations: AvailableOrganization[];
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  switchContext: (organizationId: string | null) => Promise<void>;
  refreshContext: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [activeContext, setActiveContext] = useState<TenantContext | null>(
    null,
  );
  const [availableOrganizations, setAvailableOrganizations] = useState<
    AvailableOrganization[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshContext = useCallback(async () => {
    try {
      const data = await apiClient.get<{
        activeContext: TenantContext;
        availableOrganizations: AvailableOrganization[];
      }>("/auth/context");

      setActiveContext(data.activeContext);
      setAvailableOrganizations(data.availableOrganizations || []);
    } catch {
      // Ignored if unauthenticated
    }
  }, []);

  const checkAuth = useCallback(async () => {
    try {
      const me = await apiClient.get<User>("/auth/me");
      setUser(me);
      await refreshContext();
    } catch {
      setUser(null);
      setActiveContext(null);
      setAvailableOrganizations([]);
    } finally {
      setIsLoading(false);
    }
  }, [refreshContext]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email: string, password: string) => {
    const res = await apiClient.post<{ user: User }>("/auth/login", {
      email,
      password,
    });

    setUser(res.user);
    await refreshContext();
  };

  const logout = async () => {
    try {
      await apiClient.post("/auth/logout");
    } finally {
      setUser(null);
      setActiveContext(null);
      setAvailableOrganizations([]);
      apiClient.setOrganizationContext(null);
    }
  };

  const switchContext = async (organizationId: string | null) => {
    apiClient.setOrganizationContext(organizationId);
    await refreshContext();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        activeContext,
        availableOrganizations,
        isLoading,
        login,
        logout,
        switchContext,
        refreshContext,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

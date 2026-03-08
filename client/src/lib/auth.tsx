import { createContext, useContext } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface AuthUser {
  id: string;
  username: string;
  pseudo: string;
  phone: string;
  country: string;
  region: string;
  isAdmin: boolean;
  avatarUrl: string | null;
  bio: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, isLoading: true, logout: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<{ user: AuthUser } | null>({
    queryKey: ["/api/auth/me"],
    retry: false,
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (res.status === 401) return null;
      return res.json();
    },
  });

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    queryClient.clear();
    window.location.href = "/";
  };

  return (
    <AuthContext.Provider value={{ user: data?.user ?? null, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

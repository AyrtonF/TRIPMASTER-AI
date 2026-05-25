// Dummy auth hook - OAuth removed for MVP
export function useAuth() {
  return {
    user: { id: 1, name: "User" },
    loading: false,
    error: null,
    isAuthenticated: true,
    refresh: () => {},
    logout: () => {},
  };
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useLineAuth, LineAuthProvider } from "@/contexts/LineAuthContext";
import LiffCallbackHandler from "@/components/LiffCallbackHandler";
import Index from "./pages/Index";
import TransactionDetail from "./pages/TransactionDetail";
import TransactionEdit from "./pages/TransactionEdit";
import Upload from "./pages/Upload";
import Export from "./pages/Export";
import SettingsPage from "./pages/SettingsPage";
import Auth from "./pages/Auth";
import AdminLogin from "./pages/AdminLogin";
import LiffTransaction from "./pages/LiffTransaction";
import LiffDashboard from "./pages/LiffDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { isAuthenticated, loading } = useAuth();
  const { isLineUser } = useLineAuth();

  // LIFF OAuth callback: let LIFF SDK process liff.state before auth check
  const hasLiffState = new URLSearchParams(window.location.search).has('liff.state');
  if (hasLiffState) {
    return <LiffCallbackHandler />;
  }

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">กำลังโหลด...</div>;

  // LINE users can access dashboard but not admin-only routes
  if (isLineUser && !adminOnly) return <>{children}</>;

  // Admin access via Supabase auth
  if (isAuthenticated) return <>{children}</>;

  return <Navigate to={adminOnly ? "/admin/login" : "/auth"} replace />;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">กำลังโหลด...</div>;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<AuthRoute><Auth /></AuthRoute>} />
    <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
    <Route path="/transactions/:id" element={<ProtectedRoute><TransactionDetail /></ProtectedRoute>} />
    <Route path="/transactions/:id/edit" element={<ProtectedRoute adminOnly><TransactionEdit /></ProtectedRoute>} />
    <Route path="/upload" element={<ProtectedRoute adminOnly><Upload /></ProtectedRoute>} />
    <Route path="/export" element={<ProtectedRoute adminOnly><Export /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute adminOnly><SettingsPage /></ProtectedRoute>} />
    <Route path="/liff/transaction/:id" element={<LiffTransaction />} />
    <Route path="/liff/dashboard" element={<LiffDashboard />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LineAuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </LineAuthProvider>
  </QueryClientProvider>
);

export default App;

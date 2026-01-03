import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Floor from "./pages/Floor";
import Reservations from "./pages/Reservations";
import Orders from "./pages/Orders";
import Payments from "./pages/Payments";
import TableSessionView from "./pages/TableSessionView";
import Menu from "./pages/Menu";
import Kitchen from "./pages/Kitchen";
import Bar from "./pages/Bar";
import MenuSettings from "./pages/settings/MenuSettings";
import TableSettings from "./pages/settings/TableSettings";
import UserSettings from "./pages/settings/UserSettings";
import ComingSoon from "./pages/ComingSoon";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            
            {/* All authenticated users can access these */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/floor" element={
              <ProtectedRoute>
                <Floor />
              </ProtectedRoute>
            } />
            <Route path="/reservations" element={
              <ProtectedRoute>
                <Reservations />
              </ProtectedRoute>
            } />
            <Route path="/orders" element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            } />
            <Route path="/payments" element={
              <ProtectedRoute>
                <Payments />
              </ProtectedRoute>
            } />
            <Route path="/session/:sessionId" element={
              <ProtectedRoute>
                <TableSessionView />
              </ProtectedRoute>
            } />
            
            {/* Manager and Admin only */}
            <Route path="/menu" element={
              <ProtectedRoute allowedRoles={['admin', 'manager']}>
                <Menu />
              </ProtectedRoute>
            } />
            <Route path="/kitchen" element={
              <ProtectedRoute>
                <Kitchen />
              </ProtectedRoute>
            } />
            <Route path="/bar" element={
              <ProtectedRoute>
                <Bar />
              </ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute allowedRoles={['admin', 'manager']}>
                <ComingSoon />
              </ProtectedRoute>
            } />
            
            {/* Settings Routes */}
            <Route path="/settings" element={
              <Navigate to="/settings/menu" replace />
            } />
            <Route path="/settings/menu" element={
              <ProtectedRoute allowedRoles={['admin', 'manager']}>
                <MenuSettings />
              </ProtectedRoute>
            } />
            <Route path="/settings/tables" element={
              <ProtectedRoute allowedRoles={['admin', 'manager']}>
                <TableSettings />
              </ProtectedRoute>
            } />
            <Route path="/settings/users" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <UserSettings />
              </ProtectedRoute>
            } />
            
            {/* Admin only */}
            <Route path="/staff" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <ComingSoon />
              </ProtectedRoute>
            } />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

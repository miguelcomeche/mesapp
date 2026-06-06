import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { TenantProvider } from "@/contexts/TenantContext";
import { SupportModeProvider } from "@/contexts/SupportModeContext";
import { ActiveWaiterProvider } from "@/contexts/ActiveWaiterContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ModuleGuard } from "@/components/auth/ModuleGuard";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Floor from "./pages/Floor";
import Reservations from "./pages/Reservations";
import ReservationDetail from "./pages/ReservationDetail";
import Payments from "./pages/Payments";
import TableSessionView from "./pages/TableSessionView";
import AddProductsPage from "./pages/AddProductsPage";
import Menu from "./pages/Menu";
import Kitchen from "./pages/Kitchen";
import Bar from "./pages/Bar";
import TableSettings from "./pages/settings/TableSettings";
import UserSettings from "./pages/settings/UserSettings";
import RestaurantSettings from "./pages/settings/RestaurantSettings";
import HoursSettings from "./pages/settings/HoursSettings";
import PrintersSettings from "./pages/settings/PrintersSettings";
import ProductionStationsSettings from "./pages/settings/ProductionStationsSettings";
import ComingSoon from "./pages/ComingSoon";
import Analytics from "./pages/Analytics";
import NotFound from "./pages/NotFound";
import AdminRestaurantsPage from "./pages/admin/Restaurants";
import RestaurantUsersPage from "./pages/admin/RestaurantUsers";
import GlobalUsersPage from "./pages/admin/GlobalUsers";
import PlatformSettingsPage from "./pages/admin/PlatformSettings";
import SelectRestaurant from "./pages/SelectRestaurant";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <TenantProvider>
      <AuthProvider>
      <SupportModeProvider>
      <ActiveWaiterProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/select-restaurant" element={
              <ProtectedRoute><SelectRestaurant /></ProtectedRoute>
            } />
            
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
                <ModuleGuard module="reservations_enabled"><Reservations /></ModuleGuard>
              </ProtectedRoute>
            } />
            <Route path="/reservations/:reservationId" element={
              <ProtectedRoute>
                <ModuleGuard module="reservations_enabled"><ReservationDetail /></ModuleGuard>
              </ProtectedRoute>
            } />
            <Route path="/payments" element={
              <ProtectedRoute>
                <ModuleGuard module="payments_enabled"><Payments /></ModuleGuard>
              </ProtectedRoute>
            } />
            <Route path="/session/:sessionId" element={
              <ProtectedRoute>
                <TableSessionView />
              </ProtectedRoute>
            } />
            <Route path="/session/:sessionId/add-products" element={
              <ProtectedRoute>
                <AddProductsPage />
              </ProtectedRoute>
            } />
            
            {/* Manager and Admin only */}
            <Route path="/menu" element={
              <ProtectedRoute allowedRoles={['admin', 'manager']}>
                <ModuleGuard module="menu_enabled"><Menu /></ModuleGuard>
              </ProtectedRoute>
            } />
            <Route path="/kitchen" element={
              <ProtectedRoute>
                <ModuleGuard module="kitchen_bar_enabled"><Kitchen /></ModuleGuard>
              </ProtectedRoute>
            } />
            <Route path="/bar" element={
              <ProtectedRoute>
                <ModuleGuard module="kitchen_bar_enabled"><Bar /></ModuleGuard>
              </ProtectedRoute>
            } />
            <Route path="/analytics" element={
              <ProtectedRoute allowedRoles={['admin', 'manager']}>
                <ModuleGuard module="analytics_enabled"><Analytics /></ModuleGuard>
              </ProtectedRoute>
            } />

            {/* Platform admin */}
            <Route path="/admin/restaurants" element={
              <ProtectedRoute allowedRoles={['platform_admin']}>
                <AdminRestaurantsPage />
              </ProtectedRoute>
            } />
            <Route path="/admin/restaurants/:restaurantId/users" element={
              <ProtectedRoute>
                <RestaurantUsersPage />
              </ProtectedRoute>
            } />
            
            {/* Settings Routes */}
            <Route path="/settings" element={
              <Navigate to="/settings/tables" replace />
            } />
            <Route path="/settings/menu" element={<Navigate to="/menu" replace />} />
            <Route path="/carta" element={<Navigate to="/menu" replace />} />
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
            <Route path="/settings/printers" element={
              <ProtectedRoute allowedRoles={['admin']}><PrintersSettings /></ProtectedRoute>
            } />
            <Route path="/settings/stations" element={
              <ProtectedRoute allowedRoles={['admin']}><ProductionStationsSettings /></ProtectedRoute>
            } />
            <Route path="/settings/hours" element={
              <ProtectedRoute allowedRoles={['admin', 'manager']}><HoursSettings /></ProtectedRoute>
            } />
            <Route path="/settings/restaurant" element={
              <ProtectedRoute allowedRoles={['admin', 'manager']}><RestaurantSettings /></ProtectedRoute>
            } />
            <Route path="/admin/users" element={
              <ProtectedRoute allowedRoles={['platform_admin']}><GlobalUsersPage /></ProtectedRoute>
            } />
            <Route path="/admin/settings" element={<Navigate to="/admin/platform-settings" replace />} />
            <Route path="/admin/platform-settings" element={
              <ProtectedRoute allowedRoles={['platform_admin']}><PlatformSettingsPage /></ProtectedRoute>
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
      </ActiveWaiterProvider>
      </SupportModeProvider>
      </AuthProvider>
      </TenantProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;

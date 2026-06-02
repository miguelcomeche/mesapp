import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/database';

export interface Permissions {
  // Menu management
  canViewMenu: boolean;
  canEditMenu: boolean;
  canCreateProducts: boolean;
  canDeleteProducts: boolean;
  canManageCategories: boolean;
  
  // Modifier management
  canViewModifiers: boolean;
  canEditModifiers: boolean;
  canCreateModifiers: boolean;
  canDeleteModifiers: boolean;
  
  // Table management
  canViewTables: boolean;
  canEditTables: boolean;
  canCreateTables: boolean;
  canDeleteTables: boolean;
  canMoveTables: boolean;
  
  // Zone management
  canManageZones: boolean;
  
  // Payment & discounts
  canApplyDiscounts: boolean;
  canManagePaymentMethods: boolean;
  canManageDiscountRules: boolean;
  
  // User management
  canViewUsers: boolean;
  canManageUsers: boolean;
  canAssignRoles: boolean;
  
  // Settings access
  canAccessSettings: boolean;
  canAccessFullSettings: boolean;
  
  // Role checks
  isOwner: boolean;
  isManager: boolean;
  isWaiter: boolean;
}

export function usePermissions(): Permissions {
  const { hasRole, roles } = useAuth();

  const isPlatformAdmin = hasRole('platform_admin');
  // platform_admin is a superuser: inherits admin (owner) privileges everywhere.
  const isOwner = isPlatformAdmin || hasRole('admin');
  const isManager = isPlatformAdmin || hasRole('manager');
  const isWaiter = hasRole('waiter') && !isOwner && !isManager;
  
  return {
    // Menu management - only owner/admin
    canViewMenu: isOwner || isManager,
    canEditMenu: isOwner,
    canCreateProducts: isOwner,
    canDeleteProducts: isOwner,
    canManageCategories: isOwner,
    
    // Modifier management - only owner/admin
    canViewModifiers: isOwner || isManager,
    canEditModifiers: isOwner,
    canCreateModifiers: isOwner,
    canDeleteModifiers: isOwner,
    
    // Table management
    canViewTables: true, // All roles can view tables in floor
    canEditTables: isOwner || isManager, // Manager can edit status, capacity, zone
    canCreateTables: isOwner,
    canDeleteTables: isOwner,
    canMoveTables: isOwner,
    
    // Zone management - only owner/admin
    canManageZones: isOwner,
    
    // Payment & discounts
    canApplyDiscounts: isOwner || isManager, // Manager can apply discounts
    canManagePaymentMethods: isOwner,
    canManageDiscountRules: isOwner,
    
    // User management - only owner/admin
    canViewUsers: isOwner,
    canManageUsers: isOwner,
    canAssignRoles: isOwner,
    
    // Settings access
    canAccessSettings: isOwner || isManager,
    canAccessFullSettings: isOwner,
    
    // Role checks
    isOwner,
    isManager,
    isWaiter,
  };
}


// Helper component for permission-based rendering
export function RequirePermission({ 
  permission, 
  children, 
  fallback = null 
}: { 
  permission: boolean; 
  children: React.ReactNode; 
  fallback?: React.ReactNode;
}): React.ReactElement | null {
  if (permission) {
    return React.createElement(React.Fragment, null, children);
  }
  if (fallback) {
    return React.createElement(React.Fragment, null, fallback);
  }
  return null;
}

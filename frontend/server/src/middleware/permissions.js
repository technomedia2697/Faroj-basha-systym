// Middleware to check if user has required role
export const requireRole = (requiredRoles) => {
  return (req, res, next) => {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // This will be populated by verifyToken middleware
    const userRole = req.userRole;

    if (!userRole) {
      return res.status(401).json({ error: 'User role not found' });
    }

    // Check if user has required role
    const rolesArray = Array.isArray(requiredRoles) ? requiredRoles : [requiredRoles];
    
    if (!rolesArray.includes(userRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

// Middleware to check specific permissions
export const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRole = req.userRole;
    const permissions = getPermissionsForRole(userRole);

    if (!permissions.includes(permission)) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    next();
  };
};

// Role-based permissions mapping
const permissionsMap = {
  admin: [
    'view_inventory',
    'edit_inventory',
    'create_inventory',
    'delete_inventory',
    'view_stock_movements',
    'edit_stock_movements',
    'create_stock_movements',
    'delete_stock_movements',
    'view_reports',
    'create_reports',
    'daily_inventory',
    'weekly_inventory',
    'monthly_inventory',
    'view_ingredients',
    'edit_ingredients',
    'view_products',
    'edit_products',
    'view_orders',
    'create_orders',
    'edit_orders',
    'delete_orders',
    'view_customers',
    'create_customers',
    'edit_customers',
    'delete_customers',
    'view_categories',
    'edit_categories',
    'view_recipes',
    'edit_recipes',
    'view_production',
    'edit_production'
  ],
  manager: [
    'view_inventory',
    'view_stock_movements',
    'view_reports',
    'daily_inventory',
    'weekly_inventory',
    'view_ingredients',
    'view_products',
    'view_orders',
    'view_customers',
    'view_categories',
    'view_recipes',
    'view_production'
  ],
  staff: [
    'view_orders',
    'create_orders',
    'view_products',
    'view_customers',
    'create_customers'
  ]
};

function getPermissionsForRole(role) {
  return permissionsMap[role] || [];
}

export { getPermissionsForRole };

// middlewares/permit.js
export const permitMiddleware = (...allowedRoles) => {
    return (req, res, next) => {
      // Verifica que req.user esté definido (por ejemplo, establecido por authMiddleware)
      if (req.user) {
        // Convertir el rol a minúsculas (o según convenga) y compararlo con la lista permitida
        const userRole = req.user.role.toLowerCase();
        const allowed = allowedRoles.map(role => role.toLowerCase());
        if (allowed.includes(userRole)) {
          return next();
        }
      }
      return res.status(403).json({ message: 'Forbidden: Permisos insuficientes' });
    };
  };
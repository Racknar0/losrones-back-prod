// middlewares/authMiddleware.js
import jwt from 'jsonwebtoken';

export const authMiddleware = (req, res, next) => {
  // Obtener el token del header Authorization (se espera el formato "Bearer <token>")
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Unauthorized: No se proporcionó token' });
  }

  const token = authHeader.split(' ')[1]; // Extrae el token

  try {
    // Verificar el token utilizando el secreto
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Asignar los datos decodificados al objeto req para usarlos posteriormente
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Unauthorized: Invalid token' });
  }
};
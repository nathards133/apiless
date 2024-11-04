import jwt from 'jsonwebtoken';

export default function auth(req, res) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error('Nenhum token fornecido');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    req.userRole = decoded.role;
    return true;
  } catch (error) {
    throw new Error('Token inválido');
  }
};

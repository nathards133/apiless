import dbConnect from '../lib/dbConnect.js';
import User from '../models/User.js';
import auth from '../lib/auth.js';

export default async function handler(req, res) {
  await dbConnect();
  const isAuthenticated = auth(req, res);
  if (!isAuthenticated) return;

  try {
    if (req.method === 'GET') {
      if (req.userRole !== 'admin') {
        return res.status(403).json({ message: 'Acesso negado. Apenas usuários podem listar usuários.' });
      }

      const users = await User.find({}, 'email company city role');
      return res.json(users);
    } else {
      return res.status(405).json({ message: 'Método não permitido' });
    }
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
} 
import dbConnect from '../lib/dbConnect.js';
import User from '../models/User.js';
import auth from '../lib/auth.js';

export default async function handler(req, res) {
  await dbConnect();
  const isAuthenticated = auth(req, res);
  if (!isAuthenticated) return;

  if (req.method === 'POST') {
    try {
      const { integration, clientId, clientSecret } = req.body;
      const user = await User.findById(req.userId);

      if (!user) {
        return res.status(404).json({ message: 'Usuário não encontrado' });
      }

      if (user.role !== 'admin') {
        return res.status(403).json({ message: 'Acesso não autorizado' });
      }

      user.integrations = user.integrations || {};
      user.integrations[integration] = { clientId, clientSecret };
      await user.save();

      res.status(200).json({ message: 'Integração salva com sucesso' });
    } catch (error) {
      console.error('Erro ao salvar integração:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
    }
  } else {
    res.status(405).json({ message: 'Método não permitido' });
  }
}

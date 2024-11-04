import { certificateManager } from '../config/certificates.js';
import auth from '../lib/auth.js';
import dbConnect from '../lib/dbConnect.js';
import User from '../models/User.js';

export default async function handler(req, res) {
  await dbConnect();
  const isAuthenticated = auth(req, res);
  if (!isAuthenticated) return;

  if (req.method === 'POST') {
    try {
      const { certFile, password } = req.body;
      
      if (!certFile || !password) {
        return res.status(400).json({ 
          message: 'Certificado e senha são obrigatórios' 
        });
      }

      // Atualiza o usuário com informações do certificado
      await User.findByIdAndUpdate(req.userId, {
        hasCertificate: true,
        certificateExpiration: new Date() // Você deve extrair a data real do certificado
      });

      await certificateManager.storeCertificate(
        req.userId,
        Buffer.from(certFile, 'base64'),
        password
      );

      res.json({ message: 'Certificado armazenado com sucesso' });
    } catch (error) {
      console.error('Erro ao processar certificado:', error);
      res.status(500).json({ message: 'Erro ao processar certificado' });
    }
  }
} 
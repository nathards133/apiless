import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const CERTS_DIR = path.join(process.cwd(), 'certificates');

// Garante que o diretório existe
if (!fs.existsSync(CERTS_DIR)) {
  fs.mkdirSync(CERTS_DIR, { recursive: true });
}

export const certificateManager = {
  async storeCertificate(userId, certFile, password) {
    try {
      // Cria diretório específico para o usuário
      const userDir = path.join(CERTS_DIR, userId);
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }

      // Encripta a senha do certificado
      const encryptedPassword = crypto
        .createHash('sha256')
        .update(password)
        .digest('hex');

      // Salva o certificado
      const certPath = path.join(userDir, 'cert.pfx');
      await fs.promises.writeFile(certPath, certFile);

      // Salva a senha encriptada
      await fs.promises.writeFile(
        path.join(userDir, 'cert.key'),
        encryptedPassword
      );

      return true;
    } catch (error) {
      console.error('Erro ao armazenar certificado:', error);
      throw error;
    }
  },

  async getCertificate(userId) {
    try {
      const certPath = path.join(CERTS_DIR, userId, 'cert.pfx');
      const keyPath = path.join(CERTS_DIR, userId, 'cert.key');

      if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
        throw new Error('Certificado não encontrado');
      }

      const cert = await fs.promises.readFile(certPath);
      const encryptedPassword = await fs.promises.readFile(keyPath, 'utf8');

      return {
        cert,
        password: encryptedPassword
      };
    } catch (error) {
      console.error('Erro ao recuperar certificado:', error);
      throw error;
    }
  }
}; 
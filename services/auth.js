import express from 'express';
import dbConnect from '../lib/dbConnect.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import auditLogger from './auditLogger.js';
import bcrypt from 'bcrypt';
import auth from '../lib/auth.js';

const router = express.Router();

router.post('/register', async (req, res) => {
	await dbConnect();
	try {
		// Verificar o token de registro
		const authHeader = req.headers.authorization;
		if (!authHeader) {
			return res.status(401).json({ message: 'Token não fornecido' });
		}

		const token = authHeader.split(' ')[1];
		try {
			// Verificar se é um token de registro válido
			const decoded = jwt.verify(token, process.env.REGISTER_TOKEN_SECRET);
			if (!decoded.isRegistrationToken) {
				return res.status(401).json({ message: 'Token inválido para registro' });
			}
		} catch (error) {
			return res.status(401).json({ message: 'Token inválido' });
		}

		const { email, password, company, city, salesPassword, businessType } = req.body;

		// Validações
		if (!email || !password || !company || !city || !salesPassword || !businessType) {
			return res.status(400).json({ message: 'Todos os campos são obrigatórios' });
		}

		if (salesPassword.length !== 4 || !/^\d+$/.test(salesPassword)) {
			return res.status(400).json({ message: 'A senha de vendas deve conter exatamente 4 dígitos' });
		}

		const existingUser = await User.findOne({ email });
		if (existingUser) {
			return res.status(400).json({ message: 'Email já está em uso' });
		}

		// Hash da senha de vendas
		const hashedSalesPassword = await bcrypt.hash(salesPassword, 10);

		const user = new User({
			email,
			password, // O modelo já faz o hash da senha
			company,
			city,
			salesPassword: hashedSalesPassword,
			role: 'user',
			businessType
		});

		await user.save();

		await auditLogger.log('Registro de Usuário', 
			{ email: user.email, company: user.company, city: user.city },
			user._id.toString()
		);

		res.status(201).json({ message: 'Usuário registrado com sucesso' });
	} catch (error) {
		console.error('Erro ao registrar usuário:', error);
		res.status(500).json({ message: error.message });
	}
});

router.post('/login', async (req, res) => {
	await dbConnect();
	try {
		const { email, password } = req.body;

		const user = await User.findOne({ email });
		if (!user) {
			return res.status(400).json({ message: 'Usuário não encontrado' });
		}

		const isMatch = await user.comparePassword(password);
		if (!isMatch) {
			return res.status(400).json({ message: 'Senha incorreta' });
		}

		const token = jwt.sign(
			{ userId: user._id, role: user.role, company: user.company, businessType: user.businessType },
			process.env.JWT_SECRET,
			{ expiresIn: '24h' }
		);

		await auditLogger.log('Login de Usuário', 
			{ userId: user._id, email: user.email, company: user.company },
			user._id.toString()
		);

		res.json({ token, userId: user._id, role: user.role, company: user.company, businessType: user.businessType });
	} catch (error) {
		res.status(500).json({ message: error.message });
	}
});

export const verifyPassword = async (req, res) => {
	try {
		const authResult = auth(req, res);
		if (!authResult) return;

		const { password } = req.body;
		
		// Alterado para buscar usuário com qualquer role
		const user = await User.findOneWithSalesPassword({ _id: req.userId });

		if (!user) {
			return res.status(400).json({ isValid: false, message: 'Usuário não encontrado' });
		}

		if (!user.salesPassword) {
			return res.status(400).json({ isValid: false, message: 'Senha de vendas não configurada' });
		}

		const isValid = await bcrypt.compare(password, user.salesPassword);
		
		if (isValid) {
			res.json({ isValid: true, message: 'Senha válida' });
		} else {
			res.json({ isValid: false, message: 'Senha inválida' });
		}
	} catch (error) {
		console.error('Erro ao verificar senha:', error);
		res.status(500).json({ isValid: false, message: 'Erro ao verificar senha' });
	}
};

export const setSalesPassword = async (req, res) => {
	try {
		const isAuthenticated = auth(req, res);
		if (!isAuthenticated) return;

		if (req.userRole !== 'admin') {
			return res.status(403).json({ message: 'Acesso negado. Apenas administradores podem definir a senha de vendas.' });
		}

		const { password } = req.body;
		const user = await User.findOne({ _id: req.userId, role: 'admin' });

		if (!user) {
			return res.status(400).json({ message: 'Usuário admin não encontrado' });
		}

		const hashedPassword = await bcrypt.hash(password, 10);
		user.salesPassword = hashedPassword;
		await user.save();

		res.json({ message: 'Senha de vendas configurada com sucesso' });
	} catch (error) {
		console.error('Erro ao configurar senha de vendas:', error);
		res.status(500).json({ message: 'Erro ao configurar senha de vendas' });
	}
};

// Modifique a rota de geração de token
router.post('/generate-register-token', async (req, res) => {
	try {
		// Verificar o token de autenticação
		const authHeader = req.headers.authorization;
		if (!authHeader) {
			return res.status(401).json({ message: 'Token não fornecido' });
		}

		const token = authHeader.split(' ')[1];
		
		try {
			// Verificar se o token é válido
			const decoded = jwt.verify(token, process.env.JWT_SECRET);
			
			// Verificar se o usuário é admin
			if (decoded.role !== 'admin') {
				return res.status(403).json({ message: 'Apenas administradores podem gerar tokens de registro' });
			}

			// Gerar token de registro
			const registerToken = jwt.sign(
				{ isRegistrationToken: true },
				process.env.REGISTER_TOKEN_SECRET,
				{ expiresIn: '24h' }
			);

			// Retornar o token
			return res.json({ token: registerToken });
		} catch (error) {
			console.error('Erro ao verificar token:', error);
			return res.status(401).json({ message: 'Token inválido' });
		}
	} catch (error) {
		console.error('Erro ao gerar token de registro:', error);
		return res.status(500).json({ message: 'Erro ao gerar token de registro' });
	}
});

export default router;

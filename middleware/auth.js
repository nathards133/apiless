import auth from '../lib/auth.js';

export const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) throw new Error('Token não fornecido');

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        return next();
    } catch (error) {
        res.status(401).json({ message: 'Não autorizado' });
    }
};

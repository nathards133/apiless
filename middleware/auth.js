import jwt from 'jsonwebtoken';

export const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            return res.status(401).json({ 
                message: 'Token não fornecido',
                tokenExpired: true 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        return next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ 
                message: 'Token expirado',
                tokenExpired: true 
            });
        }
        return res.status(401).json({ 
            message: 'Token inválido',
            tokenExpired: true 
        });
    }
};

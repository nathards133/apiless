import auth from '../lib/auth.js';

export const auth = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) throw new Error('Token não fornecido');

        // Verifica se é um token JWT do MongoDB
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
            return next();
        } catch (mongoError) {
            // Se não for token do MongoDB, tenta verificar no Supabase
            const supabase = createClient(
                process.env.SUPABASE_URL,
                process.env.SUPABASE_SERVICE_KEY
            );

            const { data: { user }, error } = await supabase.auth.getUser(token);
            
            if (error) throw error;
            
            req.user = user;
            return next();
        }
    } catch (error) {
        res.status(401).json({ message: 'Não autorizado' });
    }
};

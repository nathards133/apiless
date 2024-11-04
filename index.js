import express from 'express';
import cors from 'cors';
import compression from 'compression';
import authHandler, { verifyPassword, setSalesPassword } from './services/auth.js';
import salesHandler from './services/sales.js';
import productsHandler from './services/products.js';
import reportsHandler, { getAvailableDates } from './services/reports.js';
import suppliersHandler from './services/suppliers.js';
import integrationsHandler from './services/integrations.js';
import accountsPayableHandler from './services/accountsPayable.js';
import nfeHandler from './services/nfe.js';
import usersHandler from './services/users.js';
import paymentIntegrationsHandler from './services/payment-integrations.js';
import clientsHandler from './services/clients.js';
import tasksHandler from './services/tasks.js';
import serviceOrderReportsHandler from './services/serviceOrderReports.js';
import paymentsHandler from './services/payments.js';

const app = express();

app.use(cors({
  origin: ['https://gestor-comercial-panel.vercel.app', 'http://localhost:3000','http://localhost:3001', 'https://typebot.co/my-typebot-qx2vjg5'],
  credentials: true
}));
app.use(compression());
app.use(express.json());

app.use('/api/auth', authHandler);
app.use('/api/sales', salesHandler);
app.use('/api/products', productsHandler);
app.get('/api/reports/available-dates', getAvailableDates); 
app.use('/api/suppliers', suppliersHandler);
app.use('/api/integrations', integrationsHandler);
app.post('/api/verify-password', verifyPassword);
app.use('/api/accounts-payable', accountsPayableHandler);
app.post('/api/nfe', nfeHandler);
app.post('/api/set-sales-password', setSalesPassword);
app.get('/api/reports', reportsHandler);
app.use('/api/users', usersHandler);
app.use('/api/payment-integrations', paymentIntegrationsHandler);
app.use('/api/clients', clientsHandler);
app.use('/api/tasks', tasksHandler);
app.use('/api/reports/service-orders', serviceOrderReportsHandler);
app.use('/api/payments', paymentsHandler);

app.get('/', (req, res) => {
  res.json({ message: 'API está funcionando!' });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada' });
});

app.use((err, req, res, next) => {
  console.error('Erro no servidor:', err);
  res.status(500).json({ message: 'Erro interno do servidor' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

export default app;

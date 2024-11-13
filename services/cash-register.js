import dbConnect from '../lib/dbConnect.js';
import CashRegister from '../models/CashRegister.js';
import auth from '../lib/auth.js';

export default async function handler(req, res) {
  await dbConnect();
  
  try {
    const isAuthenticated = auth(req, res);
    if (!isAuthenticated) return;

    switch (req.method) {
      case 'POST':
        if (req.url.includes('/withdrawal')) {
          return await handleWithdrawal(req, res);
        }
        return await openCashRegister(req, res);
      case 'GET':
        return await getCashRegisterStatus(req, res);
      case 'PUT':
        return await closeCashRegister(req, res);
      default:
        res.status(405).json({ message: 'Método não permitido' });
    }
  } catch (error) {
    console.error('Erro no gerenciamento do caixa:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

async function openCashRegister(req, res) {
  const { initialAmount } = req.body;
  const userId = req.userId;

  try {
    // Verifica se já existe um caixa aberto
    const existingOpenRegister = await CashRegister.findOne({
      userId,
      status: 'open'
    });

    if (existingOpenRegister) {
      return res.status(400).json({ message: 'Já existe um caixa aberto para este usuário' });
    }

    // Cria novo registro de caixa
    const cashRegister = new CashRegister({
      userId,
      initialAmount,
      currentAmount: initialAmount,
      transactions: [{
        type: 'deposit',
        amount: initialAmount,
        description: 'Valor inicial do caixa'
      }]
    });

    await cashRegister.save();
    res.status(201).json(cashRegister);
  } catch (error) {
    console.error('Erro ao abrir caixa:', error);
    res.status(500).json({ message: 'Erro ao abrir caixa' });
  }
}

async function getCashRegisterStatus(req, res) {
  try {
    const cashRegister = await CashRegister.findOne({
      userId: req.userId,
      status: 'open'
    });

    res.json({ 
      isOpen: !!cashRegister,
      data: cashRegister 
    });
  } catch (error) {
    console.error('Erro ao verificar status do caixa:', error);
    res.status(500).json({ message: 'Erro ao verificar status do caixa' });
  }
}

async function closeCashRegister(req, res) {
  const { finalAmount, observations } = req.body;
  
  try {
    const cashRegister = await CashRegister.findOne({
      userId: req.userId,
      status: 'open'
    });

    if (!cashRegister) {
      return res.status(404).json({ message: 'Nenhum caixa aberto encontrado' });
    }

    cashRegister.status = 'closed';
    cashRegister.closedAt = new Date();
    cashRegister.currentAmount = finalAmount;
    if (observations) {
      cashRegister.transactions.push({
        type: 'withdrawal',
        amount: cashRegister.currentAmount - finalAmount,
        description: observations
      });
    }

    await cashRegister.save();
    res.json(cashRegister);
  } catch (error) {
    console.error('Erro ao fechar caixa:', error);
    res.status(500).json({ message: 'Erro ao fechar caixa' });
  }
}

async function handleWithdrawal(req, res) {
  const { amount, reason } = req.body;
  const userId = req.userId;

  try {
    const cashRegister = await CashRegister.findOne({
      userId,
      status: 'open'
    });

    if (!cashRegister) {
      return res.status(400).json({ message: 'Não há caixa aberto' });
    }

    // Converte o valor para número caso venha como string
    const withdrawalAmount = typeof amount === 'string' ? 
      parseFloat(amount.replace(',', '.')) : amount;

    if (cashRegister.currentAmount < withdrawalAmount) {
      return res.status(400).json({ 
        message: 'Saldo insuficiente para realizar a sangria' 
      });
    }

    // Atualiza o saldo e registra a transação
    cashRegister.currentAmount -= withdrawalAmount;
    cashRegister.transactions.push({
      type: 'withdrawal',
      amount: withdrawalAmount,
      description: `Sangria: ${reason}`,
      timestamp: new Date()
    });

    await cashRegister.save();

    res.json({
      message: 'Sangria realizada com sucesso',
      currentAmount: cashRegister.currentAmount
    });
  } catch (error) {
    console.error('Erro ao realizar sangria:', error);
    res.status(500).json({ message: 'Erro ao realizar sangria' });
  }
} 
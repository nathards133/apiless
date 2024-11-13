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
        if (req.url.includes('/close')) {
          return await closeCashRegister(req, res);
        }
        return await openCashRegister(req, res);
      case 'GET':
        if (req.url.includes('/daily')) {
          return await getDailyCashRegisters(req, res);
        }
        return await getCashRegisterStatus(req, res);
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
    const { values, observation } = req.body;
    const userId = req.userId;

    try {
        // Busca o caixa aberto atual
        const cashRegister = await CashRegister.findOne({
            userId,
            status: 'open'
        });

        if (!cashRegister) {
            return res.status(404).json({ message: 'Nenhum caixa aberto encontrado' });
        }

        // Calcula totais por tipo de transação
        const totalSales = cashRegister.transactions
            .filter(t => t.type === 'sale')
            .reduce((sum, t) => sum + t.amount, 0);

        const totalWithdrawals = cashRegister.transactions
            .filter(t => t.type === 'withdrawal')
            .reduce((sum, t) => sum + t.amount, 0);

        // Calcula diferenças
        const differences = {};
        Object.entries(values).forEach(([method, amount]) => {
            const expected = method === 'cash' ? 
                (cashRegister.initialAmount + totalSales - totalWithdrawals) : 
                0; // Para outros métodos, ajuste conforme necessário
            differences[method] = amount - expected;
        });

        // Atualiza o registro do caixa
        cashRegister.status = 'closed';
        cashRegister.closedAt = new Date();
        cashRegister.finalAmounts = values;
        cashRegister.closingSummary = {
            initialAmount: cashRegister.initialAmount,
            totalSales,
            totalWithdrawals,
            expectedBalance: {
                cash: cashRegister.initialAmount + totalSales - totalWithdrawals,
                credit: 0, // Ajuste conforme necessário
                debit: 0,
                pix: 0
            },
            finalAmounts: values,
            differences,
            observation
        };

        // Registra diferenças como transações
        Object.entries(differences).forEach(([method, difference]) => {
            if (difference !== 0) {
                cashRegister.transactions.push({
                    type: difference > 0 ? 'surplus' : 'shortage',
                    amount: Math.abs(difference),
                    description: `${difference > 0 ? 'Sobra' : 'Falta'} em ${method}`,
                    paymentMethod: method,
                    timestamp: new Date()
                });
            }
        });

        await cashRegister.save();

        res.json({
            message: 'Caixa fechado com sucesso',
            summary: cashRegister.closingSummary
        });
    } catch (error) {
        console.error('Erro ao fechar caixa:', error);
        res.status(500).json({ message: 'Erro ao fechar caixa' });
    }
}

async function calculateTransactionSummary(cashRegister) {
  const summary = {
    sales: {
      total: 0,
      byMethod: {}
    },
    withdrawals: {
      total: 0
    }
  };

  cashRegister.transactions.forEach(transaction => {
    if (transaction.type === 'sale') {
      summary.sales.total += transaction.amount;
      summary.sales.byMethod[transaction.paymentMethod] = 
        (summary.sales.byMethod[transaction.paymentMethod] || 0) + transaction.amount;
    } else if (transaction.type === 'withdrawal') {
      summary.withdrawals.total += transaction.amount;
    }
  });

  return summary;
}

function calculateExpectedBalance(cashRegister, summary) {
  const expectedBalance = {
    total: 0,
    byMethod: {}
  };

  // Adiciona valor inicial apenas para dinheiro
  expectedBalance.byMethod['dinheiro'] = cashRegister.initialAmount;

  // Adiciona vendas por método de pagamento
  Object.entries(summary.sales.byMethod).forEach(([method, amount]) => {
    expectedBalance.byMethod[method] = (expectedBalance.byMethod[method] || 0) + amount;
  });

  // Subtrai sangrias apenas do dinheiro
  if (expectedBalance.byMethod['dinheiro']) {
    expectedBalance.byMethod['dinheiro'] -= summary.withdrawals.total;
  }

  // Calcula total
  expectedBalance.total = Object.values(expectedBalance.byMethod).reduce((acc, curr) => acc + curr, 0);

  return expectedBalance;
}

function calculateDifferences(expectedBalance, finalAmounts) {
  const differences = {};

  Object.keys(expectedBalance.byMethod).forEach(method => {
    const expected = expectedBalance.byMethod[method] || 0;
    const final = finalAmounts[method] || 0;
    differences[method] = final - expected;
  });

  return differences;
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

async function getDailyCashRegisters(req, res) {
    try {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const registers = await CashRegister.find({
            userId: req.userId,
            openedAt: {
                $gte: startOfDay,
                $lte: endOfDay
            }
        }).sort({ openedAt: -1 });

        res.json(registers);
    } catch (error) {
        console.error('Erro ao buscar caixas do dia:', error);
        res.status(500).json({ message: 'Erro ao buscar caixas do dia' });
    }
} 
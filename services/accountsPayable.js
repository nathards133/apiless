import dbConnect from '../lib/dbConnect.js';
import AccountPayable from '../models/AccountPayable.js';
import RecurringAccount from '../models/RecurringAccount.js';
import auth from '../lib/auth.js';

export default async function handler(req, res) {
  await dbConnect();
  const isAuthenticated = auth(req, res);
  if (!isAuthenticated) return;

  const { method } = req;

  switch (method) {
    case 'GET':
      if (req.url.startsWith('/api/accounts-payable/installments/')) {
        await getInstallments(req, res);
      } else if (req.url.endsWith('/monthly-stats')) {
        await getMonthlyStats(req, res);
      } else {
        await getAccounts(req, res);
      }
      break;
    case 'POST':
      await createAccount(req, res);
      break;
    case 'PUT':
      if (req.url.endsWith('/mark-as-paid')) {
        await markAsPaid(req, res);
      } else {
        await updateAccount(req, res);
      }
      break;
    case 'DELETE':
      await deleteAccount(req, res);
      break;
    default:
      res.status(405).json({ message: 'Método não permitido' });
  }
}

async function getInstallments(req, res) {
  try {
    const accountId = req.url.split('/').pop();
    const installments = await AccountPayable.find({
      $or: [
        { _id: accountId },
        { parentInstallmentId: accountId }
      ],
      userId: req.userId
    }).sort({ installmentNumber: 1 });

    res.status(200).json({ installments });
  } catch (error) {
    console.error('Erro ao buscar parcelas:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

async function getAccounts(req, res) {
  try {
    const accountsPayable = await AccountPayable.find({ userId: req.userId, isInstallment: false })
      .populate('supplier', 'name')
      .populate('product', 'name');
    const recurringAccounts = await RecurringAccount.find({ userId: req.userId });
    const installmentAccounts = await AccountPayable.find({ userId: req.userId, isInstallment: true })
      .populate('supplier', 'name')
      .populate('product', 'name');
    res.status(200).json({ 
      accountsPayable: accountsPayable || [], 
      recurringAccounts: recurringAccounts || [], 
      installmentAccounts: installmentAccounts || [] 
    });
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar contas' });
  }
}

async function createAccount(req, res) {
  try {
    const { isRecurring, isInstallment, totalInstallments, ...accountData } = req.body;
    
    Object.keys(accountData).forEach(key => 
      (accountData[key] === '' || accountData[key] === undefined) && delete accountData[key]
    );

    if (isRecurring && isInstallment) {
      await createRecurringInstallmentAccount(req, res, accountData, totalInstallments);
    } else if (isRecurring) {
      await createRecurringAccount(req, res, accountData);
    } else if (isInstallment) {
      await createInstallmentAccount(req, res, accountData, totalInstallments);
    } else {
      await createSimpleAccount(req, res, accountData);
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function createRecurringInstallmentAccount(req, res, accountData, totalInstallments) {
  const installments = [];
  const installmentValue = accountData.totalValue / totalInstallments;
  const dueDay = parseInt(accountData.dueDay);

  for (let i = 0; i < totalInstallments; i++) {
    const dueDate = new Date();
    dueDate.setMonth(dueDate.getMonth() + i);
    dueDate.setDate(dueDay);

    const installment = new AccountPayable({
      ...accountData,
      isInstallment: true,
      isRecurring: true,
      installmentNumber: i + 1,
      totalInstallments,
      installmentValue,
      dueDate,
      totalValue: installmentValue,
      userId: req.userId
    });

    if (i === 0) {
      await installment.save();
      installments.push(installment);
    } else {
      installment.parentInstallmentId = installments[0]._id;
      await installment.save();
      installments.push(installment);
    }
  }

  res.status(201).json(installments);
}

async function createRecurringAccount(req, res, accountData) {
  const { dueDate, ...recurringData } = accountData;
  const newAccount = new RecurringAccount({ ...recurringData, userId: req.userId });
  await newAccount.save();
  res.status(201).json(newAccount);
}

async function createInstallmentAccount(req, res, accountData, totalInstallments) {
  const installments = [];
  const installmentValue = accountData.totalValue / totalInstallments;
  const baseDate = new Date(accountData.dueDate);

  for (let i = 0; i < totalInstallments; i++) {
    const dueDate = new Date(baseDate);
    dueDate.setMonth(dueDate.getMonth() + i);

    const installment = new AccountPayable({
      ...accountData,
      isInstallment: true,
      installmentNumber: i + 1,
      totalInstallments,
      installmentValue,
      dueDate,
      totalValue: installmentValue,
      userId: req.userId
    });

    if (i === 0) {
      await installment.save();
      installments.push(installment);
    } else {
      installment.parentInstallmentId = installments[0]._id;
      await installment.save();
      installments.push(installment);
    }
  }

  res.status(201).json(installments);
}

async function createSimpleAccount(req, res, accountData) {
  const newAccount = new AccountPayable({ ...accountData, userId: req.userId });
  await newAccount.save();
  res.status(201).json(newAccount);
}

async function markAsPaid(req, res) {
  try {
    const { ids } = req.body;
    console.log('UserID:', req.userId);
    console.log('IDs recebidos:', ids);

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'IDs inválidos fornecidos' });
    }

    const updatedAccounts = [];

    for (const id of ids) {
      const account = await AccountPayable.findOne({ _id: id, userId: req.userId });
      
      if (!account) continue;

      if (account.isInstallment) {
        account.isPaid = true;
        await account.save();

        const nextInstallment = await AccountPayable.findOne({
          parentInstallmentId: account.parentInstallmentId || account._id,
          installmentNumber: account.installmentNumber + 1,
          userId: req.userId
        });

        if (nextInstallment) {
          updatedAccounts.push(nextInstallment);
        }
      } else {
        account.isPaid = true;
        await account.save();
        updatedAccounts.push(account);
      }
    }

    res.status(200).json({ 
      message: `${updatedAccounts.length} contas atualizadas com sucesso`,
      updatedAccounts 
    });
  } catch (error) {
    console.error('Erro ao marcar contas como pagas:', error);
    res.status(500).json({ message: 'Erro interno do servidor', error: error.message });
  }
}

async function updateAccount(req, res) {
  try {
    const updateData = req.body;

    Object.keys(updateData).forEach(key => 
      (updateData[key] === '' || updateData[key] === undefined) && delete updateData[key]
    );
    const id = updateData._id;
    let updatedAccount;

    if (updateData.isRecurring) {
      updatedAccount = await RecurringAccount.findOneAndUpdate(
        { _id: id, userId: req.userId },
        updateData,
        { new: true, runValidators: true }
      );
    } else {
      updatedAccount = await AccountPayable.findOneAndUpdate(
        { _id: id, userId: req.userId },
        updateData,
        { new: true, runValidators: true }
      );
    }

    if (!updatedAccount) {
      return res.status(404).json({ message: 'Conta não encontrada' });
    }
    res.json(updatedAccount);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

async function deleteAccount(req, res) {
  try {
    const { id, isRecurring } = req.query;
    let deletedAccount;

    if (isRecurring === 'true') {
      deletedAccount = await RecurringAccount.findOneAndDelete({ _id: id, userId: req.userId });
    } else {
      deletedAccount = await AccountPayable.findOneAndDelete({ _id: id, userId: req.userId });
    }

    if (!deletedAccount) {
      return res.status(404).json({ message: 'Conta não encontrada' });
    }
    res.json({ message: 'Conta removida com sucesso' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

async function getMonthlyStats(req, res) {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Buscar contas do mês atual
    const monthlyAccounts = await AccountPayable.find({
      userId: req.userId,
      dueDate: {
        $gte: startOfMonth,
        $lte: endOfMonth
      }
    });

    // Calcular estatísticas
    const stats = {
      totalDue: 0,        // Total devido no mês
      totalPending: 0,    // Total pendente
      totalPaid: 0        // Total pago
    };

    monthlyAccounts.forEach(account => {
      stats.totalDue += account.totalValue;
      if (account.isPaid) {
        stats.totalPaid += account.totalValue;
      } else {
        stats.totalPending += account.totalValue;
      }
    });

    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Erro ao buscar estatísticas', error: error.message });
  }
}

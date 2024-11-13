import dbConnect from '../lib/dbConnect.js';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import auth from '../lib/auth.js';
import NodeCache from 'node-cache';
import AccountPayable from '../models/AccountPayable.js';
import Supplier from '../models/Supplier.js';
import axios from 'axios';
import CashRegister from '../models/CashRegister.js';

const salesCache = new NodeCache({ stdTTL: 300 });

export default async function handler(req, res) {
  await dbConnect();
  try {
    const isAuthenticated = auth(req, res);
    if (!isAuthenticated) return;

    if (req.method === 'POST') {
      try {
        // Verifica se existe um caixa aberto
        const openCashRegister = await CashRegister.findOne({
          userId: req.userId,
          status: 'open'
        });

        if (!openCashRegister) {
          return res.status(400).json({ 
            message: 'Não é possível realizar vendas sem um caixa aberto' 
          });
        }

        const { items, paymentMethod } = req.body;
        
        const productIds = items.map(item => item._id);
        const products = await Product.find({ _id: { $in: productIds } });
        
        const saleItems = items.map(item => {
          const product = products.find(p => p._id.toString() === item._id);
          return {
            product: item._id,
            name: product ? product.name : item.name,
            quantity: item.quantidade,
            price: item.price
          };
        });

        const totalValue = (items || []).reduce((acc, item) => 
          acc + item.price * item.quantidade, 0
        );

        const sale = new Sale({
          items: saleItems,
          totalValue,
          userId: req.userId,
          paymentMethod
        });
        await sale.save();

        // Registra a venda no caixa
        openCashRegister.currentAmount += totalValue;
        openCashRegister.transactions.push({
          type: 'sale',
          amount: totalValue,
          description: `Venda #${sale._id}`,
          paymentMethod
        });
        await openCashRegister.save();

        // Atualizar o estoque
        for (let item of items) {
          await Product.findOneAndUpdate(
            { _id: item._id, userId: req.userId }, 
            { $inc: { quantity: -item.quantidade } }
          );
        }

        // Emitir NFe se CPF foi fornecido
        if (req.body.customerCpf) {
          try {
            const nfeResponse = await axios.post('/api/nfe', {
              saleId: sale._id,
              customerCpf: req.body.customerCpf,
              customerName: req.body.customerName
            });
            
            sale.nfeStatus = 'issued';
            sale.nfeNumber = nfeResponse.data.nfeNumber;
            sale.nfeKey = nfeResponse.data.nfeKey;
            await sale.save();
          } catch (error) {
            console.error('Erro ao emitir NFe:', error);
            // Não impede a venda de ser concluída
          }
        }

        res.status(201).json(sale);
      } catch (error) {
        res.status(400).json({ message: error.message });
      }
    } else if (req.method === 'GET') {
      if (req.url.startsWith('/api/sales/daily-balance')) {
        try {
          const userId = req.userId;
          const today = new Date();
          const startOfDay = new Date(today.setHours(0, 0, 0, 0));

          const salesData = await Sale.aggregate([
            { 
              $match: { 
                userId,
                createdAt: { $gte: startOfDay }
              }
            },
            {
              $group: {
                _id: null,
                dailySales: { $sum: "$totalValue" }
              }
            }
          ]);

          const dailyBalance = salesData[0]?.dailySales || 0;
          
          // Retorna apenas o valor formatado como string
          return res.send(`R$ ${dailyBalance.toFixed(2)}`);
          
        } catch (error) {
          console.error('Erro ao buscar saldo diário:', error);
          return res.send('R$ 0,00');
        }
      } else if (req.url.startsWith('/api/sales/stats/daily')) {
        try {
          const cacheKey = `salesStats_${req.userId}`;
          const cachedStats = salesCache.get(cacheKey);

          if (cachedStats) {
            return res.json(cachedStats);
          }

          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);

          const stats = await Sale.aggregate([
            { $match: { userId: req.userId, createdAt: { $gte: startOfDay } } },
            { $unwind: "$items" },
            { $group: {
                _id: "$items.product",
                totalQuantity: { $sum: "$items.quantity" },
                totalValue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } }
              }
            },
            { $lookup: {
                from: "products",
                localField: "_id",
                foreignField: "_id",
                as: "productInfo"
              }
            },
            { $unwind: "$productInfo" },
            { $project: {
                name: "$productInfo.name",
                totalQuantity: 1,
                totalValue: 1
              }
            },
            { $sort: { totalValue: -1 } },
            { $limit: 10 }
          ]);

          const totalSales = await Sale.aggregate([
            { $match: { userId: req.userId, createdAt: { $gte: startOfDay } } },
            { $group: {
                _id: null,
                count: { $sum: 1 },
                totalValue: { $sum: "$totalValue" }
              }
            },
            { $project: {
                _id: 0,
                count: 1,
                totalValue: 1
              }
            }
          ]);

          const result = {
            productStats: stats,
            totalSales: totalSales.length > 0 ? [totalSales[0]] : [{ count: 0, totalValue: 0 }]
          };

          salesCache.set(cacheKey, result);

          res.json(result);
        } catch (error) {
          console.error('Erro ao buscar estatísticas de vendas:', error);
          res.status(500).json({ message: 'Erro interno do servidor' });
        }
      } else if (req.url.startsWith('/api/sales/stats')) {
        try {
          const { startDate, endDate } = req.query;
          const userId = req.userId;

          const stats = await Sale.aggregate([
            { 
                $match: { 
                    userId: mongoose.Types.ObjectId(userId),
                    createdAt: { 
                        $gte: new Date(startDate), 
                        $lte: new Date(endDate) 
                    } 
                } 
            },
            { $unwind: "$items" },
            { 
                $group: {
                    _id: "$items.product",
                    totalQuantity: { $sum: "$items.quantity" },
                    totalValue: { $sum: { $multiply: ["$items.quantity", "$items.price"] } }
                }
            },
            { 
                $lookup: {
                    from: "products",
                    localField: "_id",
                    foreignField: "_id",
                    as: "productInfo"
                }
            },
            { $unwind: "$productInfo" },
            { 
                $project: {
                    name: "$productInfo.name",
                    totalQuantity: 1,
                    totalValue: 1
                }
            },
            { $sort: { totalValue: -1 } },
            { $limit: 10 }
          ]);

          return res.json({ productStats: stats });
        } catch (error) {
          console.error('Erro ao buscar estatísticas de produtos:', error);
          res.status(500).json({ message: 'Erro interno do servidor' });
        }
      } else if (req.url.startsWith('/api/sales/available-dates')) {
        return getAvailableDates(req, res);
      } else if (req.url.startsWith('/api/dashboard')) {
        return getDashboardData(req, res); 
      } else if (req.url.startsWith('/api/sales/financial-summary')) {
        await getFinancialSummary(req, res);
      } else if (req.url.startsWith('/api/reports')) {
        await generateReport(req, res);
      } else {
        const { period } = req.query;
        const userId = req.userId;

        try {
          const { sales, periodInfo, financialSummary } = await getSalesByPeriod(userId, period);
          return res.json({ sales, periodInfo, financialSummary });
        } catch (error) {
          console.error('Erro ao buscar vendas:', error);
          return res.status(500).json({ message: 'Erro interno do servidor' });
        }
      }
    } else {
      return res.status(405).json({ message: 'Método não permitido' });
    }
  } catch (error) {
    return res.status(401).json({ message: error.message });
  }
}

export async function getAvailableDates(req, res) {
    try {
      const userId = req.userId;
  
      const sales = await Sale.aggregate([
        { $match: { userId: mongoose.Types.ObjectId(userId) } },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" }
            }
          }
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ]);
  
      const availableMonths = new Set();
      const availableYears = new Set();
  
      sales.forEach(sale => {
        availableMonths.add(sale._id.month);
        availableYears.add(sale._id.year);
      });
  
      return res.json({
        months: Array.from(availableMonths).sort((a, b) => a - b),
        years: Array.from(availableYears).sort((a, b) => a - b)
      });
    } catch (error) {
      console.error("Erro ao buscar datas disponíveis:", error);
      return res.status(500).json({ message: "Erro interno do servidor" });
    }
}
 

export async function getDashboardData(req, res) {
  await dbConnect();
  const isAuthenticated = auth(req, res);
  if (!isAuthenticated) return;

  try {
    const userId = req.userId;
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    const [
      salesData,
      topProducts,
      accountsPayable,
      suppliers,
      lowStockProducts,
      expenses
    ] = await Promise.all([
      Sale.aggregate([
        { $match: { userId } },
        { $group: {
            _id: null,
            dailySales: { $sum: { $cond: [{ $gte: ["$createdAt", startOfDay] }, "$totalValue", 0] } },
            monthlySales: { $sum: { $cond: [{ $gte: ["$createdAt", startOfMonth] }, "$totalValue", 0] } },
            yearlySales: { $sum: { $cond: [{ $gte: ["$createdAt", startOfYear] }, "$totalValue", 0] } }
          }
        }
      ]),
      Sale.aggregate([
        { $match: { userId, createdAt: { $gte: startOfMonth } } },
        { $unwind: "$items" },
        { $group: {
            _id: "$items.product",
            totalSales: { $sum: { $multiply: ["$items.quantity", "$items.price"] } }
          }
        },
        { $sort: { totalSales: -1 } },
        { $limit: 5 },
        { $lookup: {
            from: "products",
            localField: "_id",
            foreignField: "_id",
            as: "productInfo"
          }
        },
        { $unwind: "$productInfo" },
        { $project: {
            name: "$productInfo.name",
            totalSales: 1
          }
        }
      ]),
      AccountPayable.aggregate([
        { $match: { userId, dueDate: { $gte: today }, isPaid: false } },
        { $group: { _id: null, total: { $sum: "$totalValue" } } }
      ]),
      Supplier.find({ userId }).select('name').lean(),
      Product.find({ userId, quantity: { $lte: "$minStockLevel" } }).select('name quantity minStockLevel').lean(),
      AccountPayable.aggregate([
        { $match: { userId, dueDate: { $gte: startOfMonth, $lte: today }, isPaid: true } },
        { $group: { _id: null, total: { $sum: "$totalValue" } } }
      ])
    ]);

    const { dailySales, monthlySales, yearlySales } = salesData[0] || { dailySales: 0, monthlySales: 0, yearlySales: 0 };
    const monthlyExpenses = expenses[0]?.total || 0;
    const grossProfit = monthlySales;
    const netProfit = grossProfit - monthlyExpenses;

    const dashboardData = {
      dailySales,
      monthlySales,
      yearlySales,
      topProducts,
      accountsPayableDue: accountsPayable[0]?.total || 0,
      suppliers: suppliers.map(s => s.name),
      lowStockProducts,
      grossProfit,
      netProfit,
      monthlyExpenses
    };

    return res.json(dashboardData);
  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

async function getSalesByPeriod(userId, period) {
    const now = new Date();
    let startDate, endDate, label;
  
    switch (period) {
      case 'day':
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        label = 'Vendas de hoje';
        break;
      case 'week':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        endDate.setHours(23, 59, 59, 999);
        label = `Vendas desta semana (${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()})`;
        break;
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        label = `Vendas de ${startDate.toLocaleString('default', { month: 'long' })}`;
        break;
      default:
        startDate = new Date(now.setHours(0, 0, 0, 0));
        endDate = new Date(now.setHours(23, 59, 59, 999));
        label = 'Vendas de hoje';
    }
  
    const [sales, accountsPayable, cashRegister] = await Promise.all([
        Sale.find({
            userId,
            createdAt: { $gte: startDate, $lte: endDate }
        }).sort({ createdAt: -1 }).populate('items.product', 'name price'),
        AccountPayable.find({
            userId,
            dueDate: { $gte: startDate, $lte: endDate },
            isPaid: false
        }),
        CashRegister.find({
            userId,
            $or: [
                { openedAt: { $gte: startDate, $lte: endDate } },
                { closedAt: { $gte: startDate, $lte: endDate } },
                { status: 'open' } // Inclui caixas que ainda estão abertos
            ]
        }).sort({ openedAt: -1 })
    ]);

    const grossSales = sales.reduce((total, sale) => total + sale.totalValue, 0);
    const totalAccountsPayable = accountsPayable.reduce((total, account) => 
        total + account.totalValue, 0
    );
    const netProfit = grossSales - totalAccountsPayable;

    return { 
        sales, 
        periodInfo: { startDate, endDate, label },
        financialSummary: {
            grossSales,
            totalAccountsPayable,
            netProfit,
            cashRegisterData: cashRegister
        }
    };
}

async function getFinancialSummary(req, res) {
  try {
    const userId = req.userId;
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const [grossSales, accountsPayable] = await Promise.all([
      Sale.aggregate([
        { $match: { userId, createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: "$totalValue" } } }
      ]),
      AccountPayable.aggregate([
        { $match: { userId, dueDate: { $gte: startOfMonth, $lte: today }, isPaid: false } },
        { $group: { _id: null, total: { $sum: "$totalValue" } } }
      ])
    ]);

    const grossSalesTotal = grossSales[0]?.total || 0;
    const totalAccountsPayable = accountsPayable[0]?.total || 0;
    const netProfit = grossSalesTotal - totalAccountsPayable;

    return res.json({
      grossSales: grossSalesTotal,
      totalAccountsPayable,
      netProfit
    });
  } catch (error) {
    console.error('Erro ao buscar resumo financeiro:', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

async function generateReport(req, res) {
  try {
    const { reportType, startDate, endDate, format } = req.query;
    const userId = req.userId;

    let data;
    switch (reportType) {
      case 'sales':
        data = await getSalesReport(userId, new Date(startDate), new Date(endDate));
        break;
      case 'inventory':
        data = await getInventoryReport(userId);
        break;
      case 'financial':
        data = await getFinancialReport(userId, new Date(startDate), new Date(endDate));
        break;
      default:
        return res.status(400).json({ message: 'Tipo de relatório inválido' });
    }

    if (format === 'excel') {
      // Lógica para gerar Excel (você precisará implementar isso)
      // const excelBuffer = await generateExcelReport(data);
      // res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      // res.setHeader('Content-Disposition', `attachment; filename=${reportType}_report.xlsx`);
      // return res.send(excelBuffer);
    }

    return res.json(data);
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

async function getSalesReport(userId, startDate, endDate) {
  const sales = await Sale.find({
    userId,
    createdAt: { $gte: startDate, $lte: endDate }
  }).sort({ createdAt: -1 }).populate('items.product', 'name price');

  return sales.map(sale => ({
    data: sale.createdAt,
    itens: sale.items.map(item => `${item.product.name} (${item.quantity})`).join(', '),
    total: sale.totalValue,
    metodoPagamento: sale.paymentMethod
  }));
}

async function getInventoryReport(userId) {
  const products = await Product.find({ userId }).sort({ name: 1 });

  return products.map(product => ({
    nome: product.name,
    quantidade: product.quantity,
    preço: product.price,
    estoqueMinimo: product.minStockLevel
  }));
}

async function getFinancialReport(userId, startDate, endDate) {
  const [sales, expenses] = await Promise.all([
    Sale.aggregate([
      { $match: { userId, createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: null, total: { $sum: "$totalValue" } } }
    ]),
    AccountPayable.aggregate([
      { $match: { userId, dueDate: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: null, total: { $sum: "$totalValue" } } }
    ])
  ]);

  const totalSales = sales[0]?.total || 0;
  const totalExpenses = expenses[0]?.total || 0;

  return {
    vendasBrutas: totalSales,
    despesas: totalExpenses,
    lucroLiquido: totalSales - totalExpenses
  };
}


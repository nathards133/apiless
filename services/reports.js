import dbConnect from '../lib/dbConnect.js';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import AccountPayable from '../models/AccountPayable.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import auth from '../lib/auth.js';
import html_to_pdf from 'html-pdf-node';

export default async function handler(req, res) {
  await dbConnect();
  const isAuthenticated = auth(req, res);
  if (!isAuthenticated) return;

  const { reportType, startDate, endDate, format } = req.query;

  try {
    let data;

    switch (reportType) {
      case 'sales':
        data = await getSalesReport(req.userId, startDate, endDate);
        break;
      case 'inventory':
        data = await getInventoryReport(req.userId);
        break;
      case 'financial':
        data = await getFinancialReport(req.userId, startDate, endDate);
        break;
      default:
        return res.status(400).json({ message: 'Tipo de relatório inválido' });
    }

    if (format === 'excel') {
      const buffer = await generateExcelReport(data, reportType);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename=${reportType}_report.xlsx`);
      return res.send(buffer);
    } else if (format === 'pdf') {
      const buffer = await generatePdfReport(data, reportType);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=${reportType}_report.pdf`);
      return res.send(buffer);
    } else {
      return res.status(400).json({ message: 'Formato de relatório inválido' });
    }
  } catch (error) {
    console.error('Erro ao gerar relatório:', error);
    return res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

async function getSalesReport(userId, startDate, endDate) {
  const sales = await Sale.find({
    userId,
    createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) },
  }).populate('items.product', 'name');

  return sales.map(sale => ({
    ID: sale._id.toString(),
    Data: sale.createdAt.toISOString().split('T')[0],
    Itens: sale.items.map(item => {
      if (!item.product) {
        console.warn(`Venda ${sale._id} contém um item sem produto associado.`);
      }
      const productName = item.product ? item.product.name : 'Produto não encontrado';
      return `${productName} (${item.quantity})`;
    }).join('; '),
    "Valor Total": sale.totalValue.toFixed(2).replace('.', ','),
    "Método de Pagamento": sale.paymentMethod || '',
  }));
}

async function getInventoryReport(userId) {
  const products = await Product.find({ userId });

  return products.map(product => ({
    ID: product._id,
    Nome: product.name || 'Nome não disponível',
    Preço: (product.price || 0).toFixed(2),
    Quantidade: product.quantity || 0,
    Unidade: product.unit || 'N/A',
    CódigoBarras: product.barcode || 'N/A',
  }));
}

async function getFinancialReport(userId, startDate, endDate) {
  const [sales, expenses] = await Promise.all([
    Sale.aggregate([
      { $match: { userId, createdAt: { $gte: new Date(startDate), $lte: new Date(endDate) } } },
      { $group: { _id: null, total: { $sum: "$totalValue" } } },
    ]),
    AccountPayable.aggregate([
      { $match: { userId, dueDate: { $gte: new Date(startDate), $lte: new Date(endDate) } } },
      { $group: { _id: null, total: { $sum: "$totalValue" } } },
    ]),
  ]);

  return {
    Vendas: sales[0]?.total || 0,
    Despesas: expenses[0]?.total || 0,
    Lucro: (sales[0]?.total || 0) - (expenses[0]?.total || 0),
  };
}

async function generateExcelReport(data, reportType) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(reportType);

  worksheet.addRow(Object.keys(data[0]));
  data.forEach(row => worksheet.addRow(Object.values(row)));

  return await workbook.xlsx.writeBuffer();
}

async function generatePdfReport(data, reportType) {
  let content = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          h1 { color: #333; text-align: center; }
        </style>
      </head>
      <body>
        <h1>Relatório de ${reportType}</h1>
        <table>
          <thead>
            <tr>
              ${Object.keys(data[0]).map(key => `<th>${key}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.map(row => `
              <tr>
                ${Object.values(row).map(value => `<td>${value}</td>`).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;

  let options = { format: 'A4' };
  let file = { content };

  try {
    const pdfBuffer = await html_to_pdf.generatePdf(file, options);
    return pdfBuffer;
  } catch (error) {
    console.error('Erro ao gerar PDF:', error);
    throw error;
  }
}

export async function getAvailableDates(req, res) {
  await dbConnect();
  const isAuthenticated = auth(req, res);
  if (!isAuthenticated) return;

  const { reportType } = req.query;
  const userId = req.userId;

  try {
    let minDate, maxDate;
    if (reportType === 'sales') {
      const oldestSale = await Sale.findOne({ userId }).sort({ createdAt: 1 }).limit(1);
      const newestSale = await Sale.findOne({ userId }).sort({ createdAt: -1 }).limit(1);
      
      minDate = oldestSale ? oldestSale.createdAt : null;
      maxDate = newestSale ? newestSale.createdAt : null;
    } else if (reportType === 'financial') {
      const [oldestSale, newestSale, oldestExpense, newestExpense] = await Promise.all([
        Sale.findOne({ userId }).sort({ createdAt: 1 }).limit(1),
        Sale.findOne({ userId }).sort({ createdAt: -1 }).limit(1),
        AccountPayable.findOne({ userId }).sort({ dueDate: 1 }).limit(1),
        AccountPayable.findOne({ userId }).sort({ dueDate: -1 }).limit(1)
      ]);

      minDate = new Date(Math.min(
        oldestSale ? oldestSale.createdAt : Date.now(),
        oldestExpense ? oldestExpense.dueDate : Date.now()
      ));
      maxDate = new Date(Math.max(
        newestSale ? newestSale.createdAt : 0,
        newestExpense ? newestExpense.dueDate : 0
      ));
    } else {
      return res.status(400).json({ message: 'Tipo de relatório inválido' });
    }

    if (!minDate || !maxDate) {
      return res.json({ months: [], years: [], minDate: null, maxDate: null });
    }

    const months = new Set();
    const years = new Set();

    let currentDate = new Date(minDate);
    while (currentDate <= maxDate) {
      months.add(currentDate.getMonth() + 1);
      years.add(currentDate.getFullYear());
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    res.json({
      months: Array.from(months).sort((a, b) => a - b),
      years: Array.from(years).sort((a, b) => a - b),
      minDate: minDate.toISOString(),
      maxDate: maxDate.toISOString()
    });
  } catch (error) {
    console.error('Erro ao buscar datas disponíveis:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
}

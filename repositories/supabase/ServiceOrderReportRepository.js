import IServiceOrderReportRepository from '../interfaces/IServiceOrderReportRepository.js';
import supabase from '../../config/supabase.js';
import { format } from 'date-fns';
import ExcelJS from 'exceljs';

export default class SupabaseServiceOrderReportRepository extends IServiceOrderReportRepository {
  constructor() {
    super();
    this.tableName = 'service_orders';
  }

  async generateReport(filters) {
    let query = supabase
      .from(this.tableName)
      .select(`
        id,
        status,
        created_at,
        total_value,
        client:clients(id, name)
      `)
      .eq('user_id', filters.userId);

    if (filters.startDate && filters.endDate) {
      query = query
        .gte('created_at', filters.startDate)
        .lte('created_at', filters.endDate);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data: orders, error } = await query;

    if (error) throw error;

    const formattedOrders = orders.map(this._formatOrderForReport);

    return {
      totalOrders: orders.length,
      totalValue: orders.reduce((acc, order) => acc + order.total_value, 0),
      ordersByStatus: orders.reduce((acc, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {}),
      orders: formattedOrders
    };
  }

  async exportReport(filters, exportFormat = 'excel') {
    const report = await this.generateReport(filters);

    switch (exportFormat) {
      case 'excel':
        return await this._generateExcelReport(report);
      case 'csv':
        return await this._generateCSVReport(report);
      default:
        throw new Error('Export format not supported');
    }
  }

  async _generateExcelReport(report) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Service Orders Report');

    // Configurar cabeçalhos
    worksheet.columns = [
      { header: 'Order ID', key: 'id', width: 15 },
      { header: 'Client', key: 'clientName', width: 20 },
      { header: 'Status', key: 'status', width: 15 },
      { header: 'Created At', key: 'createdAt', width: 20 },
      { header: 'Total Value', key: 'totalValue', width: 15 }
    ];

    // Adicionar dados
    worksheet.addRows(report.orders.map(order => ({
      id: order.id,
      clientName: order.client.name,
      status: order.status,
      createdAt: format(new Date(order.createdAt), 'yyyy-MM-dd HH:mm'),
      totalValue: order.totalValue
    })));

    // Adicionar sumário
    worksheet.addRow([]);
    worksheet.addRow(['Total Orders', report.totalOrders]);
    worksheet.addRow(['Total Value', report.totalValue]);
    worksheet.addRow([]);
    worksheet.addRow(['Orders by Status']);
    Object.entries(report.ordersByStatus).forEach(([status, count]) => {
      worksheet.addRow([status, count]);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }

  _formatOrderForReport(order) {
    return {
      id: order.id,
      status: order.status,
      createdAt: order.created_at,
      totalValue: order.total_value,
      client: {
        id: order.client.id,
        name: order.client.name
      }
    };
  }
} 
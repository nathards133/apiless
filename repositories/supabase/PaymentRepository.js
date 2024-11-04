import IPaymentRepository from '../interfaces/IPaymentRepository.js';
import supabase from '../../config/supabase.js';

export default class SupabasePaymentRepository extends IPaymentRepository {
  constructor() {
    super();
    this.tableName = 'payments';
  }

  async create(data) {
    const { data: newPayment, error } = await supabase
      .from(this.tableName)
      .insert([{
        service_order_id: data.serviceOrderId,
        amount: data.amount,
        status: data.status || 'pending',
        payment_method: data.paymentMethod,
        payment_date: data.paymentDate,
        transaction_id: data.transactionId,
        notes: data.notes,
        user_id: data.userId
      }])
      .select(`
        *,
        service_order:service_orders(id, client_id)
      `)
      .single();

    if (error) throw error;
    return this._formatPayment(newPayment);
  }

  async findAll(filters = {}) {
    let query = supabase
      .from(this.tableName)
      .select(`
        *,
        service_order:service_orders(
          id,
          client:clients(id, name)
        )
      `)
      .eq('user_id', filters.userId);

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    if (filters.serviceOrderId) {
      query = query.eq('service_order_id', filters.serviceOrderId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data.map(this._formatPayment);
  }

  async findById(id, userId) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select(`
        *,
        service_order:service_orders(
          id,
          client:clients(id, name)
        )
      `)
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return this._formatPayment(data);
  }

  async updateStatus(id, status, userId) {
    const { data: updatedPayment, error } = await supabase
      .from(this.tableName)
      .update({
        status,
        payment_date: status === 'paid' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select(`
        *,
        service_order:service_orders(
          id,
          client:clients(id, name)
        )
      `)
      .single();

    if (error) throw error;
    return this._formatPayment(updatedPayment);
  }

  _formatPayment(data) {
    return {
      id: data.id,
      serviceOrderId: data.service_order_id,
      amount: data.amount,
      status: data.status,
      paymentMethod: data.payment_method,
      paymentDate: data.payment_date,
      transactionId: data.transaction_id,
      notes: data.notes,
      userId: data.user_id,
      serviceOrder: data.service_order ? {
        id: data.service_order.id,
        client: data.service_order.client
      } : null,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }
} 
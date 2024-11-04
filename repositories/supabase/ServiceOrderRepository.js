import IServiceOrderRepository from '../interfaces/IServiceOrderRepository.js';
import supabase from '../../config/supabase.js';

export default class SupabaseServiceOrderRepository extends IServiceOrderRepository {
  constructor() {
    super();
    this.tableName = 'service_orders';
  }

  async create(data) {
    const { data: newOrder, error } = await supabase
      .from(this.tableName)
      .insert([{
        client_id: data.clientId,
        services: data.services,
        status: 'pending',
        created_at: new Date().toISOString(),
        delivery_date: data.deliveryDate,
        total_value: data.totalValue,
        payment_status: 'pending'
      }])
      .select()
      .single();

    if (error) throw error;
    return newOrder;
  }

  async findAll(filters = {}) {
    let query = supabase
      .from(this.tableName)
      .select('*');

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  }

  async findById(id) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  }

  async update(id, data) {
    const { data: updatedOrder, error } = await supabase
      .from(this.tableName)
      .update(data)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return updatedOrder;
  }

  async delete(id) {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  }
} 
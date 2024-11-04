import IClientRepository from '../interfaces/IClientRepository.js';
import supabase from '../../config/supabase.js';

export default class SupabaseClientRepository extends IClientRepository {
  constructor() {
    super();
    this.tableName = 'clients';
  }

  async create(data) {
    const { data: newClient, error } = await supabase
      .from(this.tableName)
      .insert([{
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        document: data.document,
        user_id: data.userId,
        active: true,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return this._formatClient(newClient);
  }

  async findAll(filters = {}) {
    let query = supabase
      .from(this.tableName)
      .select('*')
      .eq('user_id', filters.userId)
      .eq('active', true);

    const { data, error } = await query;
    if (error) throw error;
    return data.map(this._formatClient);
  }

  async findById(id, userId) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) throw error;
    return data ? this._formatClient(data) : null;
  }

  async update(id, data, userId) {
    const { data: updatedClient, error } = await supabase
      .from(this.tableName)
      .update({
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        document: data.document,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return this._formatClient(updatedClient);
  }

  async delete(id, userId) {
    const { data: deletedClient, error } = await supabase
      .from(this.tableName)
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return true;
  }

  // Método auxiliar para formatar os dados do cliente
  _formatClient(data) {
    return {
      id: data.id,
      name: data.name,
      email: data.email,
      phone: data.phone,
      address: data.address || {},
      document: data.document,
      userId: data.user_id,
      active: data.active,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }
} 
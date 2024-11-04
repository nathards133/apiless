import ITaskRepository from '../interfaces/ITaskRepository.js';
import supabase from '../../config/supabase.js';

export default class SupabaseTaskRepository extends ITaskRepository {
  constructor() {
    super();
    this.tableName = 'tasks';
  }

  async create(data) {
    const { data: newTask, error } = await supabase
      .from(this.tableName)
      .insert([{
        service_order_id: data.serviceOrderId,
        description: data.description,
        status: data.status || 'pending',
        assigned_to: data.assignedTo,
        due_date: data.dueDate,
        completed_at: null,
        priority: data.priority || 'medium',
        notes: data.notes,
        user_id: data.userId,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    return this._formatTask(newTask);
  }

  async findByServiceOrder(serviceOrderId, userId) {
    const { data, error } = await supabase
      .from(this.tableName)
      .select(`
        *,
        assigned_to:users(id, name, email)
      `)
      .eq('service_order_id', serviceOrderId)
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data.map(this._formatTask);
  }

  async updateStatus(id, status, userId) {
    const updates = {
      status,
      completed_at: status === 'completed' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString()
    };

    const { data: updatedTask, error } = await supabase
      .from(this.tableName)
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select(`
        *,
        assigned_to:users(id, name, email)
      `)
      .single();

    if (error) throw error;
    return this._formatTask(updatedTask);
  }

  // Método auxiliar para formatar os dados da task
  _formatTask(data) {
    return {
      id: data.id,
      serviceOrderId: data.service_order_id,
      description: data.description,
      status: data.status,
      assignedTo: data.assigned_to ? {
        id: data.assigned_to.id,
        name: data.assigned_to.name,
        email: data.assigned_to.email
      } : null,
      dueDate: data.due_date,
      completedAt: data.completed_at,
      priority: data.priority,
      notes: data.notes,
      userId: data.user_id,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }
} 
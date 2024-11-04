import SupabaseServiceOrderRepository from './supabase/ServiceOrderRepository.js';
import SupabaseClientRepository from './supabase/ClientRepository.js';
import SupabaseTaskRepository from './supabase/TaskRepository.js';
import SupabaseServiceOrderReportRepository from './supabase/ServiceOrderReportRepository.js';
import SupabasePaymentRepository from './supabase/PaymentRepository.js';

const REPOSITORIES = {
  SUPABASE: 'supabase',
  MONGODB: 'mongodb'
};

export default class RepositoryFactory {
  static getServiceOrderRepository(type = REPOSITORIES.SUPABASE) {
    switch (type) {
      case REPOSITORIES.SUPABASE:
        return new SupabaseServiceOrderRepository();
      default:
        throw new Error('Repository type not supported');
    }
  }

  static getClientRepository(type = REPOSITORIES.SUPABASE) {
    switch (type) {
      case REPOSITORIES.SUPABASE:
        return new SupabaseClientRepository();
      default:
        throw new Error('Repository type not supported');
    }
  }

  static getTaskRepository(type = REPOSITORIES.SUPABASE) {
    switch (type) {
      case REPOSITORIES.SUPABASE:
        return new SupabaseTaskRepository();
      default:
        throw new Error('Repository type not supported');
    }
  }

  static getServiceOrderReportRepository(type = REPOSITORIES.SUPABASE) {
    switch (type) {
      case REPOSITORIES.SUPABASE:
        return new SupabaseServiceOrderReportRepository();
      default:
        throw new Error('Repository type not supported');
    }
  }

  static getPaymentRepository(type = REPOSITORIES.SUPABASE) {
    switch (type) {
      case REPOSITORIES.SUPABASE:
        return new SupabasePaymentRepository();
      default:
        throw new Error('Repository type not supported');
    }
  }
} 
import { supabase } from './base44Client';

// Maps Base44 entity names to Supabase table names
const TABLE_MAP = {
  TableData:       'table_data',
  PendingSale:     'pending_sales',
  Wristband:       'wristbands',
  Task:            'tasks',
  Expense:         'expenses',
  Attraction:      'attractions',
  Combo:           'combos',
  User:            'users',
  CasparFilling:   'caspar_fillings',
  WristbandScanLog:'wristband_scan_logs',
  AppSetting:      'app_settings',
  ExpenseEvent:    'expense_events',
  MoneyLocation:   'money_locations',
  Hotel:           'hotels',
};

function buildEntity(tableName) {
  return {
    async list(sortField, limit) {
      let query = supabase.from(tableName).select('*');
      if (sortField) {
        const ascending = !sortField.startsWith('-');
        const field = sortField.replace(/^-/, '').replace('created_date', 'created_at').replace('expense_date', 'expense_date');
        query = query.order(field, { ascending });
      }
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async filter(filters, sortField, limit) {
      let query = supabase.from(tableName).select('*');
      for (const [key, value] of Object.entries(filters || {})) {
        if (value && typeof value === 'object' && value.$in) {
          query = query.in(key, value.$in);
        } else {
          query = query.eq(key, value);
        }
      }
      if (sortField) {
        const ascending = !sortField.startsWith('-');
        const field = sortField.replace(/^-/, '').replace('created_date', 'created_at');
        query = query.order(field, { ascending });
      }
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },

    async create(payload) {
      const { data, error } = await supabase.from(tableName).insert(payload).select().single();
      if (error) throw error;
      return data;
    },

    async update(id, payload) {
      const { data, error } = await supabase.from(tableName).update(payload).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },

    async delete(id) {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
    },

    // Real-time subscription (replaces base44 subscribe)
    subscribe(callback) {
      const channel = supabase
        .channel(`${tableName}_changes`)
        .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, callback)
        .subscribe();
      return () => supabase.removeChannel(channel);
    },
  };
}

// Build all entities
const entities = {};
for (const [entityName, tableName] of Object.entries(TABLE_MAP)) {
  entities[entityName] = buildEntity(tableName);
}

export default entities;

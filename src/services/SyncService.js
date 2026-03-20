/**
 * שירות Sync מרכזי
 * =================
 * ניהול סנכרון בין Supabase ו-localStorage
 * עם retry logic ו-conflict resolution
 */

import { supabase } from '../services/supabase';
import Logger from './Logger';
import ConfigService from './ConfigService';
import ErrorHandler from './ErrorHandler';

class SyncService {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncQueue = [];
    this.isSyncing = false;
    this.retryAttempts = new Map();

    this._setupNetworkListener();
    this._setupPeriodicSync();
  }

  /**
   * setup network status listener
   */
  _setupNetworkListener() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.isOnline = true;
        Logger.info('Back online - starting sync');
        this.processSyncQueue();
      });

      window.addEventListener('offline', () => {
        this.isOnline = false;
        Logger.warn('Offline - queueing changes');
      });
    }
  }

  /**
   * setup periodic sync
   */
  _setupPeriodicSync() {
    if (typeof window !== 'undefined') {
      setInterval(() => {
        if (this.isOnline && !this.isSyncing) {
          this.processSyncQueue();
        }
      }, ConfigService.get('NOTIFICATIONS.SYNC_ERROR_RETRY_INTERVAL'));
    }
  }

  /**
   * בדיקה אם יש חיבור
   */
  async checkConnectivity() {
    try {
      const { data, error } = await supabase.from('health_check').select('id').limit(1).single();
      return !error;
    } catch (error) {
      return false;
    }
  }

  /**
   * post data to Supabase
   */
  async upload(table, data, options = {}) {
    ErrorHandler.assertNotNull(table, 'table');
    ErrorHandler.assertNotNull(data, 'data');

    Logger.debug(`Uploading to ${table}`, { data });

    try {
      if (!this.isOnline) {
        return this._queueForSync(table, data, options);
      }

      const { data: result, error } = await supabase
        .from(table)
        .insert(data)
        .select()
        .single();

      if (error) {
        Logger.error(`Upload error to ${table}`, error);
        return this._handleSyncError(table, data, error, options);
      }

      Logger.info(`Successfully uploaded to ${table}`, { id: result?.id });
      return { success: true, data: result };
    } catch (error) {
      Logger.error(`Upload exception to ${table}`, error);
      return this._handleSyncError(table, data, error, options);
    }
  }

  /**
   * batch upload
   */
  async uploadBatch(table, dataArray, options = {}) {
    ErrorHandler.assert(Array.isArray(dataArray), 'dataArray must be an array');
    ErrorHandler.assert(dataArray.length > 0, 'dataArray cannot be empty');

    Logger.info(`Batch uploading ${dataArray.length} items to ${table}`);

    try {
      if (!this.isOnline) {
        return this._queueForSync(table, dataArray, { ...options, batch: true });
      }

      const { data: results, error } = await supabase
        .from(table)
        .insert(dataArray)
        .select();

      if (error) {
        Logger.error(`Batch upload error to ${table}`, error);
        return this._handleSyncError(table, dataArray, error, options);
      }

      Logger.info(`Successfully batch uploaded ${results.length} items to ${table}`);
      return { success: true, data: results };
    } catch (error) {
      Logger.error(`Batch upload exception to ${table}`, error);
      return this._handleSyncError(table, dataArray, error, options);
    }
  }

  /**
   * get data from Supabase
   */
  async download(table, filters = {}, options = {}) {
    ErrorHandler.assertNotNull(table, 'table');

    Logger.debug(`Downloading from ${table}`, { filters });

    try {
      let query = supabase.from(table).select(filters.select || '*');

      // Apply filters
      if (filters.where) {
        Object.entries(filters.where).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            query = query.in(key, value);
          } else if (typeof value === 'object' && value.gte) {
            query = query.gte(key, value.gte);
          } else {
            query = query.eq(key, value);
          }
        });
      }

      // Apply ordering
      if (filters.order) {
        const [column, direction] = filters.order;
        query = query.order(column, { ascending: direction === 'asc' });
      }

      // Apply pagination
      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data, error } = await query;

      if (error) {
        Logger.error(`Download error from ${table}`, error);
        throw error;
      }

      Logger.info(`Downloaded ${data?.length || 0} items from ${table}`);
      return { success: true, data };
    } catch (error) {
      Logger.error(`Download exception from ${table}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * update data
   */
  async update(table, id, updates) {
    ErrorHandler.assertNotNull(table, 'table');
    ErrorHandler.assertNotNull(id, 'id');
    ErrorHandler.assertNotNull(updates, 'updates');

    Logger.debug(`Updating ${table}:${id}`, { updates });

    try {
      if (!this.isOnline) {
        return this._queueForSync(table, { id, ...updates }, { operation: 'update' });
      }

      const { data, error } = await supabase
        .from(table)
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        Logger.error(`Update error in ${table}`, error);
        return this._handleSyncError(table, { id, ...updates }, error);
      }

      Logger.info(`Successfully updated ${table}:${id}`);
      return { success: true, data };
    } catch (error) {
      Logger.error(`Update exception in ${table}`, error);
      return this._handleSyncError(table, { id, ...updates }, error);
    }
  }

  /**
   * delete data
   */
  async delete(table, id) {
    ErrorHandler.assertNotNull(table, 'table');
    ErrorHandler.assertNotNull(id, 'id');

    try {
      if (!this.isOnline) {
        return this._queueForSync(table, { id }, { operation: 'delete' });
      }

      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);

      if (error) {
        Logger.error(`Delete error in ${table}`, error);
        throw error;
      }

      Logger.info(`Successfully deleted ${table}:${id}`);
      return { success: true };
    } catch (error) {
      Logger.error(`Delete exception in ${table}`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * queue for sync
   */
  _queueForSync(table, data, options = {}) {
    const queueItem = {
      id: `${table}-${Date.now()}`,
      table,
      data,
      options,
      timestamp: new Date().toISOString(),
      retries: 0
    };

    this.syncQueue.push(queueItem);
    this._persistSyncQueue();

    Logger.info(`Queued sync item: ${queueItem.id}`);
    return { success: false, queued: true, queueId: queueItem.id };
  }

  /**
   * process sync queue
   */
  async processSyncQueue() {
    if (this.isSyncing || this.syncQueue.length === 0 || !this.isOnline) {
      return;
    }

    this.isSyncing = true;
    Logger.info(`Processing ${this.syncQueue.length} sync queue items`);

    while (this.syncQueue.length > 0) {
      const item = this.syncQueue[0];

      try {
        let result;

        if (item.options.operation === 'delete') {
          result = await this.delete(item.table, item.data.id);
        } else if (item.options.operation === 'update') {
          result = await this.update(item.table, item.data.id, item.data);
        } else if (item.options.batch) {
          result = await this.uploadBatch(item.table, item.data);
        } else {
          result = await this.upload(item.table, item.data);
        }

        if (result.success) {
          this.syncQueue.shift();
          this._persistSyncQueue();
          this.retryAttempts.delete(item.id);
          Logger.info(`Synced: ${item.id}`);
        } else {
          item.retries++;

          if (item.retries >= ConfigService.get('API.RETRY_ATTEMPTS')) {
            Logger.error(`Max retries reached for ${item.id}`);
            this.syncQueue.shift();
            this._persistSyncQueue();
          } else {
            Logger.warn(`Retrying ${item.id} (${item.retries}/${ConfigService.get('API.RETRY_ATTEMPTS')})`);
            break; // Stop processing, will retry on next attempt
          }
        }
      } catch (error) {
        Logger.error(`Error syncing ${item.id}`, error);
        item.retries++;

        if (item.retries >= ConfigService.get('API.RETRY_ATTEMPTS')) {
          this.syncQueue.shift();
          this._persistSyncQueue();
        } else {
          break;
        }
      }
    }

    this.isSyncing = false;
    Logger.info(`Sync processing complete. Queue length: ${this.syncQueue.length}`);
  }

  /**
   * handle sync error
   */
  _handleSyncError(table, data, error, options = {}) {
    if (error.status === 401) {
      Logger.error('Authentication failed', error);
      // Trigger re-authentication
      return this._queueForSync(table, data, options);
    }

    if (error.status >= 500) {
      Logger.warn('Server error, queuing for retry', error);
      return this._queueForSync(table, data, options);
    }

    // Other errors
    Logger.error(`Sync failed for ${table}`, error);
    return { success: false, error: error.message };
  }

  /**
   * persist sync queue to localStorage
   */
  _persistSyncQueue() {
    try {
      const key = `${ConfigService.get('STORAGE.LOCAL_STORAGE_PREFIX')}sync_queue`;
      localStorage.setItem(key, JSON.stringify(this.syncQueue));
    } catch (error) {
      Logger.error('Failed to persist sync queue', error);
    }
  }

  /**
   * restore sync queue from localStorage
   */
  _restoreSyncQueue() {
    try {
      const key = `${ConfigService.get('STORAGE.LOCAL_STORAGE_PREFIX')}sync_queue`;
      const stored = localStorage.getItem(key);
      if (stored) {
        this.syncQueue = JSON.parse(stored);
        Logger.info(`Restored ${this.syncQueue.length} sync queue items`);
      }
    } catch (error) {
      Logger.error('Failed to restore sync queue', error);
    }
  }

  /**
   * get sync queue status
   */
  getQueueStatus() {
    return {
      queueLength: this.syncQueue.length,
      isSyncing: this.isSyncing,
      isOnline: this.isOnline,
      queue: this.syncQueue
    };
  }

  /**
   * clear sync queue
   */
  clearQueue() {
    this.syncQueue = [];
    this._persistSyncQueue();
    Logger.info('Sync queue cleared');
  }
}

export const syncService = new SyncService();

// Restore queue on init
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    syncService._restoreSyncQueue();
  });
}

export default syncService;

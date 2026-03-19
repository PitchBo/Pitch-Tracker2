/**
 * Core IndexedDB layer for Pitch Tracker
 * 
 * Database: PitchTrackerDB
 * Schema Version: 1
 * 
 * Collections (object stores):
 *   pitchers        - Canonical player identity records
 *   teams           - Team info with pitcher ID references
 *   gameOutings     - One record per pitcher per game appearance
 *   trainingSessions - One record per training session
 *   appSettings     - Singleton app configuration
 *   draftSessions   - Paused game/training state (max 2 records)
 * 
 * Indexes:
 *   gameOutings.pitcherId    - Query all outings for a pitcher
 *   gameOutings.teamId       - Query all outings for a team
 *   gameOutings.date         - Range queries for rest day calculations
 *   gameOutings.pitcherDate  - Compound: pitcher + date lookups
 *   trainingSessions.pitcherId - Query all sessions for a pitcher
 *   trainingSessions.date    - Range queries for history
 *   draftSessions.type       - Look up by "game" or "training"
 */

const DB_NAME = 'PitchTrackerDB';
const DB_VERSION = 1;

let dbInstance = null;

/**
 * Opens (or creates) the database. Returns a promise that resolves
 * to the IDBDatabase instance. Cached after first call.
 */
export function openDatabase() {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;

      // Schema version 0 → 1: Initial creation
      if (oldVersion < 1) {
        // pitchers
        const pitcherStore = db.createObjectStore('pitchers', { keyPath: 'id' });
        // No indexes needed — small collection, always loaded in full

        // teams
        const teamStore = db.createObjectStore('teams', { keyPath: 'id' });
        // No indexes needed — small collection (max 5)

        // gameOutings
        const gameStore = db.createObjectStore('gameOutings', { keyPath: 'id' });
        gameStore.createIndex('pitcherId', 'pitcherId', { unique: false });
        gameStore.createIndex('teamId', 'teamId', { unique: false });
        gameStore.createIndex('date', 'date', { unique: false });
        gameStore.createIndex('pitcherDate', ['pitcherId', 'date'], { unique: false });

        // trainingSessions
        const trainingStore = db.createObjectStore('trainingSessions', { keyPath: 'id' });
        trainingStore.createIndex('pitcherId', 'pitcherId', { unique: false });
        trainingStore.createIndex('date', 'date', { unique: false });

        // appSettings
        db.createObjectStore('appSettings', { keyPath: 'key' });

        // draftSessions
        db.createObjectStore('draftSessions', { keyPath: 'key' });
      }

      // Future migrations go here:
      // if (oldVersion < 2) { ... }
    };

    request.onsuccess = (event) => {
      dbInstance = event.target.result;

      // Handle unexpected close (e.g., storage pressure on mobile)
      dbInstance.onclose = () => {
        console.warn('⚠️ Database connection closed unexpectedly');
        dbInstance = null;
      };

      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error('❌ Failed to open database:', event.target.error);
      reject(event.target.error);
    };
  });
}

/**
 * Close the database connection. Useful for testing cleanup.
 */
export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Delete the entire database. Nuclear option for "Clear All Data".
 * Returns a promise.
 */
export function deleteDatabase() {
  closeDatabase();
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

// ─── Low-level CRUD helpers ─────────────────────────────────────

/**
 * Get a single record by primary key.
 */
export async function getById(storeName, id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Get all records from a store.
 */
export async function getAll(storeName) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Get all records from an index matching a specific key.
 */
export async function getAllByIndex(storeName, indexName, key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(key);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Get all records from an index within a key range.
 * Useful for date range queries.
 */
export async function getAllByRange(storeName, indexName, lower, upper) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const range = IDBKeyRange.bound(lower, upper);
    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Put (insert or update) a single record.
 */
export async function put(storeName, record) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(record);
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Put multiple records in a single transaction.
 */
export async function putMany(storeName, records) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    records.forEach((record) => store.put(record));
    tx.oncomplete = () => resolve();
    tx.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Delete a single record by primary key.
 */
export async function deleteById(storeName, id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Delete multiple records matching an index key.
 * Used for "delete all game outings for pitcher X".
 */
export async function deleteAllByIndex(storeName, indexName, key) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.openCursor(key);
    let deleteCount = 0;

    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        cursor.delete();
        deleteCount++;
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve(deleteCount);
    tx.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Clear all records from a store.
 */
export async function clearStore(storeName) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Count records in a store, optionally by index key.
 */
export async function count(storeName, indexName = null, key = null) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const target = indexName ? store.index(indexName) : store;
    const request = key ? target.count(key) : target.count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

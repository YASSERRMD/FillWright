const DB_NAME = 'fillwright-profiles';
const DB_VERSION = 2;
const STORE_NAME = 'profiles';
const META_KEY = '__meta__';

export interface ProfileMeta {
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface ProfilesMeta {
  activeProfile: string;
  profiles: Record<string, ProfileMeta>;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveProfileToDB(name: string, data: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(data, `profile:${name}`);

    const metaReq = store.get(META_KEY);
    metaReq.onsuccess = () => {
      const meta = (metaReq.result as ProfilesMeta) ?? { activeProfile: 'default', profiles: {} };
      meta.profiles[name] = {
        name,
        createdAt: meta.profiles[name]?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      };
      if (!meta.activeProfile) meta.activeProfile = name;
      store.put(JSON.stringify(meta), META_KEY);
    };

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadProfileFromDB(name: string): Promise<string | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(`profile:${name}`);

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function deleteProfileFromDB(name: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(`profile:${name}`);

    const metaReq = store.get(META_KEY);
    metaReq.onsuccess = () => {
      const meta = (metaReq.result as ProfilesMeta) ?? { activeProfile: 'default', profiles: {} };
      delete meta.profiles[name];
      if (meta.activeProfile === name) {
        meta.activeProfile = Object.keys(meta.profiles)[0] ?? 'default';
      }
      store.put(JSON.stringify(meta), META_KEY);
    };

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function getProfilesMeta(): Promise<ProfilesMeta> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(META_KEY);

    request.onsuccess = () => {
      const meta = (request.result as ProfilesMeta) ?? { activeProfile: 'default', profiles: {} };
      resolve(meta);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function setActiveProfile(name: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const metaReq = store.get(META_KEY);

    metaReq.onsuccess = () => {
      const meta = (metaReq.result as ProfilesMeta) ?? { activeProfile: 'default', profiles: {} };
      meta.activeProfile = name;
      store.put(JSON.stringify(meta), META_KEY);
    };

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

export async function listProfileNames(): Promise<string[]> {
  const meta = await getProfilesMeta();
  return Object.keys(meta.profiles);
}

export async function getActiveProfileName(): Promise<string> {
  const meta = await getProfilesMeta();
  return meta.activeProfile;
}

export async function renameProfileInDB(oldName: string, newName: string): Promise<void> {
  const data = await loadProfileFromDB(oldName);
  if (data) {
    await saveProfileToDB(newName, data);
    await deleteProfileFromDB(oldName);
    const meta = await getProfilesMeta();
    if (meta.activeProfile === oldName) {
      await setActiveProfile(newName);
    }
  }
}

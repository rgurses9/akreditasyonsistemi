import { Personnel, User, UserRole, CompletedEvent } from '../types';
import { database } from './firebase';
import { ref, get, set } from 'firebase/database';

// --- MOCK DATABASE (Personnel) ---
// Test verileri kaldırıldı - Tüm personel verisi Firebase'de
const MOCK_DATABASE: Personnel[] = [];

// --- MOCK DATABASE (Users) ---
const MOCK_USERS: User[] = [
  { username: '441288', password: '441288', role: UserRole.ADMIN, fullName: 'RIFAT GÜRSES' }
];

// --- MOCK DATABASE (History) ---
// Test verileri kaldırıldı
const MOCK_HISTORY: CompletedEvent[] = [];

// Google Sheets bilgileri
const SHEET_ID = '1J6SFLRCGk2-iBzi7TTjthyNzN4dWHH8A';
const SHEET_GID = '1490010137';
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

// Cache için
let personnelCache: Personnel[] = [];
let lastCacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 dakika

/**
 * Google Sheets'ten personel verilerini çeker ve cache'ler
 */
async function fetchPersonnelFromSheets(): Promise<Personnel[]> {
  const now = Date.now();

  // Cache'de varsa ve güncel ise cache'den dön
  if (personnelCache.length > 0 && (now - lastCacheTime) < CACHE_DURATION) {
    console.log(`📦 Cache'den ${personnelCache.length} personel dönülüyor`);
    return personnelCache;
  }

  try {
    console.log('📥 Google Sheets\'ten veri çekiliyor...');
    const response = await fetch(SHEET_CSV_URL);

    if (!response.ok) {
      throw new Error(`Google Sheets erişim hatası: ${response.status}`);
    }

    const csvText = await response.text();
    const lines = csvText.trim().split('\n');
    const data: Personnel[] = [];

    // CSV parse et (başlık satırını atla)
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');

      if (values.length >= 7 && values[1]?.trim()) {
        const fullName = values[3]?.trim() || '';
        const nameParts = fullName.split(' ');
        const soyad = nameParts[nameParts.length - 1];
        const ad = nameParts.slice(0, -1).join(' ');

        data.push({
          sicil: values[1].trim(),
          ad: ad,
          soyad: soyad,
          rutbe: values[4]?.trim() || '',
          tc: values[2]?.trim() || '',
          dogumTarihi: values[5]?.trim() || '',
          telefon: values[6]?.trim() || ''
        });
      }
    }

    // Cache'i güncelle
    personnelCache = data;
    lastCacheTime = now;

    console.log(`✅ Google Sheets'ten ${data.length} personel çekildi ve cache'lendi`);
    return data;
  } catch (error) {
    console.error('❌ Google Sheets okuma hatası:', error);

    // Hata durumunda eski cache'i dön
    if (personnelCache.length > 0) {
      console.warn('⚠️ Eski cache verisi kullanılıyor');
      return personnelCache;
    }

    throw error;
  }
}

// --- PERSONNEL SERVICES ---

export const getPersonnelBySicil = async (sicil: string): Promise<Personnel | undefined> => {
  try {
    // Google Sheets'ten tüm personeli çek (cache'lenmiş)
    const allPersonnel = await fetchPersonnelFromSheets();

    // Sicil numarasına göre ara
    const person = allPersonnel.find(p => p.sicil === sicil);

    if (person) {
      console.log(`✅ Personel bulundu: ${person.ad} ${person.soyad} (${person.rutbe})`);
      return person;
    }

    console.warn(`⚠️ Sicil ${sicil} Google Sheets'te bulunamadı`);
    return undefined;
  } catch (error) {
    console.error('🔥 Personel arama hatası:', error);

    // Hata durumunda Firebase'i dene
    console.log('🔄 Firebase deneniyor...');
    if (database) {
      try {
        const personnelRef = ref(database, `personnel/${sicil}`);
        const snapshot = await get(personnelRef);

        if (snapshot.exists()) {
          console.log('✅ Firebase\'den veri bulundu');
          return snapshot.val() as Personnel;
        }
      } catch (fbError) {
        console.error('❌ Firebase hatası:', fbError);
      }
    }

    // Son çare: mock veri
    const person = MOCK_DATABASE.find(p => p.sicil === sicil);
    if (person) {
      console.log('✅ Mock veriden bulundu');
    }
    return person;
  }
};

export const getExcelBlob = (data: Personnel[]): Blob => {
  const headers = ['Sıra', 'Ad Soyad', 'Rütbe', 'T.C. Kimlik No', 'Doğum Tarihi', 'Telefon'];

  let tableContent = '<table><thead><tr>';
  headers.forEach(h => tableContent += `<th>${h}</th>`);
  tableContent += '</tr></thead><tbody>';

  data.forEach((p, index) => {
    tableContent += '<tr>';
    tableContent += `<td>${index + 1}</td>`;
    tableContent += `<td>${p.ad} ${p.soyad}</td>`;
    tableContent += `<td>${p.rutbe}</td>`;
    tableContent += `<td>${p.tc}</td>`;
    tableContent += `<td>${p.dogumTarihi}</td>`;
    tableContent += `<td>${p.telefon}</td>`;
    tableContent += '</tr>';
  });
  tableContent += '</tbody></table>';

  return new Blob([
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Personel Listesi</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--><meta charset="utf-8"></head><body>'
    + tableContent +
    '</body></html>'
  ], { type: 'application/vnd.ms-excel' });
};

export const downloadAsExcel = (data: Personnel[], eventName: string) => {
  const blob = getExcelBlob(data);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${eventName} Listesi.xls`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};

export const formatForWhatsApp = (data: Personnel[], eventName: string, dateStr?: string): string => {
  const dateDisplay = dateStr || new Date().toLocaleString('tr-TR');

  let text = `*👮 GÖREV LİSTESİ*\n`;
  text += `*Müsabaka:* ${eventName}\n`;
  text += `*Tarih/Saat:* ${dateDisplay}\n`;
  text += `----------------------------\n`;

  data.forEach((p, index) => {
    text += `${index + 1}. ${p.rutbe} ${p.ad} ${p.soyad}\n`;
  });

  text += `\n*Toplam Personel:* ${data.length}`;
  return encodeURIComponent(text);
};

// --- HISTORY SERVICES ---

export const saveCompletedEvent = async (eventData: CompletedEvent): Promise<boolean> => {
  // Memory'ye ekle
  MOCK_HISTORY.unshift(eventData);

  // Firebase'e kaydet
  if (database) {
    try {
      const eventRef = ref(database, `history/${eventData.id}`);
      await set(eventRef, eventData);
      console.log(`✅ Etkinlik Firebase'e kaydedildi: ${eventData.eventName}`);
      return true;
    } catch (error) {
      console.error('❌ Firebase kaydetme hatası:', error);
      return false;
    }
  }

  return true;
};

export const deleteEvent = async (eventId: string): Promise<boolean> => {
  // Memory'den sil
  const index = MOCK_HISTORY.findIndex(event => event.id === eventId);
  if (index !== -1) {
    MOCK_HISTORY.splice(index, 1);
  }

  // Firebase'den sil
  if (database) {
    try {
      const eventRef = ref(database, `history/${eventId}`);
      await set(eventRef, null); // null = delete
      console.log(`✅ Etkinlik Firebase'den silindi: ${eventId}`);
      return true;
    } catch (error) {
      console.error('❌ Firebase silme hatası:', error);
      return false;
    }
  }

  console.warn(`⚠️ Etkinlik bulunamadı: ${eventId}`);
  return false;
};

export const getHistory = async (): Promise<CompletedEvent[]> => {
  // Firebase'den çek
  if (database) {
    try {
      const historyRef = ref(database, 'history');
      const snapshot = await get(historyRef);

      if (snapshot.exists()) {
        const historyData = snapshot.val();
        const events: CompletedEvent[] = Object.values(historyData);

        // Tarihe göre sırala (en yeni önce)
        events.sort((a, b) => {
          const dateA = new Date(a.date.split(' ')[0].split('.').reverse().join('-'));
          const dateB = new Date(b.date.split(' ')[0].split('.').reverse().join('-'));
          return dateB.getTime() - dateA.getTime();
        });

        // Memory'yi de güncelle
        MOCK_HISTORY.length = 0;
        MOCK_HISTORY.push(...events);

        console.log(`✅ Firebase'den ${events.length} etkinlik yüklendi`);
        return events;
      }

      console.log('ℹ️ Firebase\'de henüz etkinlik yok');
      return [];
    } catch (error) {
      console.error('❌ Firebase okuma hatası:', error);
      // Hata durumunda memory'deki veriyi dön
      return [...MOCK_HISTORY];
    }
  }

  // Firebase yoksa memory'den dön
  return [...MOCK_HISTORY];
};

export const getPersonnelStatistics = async (): Promise<{ personnel: Personnel, count: number }[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const stats: Record<string, { count: number, personnel: Personnel }> = {};

      MOCK_HISTORY.forEach(event => {
        event.personnel.forEach(p => {
          if (!stats[p.sicil]) {
            stats[p.sicil] = { count: 0, personnel: p };
          }
          stats[p.sicil].count++;
        });
      });

      const result = Object.values(stats).sort((a, b) => b.count - a.count);
      resolve(result);
    }, 300);
  });
};

// --- AUTH SERVICES ---

// --- AUTH SERVICES ---

export const getAllUsers = async (): Promise<User[]> => {
  if (database) {
    try {
      const usersRef = ref(database, 'users');
      const snapshot = await get(usersRef);

      if (snapshot.exists()) {
        const usersData = snapshot.val();
        return Object.values(usersData);
      }
      return [];
    } catch (error) {
      console.error('❌ Kullanıcı listesi alma hatası:', error);
      return [...MOCK_USERS];
    }
  }
  return [...MOCK_USERS];
};

export const deleteUser = async (username: string): Promise<boolean> => {
  // Memory'den sil
  const index = MOCK_USERS.findIndex(u => u.username === username);
  if (index !== -1) {
    MOCK_USERS.splice(index, 1);
  }

  // Firebase'den sil
  if (database) {
    try {
      const userRef = ref(database, `users/${username}`);
      await set(userRef, null);
      console.log(`✅ Kullanıcı silindi: ${username}`);
      return true;
    } catch (error) {
      console.error('❌ Kullanıcı silme hatası:', error);
      return false;
    }
  }
  return true;
};

export const loginUser = async (username: string, password: string): Promise<User | null> => {
  // Önce Firebase'den kontrol et
  if (database) {
    try {
      const userRef = ref(database, `users/${username}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const user = snapshot.val() as User;
        if (user.password === password) {
          return user;
        }
      }
    } catch (error) {
      console.error('❌ Firebase login hatası:', error);
    }
  }

  // Fallback to mock
  return new Promise((resolve) => {
    setTimeout(() => {
      const user = MOCK_USERS.find(u => u.username === username && u.password === password);
      resolve(user || null);
    }, 500);
  });
};

export const createNewUser = async (newUser: User): Promise<boolean> => {
  // Memory'ye ekle
  if (!MOCK_USERS.some(u => u.username === newUser.username)) {
    MOCK_USERS.push(newUser);
  }

  // Firebase'e kaydet
  if (database) {
    try {
      // Username key olarak kullanılıyor
      const userRef = ref(database, `users/${newUser.username}`);

      // Önce var mı kontrol et
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        return false; // Kullanıcı zaten var
      }

      await set(userRef, newUser);
      console.log(`✅ Yeni kullanıcı oluşturuldu: ${newUser.username}`);
      return true;
    } catch (error) {
      console.error('❌ Kullanıcı oluşturma hatası:', error);
      return false;
    }
  }

  return true;
};

// --- STATISTICS SERVICES ---

export const getPersonnelEventHistory = async (sicil: string): Promise<CompletedEvent[]> => {
  const allHistory = await getHistory();
  return allHistory.filter(event =>
    event.personnel.some(p => p.sicil === sicil)
  );
};
import { Personnel, User, UserRole, CompletedEvent } from '../types';
import { database } from './firebase';
import { ref, get } from 'firebase/database';

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

// --- PERSONNEL SERVICES ---

export const getPersonnelBySicil = async (sicil: string): Promise<Personnel | undefined> => {
  // Önce Firebase'den dene
  if (database) {
    try {
      const personnelRef = ref(database, `personnel/${sicil}`);
      const snapshot = await get(personnelRef);

      if (snapshot.exists()) {
        return snapshot.val() as Personnel;
      }
    } catch (error) {
      console.warn('Firebase okuma hatası, mock veriye geçiliyor:', error);
    }
  }

  // Firebase başarısız olursa veya bulunamazsa mock veriden dene
  return new Promise((resolve) => {
    setTimeout(() => {
      const person = MOCK_DATABASE.find(p => p.sicil === sicil);
      resolve(person);
    }, 200);
  });
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

export const saveCompletedEvent = (eventData: CompletedEvent) => {
  MOCK_HISTORY.unshift(eventData); // Add to beginning
};

export const getHistory = async (): Promise<CompletedEvent[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve([...MOCK_HISTORY]);
    }, 300);
  });
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

export const loginUser = async (username: string, password: string): Promise<User | null> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const user = MOCK_USERS.find(u => u.username === username && u.password === password);
      resolve(user || null);
    }, 500);
  });
};

export const createNewUser = async (newUser: User): Promise<boolean> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (MOCK_USERS.some(u => u.username === newUser.username)) {
        resolve(false); // User exists
      } else {
        MOCK_USERS.push(newUser);
        resolve(true);
      }
    }, 500);
  });
};
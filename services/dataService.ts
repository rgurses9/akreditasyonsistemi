import { Personnel, User, UserRole, CompletedEvent } from '../types';

// --- MOCK DATABASE (Personnel) ---
const MOCK_DATABASE: Personnel[] = [
  { sicil: "12345", ad: "Ahmet", soyad: "Yılmaz", rutbe: "Polis Memuru", tc: "12345678901", dogumTarihi: "15.05.1990", telefon: "0555 111 22 33" },
  { sicil: "12346", ad: "Mehmet", soyad: "Demir", rutbe: "Başpolis", tc: "23456789012", dogumTarihi: "20.10.1985", telefon: "0555 222 33 44" },
  { sicil: "12347", ad: "Ayşe", soyad: "Kaya", rutbe: "Komiser Yardımcısı", tc: "34567890123", dogumTarihi: "05.03.1992", telefon: "0555 333 44 55" },
  { sicil: "12348", ad: "Fatma", soyad: "Çelik", rutbe: "Polis Memuru", tc: "45678901234", dogumTarihi: "12.12.1995", telefon: "0555 444 55 66" },
  { sicil: "12349", ad: "Mustafa", soyad: "Şahin", rutbe: "Bekçi", tc: "56789012345", dogumTarihi: "01.01.1998", telefon: "0555 555 66 77" },
  { sicil: "11111", ad: "Ali", soyad: "Öztürk", rutbe: "Emniyet Müdürü", tc: "67890123456", dogumTarihi: "10.09.1975", telefon: "0555 666 77 88" },
  { sicil: "22222", ad: "Zeynep", soyad: "Arslan", rutbe: "Polis Memuru", tc: "78901234567", dogumTarihi: "25.06.1993", telefon: "0555 777 88 99" },
];

// --- MOCK DATABASE (Users) ---
const MOCK_USERS: User[] = [
  { username: 'admin', password: '123', role: UserRole.ADMIN, fullName: 'Sistem Yöneticisi' },
  { username: 'user', password: '123', role: UserRole.USER, fullName: 'Personel Kullanıcısı' }
];

// --- MOCK DATABASE (History) ---
// In a real app, this would be in a database.
const MOCK_HISTORY: CompletedEvent[] = [
  {
    id: '1',
    date: '06.02.2024 14:30',
    eventName: 'Geçmiş Derbi Maçı',
    personnel: [MOCK_DATABASE[0], MOCK_DATABASE[1]]
  }
];

// --- PERSONNEL SERVICES ---

export const getPersonnelBySicil = async (sicil: string): Promise<Personnel | undefined> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const person = MOCK_DATABASE.find(p => p.sicil === sicil);
      resolve(person);
    }, 200); // Faster response for auto-add feel
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
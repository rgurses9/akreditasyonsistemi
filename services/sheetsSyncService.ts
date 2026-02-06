/**
 * Google Sheets - Firebase Senkronizasyon Servisi
 * 
 * Bu servis, Google Sheets'teki personel verilerini periyodik olarak kontrol eder
 * ve değişiklikleri Firebase'e aktarır.
 */

import { ref, set, get } from 'firebase/database';
import { database } from './firebase';

// Google Sheets bilgileri
const SHEET_ID = '1J6SFLRCGk2-iBzi7TTjthyNzN4dWHH8A';
const SHEET_GID = '1490010137';
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

interface SheetPersonnel {
    SN: string;
    SİCİLİ: string;
    TC_KİMLİK: string;
    ADI: string;
    RÜTBESİ: string;
    DOGUM_TARİHİ: string;
    CEP_TEL: string;
}

interface Personnel {
    sicil: string;
    ad: string;
    soyad: string;
    rutbe: string;
    tc: string;
    dogumTarihi: string;
    telefon: string;
}

/**
 * CSV verisini parse eder
 */
function parseCSV(csvText: string): SheetPersonnel[] {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',');

    const data: SheetPersonnel[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length >= 7) {
            data.push({
                SN: values[0]?.trim() || '',
                SİCİLİ: values[1]?.trim() || '',
                TC_KİMLİK: values[2]?.trim() || '',
                ADI: values[3]?.trim() || '',
                RÜTBESİ: values[4]?.trim() || '',
                DOGUM_TARİHİ: values[5]?.trim() || '',
                CEP_TEL: values[6]?.trim() || '',
            });
        }
    }

    return data;
}

/**
 * Google Sheets formatını Personnel formatına dönüştürür
 */
function convertToPersonnel(sheetData: SheetPersonnel): Personnel {
    const fullName = sheetData.ADI.trim();
    const nameParts = fullName.split(' ');

    // Son kelime soyad, geri kalanı ad
    const soyad = nameParts[nameParts.length - 1];
    const ad = nameParts.slice(0, -1).join(' ');

    return {
        sicil: sheetData.SİCİLİ,
        ad: ad,
        soyad: soyad,
        rutbe: sheetData.RÜTBESİ,
        tc: sheetData.TC_KİMLİK,
        dogumTarihi: sheetData.DOGUM_TARİHİ,
        telefon: sheetData.CEP_TEL
    };
}

/**
 * Google Sheets'ten personel verilerini çeker
 */
export async function fetchPersonnelFromSheets(): Promise<Personnel[]> {
    try {
        const response = await fetch(SHEET_CSV_URL);

        if (!response.ok) {
            throw new Error(`Google Sheets'e erişilemiyor: ${response.status}`);
        }

        const csvText = await response.text();
        const sheetData = parseCSV(csvText);

        // Verileri dönüştür
        const personnelList = sheetData
            .filter(item => item.SİCİLİ && item.SİCİLİ.length > 0)
            .map(item => convertToPersonnel(item));

        return personnelList;
    } catch (error) {
        console.error('Google Sheets veri çekme hatası:', error);
        throw error;
    }
}

/**
 * Firebase'deki mevcut personel verilerini getirir
 */
export async function getFirebasePersonnel(): Promise<Record<string, Personnel>> {
    if (!database) {
        throw new Error('Firebase database başlatılamadı');
    }

    try {
        const personnelRef = ref(database, 'personnel');
        const snapshot = await get(personnelRef);

        if (snapshot.exists()) {
            return snapshot.val();
        }

        return {};
    } catch (error) {
        console.error('Firebase okuma hatası:', error);
        throw error;
    }
}

/**
 * İki personel listesini karşılaştırır ve farkları bulur
 */
export function comparePersonnelLists(
    sheetList: Personnel[],
    firebaseData: Record<string, Personnel>
): {
    added: Personnel[];
    updated: Personnel[];
    removed: string[];
    unchanged: number;
} {
    const sheetMap = new Map(sheetList.map(p => [p.sicil, p]));
    const firebaseMap = new Map(Object.entries(firebaseData));

    const added: Personnel[] = [];
    const updated: Personnel[] = [];
    const removed: string[] = [];
    let unchanged = 0;

    // Yeni veya güncellenmiş kayıtları bul
    for (const [sicil, sheetPerson] of sheetMap) {
        const firebasePerson = firebaseMap.get(sicil);

        if (!firebasePerson) {
            // Yeni kayıt
            added.push(sheetPerson);
        } else {
            // Değişiklik var mı kontrol et
            const hasChanges =
                firebasePerson.ad !== sheetPerson.ad ||
                firebasePerson.soyad !== sheetPerson.soyad ||
                firebasePerson.rutbe !== sheetPerson.rutbe ||
                firebasePerson.tc !== sheetPerson.tc ||
                firebasePerson.dogumTarihi !== sheetPerson.dogumTarihi ||
                firebasePerson.telefon !== sheetPerson.telefon;

            if (hasChanges) {
                updated.push(sheetPerson);
            } else {
                unchanged++;
            }
        }
    }

    // Silinen kayıtları bul
    for (const [sicil] of firebaseMap) {
        if (!sheetMap.has(sicil)) {
            removed.push(sicil);
        }
    }

    return { added, updated, removed, unchanged };
}

/**
 * Firebase'i Google Sheets verisi ile senkronize eder
 */
export async function syncPersonnelToFirebase(): Promise<{
    success: boolean;
    message: string;
    stats: {
        total: number;
        added: number;
        updated: number;
        removed: number;
        unchanged: number;
    };
}> {
    if (!database) {
        return {
            success: false,
            message: 'Firebase database başlatılamadı',
            stats: { total: 0, added: 0, updated: 0, removed: 0, unchanged: 0 }
        };
    }

    try {
        // Google Sheets'ten veri çek
        console.log('📥 Google Sheets\'ten veriler çekiliyor...');
        const sheetPersonnel = await fetchPersonnelFromSheets();

        // Firebase'deki mevcut veriyi al
        console.log('📥 Firebase\'deki mevcut veriler alınıyor...');
        const firebasePersonnel = await getFirebasePersonnel();

        // Karşılaştır
        console.log('🔍 Veriler karşılaştırılıyor...');
        const diff = comparePersonnelLists(sheetPersonnel, firebasePersonnel);

        // Değişiklik yoksa çık
        if (diff.added.length === 0 && diff.updated.length === 0 && diff.removed.length === 0) {
            return {
                success: true,
                message: 'Değişiklik yok, Firebase güncel',
                stats: {
                    total: sheetPersonnel.length,
                    added: 0,
                    updated: 0,
                    removed: 0,
                    unchanged: diff.unchanged
                }
            };
        }

        // Firebase'i güncelle
        console.log('📤 Firebase güncelleniyor...');
        const personnelRef = ref(database, 'personnel');

        // Yeni veriyi hazırla
        const newData: Record<string, Personnel> = {};
        sheetPersonnel.forEach(person => {
            newData[person.sicil] = person;
        });

        // Firebase'e yaz
        await set(personnelRef, newData);

        const message = `✅ Senkronizasyon başarılı! 
Yeni: ${diff.added.length}, 
Güncellenen: ${diff.updated.length}, 
Silinen: ${diff.removed.length}, 
Değişmeyen: ${diff.unchanged}`;

        console.log(message);

        return {
            success: true,
            message: message,
            stats: {
                total: sheetPersonnel.length,
                added: diff.added.length,
                updated: diff.updated.length,
                removed: diff.removed.length,
                unchanged: diff.unchanged
            }
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Bilinmeyen hata';
        console.error('❌ Senkronizasyon hatası:', errorMessage);

        return {
            success: false,
            message: `Senkronizasyon hatası: ${errorMessage}`,
            stats: { total: 0, added: 0, updated: 0, removed: 0, unchanged: 0 }
        };
    }
}

/**
 * Son senkronizasyon zamanını localStorage'a kaydeder
 */
export function saveLastSyncTime(): void {
    localStorage.setItem('lastPersonnelSync', new Date().toISOString());
}

/**
 * Son senkronizasyon zamanını getirir
 */
export function getLastSyncTime(): Date | null {
    const lastSync = localStorage.getItem('lastPersonnelSync');
    return lastSync ? new Date(lastSync) : null;
}

/**
 * Senkronizasyon gerekli mi kontrol eder (1 saat aralık)
 */
export function shouldSync(intervalMinutes: number = 60): boolean {
    const lastSync = getLastSyncTime();

    if (!lastSync) {
        return true;
    }

    const now = new Date();
    const diffMinutes = (now.getTime() - lastSync.getTime()) / (1000 * 60);

    return diffMinutes >= intervalMinutes;
}

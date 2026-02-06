/**
 * Firebase'e Personel Verisi Yükleme Script'i
 * 
 * Bu script, personnel_data.json dosyasındaki personel verilerini
 * Firebase Realtime Database'e yükler.
 */

import { ref, set } from 'firebase/database';
import { database } from './firebase';
import personnelData from '../personnel_data.json';

/**
 * Google Sheets formatındaki veriyi Personnel formatına dönüştürür
 */
function convertToPersonnel(sheetData: any) {
    // İsmi ad ve soyad olarak ayır
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
 * Tüm personel verilerini Firebase'e yükler
 */
export async function uploadPersonnelToFirebase() {
    if (!database) {
        console.error('Firebase Database başlatılamadı!');
        return false;
    }

    try {
        const personnelRef = ref(database, 'personnel');

        // Verileri dönüştür
        const convertedData: Record<string, any> = {};
        personnelData.forEach((person: any) => {
            const converted = convertToPersonnel(person);
            // Sicil numarasını key olarak kullan
            convertedData[converted.sicil] = converted;
        });

        // Firebase'e yükle
        await set(personnelRef, convertedData);

        console.log(`✅ ${personnelData.length} personel başarıyla Firebase'e yüklendi!`);
        console.log('📊 Örnek veri:', convertedData[Object.keys(convertedData)[0]]);

        return true;
    } catch (error) {
        console.error('❌ Firebase yükleme hatası:', error);
        return false;
    }
}

/**
 * Tek bir personeli Firebase'den sicil numarasına göre getirir
 */
export async function getPersonnelBySicilFromFirebase(sicil: string) {
    if (!database) {
        console.error('Firebase Database başlatılamadı!');
        return null;
    }

    try {
        const { ref: dbRef, get } = await import('firebase/database');
        const personnelRef = dbRef(database, `personnel/${sicil}`);
        const snapshot = await get(personnelRef);

        if (snapshot.exists()) {
            return snapshot.val();
        } else {
            return null;
        }
    } catch (error) {
        console.error('Firebase okuma hatası:', error);
        return null;
    }
}

// Script doğrudan çalıştırılırsa
if (typeof window !== 'undefined' && (window as any).__uploadPersonnel) {
    uploadPersonnelToFirebase();
}

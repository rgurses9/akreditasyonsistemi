# 📊 Personel Senkroniz Servisi

## Özet

Google Sheets'teki personel verilerini Firebase Realtime Database ile periyodik olarak senkronize eder.

## Kullanım

### 1️⃣ Manuel Senkronizasyon

Projeyi development modda çalıştırın:

```bash
npm run dev
```

Ardından tarayıcıdan `sync-panel.html` sayfasını açın:
```
http://localhost:5173/sync-panel.html
```

"Manuel Senkronizasyon" butonuna tıklayın.

### 2️⃣ Otomatik Senkronizasyon

Aynı sayfada "Otomatik Senkronizasyonu Aç" butonuna basarsanız, her 60 dakikada bir otomatik olarak Google Sheets'ten veri çekilir ve Firebase güncellenir.

## Nasıl Çalışır?

1. **Veri Çekme**: Google Sheets'in CSV export özelliği kullanılır
2. **Karşılaştırma**: Firebase'deki mevcut verilerle karşılaştırılır
3. **Güncelleme**: Yeni veya güncellenmiş personeller Firebase'e kaydedilir

## Veri Yapısı

Google Sheets formatı:
- **SN**: Sıra numarası
- **SİCİLİ**: Sicil numarası (key)
- **TC KİMLİK**: TC Kimlik No
- **ADI**: Ad Soyad (tam)
- **RÜTBESİ**: Rütbe
- **DOĞUM TARİHİ**: Doğum tarihi
- **CEP TEL**: Telefon

Firebase format formatına otomatik dönüştürülür:
```json
{
  "sicil": "286855",
  "ad": "SERHAT",
  "soyad": "KALYONCU",
  "rutbe": "3.SINIF EMNİYET MÜDÜRÜ",
  "tc": "41377548368",
  "dogumTarihi": "18.08.1985",
  "telefon": "0 (505) 211 52 02"
}
```

## Dosyalar

- **`services/sheetsSyncService.ts`**: Senkronizasyon mantığı
- **`sync-panel.html`**: Senkronizasyon kontrol paneli
- **`personnel_data.json`**: İlk yükleme için kullanılan veri

## Not

⚠️ `sync-panel.html` dosyasını `file://` protokolüyle açmayın. CORS hatası alırsınız. Mutlaka bir development server üzerinden (örn: `npm run dev`) açın.

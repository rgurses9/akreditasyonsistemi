import { GoogleGenAI } from "@google/genai";
import { Personnel } from "../types";

const createClient = () => {
    // Only initialize if key exists to prevent crashing in environments without keys
    if (!process.env.API_KEY) return null;
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateDutyReport = async (personnelList: Personnel[], eventName: string): Promise<string> => {
  const ai = createClient();
  if (!ai) return "API Anahtarı bulunamadı. Lütfen sistem yöneticinize başvurun.";

  const prompt = `
    Aşağıdaki güvenlik personeli listesi "${eventName}" müsabakası için hazırlanmıştır.
    
    Lütfen bu liste için kısa, resmi ve profesyonel bir "Görev Emri ve Analiz Raporu" oluştur.
    Raporda şunlar olsun:
    1. Toplam personel sayısı ve rütbe dağılımı.
    2. Ekip için motivasyonel bir giriş cümlesi.
    3. Müsabaka güvenliği için genel dikkat edilmesi gereken 3 madde.

    Personel Listesi:
    ${personnelList.map(p => `- ${p.rutbe} ${p.ad} ${p.soyad} (Sicil: ${p.sicil})`).join('\n')}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Rapor oluşturulamadı.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Yapay zeka raporu şu an oluşturulamıyor.";
  }
};
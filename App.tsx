import React, { useState, useEffect, useRef } from 'react';
import { Shield, UserPlus, FileDown, CheckCircle, Users, Activity, FileText, Lock, LogOut, MessageCircle, Trash2, History, ArrowLeft, Share2, Home, Save, BarChart3, UserCog, Send } from 'lucide-react';
import { Personnel, EventData, AppStep, User, UserRole, CompletedEvent } from './types';
import { getPersonnelBySicil, downloadAsExcel, loginUser, formatForWhatsApp, saveCompletedEvent, deleteEvent, getHistory, getExcelBlob, getPersonnelStatistics, createNewUser } from './services/dataService';
import { generateDutyReport } from './services/geminiService';
import './services/firebase'; // Initialize Firebase

export default function App() {
  // State
  const [step, setStep] = useState<AppStep>(AppStep.LOGIN);
  const [eventData, setEventData] = useState<EventData>({ eventName: '', requiredCount: 0 });
  const [addedPersonnel, setAddedPersonnel] = useState<Personnel[]>([]);
  const [currentSicil, setCurrentSicil] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [geminiReport, setGeminiReport] = useState<string>('');
  const [generatingReport, setGeneratingReport] = useState(false);
  const [pastEvents, setPastEvents] = useState<CompletedEvent[]>([]);
  const [stats, setStats] = useState<{ personnel: Personnel, count: number }[]>([]);

  // User Creation State
  const [newUserData, setNewUserData] = useState<User>({ username: '', password: '', fullName: '', role: UserRole.USER });
  const [createUserStatus, setCreateUserStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authInput, setAuthInput] = useState({ username: '', password: '', fullName: '', role: UserRole.USER });
  const [authError, setAuthError] = useState('');

  // Refs for focus management
  const sicilInputRef = useRef<HTMLInputElement>(null);

  // Effects
  useEffect(() => {
    if (step === AppStep.ENTRY && sicilInputRef.current) {
      sicilInputRef.current.focus();
    }
  }, [step, addedPersonnel]);

  // Handlers
  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (eventData.eventName && eventData.requiredCount > 0) {
      // Set creation date with time
      setEventData(prev => ({ ...prev, creationDate: new Date().toLocaleString('tr-TR') }));
      setStep(AppStep.ENTRY);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');

    const user = await loginUser(authInput.username, authInput.password);
    if (user) {
      setCurrentUser(user);
      setStep(AppStep.SETUP);
    } else {
      setAuthError('Kullanıcı adı veya şifre hatalı.');
    }

    setLoading(false);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setStep(AppStep.LOGIN);
    setAddedPersonnel([]);
    setEventData({ eventName: '', requiredCount: 0 });
    setGeminiReport('');
    setAuthInput({ username: '', password: '', fullName: '', role: UserRole.USER });
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserData.username || !newUserData.password || !newUserData.fullName) return;

    const success = await createNewUser(newUserData);
    if (success) {
      setCreateUserStatus('success');
      setNewUserData({ username: '', password: '', fullName: '', role: UserRole.USER });
      setTimeout(() => setCreateUserStatus('idle'), 3000);
    } else {
      setCreateUserStatus('error');
    }
  };

  const handleSicilSearch = async (val: string) => {
    setCurrentSicil(val);
    setError('');

    // Auto-add logic: if length is sufficient, try to find and add immediately
    if (val.length >= 5) {
      setLoading(true);
      const person = await getPersonnelBySicil(val);
      setLoading(false);

      if (person) {
        // Check duplicate
        if (addedPersonnel.some(p => p.sicil === person.sicil)) {
          setError('Bu personel zaten ekli.');
        } else {
          // AUTO ADD
          const newList = [...addedPersonnel, person];
          setAddedPersonnel(newList);
          setCurrentSicil(''); // Clear input

          if (newList.length >= eventData.requiredCount) {
            setStep(AppStep.COMPLETE);
          }
        }
      } else {
        setError('Personel bulunamadı.');
      }
    }
  };

  const removePerson = (sicilToRemove: string) => {
    setAddedPersonnel(addedPersonnel.filter(p => p.sicil !== sicilToRemove));
    if (step === AppStep.COMPLETE) {
      setStep(AppStep.ENTRY);
    }
  };

  const saveToHistory = () => {
    // Save only once
    const now = new Date().toLocaleString('tr-TR');
    const newEvent: CompletedEvent = {
      id: Date.now().toString(),
      date: now,
      eventName: eventData.eventName,
      personnel: [...addedPersonnel]
    };
    saveCompletedEvent(newEvent);
  };

  const handleDownload = () => {
    downloadAsExcel(addedPersonnel, eventData.eventName);
    saveToHistory();
    setStep(AppStep.PASSIVE_LIST);
  };

  const handleSaveOnly = () => {
    saveToHistory();
    setStep(AppStep.PASSIVE_LIST);
  }

  const handleWhatsAppExcelShare = async () => {
    const blob = getExcelBlob(addedPersonnel);
    const file = new File([blob], `${eventData.eventName}_Listesi.xls`, { type: 'application/vnd.ms-excel' });

    // Try Web Share API (Mobile native share)
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: eventData.eventName,
          text: 'Görevli Personel Listesi Excel Dosyası'
        });
      } catch (err) {
        console.log("Share failed", err);
      }
    } else {
      // Fallback for Desktop: Download and alert
      downloadAsExcel(addedPersonnel, eventData.eventName);
      alert('Excel dosyası indirildi. WhatsApp Web üzerinden dosyayı sürükleyip bırakarak gönderebilirsiniz.');
      window.open('https://web.whatsapp.com', '_blank');
    }
  };

  const handleWhatsAppTextShare = () => {
    const text = formatForWhatsApp(addedPersonnel, eventData.eventName, eventData.creationDate);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const handleWhatsAppToAdmin = () => {
    // 1. Download file for the user to attach
    downloadAsExcel(addedPersonnel, eventData.eventName);

    // 2. Open specific chat (No text pre-filled as requested)
    const phoneNumber = "905383819261";

    window.open(`https://wa.me/${phoneNumber}`, '_blank');
  };

  const handleGenerateReport = async () => {
    if (currentUser?.role !== UserRole.ADMIN) return;
    setGeneratingReport(true);
    const report = await generateDutyReport(addedPersonnel, eventData.eventName);
    setGeminiReport(report);
    setGeneratingReport(false);
  };

  const loadHistory = async () => {
    const history = await getHistory();
    setPastEvents(history);
    setStep(AppStep.ADMIN_HISTORY);
  };

  const loadStatistics = async () => {
    const data = await getPersonnelStatistics();
    setStats(data);
    setStep(AppStep.STATISTICS);
  };

  const goBackToMain = () => {
    setStep(AppStep.SETUP);
    setAddedPersonnel([]);
    setEventData({ eventName: '', requiredCount: 0 });
    setGeminiReport('');
  };

  // Render Helpers
  const renderLogin = () => (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-blue-600 p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mb-4">
            <Shield className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white leading-tight">Akreditasyon Kartı<br />Oluşturma Sistemi</h2>
          <p className="text-blue-100 mt-2 text-sm">Güvenli Görevlendirme</p>
        </div>

        <div className="p-8">
          <h3 className="text-xl font-bold text-gray-800 mb-6 text-center">
            Giriş Yap
          </h3>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kullanıcı Adı</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={authInput.username}
                onChange={(e) => setAuthInput({ ...authInput, username: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
              <input
                type="password"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={authInput.password}
                onChange={(e) => setAuthInput({ ...authInput, password: e.target.value })}
              />
            </div>

            {authError && <p className="text-red-500 text-sm text-center">{authError}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg transition-transform active:scale-95 shadow-md flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="animate-pulse">İşleniyor...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  Giriş Yap
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  const renderSetup = () => (
    <div className="max-w-md mx-auto bg-white p-8 rounded-xl shadow-lg border border-gray-100 mt-20 relative">
      <div className="flex justify-center mb-6">
        <div className="bg-blue-100 p-4 rounded-full">
          <Shield className="w-12 h-12 text-blue-600" />
        </div>
      </div>
      <h1 className="text-2xl font-bold text-center text-gray-800 mb-2">Yeni Görev Listesi</h1>
      <p className="text-center text-gray-500 mb-8">Görevli personel listesini oluşturmak için bilgileri giriniz.</p>

      <form onSubmit={handleStart} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Müsabaka İsmi</label>
          <input
            type="text"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            placeholder="Örn: Galatasaray - Fenerbahçe"
            value={eventData.eventName}
            onChange={(e) => setEventData({ ...eventData, eventName: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Görevli Sayısı</label>
          <input
            type="number"
            required
            min="1"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            placeholder="Örn: 50"
            value={eventData.requiredCount || ''}
            onChange={(e) => setEventData({ ...eventData, requiredCount: parseInt(e.target.value) })}
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-transform active:scale-95 shadow-md flex items-center justify-center gap-2"
        >
          Listeyi Başlat <Users className="w-5 h-5" />
        </button>
      </form>

      {currentUser?.role === UserRole.ADMIN && (
        <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={loadHistory}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <History className="w-4 h-4" />
            Geçmiş
          </button>
          <button
            onClick={loadStatistics}
            className="bg-gray-100 hover:bg-gray-200 text-purple-700 font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <BarChart3 className="w-4 h-4" />
            İstatistikler
          </button>
          <button
            onClick={() => setStep(AppStep.USER_CREATION)}
            className="col-span-1 md:col-span-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm border border-slate-200"
          >
            <UserCog className="w-4 h-4" />
            Kullanıcı Oluştur
          </button>
        </div>
      )}
    </div>
  );

  const renderEntry = () => (
    <div className="max-w-4xl mx-auto mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Left Column: Input and Card */}
      <div className="space-y-6">
        <div className="bg-white p-6 rounded-xl shadow-md border-l-4 border-blue-600">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <UserPlus className="w-6 h-6 text-blue-600" />
            Personel Ekleme
          </h2>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Sicil No Giriniz</label>
            <input
              ref={sicilInputRef}
              type="text"
              value={currentSicil}
              onChange={(e) => handleSicilSearch(e.target.value)}
              className="w-full text-2xl tracking-widest font-mono p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="12345"
              maxLength={10}
            />
            <div className="h-6 mt-2">
              {loading && <p className="text-sm text-blue-500 animate-pulse">Aranıyor ve Ekleniyor...</p>}
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
            <p>Sicil numarası doğru girildiğinde personel otomatik olarak listeye eklenir.</p>
          </div>
        </div>
      </div>

      {/* Right Column: List Progress */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden flex flex-col h-[500px]">
        <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
          <div>
            <h3 className="font-bold text-gray-700">{eventData.eventName}</h3>
            <p className="text-xs text-gray-500">Personel Listesi</p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-blue-600">{addedPersonnel.length}</span>
            <span className="text-gray-400">/{eventData.requiredCount}</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {addedPersonnel.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <Users className="w-12 h-12 mb-2 opacity-20" />
              <p>Henüz personel eklenmedi.</p>
            </div>
          ) : (
            addedPersonnel.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-lg shadow-sm hover:shadow-md transition-shadow group">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                    {idx + 1}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{p.ad} {p.soyad}</p>
                    <p className="text-xs text-gray-500">{p.sicil}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold bg-gray-100 text-gray-600 px-2 py-1 rounded">
                    {p.rutbe}
                  </span>
                  <button
                    onClick={() => removePerson(p.sicil)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    title="Personeli Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderComplete = () => (
    <div className="max-w-2xl mx-auto mt-20 text-center">
      <div className="bg-white p-10 rounded-2xl shadow-xl border border-green-100">
        <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="w-10 h-10 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Liste Hazır!</h2>
        <p className="text-gray-600 mb-8">
          Hedeflenen <strong>{eventData.requiredCount}</strong> personel sayısına ulaşıldı.
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleSaveOnly}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-bold py-4 rounded-xl shadow-lg transition-transform hover:-translate-y-1 flex items-center justify-center gap-3"
          >
            <Save className="w-6 h-6" />
            Listeyi Sisteme Kaydet (Pasif'e At)
          </button>

          {/* Özel WhatsApp Butonu */}
          <button
            onClick={handleWhatsAppToAdmin}
            className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white text-lg font-bold py-4 rounded-xl shadow-lg transition-transform hover:-translate-y-1 flex items-center justify-center gap-3"
          >
            <Send className="w-6 h-6" />
            0538 381 92 61 WhatsApp Mesaj Gönder
          </button>

          <button
            onClick={handleDownload}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-lg font-bold py-4 rounded-xl shadow-lg transition-transform hover:-translate-y-1 flex items-center justify-center gap-3"
          >
            <FileDown className="w-6 h-6" />
            Excel Olarak İndir ve Kaydet
          </button>

          <button
            onClick={handleWhatsAppExcelShare}
            className="w-full bg-green-600 hover:bg-green-700 text-white text-lg font-bold py-4 rounded-xl shadow-lg transition-transform hover:-translate-y-1 flex items-center justify-center gap-3"
          >
            <Share2 className="w-6 h-6" />
            Genel Paylaş (WhatsApp/Diğer)
          </button>

          <button
            onClick={goBackToMain}
            className="w-full mt-4 bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Home className="w-5 h-5" />
            Ana Ekrana Dön
          </button>
        </div>
      </div>
    </div>
  );

  const renderPassiveList = () => (
    <div className="max-w-5xl mx-auto mt-10">
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 bg-slate-800 text-white flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={goBackToMain}
              className="p-1 hover:bg-slate-700 rounded transition-colors"
              title="Ana Ekrana Dön"
            >
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Activity className="w-6 h-6 text-green-400" />
              Pasif Denetlemeler
            </h2>
          </div>
          <span className="bg-green-500/20 text-green-300 text-xs px-3 py-1 rounded-full border border-green-500/30">
            Kayıtlı Liste
          </span>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-4 mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <h3 className="font-bold text-blue-900">{eventData.eventName} - Özel Güvenlik Şube Listesi</h3>
              <p className="text-sm text-blue-700">
                {eventData.creationDate
                  ? `${eventData.creationDate} tarihinde oluşturuldu.`
                  : `${new Date().toLocaleString('tr-TR')} tarihinde oluşturuldu.`
                }
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleWhatsAppExcelShare}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors"
              >
                <Share2 className="w-4 h-4" /> Excel Paylaş
              </button>

              <button
                onClick={handleWhatsAppTextShare}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-colors"
              >
                <MessageCircle className="w-4 h-4" /> Yazı Paylaş
              </button>

              {currentUser?.role === UserRole.ADMIN && (
                <button
                  onClick={handleGenerateReport}
                  disabled={generatingReport}
                  className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${generatingReport
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                    }`}
                >
                  {generatingReport ? (
                    <>Analiz...</>
                  ) : (
                    <><FileText className="w-4 h-4" /> AI Rapor</>
                  )}
                </button>
              )}
            </div>
          </div>

          {geminiReport && (
            <div className="mb-8 p-6 bg-purple-50 rounded-xl border border-purple-100">
              <h4 className="font-bold text-purple-900 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
                Görev Analiz Raporu
              </h4>
              <div className="prose prose-sm text-purple-900 whitespace-pre-line">
                {geminiReport}
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-100 text-gray-600 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-3">Sıra</th>
                  <th className="px-6 py-3">Sicil</th>
                  <th className="px-6 py-3">Ad Soyad</th>
                  <th className="px-6 py-3">Rütbe</th>
                  <th className="px-6 py-3">Telefon</th>
                  <th className="px-6 py-3">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {addedPersonnel.map((p, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{idx + 1}</td>
                    <td className="px-6 py-3 text-gray-500">{p.sicil}</td>
                    <td className="px-6 py-3 font-semibold text-gray-800">{p.ad} {p.soyad}</td>
                    <td className="px-6 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${p.rutbe.includes('Müdür') ? 'bg-red-100 text-red-800' :
                        p.rutbe.includes('Komiser') ? 'bg-orange-100 text-orange-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                        {p.rutbe}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-500">{p.telefon}</td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => removePerson(p.sicil)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={goBackToMain}
            className="text-gray-500 hover:text-gray-700 text-sm font-medium"
          >
            Yeni Liste Oluştur
          </button>
        </div>
      </div>
    </div>
  );

  const renderAdminHistory = () => {
    const handleDeleteEvent = async (eventId: string, eventName: string) => {
      if (window.confirm(`"${eventName}" etkinliğini silmek istediğinizden emin misiniz?`)) {
        const success = deleteEvent(eventId);
        if (success) {
          // Liste güncelle
          const updatedHistory = await getHistory();
          setPastEvents(updatedHistory);
        }
      }
    };

    return (
      <div className="max-w-4xl mx-auto mt-10">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => setStep(AppStep.SETUP)}
            className="bg-white p-2 rounded-full shadow hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h2 className="text-2xl font-bold text-gray-800">Geçmiş / Pasif Müsabakalar</h2>
        </div>

        <div className="grid gap-4">
          {pastEvents.length === 0 ? (
            <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500">
              <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p>Henüz kaydedilmiş bir müsabaka yok.</p>
            </div>
          ) : (
            pastEvents.map((event) => (
              <div key={event.id} className="bg-white p-6 rounded-xl shadow border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-blue-900">{event.eventName}</h3>
                    <p className="text-sm text-gray-500">{event.date}</p>
                  </div>
                  <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded font-medium">
                    {event.personnel.length} Personel
                  </span>
                </div>

                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => {
                      setAddedPersonnel(event.personnel);
                      // Pass the historical date
                      setEventData({
                        eventName: event.eventName,
                        requiredCount: event.personnel.length,
                        creationDate: event.date
                      });
                      setStep(AppStep.PASSIVE_LIST);
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
                  >
                    <FileText className="w-4 h-4" /> Detayları Gör
                  </button>

                  <button
                    onClick={() => handleDeleteEvent(event.id, event.eventName)}
                    className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center gap-1 ml-auto"
                  >
                    <Trash2 className="w-4 h-4" /> Sil
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderStatistics = () => (
    <div className="max-w-4xl mx-auto mt-10">
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => setStep(AppStep.SETUP)}
          className="bg-white p-2 rounded-full shadow hover:bg-gray-50 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h2 className="text-2xl font-bold text-gray-800">Personel Görev İstatistikleri</h2>
      </div>

      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 bg-purple-800 text-white">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-purple-300" />
            <div>
              <h3 className="font-bold">Görev Dağılım Analizi</h3>
              <p className="text-xs text-purple-200">Personelin toplam görev alma sayıları</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-3 text-center w-20">Sıra</th>
                <th className="px-6 py-3">Sicil</th>
                <th className="px-6 py-3">Ad Soyad</th>
                <th className="px-6 py-3">Rütbe</th>
                <th className="px-6 py-3 text-right">Toplam Görev</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {stats.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-center">
                    <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${idx === 0 ? 'bg-yellow-100 text-yellow-700' :
                      idx === 1 ? 'bg-gray-200 text-gray-700' :
                        idx === 2 ? 'bg-orange-100 text-orange-700' :
                          'text-gray-500'
                      }`}>
                      {idx + 1}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-500 font-mono">{item.personnel.sicil}</td>
                  <td className="px-6 py-3 font-semibold text-gray-800">{item.personnel.ad} {item.personnel.soyad}</td>
                  <td className="px-6 py-3 text-gray-500">{item.personnel.rutbe}</td>
                  <td className="px-6 py-3 text-right">
                    <span className="bg-purple-100 text-purple-800 font-bold px-3 py-1 rounded-full">
                      {item.count}
                    </span>
                  </td>
                </tr>
              ))}
              {stats.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    Henüz istatistik verisi bulunmuyor.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderUserCreation = () => (
    <div className="min-h-screen flex items-center justify-center px-4 -mt-20">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg overflow-hidden border border-gray-100">
        <div className="bg-slate-800 p-6 flex items-center gap-3">
          <button
            onClick={() => setStep(AppStep.SETUP)}
            className="p-1 hover:bg-slate-700 rounded text-white"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold text-white">Kullanıcı Oluştur</h2>
        </div>

        <div className="p-8">
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ad Soyad</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={newUserData.fullName}
                onChange={(e) => setNewUserData({ ...newUserData, fullName: e.target.value })}
                placeholder="Örn: Ali Veli"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Kullanıcı Adı</label>
              <input
                type="text"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={newUserData.username}
                onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                placeholder="kullanici123"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
              <input
                type="password"
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={newUserData.password}
                onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                placeholder="******"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Yetki Rolü</label>
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                value={newUserData.role}
                onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value as UserRole })}
              >
                <option value={UserRole.USER}>Personel (Standart)</option>
                <option value={UserRole.ADMIN}>Yönetici (Admin)</option>
              </select>
            </div>

            {createUserStatus === 'error' && (
              <p className="text-red-500 text-sm text-center">Kullanıcı zaten mevcut veya bir hata oluştu.</p>
            )}
            {createUserStatus === 'success' && (
              <p className="text-green-600 text-sm text-center font-semibold">Kullanıcı başarıyla oluşturuldu!</p>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-transform active:scale-95 shadow-md flex items-center justify-center gap-2 mt-4"
            >
              <UserPlus className="w-5 h-5" />
              Kaydet
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  if (step === AppStep.LOGIN) return renderLogin();

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <nav className="bg-slate-900 text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-wide">AKREDİTASYON SİSTEMİ</h1>
              <p className="text-xs text-slate-400">Kart Oluşturma & Görev Takip</p>
            </div>
          </div>

          {currentUser && (
            <div className="flex items-center gap-4">
              <div className="text-right hidden md:block">
                <p className="text-sm font-medium">{currentUser.fullName}</p>
                <p className="text-xs text-slate-400 flex justify-end gap-1">
                  {currentUser.role === UserRole.ADMIN ?
                    <span className="text-red-400 font-bold">Yönetici</span> :
                    <span className="text-green-400">Personel</span>
                  }
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="bg-slate-800 hover:bg-slate-700 p-2 rounded-lg transition-colors"
                title="Çıkış Yap"
              >
                <LogOut className="w-5 h-5 text-gray-300" />
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4">
        {step === AppStep.SETUP && renderSetup()}
        {step === AppStep.ENTRY && renderEntry()}
        {step === AppStep.COMPLETE && renderComplete()}
        {step === AppStep.PASSIVE_LIST && renderPassiveList()}
        {step === AppStep.ADMIN_HISTORY && renderAdminHistory()}
        {step === AppStep.STATISTICS && renderStatistics()}
        {step === AppStep.USER_CREATION && renderUserCreation()}
      </main>
    </div>
  );
}
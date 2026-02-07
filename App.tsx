import React, { useState, useEffect, useRef } from 'react';
import { Shield, UserPlus, FileDown, CheckCircle, Users, Activity, FileText, Lock, LogOut, Trash2, History, ArrowLeft, Share2, Home, Save, BarChart3, UserCog, Send, RefreshCw, Eye, EyeOff, Edit, Check, X } from 'lucide-react';
import { Personnel, EventData, AppStep, User, UserRole, CompletedEvent } from './types';
import { getPersonnelBySicil, downloadAsExcel, loginUser, saveCompletedEvent, deleteEvent, getHistory, getExcelBlob, getPersonnelStatistics, createNewUser, getAllUsers, deleteUser, getPersonnelEventHistory, getAllPersonnel, updateUserRole, downloadUsersAsExcel, subscribeToHistory } from './services/dataService';
import './services/firebase'; // Initialize Firebase

export default function App() {
  // State
  const [step, setStep] = useState<AppStep>(AppStep.LOGIN);
  const [eventData, setEventData] = useState<EventData>({ eventName: '', requiredCount: 0 });
  const [addedPersonnel, setAddedPersonnel] = useState<Personnel[]>([]);
  const [currentSicil, setCurrentSicil] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pastEvents, setPastEvents] = useState<CompletedEvent[]>([]);
  const [stats, setStats] = useState<{ personnel: Personnel, count: number }[]>([]);

  // User Creation State
  const [newUserData, setNewUserData] = useState<User>({ username: '', password: '', fullName: '', role: UserRole.USER });
  const [createUserStatus, setCreateUserStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authInput, setAuthInput] = useState({ username: '', password: '', fullName: '', role: UserRole.USER });
  const [authError, setAuthError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // New States
  const [users, setUsers] = useState<User[]>([]);
  const [selectedPersonnel, setSelectedPersonnel] = useState<Personnel | null>(null);
  const [personnelHistory, setPersonnelHistory] = useState<CompletedEvent[]>([]);
  const [allPersonnelData, setAllPersonnelData] = useState<Personnel[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFormData, setEditFormData] = useState({ username: '', password: '', fullName: '' });

  // Refs for focus management
  const sicilInputRef = useRef<HTMLInputElement>(null);

  // Handlers
  const loadInitialData = async (user: User) => {
    setLoading(true);
    try {
      const history = await getHistory();
      setPastEvents(history);

      if (user.role === UserRole.ADMIN) {
        const allUsers = await getAllUsers();
        setUsers(allUsers);
      }
    } catch (e) {
      console.error("Initial data load failed", e);
    }
    setLoading(false);
  };

  // Effects
  useEffect(() => {
    // Restore session
    const savedUser = localStorage.getItem('currentUser');
    const savedEvent = localStorage.getItem('activeEvent');
    const savedPersonnel = localStorage.getItem('addedPersonnel');

    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setCurrentUser(parsedUser);
        setStep(AppStep.SETUP);

        loadInitialData(parsedUser);

        if (savedEvent && savedPersonnel) {
          setEventData(JSON.parse(savedEvent));
          setAddedPersonnel(JSON.parse(savedPersonnel));
          setStep(AppStep.ENTRY);

          // Arama listesini de geri yükle
          getAllPersonnel().then(setAllPersonnelData);
        }
      } catch (e) {
        console.error("Session restore failed", e);
      }
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('currentUser', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('activeEvent');
      localStorage.removeItem('addedPersonnel');
    }
  }, [currentUser]);

  useEffect(() => {
    if (step === AppStep.ENTRY) {
      localStorage.setItem('activeEvent', JSON.stringify(eventData));
      localStorage.setItem('addedPersonnel', JSON.stringify(addedPersonnel));
    } else if (step === AppStep.COMPLETE || step === AppStep.SETUP) {
      localStorage.removeItem('activeEvent');
      localStorage.removeItem('addedPersonnel');
    }
  }, [step, eventData, addedPersonnel]);

  useEffect(() => {
    if (step === AppStep.ENTRY && sicilInputRef.current) {
      sicilInputRef.current.focus();
    }
  }, [step, addedPersonnel]);

  // Real-time history listener - tüm cihazlarda senkronize
  useEffect(() => {
    if (!currentUser) return; // Kullanıcı giriş yapmamışsa listener kurma

    console.log('📡 History için real-time listener başlatılıyor...');
    const unsubscribe = subscribeToHistory((events) => {
      setPastEvents(events);
      console.log(`✅ History güncellendi: ${events.length} etkinlik`);
    });

    // Cleanup: Component unmount olduğunda listener'ı kapat
    return () => {
      console.log('🔌 History listener kapatılıyor...');
      unsubscribe();
    };
  }, [currentUser]); // currentUser değiştiğinde yeniden subscribe et

  // Handlers
  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (eventData.eventName && eventData.requiredCount > 0) {
      // Set creation date with time
      setEventData(prev => ({ ...prev, creationDate: new Date().toLocaleString('tr-TR') }));
      setStep(AppStep.ENTRY);

      // Tüm listeyi çek (dropdown için)
      const allP = await getAllPersonnel();
      setAllPersonnelData(allP);
    }
  };

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setAuthError('');

    const user = await loginUser(authInput.username, authInput.password);
    if (user) {
      setCurrentUser(user);
      setStep(AppStep.SETUP);
      loadInitialData(user);
    } else {
      setAuthError('Kullanıcı adı veya şifre hatalı.');
    }

    setLoading(false);
  };

  // Otomatik giriş kontrolü
  // Otomatik giriş kontrolü - Debounce ile
  useEffect(() => {
    const timer = setTimeout(() => {
      if (authInput.username && authInput.password && !loading) {
        checkAutoLogin(authInput.username, authInput.password);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [authInput.username, authInput.password]);

  const checkAutoLogin = async (username: string, password: string) => {
    if (loading || password.length < 3) return;

    try {
      const user = await loginUser(username, password);
      if (user) {
        // Otomatik giriş başarılı
        setLoading(true); // Görsel geçiş için kısa bir loading
        setCurrentUser(user);
        setStep(AppStep.SETUP);
        loadInitialData(user);
        setAuthError('');
        setLoading(false);
      }
    } catch (e) {
      // Sessiz hata (henüz giriş yapılamadı)
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setStep(AppStep.LOGIN);
    setAddedPersonnel([]);
    setEventData({ eventName: '', requiredCount: 0 });
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

  const selectPersonnel = (person: Personnel) => {
    // Check duplicate
    if (addedPersonnel.some(p => p.sicil === person.sicil)) {
      setError('Bu personel zaten ekli: ' + person.ad + ' ' + person.soyad);
      return;
    }

    // AUTO ADD
    const newList = [...addedPersonnel, person];
    setAddedPersonnel(newList);
    setSearchTerm(''); // Clear input
    setError('');

    if (newList.length >= eventData.requiredCount) {
      setStep(AppStep.COMPLETE);
    }
  };

  const removePerson = (sicilToRemove: string) => {
    setAddedPersonnel(addedPersonnel.filter(p => p.sicil !== sicilToRemove));
    if (step === AppStep.COMPLETE) {
      setStep(AppStep.ENTRY);
    }
  };

  const saveToHistory = async () => {
    // Save only once
    const now = new Date().toLocaleString('tr-TR');
    const newEvent: CompletedEvent = {
      id: Date.now().toString(),
      date: now,
      eventName: eventData.eventName,
      personnel: [...addedPersonnel]
    };
    await saveCompletedEvent(newEvent);
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
    const file = new File([blob], `${eventData.eventName} ÖZEL GÜVENLİK ŞUBE MÜDÜRLÜĞÜ.xls`, { type: 'application/vnd.ms-excel' });

    // Excel'i indir
    downloadAsExcel(addedPersonnel, eventData.eventName);

    // WhatsApp numarasına yönlendir
    const phoneNumber = "905383819261"; // 0538 381 92 61

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
        // Share başarısız olursa da WhatsApp'ı aç
        window.open(`https://wa.me/${phoneNumber}`, '_blank');
      }
    } else {
      // Desktop: Excel'i indir ve WhatsApp Web aç
      alert('Excel dosyası indirildi. WhatsApp üzerinden dosyayı paylaşabilirsiniz.');
      window.open(`https://wa.me/${phoneNumber}`, '_blank');
    }
  };
  const handleWhatsAppToAdmin = async () => {
    // 1. Download file for the user to attach
    downloadAsExcel(addedPersonnel, eventData.eventName);

    // 2. Save to history (Passive List)
    await saveToHistory();
    setStep(AppStep.PASSIVE_LIST);

    // 3. Open specific chat (No text pre-filled as requested)
    const phoneNumber = "905383819261";

    window.open(`https://wa.me/${phoneNumber}`, '_blank');
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

  const loadUsers = async () => {
    const allUsers = await getAllUsers();
    setUsers(allUsers);
    setStep(AppStep.USER_MANAGEMENT);
  };

  const handleDeleteUser = async (username: string) => {
    if (window.confirm(`${username} kullanıcısını silmek istediğinize emin misiniz?`)) {
      await deleteUser(username);
      loadUsers(); // Refresh list
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setEditFormData({
      username: user.username,
      password: user.password,
      fullName: user.fullName || ''
    });
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setEditFormData({ username: '', password: '', fullName: '' });
  };

  const handleUpdateUser = async () => {
    if (!editingUser) return;

    const updatedUser: User = {
      username: editingUser.username, // Username değiştirilemez
      password: editFormData.password,
      fullName: editFormData.fullName,
      role: editingUser.role
    };

    const success = await createNewUser(updatedUser); // createNewUser aslında update de yapar
    if (success) {
      setEditingUser(null);
      setEditFormData({ username: '', password: '', fullName: '' });
      loadUsers(); // Refresh list
    }
  };

  const handleToggleUserRole = async (user: User) => {
    const newRole = user.role === UserRole.ADMIN ? UserRole.USER : UserRole.ADMIN;
    if (window.confirm(`${user.username} kullanıcısının yetkisini '${newRole}' olarak değiştirmek istediğinize emin misiniz?`)) {
      const success = await updateUserRole(user.username, newRole);
      if (success) {
        loadUsers(); // Refresh list
      }
    }
  };

  const handleDownloadUsersExcel = () => {
    downloadUsersAsExcel(users);
  };

  const loadPersonnelDetail = async (personnel: Personnel) => {
    setSelectedPersonnel(personnel);
    const history = await getPersonnelEventHistory(personnel.sicil);
    setPersonnelHistory(history);
    setStep(AppStep.PERSONNEL_DETAIL);
  };

  const goBackToMain = () => {
    setStep(AppStep.SETUP);
    setAddedPersonnel([]);
    setEventData({ eventName: '', requiredCount: 0 });
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
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 placeholder-gray-400"
                placeholder="Kullanıcı adınızı giriniz"
                value={authInput.username}
                onChange={(e) => setAuthInput({ ...authInput, username: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  className="w-full px-4 py-2 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900 placeholder-gray-400"
                  placeholder="Şifrenizi giriniz"
                  value={authInput.password}
                  onChange={(e) => setAuthInput({ ...authInput, password: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {authError && <p className="text-red-500 text-sm text-center">{authError}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg transition-transform active:scale-95 shadow-md flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="text-white animate-pulse">İşleniyor...</span>
              ) : (
                <>
                  <Lock className="w-4 h-4 text-white" />
                  <span className="text-white">Giriş Yap</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  const renderSetup = () => (
    <div className="max-w-md mx-auto bg-white p-6 rounded-xl shadow-lg border border-gray-100 mt-20 relative">
      <div className="flex justify-center mb-6">
        <div className="bg-blue-100 p-3 rounded-full">
          <Shield className="w-10 h-10 text-blue-600" />
        </div>
      </div>
      <h1 className="text-xl font-bold text-center text-gray-800 mb-2">Yeni Görev Listesi</h1>
      <p className="text-center text-gray-500 mb-6 text-sm">Görevli personel listesini oluşturmak için bilgileri giriniz.</p>

      <form onSubmit={handleStart} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Müsabaka İsmi</label>
          <input
            type="text"
            required
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-400"
            placeholder="Müsabaka ismi giriniz"
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
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-gray-900 placeholder-gray-400"
            placeholder="Örn: 50"
            value={eventData.requiredCount || ''}
            onChange={(e) => setEventData({ ...eventData, requiredCount: parseInt(e.target.value) })}
          />
        </div>
        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-transform active:scale-95 shadow-md flex items-center justify-center gap-2"
        >
          <span className="text-white">Listeyi Başlat</span> <Users className="w-5 h-5 text-white" />
        </button>
      </form>

      {
        currentUser?.role === UserRole.ADMIN && (
          <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              onClick={loadHistory}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <History className="w-4 h-4 text-gray-700" />
              <span className="text-gray-700">Geçmiş</span>
            </button>
            <button
              onClick={loadStatistics}
              className="bg-purple-100 hover:bg-purple-200 text-purple-700 font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
            >
              <BarChart3 className="w-4 h-4 text-purple-700" />
              <span className="text-purple-700">İstatistikler</span>
            </button>
            <button
              onClick={loadUsers}
              className="col-span-1 md:col-span-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm border border-slate-200"
            >
              <UserCog className="w-4 h-4 text-slate-700" />
              <span className="text-slate-700">Kullanıcı Yönetimi</span>
            </button>
          </div>
        )
      }
    </div >
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Personel Seç (Ad Soyad)</label>
            <div className="relative">
              <input
                type="text"
                placeholder="İsim arayın..."
                className="w-full text-lg p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
              {searchTerm.length > 0 && (
                <div className="absolute z-10 w-full bg-white border border-gray-200 mt-1 max-h-60 overflow-y-auto rounded-lg shadow-lg">
                  {allPersonnelData
                    .filter(p => !addedPersonnel.some(added => added.sicil === p.sicil))
                    .filter(p =>
                      p.ad.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      p.soyad.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      p.sicil.includes(searchTerm)
                    )
                    .map(p => (
                      <div
                        key={p.sicil}
                        className="p-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 flex justify-between items-center"
                        onClick={() => selectPersonnel(p)}
                      >
                        <div>
                          <div className="font-bold text-gray-800">{p.ad} {p.soyad}</div>
                          <div className="text-xs text-gray-500">{p.sicil}</div>
                        </div>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">{p.rutbe}</span>
                      </div>
                    ))
                  }
                  {allPersonnelData.length > 0 && allPersonnelData.filter(p =>
                    !addedPersonnel.some(added => added.sicil === p.sicil) &&
                    (p.ad.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      p.soyad.toLowerCase().includes(searchTerm.toLowerCase()))
                  ).length === 0 && (
                      <div className="p-3 text-gray-500 text-sm text-center">Sonuç bulunamadı</div>
                    )}
                </div>
              )}
            </div>
            <div className="h-6 mt-2">
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-sm text-blue-800">
            <p>Listeden personeli seçerek ekleyebilirsiniz.</p>
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
    <div className="max-w-2xl mx-auto mt-10 text-center">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-green-100">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Liste Hazır!</h2>
        <p className="text-gray-600 mb-6 text-sm">
          Hedeflenen <strong>{eventData.requiredCount}</strong> personel sayısına ulaşıldı.
        </p>

        <div className="flex flex-col gap-3">
          {/* Özel WhatsApp Butonu */}
          <button
            onClick={handleWhatsAppToAdmin}
            className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white text-base font-bold py-3 rounded-xl shadow-lg transition-transform hover:-translate-y-1 flex items-center justify-center gap-3"
          >
            <Send className="w-5 h-5" />
            0538 381 92 61 WhatsApp Mesaj Gönder
          </button>

          <button
            onClick={handleDownload}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-base font-bold py-3 rounded-xl shadow-lg transition-transform hover:-translate-y-1 flex items-center justify-center gap-3"
          >
            <FileDown className="w-5 h-5" />
            Excel Olarak İndir ve Kaydet
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
            </div>
          </div>

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
                  <span className="bg-green-100 text-green-800 text-[10px] px-2 py-0.5 rounded font-medium">
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
                    <button
                      onClick={() => loadPersonnelDetail(item.personnel)}
                      className="bg-purple-100 text-purple-800 font-bold px-3 py-1 rounded-full hover:bg-purple-200 transition-colors cursor-pointer"
                    >
                      {item.count}
                    </button>
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
        <div className="bg-slate-800 p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setStep(AppStep.SETUP)}
              className="p-1 hover:bg-slate-700 rounded text-white"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold text-white">Kullanıcı Oluştur</h2>
          </div>
          <button
            onClick={loadUsers}
            className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1 rounded text-white transition-colors"
          >
            Listeyi Yönet
          </button>
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
              <p className="text-red-500 text-sm text-center">İşlem sırasında bir hata oluştu. Lütfen tekrar deneyiniz.</p>
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
    </div >
  );

  const renderPersonnelDetail = () => {
    if (!selectedPersonnel) return null;

    return (
      <div className="max-w-4xl mx-auto mt-10">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => setStep(AppStep.STATISTICS)}
            className="bg-white p-2 rounded-full shadow hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h2 className="text-2xl font-bold text-gray-800">Personel Detayları</h2>
        </div>

        {/* Personel Kartı */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left">
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
              <UserCog className="w-10 h-10 text-blue-600" />
            </div>

            <div className="flex-1">
              <h3 className="text-2xl font-bold text-gray-900">{selectedPersonnel.ad} {selectedPersonnel.soyad}</h3>
              <p className="text-gray-500 font-medium">{selectedPersonnel.rutbe}</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="block text-xs text-gray-400 uppercase font-semibold">Sicil</span>
                  <span className="font-mono font-medium text-gray-700">{selectedPersonnel.sicil}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="block text-xs text-gray-400 uppercase font-semibold">T.C.</span>
                  <span className="font-mono font-medium text-gray-700">{selectedPersonnel.tc}</span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg">
                  <span className="block text-xs text-gray-400 uppercase font-semibold">Telefon</span>
                  <span className="font-mono font-medium text-gray-700">{selectedPersonnel.telefon}</span>
                </div>
                <div className="bg-purple-50 p-3 rounded-lg">
                  <span className="block text-xs text-purple-400 uppercase font-semibold">Toplam Görev</span>
                  <span className="font-bold text-purple-700">{personnelHistory.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
          <History className="w-5 h-5 text-purple-600" />
          Görev Geçmişi
        </h3>

        {/* Görev Listesi */}
        <div className="grid gap-4">
          {personnelHistory.length === 0 ? (
            <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500">
              <p>Bu personel henüz hiçbir görevde bulunmamış.</p>
            </div>
          ) : (
            personnelHistory.map((event) => (
              <div key={event.id} className="bg-white p-6 rounded-xl shadow border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800">{event.eventName}</h4>
                      <p className="text-sm text-gray-500">{event.date}</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
                    Tamamlandı
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  const renderUserManagement = () => (
    <div className="max-w-4xl mx-auto mt-10">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setStep(AppStep.SETUP)}
            className="bg-white p-2 rounded-full shadow hover:bg-gray-50 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h2 className="text-2xl font-bold text-gray-800">Kullanıcı Yönetimi Listesi</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCreateUserStatus(createUserStatus === 'idle' ? 'error' : 'idle')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors text-sm font-medium"
          >
            <UserPlus className="w-4 h-4" />
            Yeni Kullanıcı Ekle
          </button>
          <button
            onClick={handleDownloadUsersExcel}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm transition-colors text-sm font-medium"
          >
            <FileDown className="w-4 h-4" />
            Excel indir
          </button>
        </div>
      </div>

      {/* Yeni Kullanıcı Ekle Formu */}
      {createUserStatus !== 'idle' && (
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-600" />
            Yeni Kullanıcı Oluştur
          </h3>

          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kullanıcı Adı</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
                  value={newUserData.username}
                  onChange={(e) => setNewUserData({ ...newUserData, username: e.target.value })}
                  placeholder="Örn: 441288"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Şifre</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
                  value={newUserData.password}
                  onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                  placeholder="Şifre giriniz"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tam Ad</label>
              <input
                type="text"
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
                value={newUserData.fullName}
                onChange={(e) => setNewUserData({ ...newUserData, fullName: e.target.value })}
                placeholder="Ad Soyad"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Yetki Seviyesi</label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-900"
                value={newUserData.role}
                onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value as UserRole })}
              >
                <option value={UserRole.USER}>KULLANICI</option>
                <option value={UserRole.ADMIN}>ADMIN</option>
              </select>
            </div>

            {createUserStatus === 'success' && (
              <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
                ✅ Kullanıcı başarıyla oluşturuldu!
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors"
              >
                Kullanıcı Oluştur
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateUserStatus('idle');
                  setNewUserData({ username: '', password: '', fullName: '', role: UserRole.USER });
                }}
                className="px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium transition-colors"
              >
                İptal
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-100 text-gray-600 uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-3">Kullanıcı Adı</th>
                <th className="px-6 py-3">Tam Ad</th>
                <th className="px-6 py-3">Şifre</th>
                <th className="px-6 py-3">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {users.map((user, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  {editingUser?.username === user.username ? (
                    // Edit Mode
                    <>
                      <td className="px-6 py-4 font-mono text-gray-500">{user.username}</td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={editFormData.fullName}
                          onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900"
                          placeholder="Tam ad"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <input
                          type="text"
                          value={editFormData.password}
                          onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                          className="w-full px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-900"
                          placeholder="Yeni şifre"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={handleUpdateUser}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-full transition-colors"
                            title="Kaydet"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-2 text-gray-500 hover:bg-gray-50 rounded-full transition-colors"
                            title="İptal"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    // View Mode
                    <>
                      <td className="px-6 py-4 font-mono text-gray-700">{user.username}</td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-medium text-gray-900">{user.fullName || '-'}</span>
                          <span className={`mt-1 inline-block px-2 py-0.5 rounded text-xs font-bold w-fit ${user.role === UserRole.ADMIN
                            ? 'bg-red-100 text-red-800'
                            : 'bg-blue-100 text-blue-800'
                            }`}>
                            {user.role}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-gray-500">••••••••</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {user.username !== 'admin' && user.username !== currentUser?.username && (
                            <>
                              <button
                                onClick={() => handleEditUser(user)}
                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                                title="Düzenle"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleToggleUserRole(user)}
                                className="p-2 text-purple-500 hover:bg-purple-50 rounded-full transition-colors"
                                title="Yetkiyi Değiştir"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteUser(user.username)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                title="Kullanıcıyı Sil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
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
        {step === AppStep.USER_MANAGEMENT && renderUserManagement()}
        {step === AppStep.PERSONNEL_DETAIL && renderPersonnelDetail()}
      </main>
    </div>
  );
}
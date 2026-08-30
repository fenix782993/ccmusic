import React, { useState, useEffect } from 'react';
import { 
  Home, Search, Library, Heart, Disc, User, 
  Play, Pause, SkipBack, SkipForward, Volume2, 
  Repeat, Shuffle, Crown, Flame, Shield, PhoneCall, LogOut, Upload, Lock, CheckCircle 
} from 'lucide-react';

export default function App() {
  // Состояние авторизации
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' или 'register'
  
  // Поля формы авторизации
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaCode, setCaptchaCode] = useState('4829'); // Простая статичная капча

  // Данные текущего пользователя
  const [currentUser, setCurrentUser] = useState(null);

  // Навигация и плеер
  const [currentTab, setCurrentTab] = useState('home');
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState({
    title: 'Neon Horizon',
    artist_name: 'CyberPulse',
    cover_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80',
    duration: 214
  });
  
  // Треки из базы данных
  const [tracks, setTracks] = useState([]);
  
  // Админка и загрузка треков
  const [phoneInput, setPhoneInput] = useState('');
  const [selectedTier, setSelectedTier] = useState('premium');
  const [adminStatus, setAdminStatus] = useState('');

  // Форма загрузки трека (доступна всем или админу)
  const [newTrackTitle, setNewTrackTitle] = useState('');
  const [newTrackArtist, setNewTrackArtist] = useState('');
  const [newTrackGenre, setNewTrackGenre] = useState('');
  const [newTrackFile, setNewTrackFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('');

  // Загрузка треков из бэкенда при старте
  useEffect(() => {
    if (isLoggedIn) {
      fetchTracks();
    }
  }, [isLoggedIn]);

  const fetchTracks = () => {
    fetch('http://localhost:5000/api/tracks')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setTracks(data);
        }
      })
      .catch(() => {
        // Запасной вариант, если бэкенд недоступен
        setTracks([
          { id: 1, title: 'Neon Horizon', artist_name: 'CyberPulse', cover_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80', genre: 'Synthwave' }
        ]);
      });
  };

  // Обработка регистрации / входа
  const handleAuthSubmit = (e) => {
    e.preventDefault();
    if (captchaInput !== captchaCode) {
      alert('Неверная капча! Попробуйте снова.');
      return;
    }

    if (!regPhone || !regPassword) {
      alert('Заполните обязательные поля!');
      return;
    }

    // Проверка на админский номер
    const isAdmin = regPhone.trim() === '+79067853860';

    const userData = {
      name: regName || 'Пользователь',
      phone: regPhone,
      subscription_tier: isAdmin ? 'premium_plus' : 'free',
      is_admin: isAdmin
    };

    setCurrentUser(userData);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentUser(null);
    setRegPhone('');
    setRegPassword('');
    setRegName('');
    setCaptchaInput('');
  };

  // Выдача подписки из админки
  const handleGrantSubscription = () => {
    fetch('http://localhost:5000/api/admin/subscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: phoneInput, tier: selectedTier })
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setAdminStatus(`Успешно! Подписка ${selectedTier.toUpperCase()} выдана на номер ${phoneInput}`);
      } else {
        setAdminStatus(`Ошибка: ${data.error || 'Не найдено'}`);
      }
    })
    .catch(() => setAdminStatus('Ошибка подключения к серверу'));
  };

  // Загрузка нового трека в базу данных
  const handleUploadTrack = (e) => {
    e.preventDefault();
    if (!newTrackTitle || !newTrackArtist) {
      setUploadStatus('Заполните название и автора!');
      return;
    }

    const formData = new FormData();
    formData.append('title', newTrackTitle);
    formData.append('artist_name', newTrackArtist);
    formData.append('genre', newTrackGenre);
    if (newTrackFile) {
      formData.append('file', newTrackFile);
    }

    fetch('http://localhost:5000/api/tracks', {
      method: 'POST',
      body: formData
    })
    .then(res => res.json())
    .then(data => {
      setUploadStatus('Трек успешно загружен в базу данных навсегда!');
      setNewTrackTitle('');
      setNewTrackArtist('');
      setNewTrackGenre('');
      setNewTrackFile(null);
      fetchTracks(); // Обновляем список
    })
    .catch(() => {
      // Имитация успешной загрузки для фронтенда
      const mockNewTrack = {
        id: Date.now(),
        title: newTrackTitle,
        artist_name: newTrackArtist,
        genre: newTrackGenre || 'Pop',
        cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80'
      };
      setTracks([mockNewTrack, ...tracks]);
      setUploadStatus('Трек добавлен локально (бэкенд не отвечает)');
      setNewTrackTitle('');
      setNewTrackArtist('');
    });
  };

  // Экран авторизации / регистрации, если юзер не вошел
  if (!isLoggedIn) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e] font-sans text-white p-4">
        <div className="w-full max-w-md bg-white/10 border border-white/20 p-8 rounded-3xl backdrop-blur-xl shadow-2xl space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center mx-auto shadow-lg shadow-violet-500/30">
              <Flame className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-wider bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
              FENIX MUSIC
            </h1>
            <p className="text-xs text-zinc-300">
              {authMode === 'login' ? 'Войдите в свой аккаунт' : 'Создайте новый аккаунт'}
            </p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'register' && (
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Имя</label>
                <input 
                  type="text" 
                  placeholder="Ваше имя" 
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl text-white text-sm outline-none focus:border-violet-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Номер телефона</label>
              <input 
                type="text" 
                placeholder="+7 (999) 000-00-00" 
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl text-white text-sm outline-none focus:border-violet-500"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Пароль</label>
              <input 
                type="password5" 
                placeholder="••••••••" 
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl text-white text-sm outline-none focus:border-violet-500"
              />
            </div>

            {/* Капча */}
            <div className="space-y-1">
              <label className="block text-xs text-zinc-400">Введите капчу: <span className="bg-violet-600/40 px-2 py-0.5 rounded font-mono font-bold tracking-widest text-violet-200">{captchaCode}</span></label>
              <input 
                type="text" 
                placeholder="Введите цифры с картинки" 
                value={captchaInput}
                onChange={(e) => setCaptchaInput(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl text-white text-sm outline-none focus:border-violet-500 font-mono"
              />
            </div>

            <button 
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 font-bold text-sm shadow-lg shadow-violet-600/30 hover:opacity-90 transition"
            >
              {authMode === 'login' ? 'Войти' зарегистироваться='Зарегистрироваться'}
            </button>
          </form>

          <div className="text-center">
            <button 
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              className="text-xs text-violet-400 hover:underline"
            >
              {authMode === 'login' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Основной интерфейс приложения после входа
  return (
    <div className="flex h-screen text-white font-sans overflow-hidden bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e]">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-[#121216]/80 backdrop-blur-xl border-r border-white/10 p-6 justify-between">
        <div>
          <div className="flex items-center gap-3 mb-10">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-black tracking-wider bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
              FENIX MUSIC
            </span>
          </div>

          <nav className="space-y-2">
            <NavItem icon={<Home />} label="Главная" active={currentTab === 'home'} onClick={() => setCurrentTab('home')} />
            <NavItem icon={<Search />} label="Поиск" active={currentTab === 'search'} onClick={() => setCurrentTab('search')} />
            <NavItem icon={<Library />} label="Библиотека" active={currentTab === 'library'} onClick={() => setCurrentTab('library')} />
            <NavItem icon={<Upload />} label="Загрузить трек" active={currentTab === 'upload'} onClick={() => setCurrentTab('upload')} />
            {currentUser.is_admin && (
              <NavItem icon={<Shield />} label="Админка" active={currentTab === 'admin'} onClick={() => setCurrentTab('admin')} />
            )}
          </nav>
        </div>

        <div className="space-y-4">
          <div 
            onClick={() => setCurrentTab('premium')}
            className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 to-purple-500/20 border border-amber-500/30 cursor-pointer hover:border-amber-500/60 transition"
          >
            <div className="flex items-center gap-2 text-amber-400 font-bold mb-1">
              <Crown className="w-5 h-5" /> Fenix {currentUser.subscription_tier.toUpperCase()}
            </div>
            <p className="text-xs text-zinc-300">{currentUser.name}</p>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl font-medium text-sm text-red-400 hover:bg-red-500/10 transition"
          >
            <LogOut className="w-5 h-5" />
            <span>Выйти</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto pb-24">
        <header className="flex justify-between items-center px-8 py-6 sticky top-0 bg-[#0a0a0c]/60 backdrop-blur-md z-10 border-b border-white/10">
          <div className="hidden md:flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full w-96 border border-white/10">
            <Search className="w-4 h-4 text-zinc-300" />
            <input 
              type="text" 
              placeholder="Треки, альбомы, артисты..." 
              className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-zinc-400" 
            />
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setCurrentTab('premium')}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 font-medium text-sm shadow-lg shadow-violet-500/30 hover:opacity-90 transition"
            >
              💎 Подписка
            </button>
            <div className="w-10 h-10 rounded-full bg-violet-800 border border-white/20 overflow-hidden flex items-center justify-center font-bold text-violet-200">
              {currentUser.name ? currentUser.name[0].toUpperCase() : 'FX'}
            </div>
          </div>
        </header>

        <div className="p-8 flex-1">
          {currentTab === 'home' && (
            <div className="space-y-8">
              <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-violet-900/60 via-purple-900/40 to-pink-900/60 border border-white/20 p-8 flex flex-col justify-end min-h-[260px] shadow-2xl">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-2">✨ Аудиостриминг V2 с базой данных</span>
                <h1 className="text-3xl md:text-5xl font-extrabold mb-3">Привет, {currentUser.name}!</h1>
                <p className="text-zinc-200 max-w-xl text-sm mb-6">Слушайте треки, загружайте свои файлы в постоянную базу данных и наслаждайтесь музыкой.</p>
                <button 
                  onClick={() => setIsPlaying(true)}
                  className="flex items-center gap-2 bg-white text-black font-bold px-6 py-3 rounded-full w-fit hover:bg-zinc-200 transition shadow-lg"
                >
                  <Play className="w-5 h-5 fill-current" /> Слушать микс
                </button>
              </div>

              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <Flame className="text-pink-400 w-5 h-5" /> Треки из базы данных навсегда
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tracks.map((track) => (
                    <div 
                      key={track.id} 
                      onClick={() => { setCurrentTrack(track); setIsPlaying(true); }}
                      className="flex items-center gap-4 bg-white/10 p-3 rounded-2xl border border-white/10 hover:bg-white/20 transition cursor-pointer group"
                    >
                      <img src={track.cover_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80'} alt={track.title} className="w-14 h-14 rounded-xl object-cover" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm truncate group-hover:text-violet-300 transition">{track.title}</h4>
                        <p className="text-xs text-zinc-300 truncate">{track.artist_name}</p>
                      </div>
                      <button className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                        <Play className="w-4 h-4 fill-current" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentTab === 'upload' && (
            <div className="max-w-xl mx-auto bg-white/10 border border-white/20 p-8 rounded-3xl space-y-6 backdrop-blur-md">
              <div className="flex items-center gap-3 text-violet-300">
                <Upload className="w-8 h-8" />
                <h2 className="text-2xl font-bold">Загрузка трека в базу данных</h2>
              </div>
              <p className="text-sm text-zinc-300">Загруженный трек сразу попадет в приложение и останется там навсегда.</p>

              <form onSubmit={handleUploadTrack} className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Название трека</label>
                  <input 
                    type="text" 
                    placeholder="Например: Cyber Sunrise" 
                    value={newTrackTitle}
                    onChange={(e) => setNewTrackTitle(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl text-white text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Артист / Исполнитель</label>
                  <input 
                    type="text" 
                    placeholder="Например: CyberPulse" 
                    value={newTrackArtist}
                    onChange={(e) => setNewTrackArtist(e.target.value)}
                    required
                    className="w-full bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl text-white text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Жанр</label>
                  <input 
                    type="text" 
                    placeholder="Synthwave" 
                    value={newTrackGenre}
                    onChange={(e) => setNewTrackGenre(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl text-white text-sm outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Файл трека (MP3)</label>
                  <input 
                    type="file" 
                    accept="audio/*"
                    onChange={(e) => setNewTrackFile(e.target.files[0])}
                    className="w-full bg-white/5 border border-white/10 px-4 py-2 rounded-xl text-white text-sm outline-none file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-violet-600 file:text-white hover:file:bg-violet-500"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 font-bold text-sm shadow-lg shadow-violet-600/30 hover:opacity-90 transition"
                >
                  Загрузить и сохранить в базу
                </button>

                {uploadStatus && (
                  <div className="p-3 rounded-xl bg-violet-900/40 border border-violet-500/30 text-xs text-violet-200 text-center flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>{uploadStatus}</span>
                  </div>
                )}
              </form>
            </div>
          )}

          {currentTab === 'admin' && currentUser.is_admin && (
            <div className="max-w-xl mx-auto bg-white/10 border border-white/20 p-8 rounded-3xl space-y-6 backdrop-blur-md">
              <div className="flex items-center gap-3 text-violet-300">
                <Shield className="w-8 h-8" />
                <h2 className="text-2xl font-bold">Панель администратора</h2>
              </div>
              <p className="text-sm text-zinc-300">Доступ разрешен только для номера <span className="text-amber-400 font-mono">+79067853860</span></p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Номер телефона пользователя</label>
                  <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl">
                    <PhoneCall className="w-4 h-4 text-violet-400" />
                    <input 
                      type="text" 
                      placeholder="+7 (999) 000-00-00" 
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="bg-transparent border-none outline-none text-white w-full text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Уровень подписки</label>
                  <select 
                    value={selectedTier} 
                    onChange={(e) => setSelectedTier(e.target.value)}
                    className="w-full bg-[#121216] border border-white/10 px-4 py-2.5 rounded-xl text-white text-sm outline-none"
                  >
                    <option value="premium">PREMIUM</option>
                    <option value="premium_plus">PREMIUM+</option>
                  </select>
                </div>

                <button 
                  onClick={handleGrantSubscription}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 font-bold text-sm shadow-lg shadow-violet-600/30 hover:opacity-90 transition"
                >
                  Активировать подписку
                </button>

                {adminStatus && (
                  <div className="p-3 rounded-xl bg-violet-900/40 border border-violet-500/30 text-xs text-violet-200 text-center">
                    {adminStatus}
                  </div>
                )}
              </div>
            </div>
          )}

          {currentTab === 'premium' && (
            <div className="max-w-3xl mx-auto space-y-8 text-center py-6">
              <h1 className="text-4xl font-extrabold bg-gradient-to-r from-amber-300 via-purple-300 to-pink-400 bg-clip-text text-transparent">
                Выбери свой уровень Fenix
              </h1>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                <div className="bg-white/10 border border-white/10 p-6 rounded-3xl flex flex-col justify-between backdrop-blur-md">
                  <div>
                    <h3 className="text-lg font-bold mb-2">FREE</h3>
                    <p className="text-2xl font-black mb-4">0 ₽</p>
                    <ul className="text-xs text-zinc-300 space-y-2 mb-6">
                      <li>✓ Базовый каталог</li>
                      <li>✓ Загрузка треков</li>
                    </ul>
                  </div>
                  <button className="w-full py-2.5 rounded-full bg-white/20 font-bold text-sm">Ваш тариф</button>
                </div>
                <div className="bg-gradient-to-b from-violet-600/30 to-transparent border border-violet-500/50 p-6 rounded-3xl flex flex-col justify-between relative backdrop-blur-md">
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-xs px-3 py-1 rounded-full font-bold">ХИТ</span>
                  <div>
                    <h3 className="text-lg font-bold mb-2 text-violet-300">PREMIUM</h3>
                    <p className="text-2xl font-black mb-4">299 ₽ <span className="text-xs text-zinc-400">/мес</span></p>
                    <ul className="text-xs text-zinc-200 space-y-2 mb-6">
                      <li>✓ Без рекламы</li>
                      <li>✓ Высокое качество звука</li>
                      <li>✓ Выдача по номеру телефона</li>
                    </ul>
                  </div>
                  <button className="w-full py-2.5 rounded-full bg-violet-600 font-bold text-sm shadow-lg shadow-violet-600/30">Подключить</button>
                </div>
                <div className="bg-white/10 border border-amber-500/40 p-6 rounded-3xl flex flex-col justify-between backdrop-blur-md">
                  <div>
                    <h3 className="text-lg font-bold mb-2 text-amber-300">PREMIUM+</h3>
                    <p className="text-2xl font-black mb-4">499 ₽ <span className="text-xs text-zinc-400">/мес</span></p>
                    <ul className="text-xs text-zinc-300 space-y-2 mb-6">
                      <li>✓ Hi-Res Lossless звук</li>
                      <li>✓ Расширенная статистика</li>
                      <li>✓ Доступ к Админке (+79067853860)</li>
                    </ul>
                  </div>
                  <button className="w-full py-2.5 rounded-full bg-amber-500 text-black font-bold text-sm">Подключить</button>
                </div>
              </div>
            </div>
          )}

          {currentTab !== 'home' && currentTab !== 'upload' && currentTab !== 'admin' && currentTab !== 'premium' && (
            <div className="flex flex-col items-center justify-center py-20 text-center text-zinc-400">
              <Disc className="w-16 h-16 mb-4 animate-spin opacity-40" />
              <h2 className="text-xl font-bold text-white mb-2">Раздел в разработке</h2>
              <p className="text-sm max-w-sm">Все компоненты архитектуры готовы к интеграции.</p>
            </div>
          )}
        </div>
      </main>

      {/* Persistent Bottom Audio Player */}
      <footer className="fixed bottom-0 left-0 right-0 h-20 bg-[#121216]/90 backdrop-blur-xl border-t border-white/10 px-6 flex items-center justify-between z-30">
        <div className="flex items-center gap-4 w-1/4">
          <img src={currentTrack.cover_url || 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80'} alt="Cover" className="w-12 h-12 rounded-xl object-cover" />
          <div className="min-w-0">
            <h4 className="font-bold text-sm truncate">{currentTrack.title}</h4>
            <p className="text-xs text-zinc-400 truncate">{currentTrack.artist_name}</p>
          </div>
          <Heart className="w-5 h-5 text-zinc-400 hover:text-pink-500 cursor-pointer transition ml-2" />
        </div>

        <div className="flex flex-col items-center gap-2 w-2/4 max-w-md">
          <div className="flex items-center gap-6">
            <Shuffle className="w-4 h-4 text-zinc-400 hover:text-white cursor-pointer" />
            <SkipBack className="w-5 h-5 text-zinc-300 hover:text-white cursor-pointer" />
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current translate-x-0.5" />}
            </button>
            <SkipForward className="w-5 h-5 text-zinc-300 hover:text-white cursor-pointer" />
            <Repeat className="w-4 h-4 text-zinc-400 hover:text-white cursor-pointer" />
          </div>
          <div className="w-full flex items-center gap-3 text-xs text-zinc-400">
            <span>1:20</span>
            <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer">
              <div className="w-1/3 h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full"></div>
            </div>
            <span>{Math.floor(currentTrack.duration / 60)}:{currentTrack.duration % 60 || '34'}</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3 w-1/4 justify-end">
          <Volume2 className="w-5 h-5 text-zinc-400" />
          <div className="w-24 h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer">
            <div className="w-3/4 h-full bg-white rounded-full"></div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-medium text-sm cursor-pointer transition ${
        active 
          ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30 shadow-lg' 
          : 'text-zinc-400 hover:bg-white/10 hover:text-white'
      }`}
    >
      {React.cloneElement(icon, { className: 'w-5 h-5' })}
      <span>{label}</span>
    </div>
  );
}

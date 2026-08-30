import React, { useState, useEffect } from 'react';
import { 
  Home, Search, Library, Heart, 
  Play, Pause, SkipBack, SkipForward, Volume2, 
  Repeat, Shuffle, Crown, Flame, Shield, PhoneCall, LogOut, Upload, CheckCircle, Send,
  Music, User, Clock, Radio, ListMusic, Download, Sparkles
} from 'lucide-react';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaCode, setCaptchaCode] = useState('4829');

  const [currentUser, setCurrentUser] = useState(null);

  const [currentTab, setCurrentTab] = useState('home');
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState('all');
  
  const [currentTrack, setCurrentTrack] = useState({
    title: 'Cyber Pulse',
    artist_name: 'Fenix Sound',
    cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80',
    duration: 200,
    genre: 'Synthwave'
  });

  const [playlist, setPlaylist] = useState([
    { id: 1, title: 'Cyber Pulse', artist_name: 'Fenix Sound', cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80', duration: 200, genre: 'Synthwave' },
    { id: 2, title: 'Night City', artist_name: 'RetroWave', cover_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&auto=format&fit=crop&q=80', duration: 180, genre: 'Electronic' },
    { id: 3, title: 'Neon Horizon', artist_name: 'Stellar', cover_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80', duration: 210, genre: 'Pop' }
  ]);
  
  const [tracks, setTracks] = useState([]);
  const [favorites, setFavorites] = useState([1]);
  const [history, setHistory] = useState([1, 2]);
  
  const [phoneInput, setPhoneInput] = useState('');
  const [selectedTier, setSelectedTier] = useState('premium');
  const [adminStatus, setAdminStatus] = useState('');

  useEffect(() => {
    if (isLoggedIn) {
      fetchTracks();
    }
  }, [isLoggedIn]);

  const fetchTracks = () => {
    fetch('http://localhost:5000/api/tracks')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setTracks(data);
        } else {
          setTracks(playlist);
        }
      })
      .catch(() => {
        setTracks(playlist);
      });
  };

  const handleAuthSubmit = (e) => {
    e.preventDefault();
    if (captchaInput !== captchaCode) {
      alert('Неверная капча!');
      return;
    }

    if (!regPhone || !regPassword) {
      alert('Заполните обязательные поля!');
      return;
    }

    const isAdmin = regPhone.trim() === '+79067853860';

    const userData = {
      name: regName || 'Пользователь',
      phone: regPhone,
      subscription_tier: isAdmin ? 'premium_plus' : 'free',
      is_admin: isAdmin,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80',
      stats: { listenedHours: 42, favoriteCount: 12 }
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

  const toggleFavorite = (trackId, e) => {
    e.stopPropagation();
    if (favorites.includes(trackId)) {
      setFavorites(favorites.filter(id => id !== trackId));
    } else {
      setFavorites([...favorites, trackId]);
    }
  };

  const playTrack = (track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
    if (!history.includes(track.id)) {
      setHistory([track.id, ...history]);
    }
  };

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
        if (currentUser && currentUser.phone === phoneInput) {
          setCurrentUser({ ...currentUser, subscription_tier: selectedTier });
        }
      } else {
        setAdminStatus(`Ошибка: ${data.error || 'Не найдено'}`);
      }
    })
    .catch(() => {
      if (currentUser && currentUser.phone === phoneInput) {
        setCurrentUser({ ...currentUser, subscription_tier: selectedTier });
      }
      setAdminStatus(`Подписка ${selectedTier.toUpperCase()} локально применена для ${phoneInput}`);
    });
  };

  const sourceTracks = tracks.length > 0 ? tracks : playlist;

  const filteredTracks = sourceTracks.filter(track => 
    track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    track.artist_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (track.genre && track.genre.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
                <label className="block text-xs text-zinc-400 mb-1">Ник</label>
                <input 
                  type="text" 
                  placeholder="Ваш ник" 
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
                type="password" 
                placeholder="••••••••" 
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
                className="w-full bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl text-white text-sm outline-none focus:border-violet-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs text-zinc-400">Введите капчу: <span className="bg-violet-600/40 px-2 py-0.5 rounded font-mono font-bold tracking-widest text-violet-200">{captchaCode}</span></label>
              <input 
                type="text" 
                placeholder="Цифры с картинки" 
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
              {authMode === 'login' ? 'Войти' : 'Зарегистрироваться'}
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

  return (
    <div className="flex h-screen text-white font-sans overflow-hidden bg-gradient-to-br from-[#0f0c29] via-[#302b63] to-[#24243e]">
      <aside className="hidden md:flex flex-col w-64 bg-[#121216]/80 backdrop-blur-xl border-r border-white/10 p-6 justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-black tracking-wider bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
              FENIX MUSIC
            </span>
          </div>

          <nav className="space-y-1.5 overflow-y-auto max-h-[calc(100vh-240px)] pr-1 custom-scrollbar">
            <NavItem icon={<Home />} label="Главная" active={currentTab === 'home'} onClick={() => setCurrentTab('home')} />
            <NavItem icon={<Sparkles />} label="Рекомендации" active={currentTab === 'recommendations'} onClick={() => setCurrentTab('recommendations')} />
            <NavItem icon={<Search />} label="Поиск" active={currentTab === 'search'} onClick={() => setCurrentTab('search')} />
            <NavItem icon={<Library />} label="Библиотека" active={currentTab === 'library'} onClick={() => setCurrentTab('library')} />
            <NavItem icon={<Heart />} label="Избранное" active={currentTab === 'favorites'} onClick={() => setCurrentTab('favorites')} />
            <NavItem icon={<Clock />} label="История" active={currentTab === 'history'} onClick={() => setCurrentTab('history')} />
            <NavItem icon={<User />} label="Профиль" active={currentTab === 'profile'} onClick={() => setCurrentTab('profile')} />
            <NavItem icon={<Crown />} label="Подписка" active={currentTab === 'premium'} onClick={() => setCurrentTab('premium')} />
            <NavItem icon={<Upload />} label="Загрузить через бота" active={currentTab === 'upload'} onClick={() => setCurrentTab('upload')} />
            {currentUser.is_admin && (
              <NavItem icon={<Shield />} label="Админка" active={currentTab === 'admin'} onClick={() => setCurrentTab('admin')} />
            )}
          </nav>
        </div>

        <div className="space-y-3 pt-4 border-t border-white/10">
          <div 
            onClick={() => setCurrentTab('premium')}
            className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 to-purple-500/20 border border-amber-500/30 cursor-pointer hover:border-amber-500/60 transition"
          >
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs mb-1">
              <Crown className="w-4 h-4" /> Fenix {currentUser.subscription_tier.toUpperCase()}
            </div>
            <p className="text-xs text-zinc-300 truncate">{currentUser.name}</p>
          </div>

          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs text-red-400 hover:bg-red-500/10 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Выйти</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-y-auto pb-28">
        <header className="flex justify-between items-center px-8 py-5 sticky top-0 bg-[#0a0a0c]/70 backdrop-blur-md z-10 border-b border-white/10">
          <div className="hidden md:flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full w-80 border border-white/10">
            <Search className="w-4 h-4 text-zinc-300" />
            <input 
              type="text" 
              placeholder="Треки, артисты, альбомы..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); if(currentTab !== 'search') setCurrentTab('search'); }}
              className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-zinc-400" 
            />
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setCurrentTab('premium')}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 font-medium text-sm shadow-lg shadow-violet-500/30 hover:opacity-90 transition"
            >
              💎 {currentUser.subscription_tier.toUpperCase()}
            </button>
            <div 
              onClick={() => setCurrentTab('profile')}
              className="w-10 h-10 rounded-full bg-violet-800 border border-white/20 overflow-hidden flex items-center justify-center font-bold text-violet-200 cursor-pointer"
            >
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
              ) : (
                currentUser.name ? currentUser.name[0].toUpperCase() : 'FX'
              )}
            </div>
          </div>
        </header>

        <div className="p-6 md:p-8 flex-1">
          {currentTab === 'home' && (
            <div className="space-y-8">
              <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-violet-900/60 via-purple-900/40 to-pink-900/60 border border-white/20 p-8 flex flex-col justify-end min-h-[240px] shadow-2xl">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-2">✨ Лента рекомендаций «Для вас»</span>
                <h1 className="text-3xl md:text-5xl font-extrabold mb-3">Привет, {currentUser.name}!</h1>
                <p className="text-zinc-200 max-w-xl text-sm mb-6">Слушайте новинки, популярное и персональные миксы в высоком качестве.</p>
                <button 
                  onClick={() => playTrack(sourceTracks[0])}
                  className="flex items-center gap-2 bg-white text-black font-bold px-6 py-3 rounded-full w-fit hover:bg-zinc-200 transition shadow-lg"
                >
                  <Play className="w-5 h-5 fill-current" /> Продолжить слушать
                </button>
              </div>

              <div className="space-y-3">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Sparkles className="text-violet-400 w-5 h-5"/> Миксы и новинки
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {['Новинки', 'Популярное', 'Миксы дня', 'Недавно прослушанное', 'Электронный вайб'].map((mix, idx) => (
                    <div key={idx} onClick={() => playTrack(sourceTracks[idx % sourceTracks.length])} className="bg-white/5 border border-white/10 p-4 rounded-2xl hover:bg-white/10 transition cursor-pointer group">
                      <div className="w-full aspect-square rounded-xl bg-gradient-to-br from-violet-600/40 to-pink-600/40 mb-3 flex items-center justify-center group-hover:scale-105 transition">
                        <Radio className="w-8 h-8 text-white/80" />
                      </div>
                      <h4 className="font-semibold text-sm truncate">{mix}</h4>
                      <p className="text-xs text-zinc-400">Сборник треков</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Flame className="text-pink-400 w-5 h-5"/> Популярные треки
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {sourceTracks.slice(0, 6).map((track) => (
                    <div 
                      key={track.id} 
                      onClick={() => playTrack(track)}
                      className="flex items-center gap-4 bg-white/10 p-3 rounded-2xl border border-white/10 hover:bg-white/20 transition cursor-pointer group"
                    >
                      <img src={track.cover_url} alt={track.title} className="w-14 h-14 rounded-xl object-cover" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm truncate group-hover:text-violet-300 transition">{track.title}</h4>
                        <p className="text-xs text-zinc-300 truncate">{track.artist_name}</p>
                      </div>
                      <button 
                        onClick={(e) => toggleFavorite(track.id, e)}
                        className={`p-2 rounded-full hover:bg-white/20 transition ${favorites.includes(track.id) ? 'text-pink-500' : 'text-zinc-400'}`}
                      >
                        <Heart className={`w-4 h-4 ${favorites.includes(track.id) ? 'fill-current' : ''}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentTab === 'recommendations' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Sparkles className="text-violet-400 w-6 h-6" /> Рекомендации «Для вас»
              </h2>
              <p className="text-sm text-zinc-300">Персональная подборка треков на основе ваших музыкальных предпочтений и истории.</p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sourceTracks.map((track) => (
                  <div 
                    key={track.id} 
                    onClick={() => playTrack(track)}
                    className="flex items-center gap-4 bg-white/10 p-3 rounded-2xl border border-white/10 hover:bg-white/20 transition cursor-pointer group"
                  >
                    <img src={track.cover_url} alt={track.title} className="w-14 h-14 rounded-xl object-cover" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate group-hover:text-violet-300 transition">{track.title}</h4>
                      <p className="text-xs text-zinc-300 truncate">{track.artist_name}</p>
                    </div>
                    <button 
                      onClick={(e) => toggleFavorite(track.id, e)}
                      className={`p-2 rounded-full hover:bg-white/20 transition ${favorites.includes(track.id) ? 'text-pink-500' : 'text-zinc-400'}`}
                    >
                      <Heart className={`w-4 h-4 ${favorites.includes(track.id) ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentTab === 'search' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">Поиск музыки</h2>
                <div className="flex items-center gap-2 bg-white/10 px-4 py-3 rounded-2xl border border-white/10 w-full">
                  <Search className="w-5 h-5 text-zinc-300" />
                  <input 
                    type="text" 
                    placeholder="Введите название трека, исполнителя, альбом или жанр..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent border-none outline-none text-base w-full text-white placeholder-zinc-400" 
                  />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2">
                  {['all', 'Треки', 'Исполнители', 'Альбомы', 'Плейлисты', 'Жанры'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSearchCategory(cat)}
                      className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${searchCategory === cat ? 'bg-violet-600 text-white' : 'bg-white/5 text-zinc-300 hover:bg-white/10'}`}
                    >
                      {cat === 'all' ? 'Все категории' : cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredTracks.map((track) => (
                  <div 
                    key={track.id} 
                    onClick={() => playTrack(track)}
                    className="flex items-center gap-4 bg-white/10 p-3 rounded-2xl border border-white/10 hover:bg-white/20 transition cursor-pointer group"
                  >
                    <img src={track.cover_url} alt={track.title} className="w-14 h-14 rounded-xl object-cover" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate group-hover:text-violet-300 transition">{track.title}</h4>
                      <p className="text-xs text-zinc-300 truncate">{track.artist_name} • <span className="text-violet-400">{track.genre || 'Музыка'}</span></p>
                    </div>
                    <button 
                      onClick={(e) => toggleFavorite(track.id, e)}
                      className={`p-2 rounded-full hover:bg-white/20 transition ${favorites.includes(track.id) ? 'text-pink-500' : 'text-zinc-400'}`}
                    >
                      <Heart className={`w-4 h-4 ${favorites.includes(track.id) ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                ))}
                {filteredTracks.length === 0 && (
                  <p className="text-zinc-400 text-sm col-span-full text-center py-10">Ничего не найдено по вашему запросу</p>
                )}
              </div>
            </div>
          )}

          {currentTab === 'library' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Library className="text-violet-400 w-6 h-6" /> Моя Библиотека
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div onClick={() => setCurrentTab('favorites')} className="bg-white/10 border border-white/10 p-4 rounded-2xl cursor-pointer hover:bg-white/20 transition">
                  <div className="w-12 h-12 rounded-xl bg-pink-600/30 flex items-center justify-center text-pink-400 mb-3">
                    <Heart className="w-6 h-6 fill-current" />
                  </div>
                  <h4 className="font-bold text-sm">Любимые треки</h4>
                  <p className="text-xs text-zinc-400">{favorites.length} треков</p>
                </div>
                <div onClick={() => setCurrentTab('history')} className="bg-white/10 border border-white/10 p-4 rounded-2xl cursor-pointer hover:bg-white/20 transition">
                  <div className="w-12 h-12 rounded-xl bg-violet-600/30 flex items-center justify-center text-violet-400 mb-3">
                    <Clock className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm">История прослушиваний</h4>
                  <p className="text-xs text-zinc-400">{history.length} треков</p>
                </div>
                <div className="bg-white/10 border border-white/10 p-4 rounded-2xl cursor-pointer hover:bg-white/20 transition">
                  <div className="w-12 h-12 rounded-xl bg-sky-600/30 flex items-center justify-center text-sky-400 mb-3">
                    <ListMusic className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm">Плейлисты</h4>
                  <p className="text-xs text-zinc-400">2 плейлиста</p>
                </div>
                <div className="bg-white/10 border border-white/10 p-4 rounded-2xl cursor-pointer hover:bg-white/20 transition">
                  <div className="w-12 h-12 rounded-xl bg-amber-600/30 flex items-center justify-center text-amber-400 mb-3">
                    <Download className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm">Скачанные треки</h4>
                  <p className="text-xs text-zinc-400">Доступно в мобильном приложении</p>
                </div>
              </div>

              <h3 className="text-lg font-bold pt-4">Все доступные треки</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sourceTracks.map((track) => (
                  <div 
                    key={track.id} 
                    onClick={() => playTrack(track)}
                    className="flex items-center gap-4 bg-white/10 p-3 rounded-2xl border border-white/10 hover:bg-white/20 transition cursor-pointer group"
                  >
                    <img src={track.cover_url} alt={track.title} className="w-14 h-14 rounded-xl object-cover" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate group-hover:text-violet-300 transition">{track.title}</h4>
                      <p className="text-xs text-zinc-300 truncate">{track.artist_name}</p>
                    </div>
                    <button 
                      onClick={(e) => toggleFavorite(track.id, e)}
                      className={`p-2 rounded-full hover:bg-white/20 transition ${favorites.includes(track.id) ? 'text-pink-500' : 'text-zinc-400'}`}
                    >
                      <Heart className={`w-4 h-4 ${favorites.includes(track.id) ? 'fill-current' : ''}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentTab === 'favorites' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Heart className="text-pink-500 w-6 h-6 fill-current" /> Любимые треки
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sourceTracks.filter(t => favorites.includes(t.id)).map((track) => (
                  <div 
                    key={track.id} 
                    onClick={() => playTrack(track)}
                    className="flex items-center gap-4 bg-white/10 p-3 rounded-2xl border border-white/10 hover:bg-white/20 transition cursor-pointer group"
                  >
                    <img src={track.cover_url} alt={track.title} className="w-14 h-14 rounded-xl object-cover" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate group-hover:text-violet-300 transition">{track.title}</h4>
                      <p className="text-xs text-zinc-300 truncate">{track.artist_name}</p>
                    </div>
                    <button 
                      onClick={(e) => toggleFavorite(track.id, e)}
                      className="p-2 rounded-full hover:bg-white/20 transition text-pink-500"
                    >
                      <Heart className="w-4 h-4 fill-current" />
                    </button>
                  </div>
                ))}
                {favorites.length === 0 && (
                  <p className="text-zinc-400 text-sm col-span-full text-center py-10">У вас пока нет любимых треков. Добавляйте их с помощью иконки сердечка!</p>
                )}
              </div>
            </div>
          )}

          {currentTab === 'history' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Clock className="text-violet-400 w-6 h-6" /> История прослушиваний
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {sourceTracks.filter(t => history.includes(t.id)).map((track) => (
                  <div 
                    key={track.id} 
                    onClick={() => playTrack(track)}
                    className="flex items-center gap-4 bg-white/10 p-3 rounded-2xl border border-white/10 hover:bg-white/20 transition cursor-pointer group"
                  >
                    <img src={track.cover_url} alt={track.title} className="w-14 h-14 rounded-xl object-cover" />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate group-hover:text-violet-300 transition">{track.title}</h4>
                      <p className="text-xs text-zinc-300 truncate">{track.artist_name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentTab === 'profile' && (
            <div className="max-w-2xl mx-auto bg-white/10 border border-white/20 p-8 rounded-3xl space-y-6 backdrop-blur-md">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-violet-800 border-2 border-violet-400 overflow-hidden flex items-center justify-center font-bold text-2xl text-violet-200">
                  {currentUser.avatar ? (
                    <img src={currentUser.avatar} alt={currentUser.name} className="w-full h-full object-cover" />
                  ) : (
                    currentUser.name[0].toUpperCase()
                  )}
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{currentUser.name}</h2>
                  <p className="text-xs text-zinc-400">{currentUser.phone}</p>
                  <span className="inline-block mt-2 px-3 py-1 rounded-full bg-violet-600/30 border border-violet-500/40 text-xs font-semibold text-violet-300">
                    Подписка: {currentUser.subscription_tier.toUpperCase()}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <p className="text-xs text-zinc-400 mb-1">Статистика прослушивания</p>
                  <p className="text-xl font-black text-violet-300">{currentUser.stats.listenedHours} часов</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <p className="text-xs text-zinc-400 mb-1">Любимые треки</p>
                  <p className="text-xl font-black text-pink-400">{favorites.length} треков</p>
                </div>
              </div>
            </div>
          )}

          {currentTab === 'upload' && (
            <div className="max-w-xl mx-auto bg-white/10 border border-white/20 p-8 rounded-3xl space-y-6 backdrop-blur-md text-center">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center mx-auto text-sky-400">
                <Send className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold">Загрузка через Telegram-бота</h2>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Чтобы загрузить песню в приложение, отправьте аудиофайл нашему официальному Telegram-боту. Трек автоматически появится в вашей библиотеке!
              </p>
              <a 
                href="https://t.me/fenix_music_bot" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 font-bold text-sm shadow-lg shadow-sky-600/30 transition text-white"
              >
                <Send className="w-4 h-4" /> Открыть Telegram бота
              </a>
            </div>
          )}

          {currentTab === 'admin' && currentUser.is_admin && (
            <div className="max-w-xl mx-auto bg-white/10 border border-white/20 p-8 rounded-3xl space-y-6 backdrop-blur-md">
              <div className="flex items-center gap-3 text-violet-300">
                <Shield className="w-8 h-8" />
                <h2 className="text-2xl font-bold">Панель администратора</h2>
              </div>
              <p className="text-sm text-zinc-300">Доступ разрешен для номера <span className="text-amber-400 font-mono">+79067853860</span></p>
              
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
                  <label className="block text-xs text-zinc-400 mb-1">Уровень подписки (Premium — 1 месяц, Premium+ — 1 год)</label>
                  <select 
                    value={selectedTier} 
                    onChange={(e) => setSelectedTier(e.target.value)}
                    className="w-full bg-[#121216] border border-white/10 px-4 py-2.5 rounded-xl text-white text-sm outline-none"
                  >
                    <option value="free">FREE</option>
                    <option value="premium">PREMIUM (1 месяц)</option>
                    <option value="premium_plus">PREMIUM+ (1 год)</option>
                  </select>
                </div>

                <button 
                  onClick={handleGrantSubscription}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 font-bold text-sm shadow-lg shadow-violet-600/30 hover:opacity-90 transition"
                >
                  Активировать подписку
                </button>

                {adminStatus && (
                  <div className="p-3 rounded-xl bg-violet-900/40 border border-violet-500/30 text-xs text-violet-200 text-center flex items-center justify-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    <span>{adminStatus}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {currentTab === 'premium' && (
            <div className="max-w-3xl mx-auto space-y-8 text-center py-6">
              <h1 className="text-4xl font-extrabold bg-gradient-to-r from-amber-300 via-purple-300 to-pink-400 bg-clip-text text-transparent">
                Тарифные планы Fenix Music
              </h1>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                <div className="bg-white/10 border border-white/10 p-6 rounded-3xl flex flex-col justify-between backdrop-blur-md">
                  <div>
                    <h3 className="text-lg font-bold mb-2">FREE</h3>
                    <p className="text-2xl font-black mb-4">0 ₽</p>
                    <ul className="text-xs text-zinc-300 space-y-2 mb-6">
                      <li>✓ Музыка из каталога по правам</li>
                      <li>✓ Базовые рекомендации</li>
                      <li>✓ Плейлисты и история</li>
                    </ul>
                  </div>
                  <button className="w-full py-2.5 rounded-full bg-white/20 font-bold text-sm">Базовый</button>
                </div>

                <div className="bg-gradient-to-b from-violet-600/30 to-transparent border border-violet-500/50 p-6 rounded-3xl flex flex-col justify-between relative backdrop-blur-md">
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-xs px-3 py-1 rounded-full font-bold">ХИТ НА МЕСЯЦ</span>
                  <div>
                    <h3 className="text-lg font-bold mb-2 text-violet-300">PREMIUM</h3>
                    <p className="text-2xl font-black mb-4">299 ₽ <span className="text-xs text-zinc-400">/месяц</span></p>
                    <ul className="text-xs text-zinc-200 space-y-2 mb-6">
                      <li>✓ Без рекламы</li>
                      <li>✓ Улучшенное качество звука</li>
                      <li>✓ Расширенные рекомендации</li>
                      <li>✓ Дополнительные функции плеера</li>
                    </ul>
                  </div>
                  <button className="w-full py-2.5 rounded-full bg-violet-600 font-bold text-sm shadow-lg shadow-violet-600/30">Выбрать</button>
                </div>

                <div className="bg-white/10 border border-amber-500/40 p-6 rounded-3xl flex flex-col justify-between backdrop-blur-md">
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-xs px-3 py-1 rounded-full font-bold">НА ГОД</span>
                  <div>
                    <h3 className="text-lg font-bold mb-2 text-amber-300">PREMIUM+</h3>
                    <p className="text-2xl font-black mb-4">2990 ₽ <span className="text-xs text-zinc-400">/год</span></p>
                    <ul className="text-xs text-zinc-300 space-y-2 mb-6">
                      <li>✓ Всё из Premium</li>
                      <li>✓ Максимальное качество Hi-Res</li>
                      <li>✓ Расширенная статистика</li>
                      <li>✓ Эксклюзивные возможности</li>
                    </ul>
                  </div>
                  <button className="w-full py-2.5 rounded-full bg-amber-500 text-black font-bold text-sm">Выбрать год</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 h-20 bg-[#121216]/95 backdrop-blur-xl border-t border-white/10 px-6 flex items-center justify-between z-30">
        <div className="flex items-center gap-4 w-1/4">
          <img src={currentTrack.cover_url} alt="Cover" className="w-12 h-12 rounded-xl object-cover" />
          <div className="min-w-0">
            <h4 className="font-bold text-sm truncate">{currentTrack.title}</h4>
            <p className="text-xs text-zinc-400 truncate">{currentTrack.artist_name}</p>
          </div>
          <button 
            onClick={(e) => toggleFavorite(currentTrack.id, e)}
            className={`p-2 rounded-full hover:bg-white/20 transition ${favorites.includes(currentTrack.id) ? 'text-pink-500' : 'text-zinc-400'}`}
          >
            <Heart className={`w-5 h-5 ${favorites.includes(currentTrack.id) ? 'fill-current' : ''}`} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2 w-2/4 max-w-md">
          <div className="flex items-center gap-6">
            <Shuffle className="w-4 h-4 text-zinc-400 hover:text-white cursor-pointer" />
            <SkipBack className="w-5 h-5 text-zinc-300 hover:text-white cursor-pointer" />
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition shadow-lg"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current translate-x-0.5" />}
            </button>
            <SkipForward className="w-5 h-5 text-zinc-300 hover:text-white cursor-pointer" />
            <Repeat className="w-4 h-4 text-zinc-400 hover:text-white cursor-pointer" />
          </div>
          <div className="w-full flex items-center gap-3 text-xs text-zinc-400">
            <span>0:00</span>
            <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer">
              <div className="w-1/3 h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full"></div>
            </div>
            <span>3:20</span>
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
      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl font-medium text-xs cursor-pointer transition ${
        active 
          ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30 shadow-lg' 
          : 'text-zinc-400 hover:bg-white/10 hover:text-white'
      }`}
    >
      {React.cloneElement(icon, { className: 'w-4 h-4' })}
      <span>{label}</span>
    </div>
  );
}

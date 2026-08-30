import React, { useState, useEffect } from 'react';
import { 
  Home, Search, Library, Heart, Disc, 
  Play, Pause, SkipBack, SkipForward, Volume2, 
  Repeat, Shuffle, Crown, Flame, Shield, PhoneCall, LogOut, Upload, CheckCircle, Send,
  User, Clock, ListMusic, Music, Layers, ChevronRight, Maximize2, Minimize2, Sparkles, TrendingUp, BarChart2
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
  const [homeSubTab, setHomeSubTab] = useState('for_you'); // for_you, new, popular, mixes, recent, continue
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFilter, setSearchFilter] = useState('all'); // all, tracks, artists, albums, playlists, genres
  
  const [currentTrack, setCurrentTrack] = useState({
    id: 1,
    title: 'Cyber Pulse',
    artist_name: 'Fenix Sound',
    album_name: 'Neon Cybernetics',
    cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80',
    duration: 200,
    genre: 'Synthwave'
  });
  
  const [tracks, setTracks] = useState([]);
  const [albums, setAlbums] = useState([
    { id: 1, title: 'Neon Cybernetics', artist: 'Fenix Sound', cover: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80', year: '2026' },
    { id: 2, title: 'Midnight Odyssey', artist: 'RetroWave', cover: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&auto=format&fit=crop&q=80', year: '2025' }
  ]);
  const [artists, setArtists] = useState([
    { id: 1, name: 'Fenix Sound', genre: 'Synthwave', followers: '142K', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80' },
    { id: 2, name: 'RetroWave', genre: 'Electronic', followers: '98K', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80' }
  ]);
  const [playlists, setPlaylists] = useState([
    { id: 1, title: 'Киберпанк Ночь', tracksCount: 12, cover: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80' },
    { id: 2, title: 'Ретро Фьюжн', tracksCount: 8, cover: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80' }
  ]);
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  
  // Дополнительные экраны по клику на артиста/альбом
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);

  // Полноэкранный плеер
  const [isFullScreenPlayer, setIsFullScreenPlayer] = useState(false);
  const [queue, setQueue] = useState([]);

  // Админка состояния
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
        if (Array.isArray(data)) {
          const filtered = data.filter(t => t.title !== 'Neon Horizon');
          setTracks(filtered);
          setQueue(filtered);
        }
      })
      .catch(() => {
        const mockTracks = [
          { id: 1, title: 'Cyber Pulse', artist_name: 'Fenix Sound', album_name: 'Neon Cybernetics', cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80', genre: 'Synthwave' },
          { id: 2, title: 'Night City', artist_name: 'RetroWave', album_name: 'Midnight Odyssey', cover_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&auto=format&fit=crop&q=80', genre: 'Electronic' },
          { id: 3, title: 'Virtual Sunset', artist_name: 'Fenix Sound', album_name: 'Neon Cybernetics', cover_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80', genre: 'Synthwave' }
        ];
        setTracks(mockTracks);
        setQueue(mockTracks);
        setFavorites([mockTracks[0]]);
        setHistory([mockTracks[0], mockTracks[1]]);
      });
  };

  const handlePlayTrack = (track) => {
    setCurrentTrack(track);
    setIsPlaying(true);
    // Добавляем в историю
    if (!history.some(t => t.id === track.id)) {
      setHistory(prev => [track, ...prev]);
    }
  };

  const toggleFavorite = (track, e) => {
    e.stopPropagation();
    if (favorites.some(t => t.id === track.id)) {
      setFavorites(favorites.filter(t => t.id !== track.id));
    } else {
      setFavorites([...favorites, track]);
    }
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

  const handleGrantSubscription = () => {
    if (currentUser && currentUser.phone === phoneInput) {
      setCurrentUser({ ...currentUser, subscription_tier: selectedTier });
    }
    setAdminStatus(`Подписка ${selectedTier.toUpperCase()} применена для ${phoneInput}`);
  };

  const filteredTracks = tracks.filter(track => 
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
      {/* Боковая навигация */}
      <aside className="hidden md:flex flex-col w-64 bg-[#121216]/80 backdrop-blur-xl border-r border-white/10 p-6 justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8 cursor-pointer" onClick={() => { setCurrentTab('home'); setSelectedArtist(null); setSelectedAlbum(null); }}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-black tracking-wider bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">
              FENIX MUSIC
            </span>
          </div>

          <nav className="space-y-1.5">
            <NavItem icon={<Home />} label="Главная лента" active={currentTab === 'home' && !selectedArtist && !selectedAlbum} onClick={() => { setCurrentTab('home'); setSelectedArtist(null); setSelectedAlbum(null); }} />
            <NavItem icon={<Search />} label="Поиск" active={currentTab === 'search'} onClick={() => { setCurrentTab('search'); setSelectedArtist(null); setSelectedAlbum(null); }} />
            <NavItem icon={<Library />} label="Библиотека" active={currentTab === 'library'} onClick={() => { setCurrentTab('library'); setSelectedArtist(null); setSelectedAlbum(null); }} />
            <NavItem icon={<Clock />} label="История" active={currentTab === 'history'} onClick={() => { setCurrentTab('history'); setSelectedArtist(null); setSelectedAlbum(null); }} />
            <NavItem icon={<User />} label="Профиль" active={currentTab === 'profile'} onClick={() => { setCurrentTab('profile'); setSelectedArtist(null); setSelectedAlbum(null); }} />
            <NavItem icon={<Upload />} label="Загрузка через бота" active={currentTab === 'upload'} onClick={() => { setCurrentTab('upload'); setSelectedArtist(null); setSelectedAlbum(null); }} />
            {currentUser.is_admin && (
              <NavItem icon={<Shield />} label="Админка (PostgreSQL)" active={currentTab === 'admin'} onClick={() => { setCurrentTab('admin'); setSelectedArtist(null); setSelectedAlbum(null); }} />
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
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl font-medium text-sm text-red-400 hover:bg-red-500/10 transition"
          >
            <LogOut className="w-5 h-5" />
            <span>Выйти</span>
          </button>
        </div>
      </aside>

      {/* Основной контент */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto pb-24">
        <header className="flex justify-between items-center px-8 py-5 sticky top-0 bg-[#0a0a0c]/70 backdrop-blur-md z-20 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="md:hidden flex items-center gap-2">
              <button onClick={() => setCurrentTab('home')} className="p-2 text-white"><Home className="w-5 h-5"/></button>
              <button onClick={() => setCurrentTab('search')} className="p-2 text-white"><Search className="w-5 h-5"/></button>
              <button onClick={() => setCurrentTab('library')} className="p-2 text-white"><Library className="w-5 h-5"/></button>
            </div>
            <div className="hidden md:flex items-center gap-2 bg-white/10 px-4 py-2 rounded-full w-80 border border-white/10">
              <Search className="w-4 h-4 text-zinc-300" />
              <input 
                type="text" 
                placeholder="Быстрый поиск треков, артистов..." 
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentTab('search'); }}
                className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-zinc-400" 
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setCurrentTab('premium')}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 font-medium text-sm shadow-lg shadow-violet-500/30 hover:opacity-90 transition flex items-center gap-2"
            >
              <Crown className="w-4 h-4 text-amber-300" /> Подписка ({currentUser.subscription_tier.toUpperCase()})
            </button>
            <div 
              onClick={() => setCurrentTab('profile')}
              className="w-10 h-10 rounded-full bg-violet-800 border border-white/20 overflow-hidden flex items-center justify-center font-bold text-violet-200 cursor-pointer hover:scale-105 transition"
            >
              {currentUser.name ? currentUser.name[0].toUpperCase() : 'FX'}
            </div>
          </div>
        </header>

        <div className="p-6 md:p-8 flex-1">
          {/* СТРАНИЦА АРТИСТА */}
          {selectedArtist && (
            <div className="space-y-6">
              <button onClick={() => setSelectedArtist(null)} className="text-xs text-violet-400 hover:underline mb-2">← Назад</button>
              <div className="flex items-center gap-6 bg-white/10 p-6 rounded-3xl border border-white/10 backdrop-blur-md">
                <img src={selectedArtist.avatar} alt={selectedArtist.name} className="w-28 h-28 rounded-2xl object-cover shadow-xl" />
                <div>
                  <span className="text-xs uppercase bg-violet-600/30 px-3 py-1 rounded-full text-violet-300 font-semibold">Артист</span>
                  <h1 className="text-3xl font-black mt-2">{selectedArtist.name}</h1>
                  <p className="text-sm text-zinc-300 mt-1">Жанр: {selectedArtist.genre} • Слушателей: {selectedArtist.followers}</p>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-4">Популярные треки артиста</h3>
                <div className="space-y-2">
                  {tracks.filter(t => t.artist_name === selectedArtist.name).map(track => (
                    <div key={track.id} onClick={() => handlePlayTrack(track)} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 cursor-pointer transition">
                      <div className="flex items-center gap-3">
                        <img src={track.cover_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
                        <div>
                          <h4 className="font-semibold text-sm">{track.title}</h4>
                          <p className="text-xs text-zinc-400">{track.album_name}</p>
                        </div>
                      </div>
                      <Play className="w-5 h-5 text-violet-400" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* СТРАНИЦА АЛЬБОМА */}
          {selectedAlbum && !selectedArtist && (
            <div className="space-y-6">
              <button onClick={() => setSelectedAlbum(null)} className="text-xs text-violet-400 hover:underline mb-2">← Назад</button>
              <div className="flex items-center gap-6 bg-white/10 p-6 rounded-3xl border border-white/10 backdrop-blur-md">
                <img src={selectedAlbum.cover} alt={selectedAlbum.title} className="w-28 h-28 rounded-2xl object-cover shadow-xl" />
                <div>
                  <span className="text-xs uppercase bg-pink-600/30 px-3 py-1 rounded-full text-pink-300 font-semibold">Альбом ({selectedAlbum.year})</span>
                  <h1 className="text-3xl font-black mt-2">{selectedAlbum.title}</h1>
                  <p className="text-sm text-zinc-300 mt-1">Исполнитель: {selectedAlbum.artist}</p>
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold mb-4">Треки в альбоме</h3>
                <div className="space-y-2">
                  {tracks.filter(t => t.album_name === selectedAlbum.title || t.artist_name === selectedAlbum.artist).map(track => (
                    <div key={track.id} onClick={() => handlePlayTrack(track)} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 cursor-pointer transition">
                      <div className="flex items-center gap-3">
                        <img src={track.cover_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
                        <div>
                          <h4 className="font-semibold text-sm">{track.title}</h4>
                          <p className="text-xs text-zinc-400">{track.artist_name}</p>
                        </div>
                      </div>
                      <Play className="w-5 h-5 text-pink-400" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ГЛАВНАЯ ВКЛАДКА */}
          {currentTab === 'home' && !selectedArtist && !selectedAlbum && (
            <div className="space-y-8">
              {/* Верхний баннер */}
              <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-violet-900/70 via-purple-900/50 to-pink-900/70 border border-white/20 p-8 flex flex-col justify-end min-h-[260px] shadow-2xl">
                <span className="text-xs font-bold uppercase tracking-wider text-violet-300 mb-2 flex items-center gap-1">
                  <Sparkles className="w-4 h-4"/> Рекомендации Fenix Sound
                </span>
                <h1 className="text-3xl md:text-5xl font-extrabold mb-3">Привет, {currentUser.name}!</h1>
                <p className="text-zinc-200 max-w-xl text-sm mb-6">Слушайте персональные миксы, открывайте новые альбомы и управляйте качеством звука.</p>
                <button 
                  onClick={() => handlePlayTrack(tracks[0] || currentTrack)}
                  className="flex items-center gap-2 bg-white text-black font-bold px-6 py-3 rounded-full w-fit hover:bg-zinc-200 transition shadow-lg"
                >
                  <Play className="w-5 h-5 fill-current" /> Слушать микс дня
                </button>
              </div>

              {/* Подменю ленты рекомендаций */}
              <div className="flex gap-2 overflow-x-auto pb-2 border-b border-white/10">
                {[
                  { id: 'for_you', label: 'Для вас' },
                  { id: 'new', label: 'Новинки' },
                  { id: 'popular', label: 'Популярное' },
                  { id: 'mixes', label: 'Миксы' },
                  { id: 'recent', label: 'Недавно прослушанное' },
                  { id: 'continue', label: 'Продолжить слушать' }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setHomeSubTab(tab.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                      homeSubTab === tab.id ? 'bg-violet-600 text-white shadow-lg' : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Контент подменю */}
              {homeSubTab === 'for_you' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold flex items-center gap-2"><Sparkles className="text-violet-400 w-5 h-5"/> Персональные рекомендации</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tracks.map(track => (
                      <div key={track.id} onClick={() => handlePlayTrack(track)} className="flex items-center gap-4 bg-white/10 p-3 rounded-2xl border border-white/10 hover:bg-white/20 transition cursor-pointer group">
                        <img src={track.cover_url} alt="" className="w-14 h-14 rounded-xl object-cover" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm truncate group-hover:text-violet-300">{track.title}</h4>
                          <p className="text-xs text-zinc-300 truncate">{track.artist_name}</p>
                        </div>
                        <button onClick={(e) => toggleFavorite(track, e)} className={`p-2 rounded-full ${favorites.some(f => f.id === track.id) ? 'text-pink-500' : 'text-zinc-400 hover:text-white'}`}>
                          <Heart className="w-5 h-5 fill-current" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {homeSubTab === 'new' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold flex items-center gap-2"><Disc className="text-sky-400 w-5 h-5"/> Горячие новинки</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
                    {albums.map(album => (
                      <div key={album.id} onClick={() => setSelectedAlbum(album)} className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl border border-white/10 hover:bg-white/20 cursor-pointer transition">
                        <img src={album.cover} alt="" className="w-16 h-16 rounded-xl object-cover" />
                        <div>
                          <h4 className="font-bold text-base">{album.title}</h4>
                          <p className="text-xs text-zinc-400">{album.artist} • {album.year}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {homeSubTab === 'popular' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold flex items-center gap-2"><Flame className="text-pink-400 w-5 h-5"/> Топ-треки недели</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {tracks.slice(0, 4).map(track => (
                      <div key={track.id} onClick={() => handlePlayTrack(track)} className="flex items-center gap-4 bg-white/10 p-3 rounded-2xl border border-white/10 hover:bg-white/20 transition cursor-pointer">
                        <img src={track.cover_url} alt="" className="w-14 h-14 rounded-xl object-cover" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm truncate">{track.title}</h4>
                          <p className="text-xs text-zinc-300 truncate">{track.artist_name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {homeSubTab === 'mixes' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold flex items-center gap-2"><ListMusic className="text-purple-400 w-5 h-5"/> Ваши плейлисты и миксы</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {playlists.map(pl => (
                      <div key={pl.id} className="flex items-center gap-4 bg-white/10 p-4 rounded-2xl border border-white/10">
                        <img src={pl.cover} alt="" className="w-16 h-16 rounded-xl object-cover" />
                        <div>
                          <h4 className="font-bold">{pl.title}</h4>
                          <p className="text-xs text-zinc-400">{pl.tracksCount} треков</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {homeSubTab === 'recent' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold flex items-center gap-2"><Clock className="text-amber-400 w-5 h-5"/> Недавно прослушанное</h2>
                  <div className="space-y-2">
                    {history.map(item => (
                      <div key={item.id} onClick={() => handlePlayTrack(item)} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <img src={item.cover_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
                          <div>
                            <h4 className="font-semibold text-sm">{item.title}</h4>
                            <p className="text-xs text-zinc-400">{item.artist_name}</p>
                          </div>
                        </div>
                        <Play className="w-4 h-4 text-violet-400" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {homeSubTab === 'continue' && (
                <div className="space-y-6">
                  <h2 className="text-xl font-bold flex items-center gap-2"><Play className="text-green-400 w-5 h-5"/> Продолжить слушать</h2>
                  <div className="p-6 rounded-3xl bg-gradient-to-r from-violet-600/20 to-pink-600/20 border border-white/10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <img src={currentTrack.cover_url} alt="" className="w-16 h-16 rounded-2xl object-cover" />
                      <div>
                        <h4 className="font-bold text-lg">{currentTrack.title}</h4>
                        <p className="text-sm text-zinc-300">{currentTrack.artist_name}</p>
                      </div>
                    </div>
                    <button onClick={() => setIsPlaying(!isPlaying)} className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center font-bold">
                      {isPlaying ? <Pause className="w-6 h-6 fill-current"/> : <Play className="w-6 h-6 fill-current translate-x-0.5"/>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ПОИСК */}
          {currentTab === 'search' && (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold">Поиск по каталогу</h2>
                <input 
                  type="text" 
                  placeholder="Введите название трека, артиста или жанра..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl text-white text-sm outline-none w-full md:w-96"
                />
              </div>

              {/* Фильтры поиска */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {[
                  { id: 'all', label: 'Всё' },
                  { id: 'tracks', label: 'Треки' },
                  { id: 'artists', label: 'Исполнители' },
                  { id: 'albums', label: 'Альбомы' },
                  { id: 'playlists', label: 'Плейлисты' },
                  { id: 'genres', label: 'Жанры' }
                ].map(f => (
                  <button 
                    key={f.id} 
                    onClick={() => setSearchFilter(f.id)}
                    className={`px-4 py-1.5 rounded-xl text-xs font-semibold ${searchFilter === f.id ? 'bg-violet-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Результаты треков */}
              {(searchFilter === 'all' || searchFilter === 'tracks') && (
                <div>
                  <h3 className="text-lg font-bold mb-3">Треки</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTracks.map(track => (
                      <div key={track.id} onClick={() => handlePlayTrack(track)} className="flex items-center gap-4 bg-white/10 p-3 rounded-2xl border border-white/10 hover:bg-white/20 cursor-pointer group">
                        <img src={track.cover_url} alt="" className="w-14 h-14 rounded-xl object-cover" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm truncate group-hover:text-violet-300">{track.title}</h4>
                          <p className="text-xs text-zinc-300 truncate">{track.artist_name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Результаты артистов */}
              {(searchFilter === 'all' || searchFilter === 'artists') && (
                <div>
                  <h3 className="text-lg font-bold mb-3">Исполнители</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {artists.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase())).map(artist => (
                      <div key={artist.id} onClick={() => setSelectedArtist(artist)} className="flex items-center gap-4 bg-white/10 p-3 rounded-2xl border border-white/10 hover:bg-white/20 cursor-pointer">
                        <img src={artist.avatar} alt="" className="w-14 h-14 rounded-full object-cover" />
                        <div>
                          <h4 className="font-semibold text-sm">{artist.name}</h4>
                          <p className="text-xs text-zinc-400">Фолловеров: {artist.followers}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Результаты альбомов */}
              {(searchFilter === 'all' || searchFilter === 'albums') && (
                <div>
                  <h3 className="text-lg font-bold mb-3">Альбомы</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {albums.filter(al => al.title.toLowerCase().includes(searchQuery.toLowerCase())).map(album => (
                      <div key={album.id} onClick={() => setSelectedAlbum(album)} className="flex items-center gap-4 bg-white/10 p-3 rounded-2xl border border-white/10 hover:bg-white/20 cursor-pointer">
                        <img src={album.cover} alt="" className="w-14 h-14 rounded-xl object-cover" />
                        <div>
                          <h4 className="font-semibold text-sm">{album.title}</h4>
                          <p className="text-xs text-zinc-400">{album.artist}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* БИБЛИОТЕКА */}
          {currentTab === 'library' && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Ваша библиотека</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div onClick={() => setSearchFilter('tracks')} className="p-5 rounded-3xl bg-violet-900/30 border border-violet-500/30 cursor-pointer hover:border-violet-500 transition">
                  <Heart className="w-8 h-8 text-pink-500 mb-3" />
                  <h3 className="font-bold text-lg">Любимые треки</h3>
                  <p className="text-xs text-zinc-300 mt-1">{favorites.length} треков в избранном</p>
                </div>
                <div onClick={() => setCurrentTab('search')} className="p-5 rounded-3xl bg-purple-900/30 border border-purple-500/30 cursor-pointer hover:border-purple-500 transition">
                  <Disc className="w-8 h-8 text-purple-400 mb-3" />
                  <h3 className="font-bold text-lg">Альбомы и артисты</h3>
                  <p className="text-xs text-zinc-300 mt-1">{albums.length} альбомов, {artists.length} артистов</p>
                </div>
                <div onClick={() => setCurrentTab('home')} className="p-5 rounded-3xl bg-sky-900/30 border border-sky-500/30 cursor-pointer hover:border-sky-500 transition">
                  <ListMusic className="w-8 h-8 text-sky-400 mb-3" />
                  <h3 className="font-bold text-lg">Плейлисты</h3>
                  <p className="text-xs text-zinc-300 mt-1">{playlists.length} персональных плейлистов</p>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-bold mb-4">Избранные треки ❤️</h3>
                <div className="space-y-2">
                  {favorites.length === 0 ? (
                    <p className="text-xs text-zinc-400">Нет избранных треков. Нажмите на сердечко у любого трека.</p>
                  ) : (
                    favorites.map(track => (
                      <div key={track.id} onClick={() => handlePlayTrack(track)} className="flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <img src={track.cover_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
                          <div>
                            <h4 className="font-semibold text-sm">{track.title}</h4>
                            <p className="text-xs text-zinc-400">{track.artist_name}</p>
                          </div>
                        </div>
                        <Heart className="w-5 h-5 text-pink-500 fill-current" />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ИСТОРИЯ */}
          {currentTab === 'history' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold flex items-center gap-2"><Clock className="w-6 h-6 text-violet-400" /> История прослушиваний</h2>
              <div className="space-y-3">
                {history.map((item, idx) => (
                  <div key={idx} onClick={() => handlePlayTrack(item)} className="flex items-center justify-between p-4 rounded-2xl bg-white/10 border border-white/10 cursor-pointer hover:bg-white/20">
                    <div className="flex items-center gap-4">
                      <img src={item.cover_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
                      <div>
                        <h4 className="font-semibold text-sm">{item.title}</h4>
                        <p className="text-xs text-zinc-400">{item.artist_name}</p>
                      </div>
                    </div>
                    <Play className="w-5 h-5 text-violet-400" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ПРОФИЛЬ */}
          {currentTab === 'profile' && (
            <div className="max-w-xl mx-auto bg-white/10 border border-white/20 p-8 rounded-3xl space-y-6 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center text-3xl font-bold shadow-xl">
                  {currentUser.name[0].toUpperCase()}
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{currentUser.name}</h2>
                  <p className="text-xs text-zinc-300">Телефон: {currentUser.phone}</p>
                  <p className="text-xs text-amber-400 font-semibold mt-1">Тариф: {currentUser.subscription_tier.toUpperCase()}</p>
                </div>
              </div>

              <div className="space-y-4 border-t border-white/10 pt-4">
                <h3 className="font-bold flex items-center gap-2"><BarChart2 className="w-5 h-5 text-violet-400"/> Статистика прослушивания</h3>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <p className="text-2xl font-black text-violet-300">42 часа</p>
                    <p className="text-xs text-zinc-400 mt-1">В музыке за месяц</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                    <p className="text-2xl font-black text-pink-400">{favorites.length}</p>
                    <p className="text-xs text-zinc-400 mt-1">Любимых треков</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ЗАГРУЗКА ЧЕРЕЗ БОТА */}
          {currentTab === 'upload' && (
            <div className="max-w-xl mx-auto bg-white/10 border border-white/20 p-8 rounded-3xl space-y-6 backdrop-blur-md text-center">
              <div className="w-16 h-16 rounded-2xl bg-sky-500/20 border border-sky-500/30 flex items-center justify-center mx-auto text-sky-400">
                <Send className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold">Загрузка через Telegram-бота</h2>
              <p className="text-sm text-zinc-300 leading-relaxed">
                Отправьте аудиофайл нашему официальному Telegram-боту, и трек автоматически пополнит ваш каталог.
              </p>
              <a 
                href="https://t.me/fenix_music_bot" 
                target="_blank" 
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-sky-600 hover:bg-sky-500 font-bold text-sm shadow-lg text-white"
              >
                <Send className="w-4 h-4" /> Открыть Telegram бота
              </a>
            </div>
          )}

          {/* АДМИНКА */}
          {currentTab === 'admin' && currentUser.is_admin && (
            <div className="max-w-xl mx-auto bg-white/10 border border-white/20 p-8 rounded-3xl space-y-6 backdrop-blur-md">
              <div className="flex items-center gap-3 text-violet-300">
                <Shield className="w-8 h-8" />
                <h2 className="text-2xl font-bold">Панель администратора (PostgreSQL)</h2>
              </div>
              <p className="text-sm text-zinc-300">Управление подписками для номера <span className="text-amber-400 font-mono">+79067853860</span></p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Номер телефона</label>
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
                    <option value="free">FREE</option>
                    <option value="premium">PREMIUM (только месяц)</option>
                    <option value="premium_plus">PREMIUM+ (на год)</option>
                  </select>
                </div>
                <button 
                  onClick={handleGrantSubscription}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-pink-600 font-bold text-sm shadow-lg hover:opacity-95"
                >
                  Применить подписку в БД
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

          {/* ПОДПИСКИ */}
          {currentTab === 'premium' && (
            <div className="max-w-3xl mx-auto space-y-8 text-center py-6">
              <h1 className="text-4xl font-extrabold bg-gradient-to-r from-amber-300 via-purple-300 to-pink-400 bg-clip-text text-transparent">
                Ваш тариф: {currentUser.subscription_tier.toUpperCase()}
              </h1>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                <div className="bg-white/10 border border-white/10 p-6 rounded-3xl flex flex-col justify-between backdrop-blur-md">
                  <div>
                    <h3 className="text-lg font-bold mb-2">FREE</h3>
                    <p className="text-2xl font-black mb-4">0 ₽</p>
                    <ul className="text-xs text-zinc-300 space-y-2 mb-6">
                      <li>✓ Базовые рекомендации</li>
                      <li>✓ Плейлисты и история</li>
                    </ul>
                  </div>
                  <button className="w-full py-2.5 rounded-full bg-white/20 font-bold text-sm">Ваш тариф</button>
                </div>
                <div className="bg-gradient-to-b from-violet-600/30 to-transparent border border-violet-500/50 p-6 rounded-3xl flex flex-col justify-between relative backdrop-blur-md">
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-xs px-3 py-1 rounded-full font-bold">ХИТ НА МЕСЯЦ</span>
                  <div>
                    <h3 className="text-lg font-bold mb-2 text-violet-300">PREMIUM</h3>
                    <p className="text-2xl font-black mb-4">299 ₽ <span className="text-xs text-zinc-400">/мес</span></p>
                    <ul className="text-xs text-zinc-200 space-y-2 mb-6">
                      <li>✓ Без рекламы</li>
                      <li>✓ Улучшенное качество</li>
                      <li>✓ Расширенные рекомендации</li>
                    </ul>
                  </div>
                  <button className="w-full py-2.5 rounded-full bg-violet-600 font-bold text-sm shadow-lg">Выбрать</button>
                </div>
                <div className="bg-white/10 border border-amber-500/40 p-6 rounded-3xl flex flex-col justify-between backdrop-blur-md">
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-xs px-3 py-1 rounded-full font-bold">НА ГОД</span>
                  <div>
                    <h3 className="text-lg font-bold mb-2 text-amber-300">PREMIUM+</h3>
                    <p className="text-2xl font-black mb-4">4999 ₽ <span className="text-xs text-zinc-400">/год</span></p>
                    <ul className="text-xs text-zinc-300 space-y-2 mb-6">
                      <li>✓ Всё из Premium</li>
                      <li>✓ Максимальное качество</li>
                      <li>✓ Расширенная статистика</li>
                    </ul>
                  </div>
                  <button className="w-full py-2.5 rounded-full bg-amber-500 text-black font-bold text-sm">Выбрать</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ПОЛНОЭКРАННЫЙ ПЛЕЕР (Модальное окно) */}
      {isFullScreenPlayer && (
        <div className="fixed inset-0 bg-[#0f0c29]/95 backdrop-blur-2xl z-50 flex flex-col justify-between p-8 md:p-16 text-white">
          <div className="flex justify-between items-center">
            <span className="text-xs tracking-widest uppercase font-bold text-violet-400">Полноэкранный плеер</span>
            <button onClick={() => setIsFullScreenPlayer(false)} className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition">
              <Minimize2 className="w-6 h-6" />
            </button>
          </div>

          <div className="flex flex-col items-center justify-center space-y-8 my-auto">
            <img src={currentTrack.cover_url} alt="" className="w-64 h-64 md:w-80 md:h-80 rounded-3xl object-cover shadow-2xl border border-white/20" />
            <div className="text-center">
              <h2 className="text-3xl font-extrabold">{currentTrack.title}</h2>
              <p className="text-lg text-zinc-300 mt-1">{currentTrack.artist_name}</p>
            </div>
            <div className="w-full max-w-md space-y-2">
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden cursor-pointer">
                <div className="w-1/2 h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full"></div>
              </div>
              <div className="flex justify-between text-xs text-zinc-400">
                <span>1:00</span>
                <span>2:00</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-8">
            <Shuffle className="w-6 h-6 text-zinc-400 cursor-pointer" />
            <SkipBack className="w-8 h-8 cursor-pointer" />
            <button onClick={() => setIsPlaying(!isPlaying)} className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center shadow-xl">
              {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current translate-x-0.5" />}
            </button>
            <SkipForward className="w-8 h-8 cursor-pointer" />
            <Repeat className="w-6 h-6 text-zinc-400 cursor-pointer" />
          </div>
        </div>
      )}

      {/* НИЖНИЙ ПЛЕЕР */}
      <footer className="fixed bottom-0 left-0 right-0 h-20 bg-[#121216]/90 backdrop-blur-xl border-t border-white/10 px-6 flex items-center justify-between z-30">
        <div className="flex items-center gap-4 w-1/4 cursor-pointer" onClick={() => setIsFullScreenPlayer(true)}>
          <img src={currentTrack.cover_url} alt="Cover" className="w-12 h-12 rounded-xl object-cover" />
          <div className="min-w-0">
            <h4 className="font-bold text-sm truncate">{currentTrack.title}</h4>
            <p className="text-xs text-zinc-400 truncate">{currentTrack.artist_name}</p>
          </div>
          <button onClick={(e) => toggleFavorite(currentTrack, e)} className={`p-1 ${favorites.some(f => f.id === currentTrack.id) ? 'text-pink-500' : 'text-zinc-400 hover:text-white'}`}>
            <Heart className="w-5 h-5 fill-current" />
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
              <div className="w-1/2 h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full"></div>
            </div>
            <span>2:00</span>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-3 w-1/4 justify-end">
          <button onClick={() => setIsFullScreenPlayer(true)} className="text-zinc-400 hover:text-white mr-2" title="Полноэкранный плеер">
            <Maximize2 className="w-5 h-5" />
          </button>
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
      className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl font-medium text-sm cursor-pointer transition ${
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

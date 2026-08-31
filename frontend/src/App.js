import React, { useState, useEffect, useRef } from 'react';
import {  
  Home, Search, Library, Heart, Disc, User,  
  Play, Pause, SkipBack, SkipForward, Volume2,  
  Repeat, Shuffle, Crown, Flame, Clock, Menu, X,
  Sliders, ListMusic, VolumeX, Radio, Sparkles, Shield,
  Share2, Download, MoreVertical, Plus, Check, Compass,
  TrendingUp, Award, Music, Mic2, Headphones, Layers
} from 'lucide-react';

export default function FenixMusicApp() {
  const [currentTab, setCurrentTab] = useState('home');
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(35);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off'); // 'off' | 'all' | 'one'
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [playlistDrawerOpen, setPlaylistDrawerOpen] = useState(false);
  const [likedTracks, setLikedTracks] = useState([1, 3]);
  const [notifications, setNotifications] = useState([]);

  const [currentTrack, setCurrentTrack] = useState({
    id: 1,
    title: 'Neon Horizon',
    artist_name: 'CyberPulse',
    album: 'Cyber Odyssey (2026)',
    cover_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    audio_url: '',
    duration: 214,
    genre: 'Synthwave',
    plays: '1,420,932'
  });

  const [queue, setQueue] = useState([
    { id: 1, title: 'Neon Horizon', artist_name: 'CyberPulse', duration: 214, cover_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80' },
    { id: 2, title: 'Midnight Rain', artist_name: 'Aura', duration: 198, cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80' },
    { id: 3, title: 'Electric Dreams', artist_name: 'Vektor', duration: 245, cover_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=80' },
    { id: 4, title: 'Quantum State', artist_name: 'Neural Drift', duration: 310, cover_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&auto=format&fit=crop&q=80' },
    { id: 5, title: 'Supernova Protocol', artist_name: 'Stellaris', duration: 180, cover_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80' }
  ]);

  const [tracks, setTracks] = useState([
    { id: 1, title: 'Neon Horizon', artist_name: 'CyberPulse', album: 'Cyber Odyssey', cover_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80', genre: 'Synthwave', duration: 214, plays: '1.4M' },
    { id: 2, title: 'Midnight Rain', artist_name: 'Aura', album: 'Lost frequencies', cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80', genre: 'Lo-Fi', duration: 198, plays: '980K' },
    { id: 3, title: 'Electric Dreams', artist_name: 'Vektor', album: 'Neon Grid', cover_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=80', genre: 'Electro', duration: 245, plays: '3.2M' },
    { id: 4, title: 'Quantum State', artist_name: 'Neural Drift', album: 'Deep Web', cover_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&auto=format&fit=crop&q=80', genre: 'Ambient', duration: 310, plays: '450K' },
    { id: 5, title: 'Supernova Protocol', artist_name: 'Stellaris', album: 'Galaxy Express', cover_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80', genre: 'Synthwave', duration: 180, plays: '2.1M' },
    { id: 6, title: 'Cybernetic Heart', artist_name: 'Kavinsky Tribute', album: 'Nightcall V2', cover_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300&auto=format&fit=crop&q=80', genre: 'Synthwave', duration: 260, plays: '890K' }
  ]);

  const audioRef = useRef(null);

  const showNotification = (text) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, text }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 3000);
  };

  const toggleLike = (trackId, e) => {
    e.stopPropagation();
    if (likedTracks.includes(trackId)) {
      setLikedTracks(likedTracks.filter(id => id !== trackId));
      showNotification('Трек удален из избранного');
    } else {
      setLikedTracks([...likedTracks, trackId]);
      showNotification('Трек добавлен в избранное ❤️');
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex h-screen bg-[#070709] text-white font-sans overflow-hidden select-none">
      <audio ref={audioRef} src={currentTrack.audio_url} onEnded={() => {
        if (repeatMode === 'one') {
          audioRef.current.play();
        } else {
          // Автопереключение на следующий трек
          setIsPlaying(false);
        }
      }} />

      {/* Уведомления */}
      <div className="fixed top-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        {notifications.map(n => (
          <div key={n.id} className="bg-zinc-900/90 border border-violet-500/30 text-white px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md animate-fade-in text-sm font-medium flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-violet-400" />
            {n.text}
          </div>
        ))}
      </div>

      {/* Боковая панель (Desktop Sidebar) */}
      <aside className="hidden md:flex flex-col w-72 bg-[#0c0c10] border-r border-white/5 p-6 justify-between z-20">
        <div>
          {/* Логотип */}
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-violet-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-600/30">
              <Flame className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-lg font-black tracking-widest bg-gradient-to-r from-violet-400 via-pink-400 to-white bg-clip-text text-transparent">
                FENIX MUSIC
              </span>
              <span className="block text-[10px] text-zinc-500 font-semibold tracking-wider uppercase">Hi-Res Streaming</span>
            </div>
          </div>

          {/* Навигация */}
          <div className="space-y-6">
            <div>
              <p className="text-[11px] font-bold tracking-wider text-zinc-500 uppercase px-3 mb-2">Меню</p>
              <nav className="space-y-1">
                <NavItem icon={<Home />} label="Главная" active={currentTab === 'home'} onClick={() => setCurrentTab('home')} />
                <NavItem icon={<Compass />} label="Обзор" active={currentTab === 'explore'} onClick={() => setCurrentTab('explore')} />
                <NavItem icon={<Search />} label="Поиск" active={currentTab === 'search'} onClick={() => setCurrentTab('search')} />
                <NavItem icon={<Radio />} label="Радио и Студии" active={currentTab === 'radio'} onClick={() => setCurrentTab('radio')} />
              </nav>
            </div>

            <div>
              <p className="text-[11px] font-bold tracking-wider text-zinc-500 uppercase px-3 mb-2">Моя медиатека</p>
              <nav className="space-y-1">
                <NavItem icon={<Library />} label="Плейлисты" active={currentTab === 'library'} onClick={() => setCurrentTab('library')} />
                <NavItem icon={<Heart />} label="Избранное" active={currentTab === 'favorites'} onClick={() => setCurrentTab('favorites')} badge={likedTracks.length} />
                <NavItem icon={<Clock />} label="История" active={currentTab === 'history'} onClick={() => setCurrentTab('history')} />
                <NavItem icon={<Download />} label="Скачанные" active={currentTab === 'downloads'} onClick={() => setCurrentTab('downloads')} />
              </nav>
            </div>
          </div>
        </div>

        {/* Профиль и Премиум блок */}
        <div className="space-y-4">
          <div 
            onClick={() => setCurrentTab('premium')}
            className="p-4 rounded-3xl bg-gradient-to-br from-amber-500/10 via-purple-500/10 to-violet-500/10 border border-amber-500/20 cursor-pointer hover:border-amber-500/40 transition group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 text-amber-400 font-extrabold text-sm">
                <Crown className="w-4 h-4 fill-amber-400" /> Fenix+
              </div>
              <span className="text-[10px] bg-amber-400/20 text-amber-300 font-bold px-2 py-0.5 rounded-full">PRO</span>
            </div>
            <p className="text-xs text-zinc-400 group-hover:text-zinc-300 transition">Hi-Res Lossless звук, тексты песен и отсутствие рекламы.</p>
          </div>

          <div 
            onClick={() => setCurrentTab('profile')}
            className={`flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition ${currentTab === 'profile' ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-zinc-400'}`}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-500 to-indigo-600 flex items-center justify-center font-bold text-white shadow-md">
              FX
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm text-white truncate">Alex Fenix</h4>
              <p className="text-xs text-zinc-500 truncate">alex@fenix.audio</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Мобильный сайдбар ( Drawer ) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/80 backdrop-blur-md">
          <div className="w-80 bg-[#0c0c10] h-full p-6 flex flex-col justify-between border-r border-white/10">
            <div>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-pink-500 flex items-center justify-center">
                    <Flame className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-extrabold tracking-wider bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">FENIX</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-zinc-400 hover:text-white">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <nav className="space-y-2">
                <NavItem icon={<Home />} label="Главная" active={currentTab === 'home'} onClick={() => { setCurrentTab('home'); setMobileMenuOpen(false); }} />
                <NavItem icon={<Compass />} label="Обзор" active={currentTab === 'explore'} onClick={() => { setCurrentTab('explore'); setMobileMenuOpen(false); }} />
                <NavItem icon={<Search />} label="Поиск" active={currentTab === 'search'} onClick={() => { setCurrentTab('search'); setMobileMenuOpen(false); }} />
                <NavItem icon={<Library />} label="Медиатека" active={currentTab === 'library'} onClick={() => { setCurrentTab('library'); setMobileMenuOpen(false); }} />
                <NavItem icon={<Heart />} label="Избранное" active={currentTab === 'favorites'} onClick={() => { setCurrentTab('favorites'); setMobileMenuOpen(false); }} />
                <NavItem icon={<Crown />} label="Премиум" active={currentTab === 'premium'} onClick={() => { setCurrentTab('premium'); setMobileMenuOpen(false); }} />
              </nav>
            </div>
            <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-center">
              <p className="text-xs text-zinc-400 mb-2">Версия движка 4.2.0-stable</p>
              <button className="w-full py-2 bg-violet-600 rounded-xl font-bold text-xs">Обновить аккаунт</button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Основная рабочая зона */}
      <main className="flex-1 flex flex-col h-full overflow-y-auto pb-28">
        {/* Шапка */}
        <header className="flex justify-between items-center px-8 py-5 sticky top-0 bg-[#070709]/90 backdrop-blur-xl z-20 border-b border-white/5">
          <div className="flex items-center gap-4 md:hidden">
            <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-zinc-300">
              <Menu className="w-6 h-6" />
            </button>
            <span className="font-extrabold tracking-wider bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">FENIX</span>
          </div>

          <div className="hidden md:flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl w-96 border border-white/5 focus-within:border-violet-500/50 transition">
            <Search className="w-4 h-4 text-zinc-400" />
            <input 
              type="text" 
              placeholder="Трек, исполнитель, альбом или подкаст..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-zinc-500" 
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setCurrentTab('premium')}
              className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 font-bold text-xs shadow-lg shadow-violet-600/20 hover:opacity-90 transition"
            >
              <Crown className="w-3.5 h-3.5 fill-white" /> Подписка Fenix+
            </button>
            <div 
              onClick={() => setCurrentTab('profile')}
              className="w-10 h-10 rounded-full bg-zinc-800 border border-white/10 overflow-hidden flex items-center justify-center font-black text-violet-400 cursor-pointer hover:border-violet-500 transition"
            >
              FX
            </div>
          </div>
        </header>

        {/* Контент табов */}
        <div className="p-6 md:p-8 flex-1 max-w-7xl w-full mx-auto space-y-8">
          
          {/* TAB: HOME */}
          {currentTab === 'home' && (
            <div className="space-y-10 animate-fade-in">
              {/* Главный Баннер */}
              <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-violet-950/60 via-purple-950/30 to-[#070709] border border-white/10 p-8 md:p-12 flex flex-col justify-end min-h-[320px] shadow-2xl">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-violet-600/20 via-transparent to-transparent pointer-events-none" />
                <div className="relative z-10 max-w-xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-bold mb-4">
                    <Sparkles className="w-3.5 h-3.5" /> Эксклюзивный релиз 2026
                  </div>
                  <h1 className="text-4xl md:text-6xl font-black tracking-tight mb-4 text-white">Cyber Odyssey</h1>
                  <p className="text-zinc-300 text-sm md:text-base mb-8 leading-relaxed">
                    Масштабный синтвейв-альбом от проекта CyberPulse. Погружение в неоновые миры с поддержкой объемного звука Dolby Atmos.
                  </p>
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => {
                        setCurrentTrack(tracks[0]);
                        setIsPlaying(true);
                        showNotification('Воспроизведение: Cyber Odyssey');
                      }}
                      className="flex items-center gap-3 bg-white text-black font-extrabold px-7 py-3.5 rounded-full hover:bg-zinc-200 transition shadow-xl"
                    >
                      <Play className="w-5 h-5 fill-current" /> Слушать альбом
                    </button>
                    <button 
                      onClick={() => toggleLike(1, { stopPropagation: () => {} })}
                      className="w-12 h-12 rounded-full bg-white/10 border border-white/10 flex items-center justify-center hover:bg-white/20 transition"
                    >
                      <Heart className={`w-5 h-5 ${likedTracks.includes(1) ? 'fill-pink-500 text-pink-500' : 'text-white'}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Быстрый выбор по жанрам */}
              <div>
                <h2 className="text-xl font-bold mb-5 flex items-center gap-2">
                  <Disc className="text-violet-400 w-5 h-5" /> Любимые жанры
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                  {[
                    { name: 'Synthwave', color: 'from-pink-600/30 to-purple-600/30', count: '14.2k треков' },
                    { name: 'Lo-Fi', color: 'from-blue-600/30 to-indigo-600/30', count: '8.9k треков' },
                    { name: 'Electro', color: 'from-emerald-600/30 to-teal-600/30', count: '24.1k треков' },
                    { name: 'Ambient', color: 'from-amber-600/30 to-orange-600/30', count: '5.4k треков' },
                    { name: 'Phonk', color: 'from-red-600/30 to-rose-600/30', count: '19.8k треков' },
                    { name: 'Classical', color: 'from-violet-600/30 to-fuchsia-600/30', count: '3.1k треков' },
                  ].map((genre, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => { setSelectedGenre(genre.name); setCurrentTab('explore'); }}
                      className={`h-32 rounded-3xl bg-gradient-to-br ${genre.color} border border-white/10 p-5 flex flex-col justify-between cursor-pointer hover:scale-[1.03] transition group shadow-lg`}
                    >
                      <span className="font-extrabold text-base tracking-wide group-hover:text-violet-300 transition">{genre.name}</span>
                      <span className="text-[11px] text-zinc-400 font-medium">{genre.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Популярные треки сетка */}
              <div>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Flame className="text-pink-500 w-5 h-5" /> Хит-парад недели
                  </h2>
                  <button onClick={() => setCurrentTab('explore')} className="text-xs text-violet-400 font-bold hover:underline">Смотреть все</button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {tracks.map((track) => (
                    <div 
                      key={track.id} 
                      onClick={() => {
                        setCurrentTrack(track);
                        setIsPlaying(true);
                      }}
                      className="flex items-center gap-4 bg-white/[0.03] p-3.5 rounded-2xl border border-white/5 hover:bg-white/[0.08] transition cursor-pointer group"
                    >
                      <img src={track.cover_url} alt={track.title} className="w-16 h-16 rounded-xl object-cover shadow-md" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-sm truncate group-hover:text-violet-400 transition">{track.title}</h4>
                        <p className="text-xs text-zinc-400 truncate mt-0.5">{track.artist_name}</p>
                        <span className="inline-block text-[10px] text-zinc-500 bg-white/5 px-2 py-0.5 rounded-md mt-1.5">{track.genre}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => toggleLike(track.id, e)}
                          className="p-2 text-zinc-500 hover:text-pink-500 transition"
                        >
                          <Heart className={`w-4 h-4 ${likedTracks.includes(track.id) ? 'fill-pink-500 text-pink-500' : ''}`} />
                        </button>
                        <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition shadow">
                          <Play className="w-4 h-4 fill-current translate-x-0.5" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: EXPLORE / SEARCH */}
          {currentTab === 'explore' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black">Исследования и Каталог</h2>
                <div className="flex gap-2">
                  {['all', 'Synthwave', 'Lo-Fi', 'Electro', 'Ambient'].map((g) => (
                    <button 
                      key={g} 
                      onClick={() => setSelectedGenre(g)}
                      className={`px-4 py-2 rounded-full text-xs font-bold transition ${selectedGenre === g ? 'bg-violet-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}
                    >
                      {g === 'all' ? 'Все жанры' : g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
                {tracks
                  .filter(t => selectedGenre === 'all' || t.genre === selectedGenre)
                  .map(track => (
                    <div 
                      key={track.id}
                      onClick={() => { setCurrentTrack(track); setIsPlaying(true); }}
                      className="bg-white/[0.03] border border-white/5 rounded-3xl p-4 hover:border-violet-500/40 transition cursor-pointer group flex flex-col justify-between"
                    >
                      <div>
                        <div className="relative aspect-square rounded-2xl overflow-hidden mb-4 shadow-xl">
                          <img src={track.cover_url} alt={track.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-violet-600 flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition">
                              <Play className="w-5 h-5 fill-white text-white translate-x-0.5" />
                            </div>
                          </div>
                        </div>
                        <h3 className="font-bold text-base truncate group-hover:text-violet-400 transition">{track.title}</h3>
                        <p className="text-xs text-zinc-400 truncate mt-1">{track.artist_name} • {track.album}</p>
                      </div>
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5 text-xs text-zinc-500">
                        <span>{track.plays} прослушиваний</span>
                        <span>{formatTime(track.duration)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* TAB: SEARCH */}
          {currentTab === 'search' && (
            <div className="space-y-8 animate-fade-in max-w-4xl mx-auto">
              <div className="text-center py-6">
                <h1 className="text-3xl font-black mb-3">Что вы хотите послушать?</h1>
                <p className="text-zinc-400 text-sm">Ищите треки, исполнителей, жанры или кураторские плейлисты</p>
              </div>

              <div className="relative">
                <Search className="absolute left-5 top-4 w-5 h-5 text-zinc-400" />
                <input 
                  type="text" 
                  placeholder="Введите запрос, например: CyberPulse или Synthwave..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-4 text-white placeholder-zinc-500 outline-none focus:border-violet-500 transition text-base shadow-inner"
                />
              </div>

              <div>
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-4">Популярные категории</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {['Топ-50 мира', 'Новинки', 'Подкасты', 'Для тренировок', 'Расслабление', 'Вечеринка', 'Сон', 'Рок-хиты'].map((cat, i) => (
                    <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-violet-500/30 cursor-pointer font-bold text-sm transition">
                      {cat}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB: LIBRARY */}
          {currentTab === 'library' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-black">Ваша медиатека плейлистов</h2>
                <button className="px-4 py-2 rounded-xl bg-violet-600 text-white font-bold text-xs flex items-center gap-2 shadow-lg">
                  <Plus className="w-4 h-4" /> Создать плейлист
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                  { title: 'Любимые треки', count: `${likedTracks.length} треков`, desc: 'Ваши залайканные композиции', gradient: 'from-pink-600/30 to-violet-600/30' },
                  { title: 'Ночной киберпанк', count: '24 трека', desc: 'Автоподборка под вечернее кодинг-настроение', gradient: 'from-blue-600/30 to-purple-600/30' },
                  { title: 'Бодрый утренний микс', count: '18 треков', desc: 'Энергичный электро-биток на старт дня', gradient: 'from-amber-600/30 to-red-600/30' }
                ].map((pl, i) => (
                  <div key={i} className={`p-6 rounded-3xl bg-gradient-to-br ${pl.gradient} border border-white/10 flex flex-col justify-between h-48 cursor-pointer hover:scale-[1.02] transition shadow-xl`}>
                    <div>
                      <h3 className="font-extrabold text-lg mb-1">{pl.title}</h3>
                      <p className="text-xs text-zinc-300">{pl.desc}</p>
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-400 pt-4 border-t border-white/10">
                      <span>{pl.count}</span>
                      <Play className="w-4 h-4 fill-white text-white" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB: FAVORITES */}
          {currentTab === 'favorites' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black">Избранные треки</h2>
                  <p className="text-xs text-zinc-400 mt-1">Всего в вашем списке: {likedTracks.length} композиций</p>
                </div>
                <button 
                  onClick={() => {
                    if(tracks.length > 0) {
                      setCurrentTrack(tracks[0]);
                      setIsPlaying(true);
                    }
                  }}
                  className="px-5 py-2.5 rounded-full bg-white text-black font-bold text-xs flex items-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" /> Воспроизвести все
                </button>
              </div>

              <div className="space-y-3">
                {tracks.filter(t => likedTracks.includes(t.id)).map(track => (
                  <div 
                    key={track.id}
                    onClick={() => { setCurrentTrack(track); setIsPlaying(true); }}
                    className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-4">
                      <img src={track.cover_url} alt="" className="w-12 h-12 rounded-xl object-cover" />
                      <div>
                        <h4 className="font-bold text-sm group-hover:text-violet-400 transition">{track.title}</h4>
                        <p className="text-xs text-zinc-400">{track.artist_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="text-xs text-zinc-500">{formatTime(track.duration)}</span>
                      <button onClick={(e) => toggleLike(track.id, e)} className="text-pink-500">
                        <Heart className="w-5 h-5 fill-current" />
                      </button>
                    </div>
                  </div>
                ))}
                {likedTracks.length === 0 && (
                  <div className="text-center py-20 text-zinc-500">
                    <Heart className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">Список избранного пуст. Добавляйте треки сердечком!</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB: PREMIUM */}
          {currentTab === 'premium' && (
            <div className="max-w-4xl mx-auto space-y-10 py-4 animate-fade-in text-center">
              <div>
                <span className="px-3.5 py-1.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-extrabold uppercase tracking-widest border border-amber-500/30">
                  Fenix+ Subscription
                </span>
                <h1 className="text-4xl md:text-5xl font-black mt-4 bg-gradient-to-r from-amber-300 via-purple-400 to-pink-500 bg-clip-text text-transparent">
                  Музыка без границ и компромиссов
                </h1>
                <p className="text-zinc-400 text-sm mt-3 max-w-lg mx-auto">
                  Перейдите на Hi-Res аудиопоток, скачивайте треки для офлайн-прослушивания и забудьте про любую рекламу.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
                <div className="bg-white/5 border border-white/10 p-6 rounded-3xl flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-zinc-300">Базовый</h3>
                    <p className="text-3xl font-black mt-2 mb-4">0 ₽ <span className="text-xs font-normal text-zinc-500">навсегда</span></p>
                    <ul className="space-y-3 text-xs text-zinc-400 mb-8">
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-zinc-500" /> Стандартный битрейт 128 kbps</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-zinc-500" /> Доступ к каталогу треков</li>
                      <li className="flex items-center gap-2 text-zinc-600">✕ Реклама между треками</li>
                    </ul>
                  </div>
                  <button className="w-full py-3 rounded-2xl bg-white/10 font-bold text-xs text-zinc-300">Текущий тариф</button>
                </div>

                <div className="bg-gradient-to-b from-violet-600/20 via-purple-600/10 to-transparent border border-violet-500/50 p-6 rounded-3xl flex flex-col justify-between relative shadow-2xl">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-pink-600 text-white text-[10px] uppercase font-black px-3 py-1 rounded-full shadow-md">
                    Популярный выбор
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-violet-400">Fenix+ PRO</h3>
                    <p className="text-3xl font-black mt-2 mb-4">299 ₽ <span className="text-xs font-normal text-zinc-400">/ месяц</span></p>
                    <ul className="space-y-3 text-xs text-zinc-200 mb-8">
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-violet-400" /> Lossless звук FLAC 24-bit</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-violet-400" /> Полное отсутствие рекламы</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-violet-400" /> Офлайн-режим и скачивание</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-violet-400" /> Тексты песен в реальном времени</li>
                    </ul>
                  </div>
                  <button 
                    onClick={() => showNotification('Спасибо за оформление подписки Fenix+ PRO! 🎉')}
                    className="w-full py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 font-bold text-xs shadow-lg shadow-violet-600/30 hover:opacity-95 transition"
                  >
                    Подключить за 299 ₽
                  </button>
                </div>

                <div className="bg-white/5 border border-amber-500/30 p-6 rounded-3xl flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-bold text-amber-400">Family Hi-Res</h3>
                    <p className="text-3xl font-black mt-2 mb-4">499 ₽ <span className="text-xs font-normal text-zinc-400">/ месяц</span></p>
                    <ul className="space-y-3 text-xs text-zinc-400 mb-8">
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-400" /> До 5 аккаунтов для семьи</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-400" /> Индивидуальные рекомендации</li>
                      <li className="flex items-center gap-2"><Check className="w-4 h-4 text-amber-400" /> Максимальное качество Hi-Res</li>
                    </ul>
                  </div>
                  <button 
                    onClick={() => showNotification('Запрос на семейную подписку отправлен!')}
                    className="w-full py-3 rounded-2xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition"
                  >
                    Подключить Family
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Другие табуляции */}
          {(currentTab === 'history' || currentTab === 'downloads' || currentTab === 'radio' || currentTab === 'profile') && (
            <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
              <Disc className="w-16 h-16 mb-4 text-violet-500/30 animate-spin" />
              <h2 className="text-xl font-bold mb-2">Раздел «{currentTab}» полностью подготовлен</h2>
              <p className="text-sm text-zinc-500 max-w-md">Все логические блоки интерфейса зарезервированы под активные модули стриминга Fenix Engine.</p>
            </div>
          )}
        </div>
      </main>

      {/* Постоянная нижняя панель плеера */}
      <footer className="fixed bottom-0 left-0 right-0 h-24 bg-[#0d0d12]/95 backdrop-blur-2xl border-t border-white/10 px-6 flex items-center justify-between z-40">
        {/* Инфо о треке */}
        <div className="flex items-center gap-4 w-1/4 min-w-[220px]">
          <img src={currentTrack.cover_url} alt="" className="w-14 h-14 rounded-2xl object-cover shadow-lg" />
          <div className="min-w-0">
            <h4 className="font-bold text-sm truncate text-white">{currentTrack.title}</h4>
            <p className="text-xs text-zinc-400 truncate mt-0.5">{currentTrack.artist_name}</p>
          </div>
          <button onClick={(e) => toggleLike(currentTrack.id, e)} className="text-zinc-400 hover:text-pink-500 transition ml-2">
            <Heart className={`w-5 h-5 ${likedTracks.includes(currentTrack.id) ? 'fill-pink-500 text-pink-500' : ''}`} />
          </button>
        </div>

        {/* Центр: контроллеры и таймлайн */}
        <div className="flex flex-col items-center gap-2 w-2/4 max-w-xl">
          <div className="flex items-center gap-6">
            <button 
              onClick={() => { setShuffleMode(!shuffleMode); showNotification(shuffleMode ? 'Перемешивание выключено' : 'Перемешивание включено'); }}
              className={`transition ${shuffleMode ? 'text-violet-400' : 'text-zinc-500 hover:text-white'}`}
            >
              <Shuffle className="w-4 h-4" />
            </button>
            <button 
              onClick={() => showNotification('Предыдущий трек')}
              className="text-zinc-300 hover:text-white transition"
            >
              <SkipBack className="w-5 h-5 fill-current" />
            </button>
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-11 h-11 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition shadow-lg shadow-white/10"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current translate-x-0.5" />}
            </button>
            <button 
              onClick={() => showNotification('Следующий трек')}
              className="text-zinc-300 hover:text-white transition"
            >
              <SkipForward className="w-5 h-5 fill-current" />
            </button>
            <button 
              onClick={() => {
                const next = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
                setRepeatMode(next);
                showNotification(`Повтор: ${next === 'off' ? 'выключен' : next === 'all' ? 'всех треков' : 'трека'}`);
              }}
              className={`transition ${repeatMode !== 'off' ? 'text-violet-400' : 'text-zinc-500 hover:text-white'}`}
            >
              <Repeat className="w-4 h-4" />
            </button>
          </div>

          <div className="w-full flex items-center gap-3 text-xs text-zinc-500">
            <span>1:15</span>
            <div 
              className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden cursor-pointer relative group"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                setProgress(pos * 100);
              }}
            >
              <div 
                className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full relative" 
                style={{ width: `${progress}%` }}
              >
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow opacity-0 group-hover:opacity-100 transition" />
              </div>
            </div>
            <span>{formatTime(currentTrack.duration)}</span>
          </div>
        </div>

        {/* Правый блок: громкость и доп. функции */}
        <div className="hidden md:flex items-center justify-end gap-4 w-1/4">
          <button onClick={() => setPlaylistDrawerOpen(!playlistDrawerOpen)} className="text-zinc-400 hover:text-white transition" title="Очередь">
            <ListMusic className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setIsMuted(!isMuted)} className="text-zinc-400 hover:text-white transition">
              {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <input 
              type="range" 
              min="0" 
              max="100" 
              value={isMuted ? 0 : volume}
              onChange={(e) => { setVolume(Number(e.target.value)); setIsMuted(false); }}
              className="w-20 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-violet-500" 
            />
          </div>
        </div>
      </footer>

      {/* Выдвижная панель очереди воспроизведения */}
      {playlistDrawerOpen && (
        <div className="fixed right-0 top-0 bottom-24 w-80 bg-[#0c0c10]/95 backdrop-blur-2xl border-l border-white/10 z-50 p-6 flex flex-col shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-base">Очередь воспроизведения</h3>
            <button onClick={() => setPlaylistDrawerOpen(false)} className="text-zinc-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1">
            {queue.map((item, idx) => (
              <div 
                key={idx} 
                onClick={() => {
                  setCurrentTrack({ ...item, album: 'Queue Album', genre: 'Pop', plays: '100K' });
                  setIsPlaying(true);
                }}
                className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/10 transition cursor-pointer"
              >
                <img src={item.cover_url} alt="" className="w-10 h-10 rounded-xl object-cover" />
                <div className="flex-1 min-w-0">
                  <h5 className="font-bold text-xs truncate">{item.title}</h5>
                  <p className="text-[10px] text-zinc-400 truncate">{item.artist_name}</p>
                </div>
                <span className="text-[10px] text-zinc-500">{formatTime(item.duration)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center justify-between px-4 py-3 rounded-2xl font-bold text-xs cursor-pointer transition ${
        active 
          ? 'bg-violet-600/15 text-violet-400 border border-violet-500/30 shadow-inner' 
          : 'text-zinc-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      <div className="flex items-center gap-3">
        {React.cloneElement(icon, { className: 'w-4 h-4' })}
        <span>{label}</span>
      </div>
      {badge > 0 && (
        <span className="bg-violet-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
          {badge}
        </span>
      )}
    </div>
  );
}

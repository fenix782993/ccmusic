import React, { useState, useEffect, useRef } from 'react';
import {  
  Home, Search, Library, Heart, Disc, User,  
  Play, Pause, SkipBack, SkipForward, Volume2,  
  Repeat, Shuffle, Crown, Flame, Clock, Menu, X,
  Sliders, VolumeX, Radio, Sparkles, Shield,
  Share2, Plus, Check, Compass,
  TrendingUp, Music, Upload
} from 'lucide-react';

export default function FenixMusicApp() {
  const [currentTab, setCurrentTab] = useState('home');
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [repeatMode, setRepeatMode] = useState('off');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const [likedTracks, setLikedTracks] = useState([1, 3]);
  const [notifications, setNotifications] = useState([]);

  const [currentTrack, setCurrentTrack] = useState({
    id: 1,
    title: 'Neon Horizon',
    artist_name: 'CyberPulse',
    album: 'Cyber Odyssey (2026)',
    cover_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&auto=format&fit=crop&q=80',
    audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    duration: 214,
    genre: 'Synthwave',
    plays: '1,420,932'
  });

  const [tracks, setTracks] = useState([
    { id: 1, title: 'Neon Horizon', artist_name: 'CyberPulse', album: 'Cyber Odyssey', cover_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', genre: 'Synthwave', duration: 214, plays: '1.4M' },
    { id: 2, title: 'Midnight Rain', artist_name: 'Aura', album: 'Lost frequencies', cover_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=80', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', genre: 'Lo-Fi', duration: 198, plays: '980K' },
    { id: 3, title: 'Electric Dreams', artist_name: 'Vektor', album: 'Neon Grid', cover_url: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=80', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', genre: 'Electro', duration: 245, plays: '3.2M' },
    { id: 4, title: 'Quantum State', artist_name: 'Neural Drift', album: 'Deep Web', cover_url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=300&auto=format&fit=crop&q=80', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', genre: 'Ambient', duration: 310, plays: '450K' },
    { id: 5, title: 'Supernova Protocol', artist_name: 'Stellaris', album: 'Galaxy Express', cover_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&auto=format&fit=crop&q=80', audio_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', genre: 'Synthwave', duration: 180, plays: '2.1M' }
  ]);

  const audioRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrack]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const duration = audioRef.current.duration || currentTrack.duration;
      setProgress((current / duration) * 100);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fileUrl = URL.createObjectURL(file);
    const newTrack = {
      id: Date.now(),
      title: file.name.replace(/\.[^/.]+$/, ''),
      artist_name: 'Локальный файл',
      album: 'Загруженные',
      cover_url: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=80',
      audio_url: fileUrl,
      duration: 180,
      genre: 'Custom',
      plays: '1'
    };
    setTracks([newTrack, ...tracks]);
    setCurrentTrack(newTrack);
    setIsPlaying(true);
    showNotification('Трек успешно загружен и запущен! 🎵');
  };

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
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex h-screen bg-[#070709] text-white font-sans overflow-hidden select-none">
      <audio 
        ref={audioRef} 
        src={currentTrack.audio_url} 
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => {
          if (repeatMode === 'one') {
            audioRef.current.currentTime = 0;
            audioRef.current.play();
          } else {
            setIsPlaying(false);
          }
        }} 
      />

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept="audio/*" 
        className="hidden" 
      />

      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none max-w-xs w-full px-4">
        {notifications.map(n => (
          <div key={n.id} className="bg-zinc-900/95 border border-violet-500/30 text-white px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-md text-xs sm:text-sm font-medium flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
            <span className="truncate">{n.text}</span>
          </div>
        ))}
      </div>

      <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-[#0c0c10] border-r border-white/5 p-6 justify-between z-20">
        <div>
          <div className="flex items-center gap-3 mb-10 px-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 via-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-600/30">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="text-base lg:text-lg font-black tracking-widest bg-gradient-to-r from-violet-400 via-pink-400 to-white bg-clip-text text-transparent">
                FENIX MUSIC
              </span>
              <span className="block text-[10px] text-zinc-500 font-semibold tracking-wider uppercase">Hi-Res Streaming</span>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase px-3 mb-2">Меню</p>
              <nav className="space-y-1">
                <NavItem icon={<Home />} label="Главная" active={currentTab === 'home'} onClick={() => setCurrentTab('home')} />
                <NavItem icon={<Compass />} label="Обзор" active={currentTab === 'explore'} onClick={() => setCurrentTab('explore')} />
                <NavItem icon={<Search />} label="Поиск" active={currentTab === 'search'} onClick={() => setCurrentTab('search')} />
                <NavItem icon={<Radio />} label="Радио" active={currentTab === 'radio'} onClick={() => setCurrentTab('radio')} />
              </nav>
            </div>

            <div>
              <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase px-3 mb-2">Медиатека</p>
              <nav className="space-y-1">
                <NavItem icon={<Library />} label="Плейлисты" active={currentTab === 'library'} onClick={() => setCurrentTab('library')} />
                <NavItem icon={<Heart />} label="Избранное" active={currentTab === 'favorites'} onClick={() => setCurrentTab('favorites')} badge={likedTracks.length} />
                <NavItem icon={<Clock />} label="История" active={currentTab === 'history'} onClick={() => setCurrentTab('history')} />
                <NavItem icon={<Upload />} label="Загрузить трек" onClick={() => fileInputRef.current.click()} />
              </nav>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div 
            onClick={() => setCurrentTab('premium')}
            className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-purple-500/10 to-violet-500/10 border border-amber-500/20 cursor-pointer hover:border-amber-500/40 transition group"
          >
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5 text-amber-400 font-extrabold text-xs">
                <Crown className="w-3.5 h-3.5 fill-amber-400" /> Fenix+
              </div>
              <span className="text-[9px] bg-amber-400/20 text-amber-300 font-bold px-1.5 py-0.5 rounded-full">PRO</span>
            </div>
            <p className="text-[11px] text-zinc-400 group-hover:text-zinc-300 transition">Hi-Res Lossless звук и без рекламы.</p>
          </div>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/80 backdrop-blur-md">
          <div className="w-72 bg-[#0c0c10] h-full p-6 flex flex-col justify-between border-r border-white/10 overflow-y-auto">
            <div>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-violet-600 to-pink-500 flex items-center justify-center">
                    <Flame className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-extrabold tracking-wider bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">FENIX</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-2 text-zinc-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="space-y-2">
                <NavItem icon={<Home />} label="Главная" active={currentTab === 'home'} onClick={() => { setCurrentTab('home'); setMobileMenuOpen(false); }} />
                <NavItem icon={<Compass />} label="Обзор" active={currentTab === 'explore'} onClick={() => { setCurrentTab('explore'); setMobileMenuOpen(false); }} />
                <NavItem icon={<Search />} label="Поиск" active={currentTab === 'search'} onClick={() => { setCurrentTab('search'); setMobileMenuOpen(false); }} />
                <NavItem icon={<Library />} label="Медиатека" active={currentTab === 'library'} onClick={() => { setCurrentTab('library'); setMobileMenuOpen(false); }} />
                <NavItem icon={<Heart />} label="Избранное" active={currentTab === 'favorites'} onClick={() => { setCurrentTab('favorites'); setMobileMenuOpen(false); }} />
                <NavItem icon={<Crown />} label="Премиум" active={currentTab === 'premium'} onClick={() => { setCurrentTab('premium'); setMobileMenuOpen(false); }} />
                <NavItem icon={<Upload />} label="Загрузить аудио" onClick={() => { fileInputRef.current.click(); setMobileMenuOpen(false); }} />
              </nav>
            </div>
            <div className="p-3 bg-white/5 rounded-2xl border border-white/5 text-center mt-6">
              <p className="text-[11px] text-zinc-400 mb-2">Мобильная версия v4.2</p>
              <button onClick={() => { setCurrentTab('premium'); setMobileMenuOpen(false); }} className="w-full py-2 bg-violet-600 rounded-xl font-bold text-xs">Fenix+ PRO</button>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      <main className="flex-1 flex flex-col h-full overflow-y-auto pb-28">
        <header className="flex justify-between items-center px-4 sm:px-8 py-4 sticky top-0 bg-[#070709]/90 backdrop-blur-xl z-20 border-b border-white/5 gap-3">
          <div className="flex items-center gap-3 md:hidden">
            <button onClick={() => setMobileMenuOpen(true)} className="p-2 -ml-2 text-zinc-300">
              <Menu className="w-6 h-6" />
            </button>
            <span className="font-extrabold tracking-wider bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent text-sm">FENIX</span>
          </div>

          <div className="hidden sm:flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl flex-1 max-w-md border border-white/5 focus-within:border-violet-500/50 transition">
            <Search className="w-4 h-4 text-zinc-400 shrink-0" />
            <input 
              type="text" 
              placeholder="Трек, исполнитель или альбом..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-xs sm:text-sm w-full text-white placeholder-zinc-500" 
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => fileInputRef.current.click()}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/10 hover:bg-white/20 font-bold text-xs transition text-zinc-200 border border-white/10"
            >
              <Upload className="w-3.5 h-3.5" /> <span className="hidden xs:inline">Загрузить</span>
            </button>
            <div 
              onClick={() => setCurrentTab('profile')}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-zinc-800 border border-white/10 overflow-hidden flex items-center justify-center font-black text-violet-400 cursor-pointer hover:border-violet-500 transition text-xs"
            >
              FX
            </div>
          </div>
        </header>

        <div className="p-4 sm:p-8 flex-1 max-w-7xl w-full mx-auto space-y-6 sm:space-y-8">
          {currentTab === 'home' && (
            <div className="space-y-8 animate-fade-in">
              <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-violet-950/60 via-purple-950/30 to-[#070709] border border-white/10 p-6 sm:p-10 flex flex-col justify-end min-h-[260px] sm:min-h-[320px] shadow-2xl">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-violet-600/20 via-transparent to-transparent pointer-events-none" />
                <div className="relative z-10 max-w-xl">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-[11px] font-bold mb-3">
                    <Sparkles className="w-3.5 h-3.5" /> Эксклюзив 2026
                  </div>
                  <h1 className="text-2xl sm:text-5xl font-black tracking-tight mb-2 sm:mb-4 text-white">Cyber Odyssey</h1>
                  <p className="text-zinc-300 text-xs sm:text-base mb-6 leading-relaxed line-clamp-2 sm:line-clamp-none">
                    Масштабный синтвейв-альбом с поддержкой объемного звука Lossless.
                  </p>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => {
                        setCurrentTrack(tracks[0]);
                        setIsPlaying(true);
                        showNotification('Воспроизведение: Cyber Odyssey');
                      }}
                      className="flex items-center gap-2 bg-white text-black font-extrabold px-5 sm:px-7 py-3 rounded-full hover:bg-zinc-200 transition text-xs sm:text-sm shadow-xl"
                    >
                      <Play className="w-4 h-4 fill-current" /> Слушать
                    </button>
                    <button 
                      onClick={() => toggleLike(1, { stopPropagation: () => {} })}
                      className="w-11 h-11 rounded-full bg-white/10 border border-white/10 flex items-center justify-center hover:bg-white/20 transition shrink-0"
                    >
                      <Heart className={`w-4 h-4 ${likedTracks.includes(1) ? 'fill-pink-500 text-pink-500' : 'text-white'}`} />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-lg sm:text-xl font-bold mb-4 flex items-center gap-2">
                  <Flame className="text-pink-500 w-4 h-4 sm:w-5 sm:h-5" /> Треки в ротации
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {tracks.map((track) => (
                    <div 
                      key={track.id} 
                      onClick={() => {
                        setCurrentTrack(track);
                        setIsPlaying(true);
                      }}
                      className="flex items-center gap-3.5 bg-white/[0.03] p-3 rounded-2xl border border-white/5 hover:bg-white/[0.08] transition cursor-pointer group"
                    >
                      <img src={track.cover_url} alt={track.title} className="w-14 h-14 rounded-xl object-cover shadow-md shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-xs sm:text-sm truncate group-hover:text-violet-400 transition">{track.title}</h4>
                        <p className="text-[11px] sm:text-xs text-zinc-400 truncate mt-0.5">{track.artist_name}</p>
                        <span className="inline-block text-[9px] text-zinc-500 bg-white/5 px-2 py-0.5 rounded-md mt-1">{track.genre}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button 
                          onClick={(e) => toggleLike(track.id, e)}
                          className="p-2 text-zinc-500 hover:text-pink-500 transition"
                        >
                          <Heart className={`w-4 h-4 ${likedTracks.includes(track.id) ? 'fill-pink-500 text-pink-500' : ''}`} />
                        </button>
                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center md:opacity-0 group-hover:opacity-100 transition shadow">
                          <Play className="w-3.5 h-3.5 fill-current translate-x-0.5" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {currentTab === 'explore' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-xl sm:text-2xl font-black">Каталог треков</h2>
                <div className="flex gap-1.5 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
                  {['all', 'Synthwave', 'Lo-Fi', 'Electro', 'Ambient', 'Custom'].map((g) => (
                    <button 
                      key={g} 
                      onClick={() => setSelectedGenre(g)}
                      className={`px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-bold whitespace-nowrap transition ${selectedGenre === g ? 'bg-violet-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'}`}
                    >
                      {g === 'all' ? 'Все' : g}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {tracks
                  .filter(t => selectedGenre === 'all' || t.genre === selectedGenre)
                  .map(track => (
                    <div 
                      key={track.id}
                      onClick={() => { setCurrentTrack(track); setIsPlaying(true); }}
                      className="bg-white/[0.03] border border-white/5 rounded-2xl sm:rounded-3xl p-3 sm:p-4 hover:border-violet-500/40 transition cursor-pointer group flex flex-col justify-between"
                    >
                      <div>
                        <div className="relative aspect-square rounded-xl sm:rounded-2xl overflow-hidden mb-3 shadow-xl">
                          <img src={track.cover_url} alt={track.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-violet-600 flex items-center justify-center shadow-lg">
                              <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-white text-white translate-x-0.5" />
                            </div>
                          </div>
                        </div>
                        <h3 className="font-bold text-xs sm:text-sm truncate group-hover:text-violet-400 transition">{track.title}</h3>
                        <p className="text-[10px] sm:text-xs text-zinc-400 truncate mt-0.5">{track.artist_name}</p>
                      </div>
                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-white/5 text-[10px] text-zinc-500">
                        <span>{track.plays} прослушиваний</span>
                        <span>{formatTime(track.duration)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {currentTab === 'search' && (
            <div className="space-y-6 animate-fade-in max-w-2xl mx-auto pt-4">
              <div className="text-center">
                <h1 className="text-2xl sm:text-3xl font-black mb-2">Поиск музыки</h1>
                <p className="text-zinc-400 text-xs sm:text-sm">Ищите треки по названию в библиотеке</p>
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-3.5 w-4 h-4 text-zinc-400" />
                <input 
                  type="text" 
                  placeholder="Введите запрос..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3 text-xs sm:text-sm text-white placeholder-zinc-500 outline-none focus:border-violet-500 transition shadow-inner"
                />
              </div>

              <div className="space-y-2">
                {tracks
                  .filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.artist_name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(track => (
                    <div 
                      key={track.id}
                      onClick={() => { setCurrentTrack(track); setIsPlaying(true); }}
                      className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 cursor-pointer transition"
                    >
                      <div className="flex items-center gap-3">
                        <img src={track.cover_url} alt="" className="w-10 h-10 rounded-lg object-cover" />
                        <div>
                          <h4 className="font-bold text-xs">{track.title}</h4>
                          <p className="text-[10px] text-zinc-400">{track.artist_name}</p>
                        </div>
                      </div>
                      <Play className="w-4 h-4 text-violet-400" />
                    </div>
                  ))}
              </div>
            </div>
          )}

          {currentTab === 'library' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-xl sm:text-2xl font-black">Медиатека</h2>
                <button 
                  onClick={() => fileInputRef.current.click()}
                  className="px-4 py-2 rounded-xl bg-violet-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg"
                >
                  <Upload className="w-4 h-4" /> Загрузить аудиофайл с устройства
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { title: 'Избранное', count: `${likedTracks.length} треков`, desc: 'Ваши залайканные композиции', gradient: 'from-pink-600/30 to-violet-600/30', tab: 'favorites' },
                  { title: 'Локальные треки', count: `${tracks.filter(t => t.genre === 'Custom').length} файлов`, desc: 'Загруженные вами песни', gradient: 'from-blue-600/30 to-purple-600/30', tab: 'explore' },
                  { title: 'История ротации', count: 'Все треки', desc: 'Недавние композиции', gradient: 'from-amber-600/30 to-red-600/30', tab: 'home' }
                ].map((pl, i) => (
                  <div 
                    key={i} 
                    onClick={() => setCurrentTab(pl.tab)}
                    className={`p-5 rounded-3xl bg-gradient-to-br ${pl.gradient} border border-white/10 flex flex-col justify-between h-40 cursor-pointer hover:scale-[1.02] transition shadow-xl`}
                  >
                    <div>
                      <h3 className="font-extrabold text-base mb-1">{pl.title}</h3>
                      <p className="text-[11px] text-zinc-300">{pl.desc}</p>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-3 border-t border-white/10">
                      <span>{pl.count}</span>
                      <Play className="w-4 h-4 fill-white text-white" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {currentTab === 'favorites' && (
            <div className="space-y-4 animate-fade-in">
              <h2 className="text-xl sm:text-2xl font-black">Избранные треки</h2>
              <div className="space-y-2">
                {tracks.filter(t => likedTracks.includes(t.id)).map(track => (
                  <div 
                    key={track.id}
                    onClick={() => { setCurrentTrack(track); setIsPlaying(true); }}
                    className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.08] transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <img src={track.cover_url} alt="" className="w-10 h-10 rounded-xl object-cover" />
                      <div>
                        <h4 className="font-bold text-xs sm:text-sm group-hover:text-violet-400 transition">{track.title}</h4>
                        <p className="text-[10px] sm:text-xs text-zinc-400">{track.artist_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[11px] text-zinc-500">{formatTime(track.duration)}</span>
                      <button onClick={(e) => toggleLike(track.id, e)} className="text-pink-500">
                        <Heart className="w-4 h-4 fill-current" />
                      </button>
                    </div>
                  </div>
                ))}
                {likedTracks.length === 0 && (
                  <div className="text-center py-16 text-zinc-500 text-xs">
                    Список избранного пуст.
                  </div>
                )}
              </div>
            </div>
          )}

          {currentTab === 'premium' && (
            <div className="max-w-3xl mx-auto space-y-6 py-2 animate-fade-in text-center">
              <div>
                <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 text-[10px] font-extrabold uppercase tracking-widest border border-amber-500/30">
                  Fenix+ PRO
                </span>
                <h1 className="text-2xl sm:text-4xl font-black mt-3 bg-gradient-to-r from-amber-300 via-purple-400 to-pink-500 bg-clip-text text-transparent">
                  Музыка без ограничений
                </h1>
                <p className="text-zinc-400 text-xs sm:text-sm mt-2 max-w-md mx-auto">
                  Lossless аудиопоток и полная свобода загрузки треков.
                </p>
              </div>

              <div className="bg-gradient-to-b from-violet-600/20 via-purple-600/10 to-transparent border border-violet-500/50 p-6 rounded-3xl text-left max-w-md mx-auto shadow-2xl">
                <h3 className="text-base font-bold text-violet-400">Fenix+ PRO</h3>
                <p className="text-2xl font-black mt-1 mb-4">299 ₽ <span className="text-xs font-normal text-zinc-400">/ месяц</span></p>
                <ul className="space-y-2.5 text-xs text-zinc-200 mb-6">
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-violet-400" /> Lossless звук FLAC 24-bit</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-violet-400" /> Без ограничений на размер загрузки</li>
                  <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5 text-violet-400" /> Офлайн-кэширование треков</li>
                </ul>
                <button 
                  onClick={() => showNotification('Подписка Fenix+ PRO активирована! 🎉')}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-violet-600 to-pink-600 font-bold text-xs shadow-lg shadow-violet-600/30"
                >
                  Подключить за 299 ₽
                </button>
              </div>
            </div>
          )}

          {(currentTab === 'history' || currentTab === 'radio' || currentTab === 'profile') && (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
              <Disc className="w-12 h-12 mb-3 text-violet-500/30 animate-spin" />
              <h2 className="text-base font-bold mb-1">Раздел в разработке</h2>
              <p className="text-xs text-zinc-500">Скоро здесь появится расширенный функционал.</p>
            </div>
          )}
        </div>
      </main>

      <footer className="fixed bottom-0 left-0 right-0 h-20 sm:h-24 bg-[#0d0d12]/95 backdrop-blur-2xl border-t border-white/10 px-4 sm:px-6 flex items-center justify-between z-40 gap-2">
        <div className="flex items-center gap-3 w-1/3 sm:w-1/4 min-w-0">
          <img src={currentTrack.cover_url} alt="" className="w-11 h-11 sm:w-13 sm:h-13 rounded-xl object-cover shadow-lg shrink-0" />
          <div className="min-w-0">
            <h4 className="font-bold text-xs sm:text-sm truncate text-white">{currentTrack.title}</h4>
            <p className="text-[10px] sm:text-xs text-zinc-400 truncate mt-0.5">{currentTrack.artist_name}</p>
          </div>
          <button onClick={(e) => toggleLike(currentTrack.id, e)} className="text-zinc-400 hover:text-pink-500 transition hidden xs:block ml-1">
            <Heart className={`w-4 h-4 ${likedTracks.includes(currentTrack.id) ? 'fill-pink-500 text-pink-500' : ''}`} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-1.5 w-1/3 sm:w-2/4 max-w-xl">
          <div className="flex items-center gap-4 sm:gap-6">
            <button 
              onClick={() => { setShuffleMode(!shuffleMode); showNotification(shuffleMode ? 'Перемешивание выключено' : 'Перемешивание включено'); }}
              className={`hidden sm:block transition ${shuffleMode ? 'text-violet-400' : 'text-zinc-500 hover:text-white'}`}
            >
              <Shuffle className="w-3.5 h-3.5" />
            </button>
            <button 
              onClick={() => {
                const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
                const prevIndex = (currentIndex - 1 + tracks.length) % tracks.length;
                setCurrentTrack(tracks[prevIndex]);
                setIsPlaying(true);
              }}
              className="text-zinc-300 hover:text-white transition"
            >
              <SkipBack className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            </button>
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition shadow-lg shrink-0"
            >
              {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-current" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 fill-current translate-x-0.5" />}
            </button>
            <button 
              onClick={() => {
                const currentIndex = tracks.findIndex(t => t.id === currentTrack.id);
                const nextIndex = (currentIndex + 1) % tracks.length;
                setCurrentTrack(tracks[nextIndex]);
                setIsPlaying(true);
              }}
              className="text-zinc-300 hover:text-white transition"
            >
              <SkipForward className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
            </button>
            <button 
              onClick={() => {
                const next = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
                setRepeatMode(next);
                showNotification(`Повтор: ${next === 'off' ? 'выключен' : next === 'all' ? 'все' : 'трек'}`);
              }}
              className={`hidden sm:block transition ${repeatMode !== 'off' ? 'text-violet-400' : 'text-zinc-500 hover:text-white'}`}
            >
              <Repeat className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="w-full flex items-center gap-2 text-[10px] text-zinc-500">
            <span className="hidden xs:inline">
              {audioRef.current ? formatTime(audioRef.current.currentTime) : '0:00'}
            </span>
            <div 
              className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden cursor-pointer relative group"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const pos = (e.clientX - rect.left) / rect.width;
                if (audioRef.current && audioRef.current.duration) {
                  audioRef.current.currentTime = pos * audioRef.current.duration;
                }
              }}
            >
              <div 
                className="h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full relative" 
                style={{ width: `${progress}%` }}
              />
            </div>
            <span>{formatTime(currentTrack.duration)}</span>
          </div>
        </div>

        <div className="hidden md:flex items-center justify-end gap-3 w-1/4">
          <div className="flex items-center gap-2">
            <button onClick={() => setIsMuted(!isMuted)} className="text-zinc-400 hover:text-white transition">
              {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
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
    </div>
  );
}

function NavItem({ icon, label, active, onClick, badge }) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-xs cursor-pointer transition ${
        active 
          ? 'bg-violet-600/15 text-violet-400 border border-violet-500/30' 
          : 'text-zinc-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      <div className="flex items-center gap-2.5">
        {React.cloneElement(icon, { className: 'w-4 h-4' })}
        <span>{label}</span>
      </div>
      {badge > 0 && (
        <span className="bg-violet-600 text-white text-[9px] px-2 py-0.5 rounded-full font-black">
          {badge}
        </span>
      )}
    </div>
  );
}

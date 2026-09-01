* {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  padding: 0;
  width: 100%;
  min-height: 100%;
}

body {
  background: #050507;
  color: white;
  font-family:
    Inter,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Arial,
    sans-serif;
}

button {
  font: inherit;
}

.app {
  min-height: 100vh;
  background:
    radial-gradient(
      circle at 80% 10%,
      rgba(255, 30, 60, 0.14),
      transparent 35%
    ),
    radial-gradient(
      circle at 20% 30%,
      rgba(120, 0, 255, 0.08),
      transparent 30%
    ),
    #050507;
  padding-bottom: 130px;
}

.header {
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 5%;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  background: rgba(5,5,7,0.8);
  backdrop-filter: blur(20px);
  position: sticky;
  top: 0;
  z-index: 20;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: 900;
  letter-spacing: 1px;
}

.logo-fire {
  font-size: 25px;
}

.status {
  color: #aaa;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  gap: 7px;
  align-items: center;
}

.status-dot {
  width: 8px;
  height: 8px;
  background: #35e27d;
  border-radius: 50%;
  box-shadow: 0 0 15px #35e27d;
}

.content {
  width: min(1400px, 90%);
  margin: auto;
}

.hero {
  min-height: 520px;
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  align-items: center;
  gap: 40px;
}

.hero-label {
  color: #ff3150;
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 4px;
  margin-bottom: 15px;
}

.hero h1 {
  font-size: clamp(50px, 7vw, 100px);
  line-height: 0.95;
  margin: 0;
  font-weight: 950;
  letter-spacing: -5px;
}

.hero h1 span {
  color: #ff3150;
  text-shadow:
    0 0 25px rgba(255,49,80,0.35);
}

.hero p {
  color: #a1a1aa;
  max-width: 600px;
  line-height: 1.7;
  font-size: 17px;
  margin: 30px 0;
}

.hero-button {
  background: #ff3150;
  color: white;
  padding: 15px 25px;
  border-radius: 12px;
  font-weight: 800;
  box-shadow:
    0 10px 40px rgba(255,49,80,0.25);
  transition: 0.2s;
}

.hero-button:hover {
  transform: translateY(-2px);
  box-shadow:
    0 15px 50px rgba(255,49,80,0.4);
}

.hero-glow {
  display: flex;
  justify-content: center;
  align-items: center;
}

.disc {
  width: min(350px, 70vw);
  aspect-ratio: 1;
  border-radius: 50%;
  background:
    repeating-radial-gradient(
      circle,
      #111 0,
      #111 7px,
      #19191d 8px,
      #19191d 11px
    );
  box-shadow:
    0 0 70px rgba(255,30,60,0.25),
    0 0 150px rgba(255,30,60,0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: spin 14s linear infinite;
}

.disc-center {
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: #ff3150;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: 950;
  box-shadow: 0 0 35px rgba(255,49,80,0.5);
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.section {
  margin-top: 40px;
}

.section-title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-title h2 {
  font-size: 28px;
  margin: 0;
}

.section-title button {
  background: #18181b;
  color: #aaa;
  padding: 9px 15px;
  border-radius: 9px;
}

.tracks {
  display: grid;
  grid-template-columns:
    repeat(auto-fill, minmax(190px, 1fr));
  gap: 22px;
}

.track {
  background: #0d0d10;
  border: 1px solid rgba(255,255,255,0.06);
  padding: 12px;
  border-radius: 16px;
  cursor: pointer;
  transition: 0.2s;
}

.track:hover {
  transform: translateY(-5px);
  border-color: rgba(255,49,80,0.4);
  background: #111116;
}

.cover {
  position: relative;
  aspect-ratio: 1;
  border-radius: 12px;
  overflow: hidden;
  background: #18181b;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40px;
  font-weight: 950;
  color: #ff3150;
}

.cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.play-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background: rgba(0,0,0,0.45);
  opacity: 0;
  transition: 0.2s;
  font-size: 35px;
}

.track:hover .play-overlay {
  opacity: 1;
}

.track-info {
  padding: 12px 4px 5px;
}

.track-info h3 {
  margin: 0;
  font-size: 15px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.track-info p {
  margin: 5px 0 0;
  color: #71717a;
  font-size: 13px;
}

.message {
  background: #0d0d10;
  border: 1px solid #202027;
  border-radius: 14px;
  padding: 30px;
  text-align: center;
  color: #999;
}

.message button {
  display: block;
  margin: 15px auto 0;
  background: #ff3150;
  color: white;
  border-radius: 8px;
  padding: 9px 16px;
}

.error {
  color: #ff6b7e;
}

.player {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  min-height: 90px;
  background: rgba(10,10,13,0.96);
  border-top: 1px solid rgba(255,255,255,0.08);
  backdrop-filter: blur(25px);
  display: flex;
  align-items: center;
  gap: 25px;
  padding: 12px 5%;
  z-index: 100;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 230px;
}

.player-cover {
  width: 55px;
  height: 55px;
  border-radius: 9px;
  background: #18181b;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ff3150;
  font-weight: 900;
  overflow: hidden;
}

.player-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.player-info strong,
.player-info span {
  display: block;
}

.player-info span {
  color: #71717a;
  font-size: 12px;
  margin-top: 4px;
}

.player audio {
  flex: 1;
  max-width: 700px;
}

.close-player {
  background: #18181b;
  color: #aaa;
  width: 38px;
  height: 38px;
  border-radius: 50%;
}

@media (max-width: 700px) {
  .header {
    height: 62px;
    padding: 0 18px;
  }

  .content {
    width: calc(100% - 30px);
  }

  .hero {
    min-height: auto;
    padding: 60px 0 30px;
    display: block;
  }

  .hero h1 {
    font-size: 55px;
    letter-spacing: -3px;
  }

  .hero p {
    font-size: 15px;
  }

  .hero-glow {
    margin-top: 50px;
  }

  .disc {
    width: 230px;
  }

  .tracks {
    grid-template-columns:
      repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .track {
    padding: 8px;
    border-radius: 12px;
  }

  .player {
    padding: 10px 14px;
    gap: 10px;
    flex-wrap: wrap;
  }

  .player-info {
    min-width: 0;
    flex: 1;
  }

  .player audio {
    width: 100%;
    order: 3;
  }
}

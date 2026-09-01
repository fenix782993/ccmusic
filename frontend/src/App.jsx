import React, { useEffect, useMemo, useRef, useState } from "react";

const API_BASE =
import.meta.env.VITE_API_URL || "https://ccmusice.onrender.com";

const DEMO_TRACKS = [
{
id: "demo-1",
title: "Neon Dreams",
artist: "Fenix Music",
album: "Night Drive",
cover:
"https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=700&q=80",
duration: 214,
audio: "",
genre: "Electronic",
},
{
id: "demo-2",
title: "Midnight City",
artist: "Fenix Wave",
album: "After Dark",
cover:
"https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=700&q=80",
duration: 197,
audio: "",
genre: "Synthwave",
},
{
id: "demo-3",
title: "Red Lights",
artist: "Nova",
album: "Velocity",
cover:
"https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?auto=format&fit=crop&w=700&q=80",
duration: 231,
audio: "",
genre: "Pop",
},
{
id: "demo-4",
title: "Lost Signal",
artist: "Fenix",
album: "Signals",
cover:
"https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=700&q=80",
duration: 189,
audio: "",
genre: "Chill",
},
{
id: "demo-5",
title: "After Hours",
artist: "Luma",
album: "Late Night",
cover:
"https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=700&q=80",
duration: 203,
audio: "",
genre: "R&B",
},
{
id: "demo-6",
title: "Gravity",
artist: "Astra",
album: "Orbit",
cover:
"https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=700&q=80",
duration: 247,
audio: "",
genre: "Dance",
},
{
id: "demo-7",
title: "Fireline",
artist: "Kairo",
album: "Fireline",
cover:
"https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=700&q=80",
duration: 221,
audio: "",
genre: "Hip-Hop",
},
{
id: "demo-8",
title: "Ocean",
artist: "Mira",
album: "Blue",
cover:
"https://images.unsplash.com/photo-1498038432885-c6f3b1b2f4b0?auto=format&fit=crop&w=700&q=80",
duration: 264,
audio: "",
genre: "Ambient",
},
];

const GENRES = [
"Все",
"Pop",
"Hip-Hop",
"Electronic",
"Synthwave",
"R&B",
"Rock",
"Chill",
"Dance",
"Ambient",
];

const CSS = `
:root {
--bg: #060609;
--panel: #0d0d12;
--panel2: #121219;
--panel3: #191921;
--line: rgba(255,255,255,.08);
--text: #fff;
--muted: #9999a8;
--red: #ff174f;
--red2: #ff426e;
--purple: #7c4dff;
--green: #26d98b;
}

{
box-sizing: border-box;
}

.fm-app {
min-height: 100vh;
background:
radial-gradient(circle at 80% 0%, rgba(255,23,79,.12), transparent 30%),
radial-gradient(circle at 20% 20%, rgba(124,77,255,.08), transparent 28%),
var(--bg);
color: var(--text);
font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.fm-layout {
display: flex;
min-height: 100vh;
}

.fm-sidebar {
position: fixed;
z-index: 30;
left: 0;
top: 0;
bottom: 0;
width: 250px;
background: rgba(8,8,12,.94);
border-right: 1px solid var(--line);
padding: 24px 16px;
overflow-y: auto;
backdrop-filter: blur(20px);
}

.fm-logo {
display: flex;
align-items: center;
gap: 11px;
padding: 4px 12px 28px;
font-size: 21px;
font-weight: 900;
letter-spacing: -.5px;
}

.fm-logo-mark {
width: 36px;
height: 36px;
display: grid;
place-items: center;
border-radius: 12px;
background: linear-gradient(135deg, var(--red), #b300ff);
box-shadow: 0 8px 30px rgba(255,23,79,.3);
}

.fm-nav-title {
color: #686875;
font-size: 11px;
text-transform: uppercase;
font-weight: 800;
padding: 15px 12px 8px;
letter-spacing: 1px;
}

.fm-nav button {
width: 100%;
display: flex;
align-items: center;
gap: 13px;
padding: 12px 13px;
margin: 2px 0;
color: #a7a7b3;
background: transparent;
border-radius: 11px;
text-align: left;
transition: .2s;
}

.fm-nav button:hover,
.fm-nav button.active {
color: #fff;
background: rgba(255,255,255,.07);
}

.fm-nav button.active {
box-shadow: inset 3px 0 0 var(--red);
}

.fm-main {
width: calc(100% - 250px);
margin-left: 250px;
padding-bottom: 120px;
}

.fm-header {
position: sticky;
top: 0;
z-index: 20;
display: flex;
align-items: center;
gap: 18px;
padding: 17px 30px;
background: rgba(6,6,9,.78);
border-bottom: 1px solid rgba(255,255,255,.05);
backdrop-filter: blur(20px);
}

.fm-search {
flex: 1;
max-width: 650px;
position: relative;
}

.fm-search input {
width: 100%;
height: 45px;
border: 1px solid var(--line);
border-radius: 13px;
outline: none;
background: #101016;
color: #fff;
padding: 0 17px 0 44px;
font-size: 14px;
}

.fm-search input:focus {
border-color: rgba(255,23,79,.5);
box-shadow: 0 0 0 3px rgba(255,23,79,.08);
}

.fm-search-icon {
position: absolute;
left: 16px;
top: 13px;
color: #777784;
}

.fm-header-actions {
margin-left: auto;
display: flex;
gap: 9px;
}

.fm-icon-btn,
.fm-user-btn {
border: 1px solid var(--line);
background: #111117;
color: #fff;
border-radius: 11px;
min-width: 42px;
height: 42px;
display: grid;
place-items: center;
}

.fm-user-btn {
padding: 0 14px;
display: flex;
gap: 9px;
font-weight: 700;
}

.fm-content {
max-width: 1500px;
margin: auto;
padding: 30px;
}

.fm-hero {
min-height: 330px;
border-radius: 25px;
overflow: hidden;
position: relative;
display: flex;
align-items: flex-end;
padding: 35px;
background:
linear-gradient(90deg, rgba(0,0,0,.9), rgba(0,0,0,.25)),
url("https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1600&q=85")
center/cover;
box-shadow: 0 30px 70px rgba(0,0,0,.35);
}

.fm-hero-content {
max-width: 650px;
}

.fm-eyebrow {
color: #ff7798;
font-size: 12px;
font-weight: 900;
text-transform: uppercase;
letter-spacing: 2px;
}

.fm-hero h1 {
font-size: clamp(34px,5vw,65px);
line-height: .98;
margin: 12px 0;
letter-spacing: -3px;
}

.fm-hero p {
color: #c4c4ce;
max-width: 550px;
line-height: 1.6;
}

.fm-buttons {
display: flex;
flex-wrap: wrap;
gap: 10px;
margin-top: 20px;
}

.fm-primary,
.fm-secondary {
height: 44px;
padding: 0 19px;
border-radius: 12px;
font-weight: 800;
color: #fff;
}

.fm-primary {
background: linear-gradient(135deg,var(--red),#ff365e);
box-shadow: 0 10px 28px rgba(255,23,79,.25);
}

.fm-secondary {
background: rgba(255,255,255,.08);
border: 1px solid var(--line);
}

.fm-section {
margin-top: 38px;
}

.fm-section-head {
display: flex;
align-items: center;
justify-content: space-between;
margin-bottom: 17px;
}

.fm-section-head h2 {
margin: 0;
font-size: 22px;
}

.fm-link {
color: #ff5d7e;
background: none;
font-weight: 700;
}

.fm-chips {
display: flex;
gap: 9px;
overflow-x: auto;
padding-bottom: 5px;
}

.fm-chip {
flex: 0 0 auto;
border: 1px solid var(--line);
background: #101016;
color: #aaaab5;
border-radius: 999px;
padding: 9px 16px;
}

.fm-chip.active {
background: #fff;
color: #08080a;
}

.fm-grid {
display: grid;
grid-template-columns: repeat(6,minmax(0,1fr));
gap: 18px;
}

.fm-card {
min-width: 0;
cursor: pointer;
}

.fm-cover {
position: relative;
aspect-ratio: 1;
border-radius: 16px;
overflow: hidden;
background: #16161c;
box-shadow: 0 12px 30px rgba(0,0,0,.25);
}

.fm-cover img {
width: 100%;
height: 100%;
object-fit: cover;
transition: .3s;
}

.fm-card:hover .fm-cover img {
transform: scale(1.05);
}

.fm-cover-play {
position: absolute;
right: 10px;
bottom: 10px;
width: 44px;
height: 44px;
border-radius: 50%;
background: var(--red);
color: #fff;
display: grid;
place-items: center;
opacity: 0;
transform: translateY(8px);
transition: .2s;
box-shadow: 0 10px 25px rgba(255,23,79,.4);
}

.fm-card:hover .fm-cover-play,
.fm-cover-play.visible {
opacity: 1;
transform: translateY(0);
}

.fm-card-title {
margin-top: 11px;
font-weight: 800;
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;
}

.fm-card-artist {
color: var(--muted);
font-size: 13px;
margin-top: 4px;
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;
}

.fm-track-list {
display: flex;
flex-direction: column;
gap: 3px;
}

.fm-track {
display: grid;
grid-template-columns: 42px minmax(0,1fr) 90px 70px 44px;
gap: 13px;
align-items: center;
padding: 9px 12px;
border-radius: 12px;
}

.fm-track:hover,
.fm-track.active {
background: rgba(255,255,255,.06);
}

.fm-track-cover {
width: 42px;
height: 42px;
border-radius: 8px;
object-fit: cover;
}

.fm-track-main {
min-width: 0;
}

.fm-track-title {
font-weight: 700;
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;
}

.fm-track-artist {
color: var(--muted);
font-size: 12px;
margin-top: 3px;
}

.fm-track-album,
.fm-track-time {
color: #777784;
font-size: 13px;
}

.fm-track-actions {
display: flex;
justify-content: flex-end;
}

.fm-small-btn {
width: 34px;
height: 34px;
border-radius: 9px;
background: transparent;
color: #858590;
}

.fm-small-btn:hover,
.fm-small-btn.liked {
color: var(--red);
background: rgba(255,23,79,.1);
}

.fm-empty {
padding: 55px 20px;
text-align: center;
color: #777784;
border: 1px dashed var(--line);
border-radius: 18px;
}

.fm-player {
position: fixed;
z-index: 50;
left: 250px;
right: 0;
bottom: 0;
height: 84px;
background: rgba(12,12,17,.96);
border-top: 1px solid var(--line);
backdrop-filter: blur(25px);
display: grid;
grid-template-columns: minmax(220px,1fr) minmax(300px,1.5fr) minmax(180px,1fr);
align-items: center;
gap: 20px;
padding: 10px 20px;
}

.fm-now {
min-width: 0;
display: flex;
align-items: center;
gap: 11px;
}

.fm-now img {
width: 58px;
height: 58px;
border-radius: 9px;
object-fit: cover;
}

.fm-now-text {
min-width: 0;
}

.fm-now-title {
font-weight: 800;
white-space: nowrap;
overflow: hidden;
text-overflow: ellipsis;
}

.fm-now-artist {
color: var(--muted);
font-size: 12px;
margin-top: 4px;
}

.fm-player-center {
display: flex;
flex-direction: column;
gap: 5px;
}

.fm-controls {
display: flex;
align-items: center;
justify-content: center;
gap: 9px;
}

.fm-control {
width: 34px;
height: 34px;
border-radius: 50%;
background: transparent;
color: #aaaab5;
}

.fm-control:hover {
color: #fff;
}

.fm-play {
width: 43px;
height: 43px;
border-radius: 50%;
background: #fff;
color: #050507;
display: grid;
place-items: center;
}

.fm-progress {
display: flex;
align-items: center;
gap: 8px;
color: #777784;
font-size: 10px;
}

.fm-range {
flex: 1;
accent-color: var(--red);
}

.fm-player-right {
display: flex;
align-items: center;
justify-content: flex-end;
gap: 8px;
}

.fm-volume {
width: 100px;
accent-color: var(--red);
}

.fm-modal-bg {
position: fixed;
z-index: 100;
inset: 0;
display: grid;
place-items: center;
padding: 20px;
background: rgba(0,0,0,.72);
backdrop-filter: blur(14px);
}

.fm-modal {
width: min(460px,100%);
background: #111117;
border: 1px solid var(--line);
border-radius: 22px;
padding: 25px;
box-shadow: 0 30px 100px rgba(0,0,0,.6);
}

.fm-modal-head {
display: flex;
align-items: center;
justify-content: space-between;
margin-bottom: 20px;
}

.fm-modal-head h2 {
margin: 0;
}

.fm-close {
width: 38px;
height: 38px;
border-radius: 10px;
background: rgba(255,255,255,.07);
color: #fff;
}

.fm-field {
margin-top: 13px;
}

.fm-field label {
display: block;
font-size: 12px;
color: #8b8b97;
margin-bottom: 6px;
}

.fm-field input {
width: 100%;
height: 45px;
border: 1px solid var(--line);
border-radius: 11px;
background: #0a0a0e;
color: #fff;
outline: none;
padding: 0 13px;
}

.fm-field input:focus {
border-color: rgba(255,23,79,.6);
}

.fm-captcha {
margin-top: 15px;
padding: 14px;
border-radius: 13px;
background:
repeating-linear-gradient(
135deg,
rgba(255,255,255,.025) 0px,
rgba(255,255,255,.025) 2px,
transparent 2px,
transparent 8px
),
#19191f;
border: 1px solid var(--line);
}

.fm-captcha-code {
height: 65px;
display: grid;
place-items: center;
font-size: 34px;
font-weight: 900;
letter-spacing: 9px;
color: #fff;
user-select: none;
text-shadow: 3px 0 var(--red), -2px 0 var(--purple);
}

.fm-captcha-row {
display: flex;
gap: 8px;
margin-top: 9px;
}

.fm-captcha-row input {
flex: 1;
}

.fm-captcha-refresh {
width: 48px;
border-radius: 10px;
background: rgba(255,255,255,.08);
color: #fff;
}

.fm-error {
margin-top: 10px;
padding: 10px;
border-radius: 10px;
background: rgba(255,23,79,.1);
color: #ff708e;
font-size: 13px;
}

.fm-success {
margin-top: 10px;
padding: 10px;
border-radius: 10px;
background: rgba(38,217,139,.1);
color: #55e9a8;
font-size: 13px;
}

.fm-modal-submit {
width: 100%;
height: 46px;
margin-top: 17px;
border-radius: 12px;
color: #fff;
background: linear-gradient(135deg,var(--red),#d600ff);
font-weight: 900;
}

.fm-switch {
margin-top: 15px;
text-align: center;
color: #888894;
font-size: 13px;
}

.fm-switch button {
color: #ff5277;
background: none;
font-weight: 800;
}

.fm-mobile-nav {
display: none;
}

.fm-mobile-menu {
display: none;
}

.fm-toast {
position: fixed;
right: 25px;
bottom: 105px;
z-index: 200;
background: #19191f;
border: 1px solid var(--line);
border-radius: 13px;
padding: 13px 17px;
box-shadow: 0 15px 50px rgba(0,0,0,.45);
animation: toastIn .2s ease;
}

@keyframes toastIn {
from { opacity: 0; transform: translateY(10px); }
to { opacity: 1; transform: translateY(0); }
}

@media(max-width:1300px) {
.fm-grid {
grid-template-columns: repeat(4,minmax(0,1fr));
}
}

@media(max-width:900px) {
.fm-sidebar {
display: none;
}

.fm-main {
width: 100%;
margin-left: 0;
}

.fm-player {
left: 0;
height: 74px;
grid-template-columns: 1fr auto;
}

.fm-player-center {
display: none;
}

.fm-player-right {
display: none;
}

.fm-content {
padding: 18px;
}

.fm-header {
padding: 12px 15px;
}

.fm-mobile-nav {
position: fixed;
z-index: 60;
left: 0;
right: 0;
bottom: 0;
display: flex;
height: 66px;
background: rgba(10,10,14,.97);
border-top: 1px solid var(--line);
backdrop-filter: blur(20px);
}

.fm-mobile-nav button {
flex: 1;
background: transparent;
color: #777784;
font-size: 10px;
}

.fm-mobile-nav button.active {
color: #fff;
}

.fm-mobile-nav span {
display: block;
margin-top: 3px;
}

.fm-grid {
grid-template-columns: repeat(2,minmax(0,1fr));
}

.fm-track {
grid-template-columns: 42px minmax(0,1fr) 38px;
}

.fm-track-album,
.fm-track-time {
display: none;
}

.fm-header-actions .fm-user-btn {
display: none;
}

.fm-hero {
min-height: 390px;
padding: 23px;
}
}

@media(max-width:520px) {
.fm-search {
max-width: none;
}

.fm-header-actions {
display: none;
}

.fm-hero h1 {
letter-spacing: -2px;
}

.fm-hero p {
font-size: 13px;
}

.fm-section {
margin-top: 28px;
}
}
`;

function Icon({ name, size = 20 }) {
const common = {
width: size,
height: size,
viewBox: "0 0 24 24",
fill: "none",
stroke: "currentColor",
strokeWidth: 2,
strokeLinecap: "round",
strokeLinejoin: "round",
};

const paths = {
home: (
<>
<path d="M3 10.5 12 3l9 7.5" />
<path d="M5 9.5V21h14V9.5" />
<path d="M9 21v-7h6v7" />
</>
),
search: (
<>
<circle cx="11" cy="11" r="7" />
<path d="m20 20-4-4" />
</>
),
heart: <path d="M20.8 8.8c0 5.4-8.8 11-8.8 11s-8.8-5.6-8.8-11A4.8 4.8 0 0 1 12 6.1a4.8 4.8 0 0 1 8.8 2.7Z" />,
music: (
<>
<path d="M9 18V5l10-2v13" />
<circle cx="6" cy="18" r="3" />
<circle cx="16" cy="16" r="3" />
</>
),
library: (
<>
<path d="M4 5h16" />
<path d="M4 12h16" />
<path d="M4 19h16" />
</>
),
user: (
<>
<circle cx="12" cy="8" r="4" />
<path d="M4 21c.7-4 3.4-6 8-6s7.3 2 8 6" />
</>
),
play: <path d="m8 5 11 7-11 7V5Z" />,
pause: (
<>
<path d="M8 5v14" />
<path d="M16 5v14" />
</>
),
next: (
<>
<path d="m6 4 9 8-9 8V4Z" />
<path d="M18 5v14" />
</>
),
prev: (
<>
<path d="m18 4-9 8 9 8V4Z" />
<path d="M6 5v14" />
</>
),
shuffle: (
<>
<path d="M3 7h3c5 0 7 10 12 10h3" />
<path d="m18 14 3 3-3 3" />
<path d="M3 17h3c1.4 0 2.6-.6 3.6-1.5" />
<path d="M14.4 8.5C15.4 7.6 16.6 7 18 7h3" />
<path d="m18 4 3 3-3 3" />
</>
),
repeat: (
<>
<path d="M17 2l4 4-4 4" />
<path d="M3 11V9a3 3 0 0 1 3-3h15" />
<path d="m7 22-4-4 4-4" />
<path d="M21 13v2a3 3 0 0 1-3 3H3" />
</>
),
volume: (
<>
<path d="M4 9v6h4l5 4V5L8 9H4Z" />
<path d="M16 9.5a4 4 0 0 1 0 5" />
<path d="M18.5 7a8 8 0 0 1 0 10" />
</>
),
close: (
<>
<path d="m6 6 12 12" />
<path d="m18 6-12 12" />
</>
),
refresh: (
<>
<path d="M20 11a8 8 0 0 0-14-5L3 9" />
<path d="M3 4v5h5" />
<path d="M4 13a8 8 0 0 0 14 5l3-3" />
<path d="M21 20v-5h-5" />
</>
),
more: (
<>
<circle cx="5" cy="12" r="1" />
<circle cx="12" cy="12" r="1" />
<circle cx="19" cy="12" r="1" />
</>
),
spark: (
<>
<path d="m12 2 1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6L12 2Z" />
<path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />
</>
),
flame: (
<path d="M12 22c4.4 0 7-3.1 7-7.2 0-3.5-2.2-6.3-5.1-9.8.1 2.9-1 4.7-2.4 5.6C11.7 7 9.8 4.6 8.1 3 8.6 7.8 5 10.2 5 14.5 5 18.8 8 22 12 22Z" />
),
};

return <svg {...common}>{paths[name] || paths.music}</svg>;
}

function formatTime(seconds) {
const value = Number(seconds) || 0;
const mins = Math.floor(value / 60);
const secs = Math.floor(value % 60);
return ${mins}:${String(secs).padStart(2, "0")};
}

async function apiFetch(path, options = {}) {
const url = path.startsWith("http")
? path
: ${API_BASE}${path.startsWith("/") ? path : /${path}};

const response = await fetch(url, {
credentials: "include",
...options,
headers: {
"Content-Type": "application/json",
...(options.headers || {}),
},
});

const text = await response.text();

let data = null;

try {
data = text ? JSON.parse(text) : null;
} catch {
data = text;
}

if (!response.ok) {
throw new Error(
data?.detail ||
data?.message ||
data?.error ||
HTTP ${response.status}
);
}

return data;
}

function TrackCard({ track, onPlay, liked, onLike }) {
return (
<article className="fm-card" onClick={() => onPlay(track)}>
<div className="fm-cover">
<img src={track.cover} alt={track.title} />
<button
className="fm-cover-play visible"
onClick={(event) => {
event.stopPropagation();
onPlay(track);
}}
aria-label="Воспроизвести"
>
<Icon name="play" size={19} />
</button>
</div>

  <div className="fm-card-title">{track.title}</div>
  <div className="fm-card-artist">{track.artist}</div>

  <button
    className={`fm-small-btn ${liked ? "liked" : ""}`}
    onClick={(event) => {
      event.stopPropagation();
      onLike(track);
    }}
    aria-label="Избранное"
  >
    <Icon name="heart" size={17} />
  </button>
</article>

);
}

function TrackRow({ track, active, liked, onPlay, onLike }) {
return (
<div className={fm-track ${active ? "active" : ""}}>
<img className="fm-track-cover" src={track.cover} alt="" />

  <button
    className="fm-track-main"
    style={{
      border: 0,
      background: "transparent",
      color: "inherit",
      textAlign: "left",
      padding: 0,
      cursor: "pointer",
    }}
    onClick={() => onPlay(track)}
  >
    <div className="fm-track-title">{track.title}</div>
    <div className="fm-track-artist">{track.artist}</div>
  </button>

  <div className="fm-track-album">{track.album}</div>

  <div className="fm-track-time">{formatTime(track.duration)}</div>

  <div className="fm-track-actions">
    <button
      className={`fm-small-btn ${liked ? "liked" : ""}`}
      onClick={() => onLike(track)}
      aria-label="Добавить в избранное"
    >
      <Icon name="heart" size={17} />
    </button>
  </div>
</div>

);
}

function AuthModal({ onClose, onSuccess }) {
const [mode, setMode] = useState("login");
const [login, setLogin] = useState("");
const [password, setPassword] = useState("");
const [captchaInput, setCaptchaInput] = useState("");
const [captcha, setCaptcha] = useState(null);
const [loadingCaptcha, setLoadingCaptcha] = useState(false);
const [loading, setLoading] = useState(false);
const [error, setError] = useState("");

const loadCaptcha = async () => {
setLoadingCaptcha(true);
setError("");
setCaptchaInput("");

try {
  const data = await apiFetch("/captcha");

  if (!data?.code || !data?.captcha_id) {
    throw new Error("Сервер вернул неправильную CAPTCHA");
  }

  setCaptcha(data);
} catch {
  const generated = String(
    Math.floor(1000 + Math.random() * 9000)
  );

  setCaptcha({
    captcha_id: `local-${Date.now()}`,
    code: generated,
    expires_in: 300,
    local: true,
  });

  setError(
    "Сервер CAPTCHA недоступен. Используется резервная CAPTCHA."
  );
} finally {
  setLoadingCaptcha(false);
}

};

useEffect(() => {
loadCaptcha();
}, []);

const submit = async (event) => {
event.preventDefault();
setError("");

if (!login.trim()) {
  setError("Введите логин или email.");
  return;
}

if (!password) {
  setError("Введите пароль.");
  return;
}

if (!captcha) {
  setError("Сначала загрузите CAPTCHA.");
  return;
}

if (captchaInput.trim() !== String(captcha.code)) {
  setError("CAPTCHA введена неправильно.");
  loadCaptcha();
  return;
}

setLoading(true);

try {
  const endpoint =
    mode === "login"
      ? "/api/auth/login"
      : "/api/auth/register";

  const data = await apiFetch(endpoint, {
    method: "POST",
    body: JSON.stringify({
      login,
      email: login,
      username: login,
      password,
      captcha_id: captcha.captcha_id,
      captcha: captchaInput,
      captcha_code: captchaInput,
    }),
  });

  localStorage.setItem(
    "fenix_music_user",
    JSON.stringify(
      data?.user || {
        username: login,
      }
    )
  );

  onSuccess(data?.user || { username: login });
} catch (requestError) {
  if (
    mode === "login" &&
    captcha?.local
  ) {
    localStorage.setItem(
      "fenix_music_user",
      JSON.stringify({
        username: login,
        local: true,
      })
    );

    onSuccess({
      username: login,
      local: true,
    });

    return;
  }

  setError(
    requestError.message ||
      "Не удалось выполнить запрос."
  );
} finally {
  setLoading(false);
}

};

return (
<div className="fm-modal-bg" onMouseDown={onClose}>
<div
className="fm-modal"
onMouseDown={(event) => event.stopPropagation()}
>
<div className="fm-modal-head">
<h2>
{mode === "login"
? "Вход в Fenix Music"
: "Создать аккаунт"}
</h2>

      <button
        className="fm-close"
        onClick={onClose}
        type="button"
      >
        <Icon name="close" size={20} />
      </button>
    </div>

    <form onSubmit={submit}>
      <div className="fm-field">
        <label>Логин или Email</label>
        <input
          value={login}
          onChange={(event) => setLogin(event.target.value)}
          placeholder="Введите логин"
          autoComplete="username"
        />
      </div>

      <div className="fm-field">
        <label>Пароль</label>
        <input
          type="password"
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          placeholder="Введите пароль"
          autoComplete={
            mode === "login"
              ? "current-password"
              : "new-password"
          }
        />
      </div>

      <div className="fm-captcha">
        <div
          style={{
            color: "#8c8c98",
            fontSize: 12,
            marginBottom: 4,
          }}
        >
          Введите 4 цифры
        </div>

        <div className="fm-captcha-code">
          {loadingCaptcha
            ? "••••"
            : captcha?.code || "----"}
        </div>

        <div className="fm-captcha-row">
          <input
            inputMode="numeric"
            maxLength={4}
            value={captchaInput}
            onChange={(event) =>
              setCaptchaInput(
                event.target.value.replace(/\D/g, "")
              )
            }
            placeholder="0000"
          />

          <button
            className="fm-captcha-refresh"
            type="button"
            onClick={loadCaptcha}
            disabled={loadingCaptcha}
            title="Новый код"
          >
            <Icon name="refresh" size={19} />
          </button>
        </div>
      </div>

      {error && (
        <div className="fm-error">
          {error}
        </div>
      )}

      <button
        className="fm-modal-submit"
        type="submit"
        disabled={loading}
      >
        {loading
          ? "Подождите..."
          : mode === "login"
            ? "Войти"
            : "Зарегистрироваться"}
      </button>
    </form>

    <div className="fm-switch">
      {mode === "login"
        ? "Нет аккаунта? "
        : "Уже есть аккаунт? "}

      <button
        type="button"
        onClick={() => {
          setMode(
            mode === "login"
              ? "register"
              : "login"
          );
          setError("");
        }}
      >
        {mode === "login"
          ? "Регистрация"
          : "Войти"}
      </button>
    </div>
  </div>
</div>

);
}

function Player({
track,
isPlaying,
onToggle,
onNext,
onPrev,
progress,
duration,
onSeek,
volume,
onVolume,
}) {
if (!track) {
return null;
}

return (
<div className="fm-player">
<div className="fm-now">
<img src={track.cover} alt="" />

    <div className="fm-now-text">
      <div className="fm-now-title">{track.title}</div>
      <div className="fm-now-artist">{track.artist}</div>
    </div>
  </div>

  <div className="fm-player-center">
    <div className="fm-controls">
      <button className="fm-control" type="button">
        <Icon name="shuffle" size={17} />
      </button>

      <button
        className="fm-control"
        type="button"
        onClick={onPrev}
      >
        <Icon name="prev" size={18} />
      </button>

      <button
        className="fm-play"
        type="button"
        onClick={onToggle}
      >
        <Icon
          name={isPlaying ? "pause" : "play"}
          size={20}
        />
      </button>

      <button
        className="fm-control"
        type="button"
        onClick={onNext}
      >
        <Icon name="next" size={18} />
      </button>

      <button className="fm-control" type="button">
        <Icon name="repeat" size={17} />
      </button>
    </div>

    <div className="fm-progress">
      <span>{formatTime(progress)}</span>

      <input
        className="fm-range"
        type="range"
        min="0"
        max={Math.max(duration, 1)}
        value={Math.min(progress, duration || 0)}
        onChange={(event) =>
          onSeek(Number(event.target.value))
        }
      />

      <span>{formatTime(duration)}</span>
    </div>
  </div>

  <div className="fm-player-right">
    <Icon name="volume" size={18} />

    <input
      className="fm-volume"
      type="range"
      min="0"
      max="1"
      step="0.01"
      value={volume}
      onChange={(event) =>
        onVolume(Number(event.target.value))
      }
    />
  </div>
</div>

);
}

export default function App() {
const audioRef = useRef(null);

const [page, setPage] = useState("home");
const [tracks, setTracks] = useState(DEMO_TRACKS);
const [search, setSearch] = useState("");
const [genre, setGenre] = useState("Все");

const [currentTrack, setCurrentTrack] = useState(null);
const [isPlaying, setIsPlaying] = useState(false);
const [progress, setProgress] = useState(0);
const [duration, setDuration] = useState(0);
const [volume, setVolume] = useState(0.8);

const [liked, setLiked] = useState(() => {
try {
return JSON.parse(
localStorage.getItem("fenix_music_likes") || "[]"
);
} catch {
return [];
}
});

const [user, setUser] = useState(() => {
try {
return JSON.parse(
localStorage.getItem("fenix_music_user") || "null"
);
} catch {
return null;
}
});

const [authOpen, setAuthOpen] = useState(false);
const [toast, setToast] = useState("");
const [history, setHistory] = useState(() => {
try {
return JSON.parse(
localStorage.getItem("fenix_music_history") || "[]"
);
} catch {
return [];
}
});

const filteredTracks = useMemo(() => {
const query = search.trim().toLowerCase();

return tracks.filter((track) => {
  const matchesSearch =
    !query ||
    track.title.toLowerCase().includes(query) ||
    track.artist.toLowerCase().includes(query) ||
    track.album.toLowerCase().includes(query);

  const matchesGenre =
    genre === "Все" || track.genre === genre;

  return matchesSearch && matchesGenre;
});

}, [tracks, search, genre]);

const likedTracks = useMemo(
() =>
tracks.filter((track) =>
liked.includes(String(track.id))
),
[tracks, liked]
);

const showToast = (message) => {
setToast(message);

window.clearTimeout(
  showToast.timer
);

showToast.timer = window.setTimeout(() => {
  setToast("");
}, 2500);

};

const loadMusic = async () => {
try {
const data = await apiFetch("/api/tracks");

  const list = Array.isArray(data)
    ? data
    : data?.tracks;

  if (Array.isArray(list) && list.length) {
    setTracks(
      list.map((item, index) => ({
        id: item.id ?? `api-${index}`,
        title:
          item.title ||
          item.name ||
          `Трек ${index + 1}`,
        artist:
          item.artist ||
          item.author ||
          "Unknown Artist",
        album:
          item.album ||
          "Fenix Music",
        cover:
          item.cover ||
          item.cover_url ||
          DEMO_TRACKS[
            index % DEMO_TRACKS.length
          ].cover,
        audio:
          item.audio ||
          item.audio_url ||
          item.url ||
          "",
        duration:
          Number(item.duration) ||
          180,
        genre:
          item.genre ||
          "Pop",
      }))
    );
  }
} catch {
  setTracks(DEMO_TRACKS);
}

};

useEffect(() => {
loadMusic();
}, []);

useEffect(() => {
if (!audioRef.current) {
audioRef.current = new Audio();
}

audioRef.current.volume = volume;

const audio = audioRef.current;

const timeUpdate = () => {
  setProgress(audio.currentTime || 0);
};

const loaded = () => {
  setDuration(
    Number.isFinite(audio.duration)
      ? audio.duration
      : currentTrack?.duration || 0
  );
};

const ended = () => {
  nextTrack();
};

audio.addEventListener(
  "timeupdate",
  timeUpdate
);

audio.addEventListener(
  "loadedmetadata",
  loaded
);

audio.addEventListener(
  "ended",
  ended
);

return () => {
  audio.removeEventListener(
    "timeupdate",
    timeUpdate
  );

  audio.removeEventListener(
    "loadedmetadata",
    loaded
  );

  audio.removeEventListener(
    "ended",
    ended
  );
};

}, [currentTrack]);

useEffect(() => {
if (audioRef.current) {
audioRef.current.volume = volume;
}
}, [volume]);

const playTrack = async (track) => {
setCurrentTrack(track);
setProgress(0);
setDuration(track.duration || 0);

const audio = audioRef.current;

if (!audio) {
  return;
}

if (track.audio) {
  try {
    audio.src = track.audio;
    audio.currentTime = 0;
    await audio.play();
    setIsPlaying(true);
  } catch {
    setIsPlaying(false);
    showToast("Аудиофайл пока недоступен");
  }
} else {
  setIsPlaying(true);
  showToast("Демо-трек: API аудио ещё не подключён");
}

setHistory((previous) => {
  const next = [
    track,
    ...previous.filter(
      (item) => item.id !== track.id
    ),
  ].slice(0, 30);

  localStorage.setItem(
    "fenix_music_history",
    JSON.stringify(next)
  );

  return next;
});

};

const togglePlay = async () => {
if (!currentTrack) {
playTrack(tracks[0]);
return;
}

if (!currentTrack.audio) {
  setIsPlaying((value) => !value);
  return;
}

const audio = audioRef.current;

if (!audio) {
  return;
}

if (audio.paused) {
  try {
    await audio.play();
    setIsPlaying(true);
  } catch {
    showToast("Не удалось запустить аудио");
  }
} else {
  audio.pause();
  setIsPlaying(false);
}

};

const currentIndex = currentTrack
? tracks.findIndex(
(track) => track.id === currentTrack.id
)
: -1;

function nextTrack() {
if (!tracks.length) {
return;
}

const nextIndex =
  currentIndex >= 0
    ? (currentIndex + 1) % tracks.length
    : 0;

playTrack(tracks[nextIndex]);

}

function prevTrack() {
if (!tracks.length) {
return;
}

const previousIndex =
  currentIndex > 0
    ? currentIndex - 1
    : tracks.length - 1;

playTrack(tracks[previousIndex]);

}

const seek = (value) => {
setProgress(value);

if (audioRef.current && currentTrack?.audio) {
  audioRef.current.currentTime = value;
}

};

const toggleLike = (track) => {
const id = String(track.id);

setLiked((previous) => {
  const next = previous.includes(id)
    ? previous.filter((item) => item !== id)
    : [...previous, id];

  localStorage.setItem(
    "fenix_music_likes",
    JSON.stringify(next)
  );

  return next;
});

showToast(
  liked.includes(id)
    ? "Удалено из избранного"
    : "Добавлено в избранное"
);

};

const openAuth = () => {
setAuthOpen(true);
};

const logout = () => {
localStorage.removeItem("fenix_music_user");
setUser(null);
showToast("Вы вышли из аккаунта");
};

const navigate = (target) => {
setPage(target);
window.scrollTo({
top: 0,
behavior: "smooth",
});
};

const doSearch = async () => {
if (!search.trim()) {
return;
}

try {
  const data = await apiFetch(
    `/api/search?q=${encodeURIComponent(search)}`
  );

  const list = Array.isArray(data)
    ? data
    : data?.tracks;

  if (Array.isArray(list) && list.length) {
    setTracks(
      list.map((item, index) => ({
        id: item.id ?? `search-${index}`,
        title:
          item.title ||
          item.name ||
          "Без названия",
        artist:
          item.artist ||
          item.author ||
          "Unknown Artist",
        album:
          item.album ||
          "Fenix Music",
        cover:
          item.cover ||
          item.cover_url ||
          DEMO_TRACKS[
            index % DEMO_TRACKS.length
          ].cover,
        audio:
          item.audio ||
          item.audio_url ||
          item.url ||
          "",
        duration:
          Number(item.duration) || 180,
        genre:
          item.genre || "Pop",
      }))
    );
  }
} catch {
  showToast(
    "Сервер поиска недоступен — показаны локальные треки"
  );
}

navigate("search");

};

const navItems = [
["home", "Главная", "home"],
["search", "Поиск", "search"],
["library", "Моя музыка", "library"],
];

const renderCards = (list) => {
if (!list.length) {
return (
<div className="fm-empty">
<Icon name="music" size={35} />
<div style={{ marginTop: 12 }}>
Ничего не найдено
</div>
</div>
);
}

return (
  <div className="fm-grid">
    {list.map((track) => (
      <TrackCard
        key={track.id}
        track={track}
        liked={liked.includes(String(track.id))}
        onPlay={playTrack}
        onLike={toggleLike}
      />
    ))}
  </div>
);

};

const renderTrackList = (list) => {
if (!list.length) {
return (
<div className="fm-empty">
Здесь пока ничего нет
</div>
);
}

return (
  <div className="fm-track-list">
    {list.map((track) => (
      <TrackRow
        key={track.id}
        track={track}
        active={currentTrack?.id === track.id}
        liked={liked.includes(String(track.id))}
        onPlay={playTrack}
        onLike={toggleLike}
      />
    ))}
  </div>
);

};

const Home = () => (
<>
<section className="fm-hero">
<div className="fm-hero-content">
<div className="fm-eyebrow">
FENIX MUSIC
</div>

      <h1>
        Музыка,
        <br />
        которая рядом.
      </h1>

      <p>
        Слушай любимые треки, открывай новых
        исполнителей, собирай коллекцию и
        создавай собственную музыкальную атмосферу.
      </p>

      <div className="fm-buttons">
        <button
          className="fm-primary"
          onClick={() =>
            playTrack(tracks[0])
          }
        >
          <Icon name="play" size={17} />{" "}
          Слушать сейчас
        </button>

        <button
          className="fm-secondary"
          onClick={() =>
            navigate("library")
          }
        >
          Моя музыка
        </button>
      </div>
    </div>
  </section>

  <section className="fm-section">
    <div className="fm-section-head">
      <h2>Для вас</h2>
      <button
        className="fm-link"
        onClick={() =>
          showToast("Персональные рекомендации")
        }
      >
        Смотреть всё
      </button>
    </div>

    {renderCards(tracks.slice(0, 6))}
  </section>

  <section className="fm-section">
    <div className="fm-section-head">
      <h2>
        <Icon name="flame" size={19} /> Популярное
      </h2>
      <button
        className="fm-link"
        onClick={() => navigate("popular")}
      >
        Всё
      </button>
    </div>

    {renderTrackList(tracks.slice(0, 5))}
  </section>

  <section className="fm-section">
    <div className="fm-section-head">
      <h2>Новинки</h2>
      <button
        className="fm-link"
        onClick={() => navigate("new")}
      >
        Все новинки
      </button>
    </div>

    {renderCards(
      [...tracks].reverse().slice(0, 6)
    )}
  </section>

  <section className="fm-section">
    <div className="fm-section-head">
      <h2>
        <Icon name="spark" size={19} /> Миксы
      </h2>
    </div>

    <div className="fm-grid">
      {[
        ["Night Mix", "Ночная атмосфера"],
        ["Energy Mix", "Для энергии"],
        ["Chill Mix", "Спокойный вечер"],
        ["Fenix Mix", "Лучшее для тебя"],
      ].map(([title, subtitle], index) => (
        <div
          className="fm-card"
          key={title}
          onClick={() =>
            playTrack(
              tracks[index % tracks.length]
            )
          }
        >
          <div
            className="fm-cover"
            style={{
              display: "grid",
              placeItems: "center",
              background:
                index % 2
                  ? "linear-gradient(135deg,#4b1cff,#ff174f)"
                  : "linear-gradient(135deg,#ff174f,#6b00ff)",
            }}
          >
            <Icon name="music" size={48} />
          </div>

          <div className="fm-card-title">
            {title}
          </div>

          <div className="fm-card-artist">
            {subtitle}
          </div>
        </div>
      ))}
    </div>
  </section>

  {history.length > 0 && (
    <section className="fm-section">
      <div className="fm-section-head">
        <h2>Продолжить слушать</h2>
        <button
          className="fm-link"
          onClick={() => navigate("history")}
        >
          История
        </button>
      </div>

      {renderCards(history.slice(0, 6))}
    </section>
  )}
</>

);

const SearchPage = () => (
<>
<section className="fm-section" style={{ marginTop: 0 }}>
<div className="fm-section-head">
<h2>Поиск музыки</h2>
</div>

    <div className="fm-search" style={{ maxWidth: "100%" }}>
      <span className="fm-search-icon">
        <Icon name="search" size={19} />
      </span>

      <input
        value={search}
        onChange={(event) =>
          setSearch(event.target.value)
        }
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            doSearch();
          }
        }}
        placeholder="Исполнитель, трек или альбом..."
        autoFocus
      />
    </div>
  </section>

  <section className="fm-section">
    <div className="fm-chips">
      {GENRES.map((item) => (
        <button
          key={item}
          className={`fm-chip ${
            genre === item ? "active" : ""
          }`}
          onClick={() => setGenre(item)}
        >
          {item}
        </button>
      ))}
    </div>
  </section>

  <section className="fm-section">
    <div className="fm-section-head">
      <h2>
        {search
          ? `Результаты: ${search}`
          : "Все треки"}
      </h2>
    </div>

    {renderTrackList(filteredTracks)}
  </section>
</>

);

const LibraryPage = () => (
<>
<section
className="fm-hero"
style={{
minHeight: 240,
background:
"linear-gradient(135deg,#171720,#270914)",
}}
>
<div className="fm-hero-content">
<div className="fm-eyebrow">
ТВОЯ КОЛЛЕКЦИЯ
</div>

      <h1 style={{ fontSize: 42 }}>
        Моя музыка
      </h1>

      <p>
        Избранные треки, история прослушиваний
        и твоя личная коллекция.
      </p>
    </div>
  </section>

  <section className="fm-section">
    <div className="fm-section-head">
      <h2>
        <Icon name="heart" size={19} /> Избранное
      </h2>
    </div>

    {renderTrackList(likedTracks)}
  </section>

  <section className="fm-section">
    <div className="fm-section-head">
      <h2>Недавно прослушанное</h2>
    </div>

    {renderTrackList(history)}
  </section>
</>

);

const GenericPage = ({ title, subtitle }) => (
<>
<section
className="fm-hero"
style={{
minHeight: 250,
background:
"linear-gradient(135deg,#170b12,#0c0c18)",
}}
>
<div className="fm-hero-content">
<div className="fm-eyebrow">
FENIX MUSIC
</div>

      <h1 style={{ fontSize: 44 }}>
        {title}
      </h1>

      <p>{subtitle}</p>
    </div>
  </section>

  <section className="fm-section">
    {renderCards(filteredTracks)}
  </section>

  <section className="fm-section">
    {renderTrackList(filteredTracks)}
  </section>
</>

);

let pageContent = <Home />;

if (page === "search") {
pageContent = <SearchPage />;
}

if (page === "library") {
pageContent = <LibraryPage />;
}

if (page === "popular") {
pageContent = (
<GenericPage title="Популярное" subtitle="Треки, которые сейчас слушают чаще всего." />
);
}

if (page === "new") {
pageContent = (
<GenericPage title="Новинки" subtitle="Свежая музыка и новые релизы." />
);
}

if (page === "history") {
pageContent = (
<GenericPage title="История" subtitle="Продолжай слушать то, что недавно включал." />
);
}

return (
<div className="fm-app">
<style>{CSS}</style>

  <div className="fm-layout">
    <aside className="fm-sidebar">
      <div className="fm-logo">
        <div className="fm-logo-mark">
          <Icon name="music" size={21} />
        </div>

        <span>Fenix Music</span>
      </div>

      <div className="fm-nav-title">
        Навигация
      </div>

      <nav className="fm-nav">
        {navItems.map(
          ([key, label, icon]) => (
            <button
              key={key}
              className={
                page === key
                  ? "active"
                  : ""
              }
              onClick={() =>
                navigate(key)
              }
            >
              <Icon name={icon} size={19} />
              {label}
            </button>
          )
        )}
      </nav>

      <div className="fm-nav-title">
        Библиотека
      </div>

      <nav className="fm-nav">
        <button
          className={
            page === "liked"
              ? "active"
              : ""
          }
          onClick={() =>
            navigate("library")
          }
        >
          <Icon name="heart" size={19} />
          Избранное
        </button>

        <button
          className={
            page === "history"
              ? "active"
              : ""
          }
          onClick={() =>
            navigate("history")
          }
        >
          <Icon name="repeat" size={19} />
          История
        </button>
      </nav>

      <div className="fm-nav-title">
        Настройки
      </div>

      <nav className="fm-nav">
        <button
          onClick={() =>
            showToast(
              "Настройки скоро будут доступны"
            )
          }
        >
          <Icon name="spark" size={19} />
          Настройки
        </button>
      </nav>

      <div
        style={{
          position: "absolute",
          left: 16,
          right: 16,
          bottom: 20,
        }}
      >
        {!user ? (
          <button
            className="fm-primary"
            style={{ width: "100%" }}
            onClick={openAuth}
          >
            <Icon name="user" size={17} /> Войти
          </button>
        ) : (
          <button
            className="fm-secondary"
            style={{
              width: "100%",
              color: "#fff",
            }}
            onClick={logout}
          >
            <Icon name="user" size={17} />{" "}
            {user.username || "Профиль"}
          </button>
        )}
      </div>
    </aside>

    <main className="fm-main">
      <header className="fm-header">
        <div className="fm-search">
          <span className="fm-search-icon">
            <Icon name="search" size={18} />
          </span>

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                doSearch();
              }
            }}
            placeholder="Что хочешь послушать?"
          />
        </div>

        <div className="fm-header-actions">
          <button
            className="fm-icon-btn"
            onClick={() =>
              showToast(
                "Уведомлений пока нет"
              )
            }
          >
            <Icon name="spark" size={18} />
          </button>

          {!user ? (
            <button
              className="fm-user-btn"
              onClick={openAuth}
            >
              <Icon name="user" size={17} />
              Войти
            </button>
          ) : (
            <button
              className="fm-user-btn"
              onClick={() =>
                showToast(
                  `Вы вошли как ${
                    user.username || "пользователь"
                  }`
                )
              }
            >
              <Icon name="user" size={17} />
              {user.username || "Профиль"}
            </button>
          )}
        </div>
      </header>

      <div className="fm-content">
        {pageContent}
      </div>
    </main>
  </div>

  <div className="fm-mobile-nav">
    <button
      className={
        page === "home"
          ? "active"
          : ""
      }
      onClick={() => navigate("home")}
    >
      <Icon name="home" size={20} />
      <span>Главная</span>
    </button>

    <button
      className={
        page === "search"
          ? "active"
          : ""
      }
      onClick={() => navigate("search")}
    >
      <Icon name="search" size={20} />
      <span>Поиск</span>
    </button>

    <button
      className={
        page === "library"
          ? "active"
          : ""
      }
      onClick={() => navigate("library")}
    >
      <Icon name="library" size={20} />
      <span>Моя музыка</span>
    </button>

    <button
      onClick={() => {
        if (user) {
          showToast(
            `Аккаунт: ${
              user.username || "пользователь"
            }`
          );
        } else {
          openAuth();
        }
      }}
    >
      <Icon name="user" size={20} />
      <span>
        {user ? "Профиль" : "Войти"}
      </span>
    </button>
  </div>

  <Player
    track={currentTrack}
    isPlaying={isPlaying}
    onToggle={togglePlay}
    onNext={nextTrack}
    onPrev={prevTrack}
    progress={progress}
    duration={
      duration ||
      currentTrack?.duration ||
      0
    }
    onSeek={seek}
    volume={volume}
    onVolume={setVolume}
  />

  {authOpen && (
    <AuthModal
      onClose={() => setAuthOpen(false)}
      onSuccess={(newUser) => {
        setUser(newUser);
        setAuthOpen(false);
        showToast("Добро пожаловать в Fenix Music!");
      }}
    />
  )}

  {toast && (
    <div className="fm-toast">
      {toast}
    </div>
  )}
</div>

);
}
  export default App;

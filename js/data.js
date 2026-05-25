/* =========================================================
   Spotify Clone – Datenkatalog
   Audio: lizenzfreie SoundHelix-Demos (frei nutzbar)
   Cover: deterministisch generierte Verläufe (keine externen Bilder)
   ========================================================= */

const AUDIO = i =>
  `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${((i - 1) % 16) + 1}.mp3`;

// Künstler
const ARTISTS = [
  { id: 'a1', name: 'Aurora Skies', type: 'artist', monthly: '24.183.402', bio: 'Synth-Pop aus Oslo.' },
  { id: 'a2', name: 'Neon District', type: 'artist', monthly: '18.940.221', bio: 'Elektronische Beats für die Nacht.' },
  { id: 'a3', name: 'Midnight Echo', type: 'artist', monthly: '12.557.018', bio: 'Indie-Rock mit Tiefgang.' },
  { id: 'a4', name: 'Luna Waves', type: 'artist', monthly: '31.002.911', bio: 'Dream-Pop und Ambient.' },
  { id: 'a5', name: 'The Velvet Keys', type: 'artist', monthly: '8.412.770', bio: 'Soul, Jazz & Piano.' },
  { id: 'a6', name: 'Crimson Pulse', type: 'artist', monthly: '15.778.330', bio: 'Hard-hitting Hip-Hop.' },
  { id: 'a7', name: 'Solar Bloom', type: 'artist', monthly: '9.221.045', bio: 'Sommerlicher Pop.' },
  { id: 'a8', name: 'Echoes of Dawn', type: 'artist', monthly: '6.330.118', bio: 'Cinematic Postrock.' },
];

const artistName = id => (ARTISTS.find(a => a.id === id) || {}).name || 'Unknown';

// Songtitel-Pools je Künstler
const TRACKS = [];
let tid = 0;
function mk(title, artistId, albumId, dur, idx) {
  tid++;
  return {
    id: 't' + tid, title, artistId, artist: artistName(artistId),
    albumId, duration: dur, type: 'track', src: AUDIO(idx),
  };
}

// Alben + ihre Tracks
const ALBUMS = [];
function album(id, title, artistId, year, songs) {
  const trackIds = [];
  songs.forEach((s, i) => {
    const t = mk(s.t, artistId, id, s.d, s.a);
    TRACKS.push(t);
    trackIds.push(t.id);
  });
  ALBUMS.push({ id, title, artistId, artist: artistName(artistId), year, type: 'album', trackIds });
}

album('al1', 'Northern Lights', 'a1', 2023, [
  { t: 'Glacier Heart', d: 241, a: 1 },
  { t: 'Polar Dreams', d: 198, a: 2 },
  { t: 'Aurora', d: 263, a: 3 },
  { t: 'Frozen Sky', d: 215, a: 4 },
  { t: 'Snowfall', d: 187, a: 5 },
]);
album('al2', 'City of Neon', 'a2', 2024, [
  { t: 'Midnight Drive', d: 224, a: 6 },
  { t: 'Electric Veins', d: 209, a: 7 },
  { t: 'Skyline', d: 251, a: 8 },
  { t: 'After Hours', d: 233, a: 9 },
]);
album('al3', 'Reverb', 'a3', 2022, [
  { t: 'Hollow', d: 256, a: 10 },
  { t: 'Static', d: 198, a: 11 },
  { t: 'Echo Chamber', d: 274, a: 12 },
  { t: 'Distance', d: 219, a: 13 },
]);
album('al4', 'Tidal', 'a4', 2024, [
  { t: 'Moonlit Shore', d: 288, a: 14 },
  { t: 'Drift', d: 232, a: 15 },
  { t: 'Undertow', d: 201, a: 16 },
  { t: 'Lullaby', d: 245, a: 1 },
  { t: 'Pale Blue', d: 213, a: 2 },
]);
album('al5', 'Velvet Sessions', 'a5', 2021, [
  { t: 'Smoke & Silk', d: 267, a: 3 },
  { t: 'Late Night Keys', d: 298, a: 4 },
  { t: 'Whisper', d: 221, a: 5 },
]);
album('al6', 'Bloodline', 'a6', 2023, [
  { t: 'No Limits', d: 192, a: 6 },
  { t: 'Crown', d: 205, a: 7 },
  { t: 'Pressure', d: 178, a: 8 },
  { t: 'Legacy', d: 224, a: 9 },
]);
album('al7', 'Sunchaser', 'a7', 2024, [
  { t: 'Golden Hour', d: 211, a: 10 },
  { t: 'Beachside', d: 196, a: 11 },
  { t: 'Palm Trees', d: 188, a: 12 },
]);
album('al8', 'Horizon', 'a8', 2022, [
  { t: 'First Light', d: 312, a: 13 },
  { t: 'Ascend', d: 278, a: 14 },
  { t: 'Vastness', d: 334, a: 15 },
]);

const trackById = id => TRACKS.find(t => t.id === id);
const albumById = id => ALBUMS.find(a => a.id === id);

// Vordefinierte Playlists
const PLAYLISTS = [
  {
    id: 'pl1', title: "Today's Top Hits", type: 'playlist', editable: false,
    owner: 'Spotify', desc: 'Die größten Hits gerade jetzt.',
    trackIds: ['t1', 't6', 't10', 't19', 't23', 't26', 't29', 't14', 't2', 't7'],
  },
  {
    id: 'pl2', title: 'Chill Vibes', type: 'playlist', editable: false,
    owner: 'Spotify', desc: 'Entspann dich und lass los.',
    trackIds: ['t14', 't15', 't16', 't17', 't18', 't20', 't21', 't4'],
  },
  {
    id: 'pl3', title: 'RapCaviar', type: 'playlist', editable: false,
    owner: 'Spotify', desc: 'Neue und heiße Hip-Hop-Tracks.',
    trackIds: ['t23', 't24', 't25', 't26', 't6', 't7', 't8'],
  },
  {
    id: 'pl4', title: 'Rock Classics', type: 'playlist', editable: false,
    owner: 'Spotify', desc: 'Zeitlose Rock-Hymnen.',
    trackIds: ['t10', 't11', 't12', 't13', 't3', 't1'],
  },
  {
    id: 'pl5', title: 'Focus Flow', type: 'playlist', editable: false,
    owner: 'Spotify', desc: 'Instrumentale Konzentration.',
    trackIds: ['t29', 't30', 't31', 't20', 't21', 't22'],
  },
  {
    id: 'pl6', title: 'Summer Party', type: 'playlist', editable: false,
    owner: 'Spotify', desc: 'Sonne, Strand und gute Laune.',
    trackIds: ['t27', 't28', 't7', 't2', 't6', 't19'],
  },
  {
    id: 'pl7', title: 'Sleep', type: 'playlist', editable: false,
    owner: 'Spotify', desc: 'Sanfte Klänge zum Einschlafen.',
    trackIds: ['t31', 't20', 't16', 't18', 't14'],
  },
  {
    id: 'pl8', title: 'All Out 2020s', type: 'playlist', editable: false,
    owner: 'Spotify', desc: 'Die Hits dieses Jahrzehnts.',
    trackIds: ['t1', 't2', 't6', 't10', 't14', 't19', 't23', 't27', 't29'],
  },
];

// Genres für die Suchseite
const GENRES = [
  { name: 'Pop', color: '#8d67ab' },
  { name: 'Hip-Hop', color: '#ba5d07' },
  { name: 'Rock', color: '#e61e32' },
  { name: 'Elektronisch', color: '#d84000' },
  { name: 'Chill', color: '#477d95' },
  { name: 'Indie', color: '#608108' },
  { name: 'Jazz', color: '#777777' },
  { name: 'Fokus', color: '#503750' },
  { name: 'Schlaf', color: '#1e3264' },
  { name: 'Party', color: '#e8115b' },
  { name: 'Sommer', color: '#0d72ec' },
  { name: 'Klassik', color: '#7d4b32' },
];

// Hilfsfunktionen für Tracks einer Sammlung
function tracksOf(collection) {
  return (collection.trackIds || []).map(trackById).filter(Boolean);
}

window.DB = {
  ARTISTS, ALBUMS, PLAYLISTS, TRACKS, GENRES,
  trackById, albumById, artistName,
  artistById: id => ARTISTS.find(a => a.id === id),
  playlistById: id => PLAYLISTS.find(p => p.id === id),
  tracksOf,
};

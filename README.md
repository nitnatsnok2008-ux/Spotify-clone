# Spotify Clone

Eine originalgetreue Spotify-Web-Player-Nachbildung als **statische Website** – kein Login, kein Backend, kein Build-Schritt. Einfach `index.html` öffnen oder online deployen.

## Funktionen

- **Player**: Abspielen/Pause, Weiter/Zurück, Fortschrittsleiste (klick- & ziehbar), Lautstärke, Stummschaltung
- **Shuffle & Wiederholen** (aus / alle / einzelner Titel)
- **Warteschlange** mit „Als Nächstes" und Direktwechsel
- **Suche** über Songs, Künstler:innen, Alben und Playlists (mit Top-Ergebnis)
- **Bibliothek** mit Filtern (Playlists / Künstler:innen / Alben)
- **Lieblingssongs** (Herz) – im Browser gespeichert (localStorage)
- **Eigene Playlists** erstellen & Songs per Kontextmenü hinzufügen
- **Seiten** für Playlist, Album und Künstler:in im exakten Spotify-Layout
- **Zuletzt gespielt**, Begrüßung nach Tageszeit, Genre-Kacheln
- **Tastenkürzel**: Leertaste = Play/Pause, Shift+→/← = Weiter/Zurück
- Responsives Design (Sidebar klappt auf kleinen Bildschirmen ein)

## Technik

- Reines HTML / CSS / Vanilla-JavaScript – keine Abhängigkeiten, kein Build
- Cover werden deterministisch als Farbverläufe generiert (keine externen Bilder → keine kaputten Links)
- Audio: lizenzfreie [SoundHelix](https://www.soundhelix.com/)-Demosongs

## Lokal starten

```bash
# Einfach öffnen:
open index.html
# oder mit lokalem Server (empfohlen für Audio):
python3 -m http.server 8000   # dann http://localhost:8000
```

## Deployment (GitHub Pages)

Settings → Pages → Branch wählen → Speichern. Die Seite läuft als statische Site ohne weitere Konfiguration.

## Hinweis

Dies ist ein nicht-kommerzielles Lern-/Demoprojekt im Spotify-Stil. Es ist nicht mit Spotify AB verbunden. Der echte Spotify-Musikkatalog ist lizenziert und kann nicht nachgebildet werden; hier kommen frei nutzbare Demo-Audiodateien zum Einsatz.

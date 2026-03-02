import { StorageService } from '../services/StorageService.js';
import { AudioStorageService } from '../services/AudioStorageService.js';

export class MusicPlayer {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.audioStorage = new AudioStorageService();
        this.audio = new Audio();

        // State
        this.playlists = StorageService.get('music_playlists', {
            'default': { id: 'default', name: 'Default Playlist', tracks: [] }
        });
        this.currentPlaylistId = StorageService.get('music_current_playlist', 'default');
        this.currentTrackIndex = StorageService.get('music_current_track_index', -1);
        this.isLooping = StorageService.get('music_is_looping', false);
        this.audio.volume = StorageService.get('music_volume', 0.5);
        this.isMuted = false;

        // Cache DOM elements
        this.cacheDOM();

        // Initialize
        this.init();
    }

    cacheDOM() {
        // Window UI
        this.musicWindow = document.getElementById('music-window');
        this.musicFab = document.getElementById('music-fab');
        this.quickPlayBtn = document.getElementById('quick-play-btn');
        this.quickPlayIcon = document.getElementById('quick-play-icon');
        this.closeMusicBtn = document.getElementById('close-music-btn');
        this.sizeBtns = this.musicWindow.querySelectorAll('.size-btn');

        // Playback Controls
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.prevBtn = document.getElementById('prev-track-btn');
        this.nextBtn = document.getElementById('next-track-btn');
        this.loopBtn = document.getElementById('loop-btn');
        this.muteBtn = document.getElementById('mute-btn');
        this.volumeSlider = document.getElementById('volume-slider');
        this.seekSlider = document.getElementById('seek-slider');

        // Info Displays
        this.timeCurrent = document.getElementById('time-current');
        this.timeTotal = document.getElementById('time-total');
        this.trackName = document.getElementById('current-track-name');
        this.playlistName = document.getElementById('current-playlist-name');
        this.trackIcon = document.querySelector('.track-icon');

        // Playlist & Upload
        this.playlistSelect = document.getElementById('playlist-select');
        this.addPlaylistBtn = document.getElementById('add-playlist-btn');
        this.audioInput = document.getElementById('audio-file-input');
        this.uploadArea = document.getElementById('audio-upload-area');
        this.trackList = document.getElementById('track-list');
    }

    async init() {
        try {
            await this.audioStorage.init();
        } catch (e) {
            console.error('Failed to init AudioStorage:', e);
        }

        this.initListeners();
        this.renderPlaylistSelect();
        this.renderTrackList();
        this.updateUI();

        // Restore loop & volume UI
        if (this.isLooping) this.loopBtn.classList.add('active');
        this.volumeSlider.value = this.audio.volume;
        this.updateVolumeIcon();

        // Check if there is a saved track to load
        if (this.currentTrackIndex >= 0) {
            await this.loadTrack(this.currentTrackIndex, false);
        }
    }

    initListeners() {
        // Window Toggle
        this.musicFab.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.musicWindow.classList.contains('collapsed')) {
                this.musicWindow.classList.remove('collapsed');
                this.musicWindow.classList.add('chat-size-medium');
                if (this.eventBus) {
                    this.eventBus.emit('musicWindowOpened');
                }
            } else {
                this.musicWindow.classList.add('collapsed');
            }
        });

        this.musicWindow.addEventListener('click', (e) => {
            e.stopPropagation();
        });

        document.addEventListener('click', () => {
            if (!this.musicWindow.classList.contains('collapsed')) {
                this.musicWindow.classList.add('collapsed');
            }
        });

        this.closeMusicBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.musicWindow.classList.add('collapsed');
        });

        // Listen for chat window opening to close music player
        if (this.eventBus) {
            this.eventBus.on('chatWindowOpened', () => {
                if (!this.musicWindow.classList.contains('collapsed')) {
                    this.musicWindow.classList.add('collapsed');
                }
            });
        }

        // Quick Play logic
        this.quickPlayBtn.addEventListener('click', () => this.togglePlay());

        // Size toggles
        this.sizeBtns.forEach(btn => {
            if (btn.id === 'close-music-btn') return;
            btn.addEventListener('click', () => {
                const size = btn.dataset.size;
                this.musicWindow.classList.remove('chat-size-small', 'chat-size-medium', 'chat-size-large');
                this.musicWindow.classList.add(`chat-size-${size}`);
                this.sizeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Playback Controls
        this.playPauseBtn.addEventListener('click', () => this.togglePlay());
        this.prevBtn.addEventListener('click', () => this.playPrev());
        this.nextBtn.addEventListener('click', () => this.playNext());

        this.loopBtn.addEventListener('click', () => {
            this.isLooping = !this.isLooping;
            this.audio.loop = this.isLooping;
            this.loopBtn.classList.toggle('active', this.isLooping);
            StorageService.set('music_is_looping', this.isLooping);
        });

        this.muteBtn.addEventListener('click', () => {
            this.isMuted = !this.isMuted;
            this.audio.muted = this.isMuted;
            this.updateVolumeIcon();
        });

        this.volumeSlider.addEventListener('input', (e) => {
            const vol = parseFloat(e.target.value);
            this.audio.volume = vol;
            if (vol > 0) this.isMuted = false;
            StorageService.set('music_volume', vol);
            this.updateVolumeIcon();
        });

        this.seekSlider.addEventListener('input', (e) => {
            if (!this.audio.duration) return;
            const percentage = parseFloat(e.target.value);
            this.audio.currentTime = (percentage / 100) * this.audio.duration;
            this.timeCurrent.textContent = this.formatTime(this.audio.currentTime);
        });

        // Audio Events
        this.audio.addEventListener('timeupdate', () => this.onTimeUpdate());
        this.audio.addEventListener('loadedmetadata', () => {
            this.timeTotal.textContent = this.formatTime(this.audio.duration);
        });
        this.audio.addEventListener('ended', () => {
            if (!this.isLooping) {
                this.playNext();
            }
        });

        // Upload
        this.audioInput.addEventListener('change', (e) => this.handleFileUpload(e.target.files));

        // Drag over file upload
        this.uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.uploadArea.style.borderColor = 'var(--accent-color)';
        });
        this.uploadArea.addEventListener('dragleave', () => {
            this.uploadArea.style.borderColor = 'var(--glass-border)';
        });
        this.uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            this.uploadArea.style.borderColor = 'var(--glass-border)';
            if (e.dataTransfer.files) this.handleFileUpload(e.dataTransfer.files);
        });

        // Playlist Select
        this.playlistSelect.addEventListener('change', (e) => {
            this.selectPlaylist(e.target.value);
        });

        // Add Playlist
        this.addPlaylistBtn.addEventListener('click', () => {
            const name = prompt('新しいプレイリスト名を入力してください:');
            if (name && name.trim()) {
                this.createPlaylist(name.trim());
            }
        });
    }

    /* ================= Methods ================= */

    async handleFileUpload(files) {
        if (!files || files.length === 0) return;

        const playlist = this.playlists[this.currentPlaylistId];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('audio/')) continue;

            const trackId = `track_${Date.now()}_${i}`;
            const trackData = {
                id: trackId,
                name: file.name.replace(/\.[^/.]+$/, ""), // remove extension
                size: file.size
            };

            try {
                // Save massive blob to IndexedDB
                await this.audioStorage.saveAudio(trackId, file);

                // Add metadata to local storage
                playlist.tracks.push(trackData);
            } catch (err) {
                console.error('Failed to save audio file:', err);
                alert(`ファイルの保存に失敗しました: ${file.name}`);
            }
        }

        this.savePlaylists();
        this.renderTrackList();

        // If it's the first track and nothing is playing, load it
        if (playlist.tracks.length > 0 && this.currentTrackIndex === -1) {
            this.loadTrack(0, false);
        }
    }

    createPlaylist(name) {
        const id = `playlist_${Date.now()}`;
        this.playlists[id] = { id, name, tracks: [] };
        this.savePlaylists();
        this.renderPlaylistSelect();
        this.selectPlaylist(id);
    }

    selectPlaylist(id) {
        if (!this.playlists[id]) return;

        this.currentPlaylistId = id;
        StorageService.set('music_current_playlist', id);
        this.renderTrackList();
        this.updatePlaylistUI();
    }

    async loadTrack(index, autoplay = true) {
        const playlist = this.playlists[this.currentPlaylistId];
        if (!playlist || !playlist.tracks || playlist.tracks.length === 0) return;

        if (index < 0) index = playlist.tracks.length - 1;
        if (index >= playlist.tracks.length) index = 0;

        this.currentTrackIndex = index;
        StorageService.set('music_current_track_index', index);

        const track = playlist.tracks[index];
        this.trackName.textContent = track.name;

        try {
            const blob = await this.audioStorage.getAudio(track.id);
            if (blob) {
                const url = URL.createObjectURL(blob);

                // revoke old URL if needed
                if (this.audio.src && this.audio.src.startsWith('blob:')) {
                    URL.revokeObjectURL(this.audio.src);
                }

                this.audio.src = url;
                this.audio.load();

                if (autoplay) {
                    this.audio.play().catch(e => console.error("Autoplay prevented:", e));
                }

                this.renderTrackList(); // update playing indicator
                this.updateUI();

                // Show Quick Play if hidden
                this.quickPlayBtn.style.display = 'flex';

            } else {
                console.warn('Audio blob not found in IndexedDB.');
                alert('指定された音声データが見つかりません。削除された可能性があります。');
            }
        } catch (err) {
            console.error('Failed to load track from DB:', err);
        }
    }

    async deleteTrack(trackId, e) {
        e.stopPropagation();
        if (!confirm('この曲をプレイリストから削除しますか？')) return;

        const playlist = this.playlists[this.currentPlaylistId];
        const index = playlist.tracks.findIndex(t => t.id === trackId);

        if (index !== -1) {
            playlist.tracks.splice(index, 1);
            this.savePlaylists();

            try {
                await this.audioStorage.deleteAudio(trackId);
            } catch (err) {
                console.error("Failed to delete audio blob:", err);
            }

            // If deleting currently selected track
            if (this.currentTrackIndex === index) {
                this.audio.pause();
                this.audio.src = '';
                this.currentTrackIndex = -1;
                StorageService.set('music_current_track_index', -1);
                this.trackName.textContent = 'No track selected';
                this.quickPlayBtn.style.display = 'none';
                this.updateUI();
            } else if (this.currentTrackIndex > index) {
                this.currentTrackIndex--;
                StorageService.set('music_current_track_index', this.currentTrackIndex);
            }

            this.renderTrackList();
        }
    }

    togglePlay() {
        if (!this.audio.src) return;

        if (this.audio.paused) {
            this.audio.play();
        } else {
            this.audio.pause();
        }
        this.updateUI();
    }

    playNext() {
        if (this.currentTrackIndex === -1) return;
        this.loadTrack(this.currentTrackIndex + 1, true);
    }

    playPrev() {
        if (this.currentTrackIndex === -1) return;
        this.loadTrack(this.currentTrackIndex - 1, true);
    }

    /* ================= Rendering & UI ================= */

    renderPlaylistSelect() {
        this.playlistSelect.innerHTML = '';
        Object.values(this.playlists).forEach(pl => {
            const option = document.createElement('option');
            option.value = pl.id;
            option.textContent = pl.name;
            if (pl.id === this.currentPlaylistId) option.selected = true;
            this.playlistSelect.appendChild(option);
        });
        this.updatePlaylistUI();
    }

    renderTrackList() {
        this.trackList.innerHTML = '';
        const playlist = this.playlists[this.currentPlaylistId];

        if (!playlist || playlist.tracks.length === 0) {
            this.trackList.innerHTML = '<li style="text-align:center; padding: 1rem; color: var(--text-muted);">No tracks in this playlist.</li>';
            return;
        }

        playlist.tracks.forEach((track, index) => {
            const li = document.createElement('li');
            li.className = 'track-item';
            if (index === this.currentTrackIndex) li.classList.add('playing');

            li.innerHTML = `
                <div class="track-item-icon">
                    <i class="ri-${index === this.currentTrackIndex && !this.audio.paused ? 'bar-chart-2-fill' : 'music-2-line'}"></i>
                </div>
                <div class="track-item-info">
                    <div class="track-item-title">${this.escapeHtml(track.name)}</div>
                    <div class="track-item-size">${(track.size / (1024 * 1024)).toFixed(2)} MB</div>
                </div>
                <button class="track-item-delete" title="Delete Track"><i class="ri-delete-bin-line"></i></button>
            `;

            li.addEventListener('click', () => this.loadTrack(index));
            li.querySelector('.track-item-delete').addEventListener('click', (e) => this.deleteTrack(track.id, e));

            this.trackList.appendChild(li);
        });
    }

    updatePlaylistUI() {
        const playlist = this.playlists[this.currentPlaylistId];
        if (playlist) {
            this.playlistName.textContent = playlist.name;
        }
    }

    updateUI() {
        const isPaused = this.audio.paused;

        // Window Play button
        this.playPauseBtn.innerHTML = isPaused ? '<i class="ri-play-fill"></i>' : '<i class="ri-pause-fill"></i>';

        // Quick Play button
        this.quickPlayIcon.className = isPaused ? 'ri-play-fill' : 'ri-pause-fill';

        if (!isPaused) {
            this.trackIcon.classList.add('playing');
            this.quickPlayBtn.classList.add('playing');
        } else {
            this.trackIcon.classList.remove('playing');
            this.quickPlayBtn.classList.remove('playing');
        }

        // Show/hide quick play
        if (this.currentTrackIndex !== -1) {
            this.quickPlayBtn.style.display = 'flex';
        } else {
            this.quickPlayBtn.style.display = 'none';
        }
    }

    updateVolumeIcon() {
        let iconClass = 'ri-volume-up-line';
        if (this.isMuted || this.audio.volume === 0) {
            iconClass = 'ri-volume-mute-line';
        } else if (this.audio.volume < 0.5) {
            iconClass = 'ri-volume-down-line';
        }
        this.muteBtn.className = iconClass;

        if (this.isMuted) {
            this.muteBtn.style.color = 'var(--danger-color)';
        } else {
            this.muteBtn.style.color = 'var(--text-muted)';
        }
    }

    onTimeUpdate() {
        if (!this.audio.duration) return;
        this.timeCurrent.textContent = this.formatTime(this.audio.currentTime);
        const percentage = (this.audio.currentTime / this.audio.duration) * 100;
        this.seekSlider.value = percentage;
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }

    savePlaylists() {
        StorageService.set('music_playlists', this.playlists);
        if (this.eventBus) {
            // Trigger sync to backend via EventBus if desired
            this.eventBus.emit('dataUpdated', { source: 'MusicPlayer' });
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

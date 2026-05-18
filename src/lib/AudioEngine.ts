import { convertFileSrc } from '@tauri-apps/api/core';

/**
 * Zentrale Audio-Playback-Engine
 * Wrapper um das native HTML5 Audio-Element für zuverlässiges Pre-Buffering
 * und Crossfading (vorbereitet).
 */

export class AudioEngine {
  private static instance: AudioEngine;
  private audio: HTMLAudioElement;

  private constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto'; // Wichtig für Jams (Pre-buffering)
    this.setupListeners();
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  private setupListeners() {
    // Höre auf WebRTC Jam Sync Events
    window.addEventListener('jam-sync-update', ((e: CustomEvent) => {
      const { status, targetPositionMs } = e.detail;
      
      if (status === 'playing') {
        const targetSecs = targetPositionMs / 1000;
        const currentSecs = this.audio.currentTime;
        
        // Nur spulen, wenn die Drift zu groß ist (> 50ms)
        if (Math.abs(currentSecs - targetSecs) > 0.05) {
          this.audio.currentTime = targetSecs;
        }
        
        if (this.audio.paused) {
          this.audio.play().catch(err => console.error("Auto-play prevented", err));
        }
      } else {
        this.audio.pause();
        this.audio.currentTime = targetPositionMs / 1000;
      }
    }) as EventListener);
  }

  public getAudioElement(): HTMLAudioElement {
    return this.audio;
  }

  public loadTrack(path: string) {
    if (path.startsWith('http://') || path.startsWith('https://')) {
      this.audio.src = path;
    } else {
      this.audio.src = convertFileSrc(path);
    }
    this.audio.load();
  }

  public play() {
    return this.audio.play();
  }

  public pause() {
    this.audio.pause();
  }

  public seek(seconds: number) {
    this.audio.currentTime = seconds;
  }

  public setVolume(volume: number) {
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }
}

export const audioEngine = AudioEngine.getInstance();

/**
 * Cross-platform detection utilities.
 * The OS string comes from Rust's std::env::consts::OS via the get_platform command.
 * Values: "windows" | "macos" | "linux"
 */
import { invoke } from '@tauri-apps/api/core';

let _os: string = 'unknown';
let _resolved = false;

/** Call once near app startup (e.g. in main.tsx). */
export async function initPlatform(): Promise<void> {
  if (_resolved) return;
  try {
    _os = await invoke<string>('get_platform');
  } catch {
    // Fallback: try navigator.platform (works in most Tauri WebViews)
    const p = typeof navigator !== 'undefined' ? navigator.platform.toLowerCase() : '';
    if (p.startsWith('mac'))     _os = 'macos';
    else if (p.startsWith('win')) _os = 'windows';
    else                          _os = 'linux';
  }
  _resolved = true;
}

export const isMac     = (): boolean => _os === 'macos';
export const isWindows = (): boolean => _os === 'windows';
export const isLinux   = (): boolean => _os === 'linux';
export const getOS     = (): string  => _os;

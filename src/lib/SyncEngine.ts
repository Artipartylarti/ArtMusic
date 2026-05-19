/**
 * WebRTC SyncEngine für dezentrale Jams
 * Nutzt einen NTP-ähnlichen Algorithmus (Network Time Protocol) über WebRTC Data Channels,
 * um Audio-Latenzen zwischen Host und Clients (< 50ms) auszugleichen.
 */

export class SyncEngine {
  peerConnection: RTCPeerConnection | null = null;
  dataChannel: RTCDataChannel | null = null;
  private clockSyncInterval: ReturnType<typeof setInterval> | null = null;

  // Zeitsynchronisations-Parameter
  rtt: number = 0;
  clockOffset: number = 0; // Differenz zwischen lokaler Uhr und Host-Uhr
  isHost: boolean;

  constructor(isHost: boolean = false) {
    this.isHost = isHost;
    this.initPeerConnection();
  }

  public destroy() {
    if (this.clockSyncInterval) {
      clearInterval(this.clockSyncInterval);
      this.clockSyncInterval = null;
    }
    this.dataChannel?.close();
    this.peerConnection?.close();
    this.dataChannel = null;
    this.peerConnection = null;
  }

  private initPeerConnection() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] // Standard STUN für NAT Traversal
    });

    if (this.isHost) {
      this.dataChannel = this.peerConnection.createDataChannel('jam-sync', {
        ordered: false, // UDP-ähnlich für geringste Latenz
        maxRetransmits: 0 
      });
      this.setupChannelListeners();
    } else {
      this.peerConnection.ondatachannel = (event) => {
        this.dataChannel = event.channel;
        this.setupChannelListeners();
      };
    }
  }

  private setupChannelListeners() {
    if (!this.dataChannel) return;

    this.dataChannel.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        
        if (msg.type === 'ping' && this.isHost) {
          // Host antwortet auf Ping
          this.dataChannel?.send(JSON.stringify({
            type: 'pong',
            t0: msg.t0,
            t1: Date.now(),
            t2: Date.now()
          }));
        } else if (msg.type === 'pong' && !this.isHost) {
          // Client berechnet RTT und Zeit-Offset
          const t3 = Date.now();
          const { t0, t1, t2 } = msg;
          
          // NTP Formel
          this.rtt = (t3 - t0) - (t2 - t1);
          this.clockOffset = ((t1 - t0) + (t2 - t3)) / 2;
          
          console.log(`[Sync] RTT: ${this.rtt}ms | Offset: ${this.clockOffset}ms`);
        } else if (msg.type === 'playback-sync') {
          // Host sendet Playback-Status (z.B. Play bei 15400ms)
          this.handlePlaybackSync(msg);
        }
      } catch (err) {
        console.error('[Sync] Failed to parse message:', err);
      }
    };
  }

  // Wird vom Client periodisch aufgerufen, um Drift zu korrigieren
  public startClockSync() {
    if (this.isHost || !this.dataChannel) return;

    if (this.clockSyncInterval) {
      clearInterval(this.clockSyncInterval);
    }

    this.clockSyncInterval = setInterval(() => {
      if (this.dataChannel?.readyState === 'open') {
        this.dataChannel.send(JSON.stringify({
          type: 'ping',
          t0: Date.now()
        }));
      }
    }, 5000);
  }

  public sendPlaybackSync(status: 'playing' | 'paused', positionMs: number) {
    if (!this.isHost || !this.dataChannel) return;
    
    this.dataChannel.send(JSON.stringify({
      type: 'playback-sync',
      status,
      positionMs,
      hostTimestamp: Date.now()
    }));
  }

  private handlePlaybackSync(msg: any) {
    // Wenn Host "Play bei 10s" gesendet hat, berechnen wir die absolute Startzeit
    // unter Berücksichtigung der Netzwerk-Latenz und des Zeitstempel-Offsets.
    const calculatedHostTime = Date.now() + this.clockOffset;
    const latencyCorrection = (calculatedHostTime - msg.hostTimestamp);
    
    const targetPositionMs = msg.positionMs + latencyCorrection;
    
    // Dispatch Custom Event an die AudioEngine
    window.dispatchEvent(new CustomEvent('jam-sync-update', {
      detail: { status: msg.status, targetPositionMs }
    }));
  }
}

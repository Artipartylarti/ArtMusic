import { useEffect, useState } from 'react';
import { useServerStore } from '../store/useServerStore';
import { ChevronDown, Plus, Trash2, Wifi } from 'lucide-react';

export function ServerSelector() {
  const { 
    servers, 
    activeServer, 
    setActiveServer, 
    addServer, 
    removeServer, 
    loadServersFromStorage,
    fetchRemoteTracks,
    fetchRemoteReleases,
  } = useServerStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [newServerUrl, setNewServerUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadServersFromStorage();
  }, []);

  async function handleSelectServer(server: typeof activeServer) {
    if (!server) return;
    
    setActiveServer(server);
    setIsOpen(false);
    
    // If it's a remote server (has URL), fetch its data
    if (server.url && server.url !== 'local') {
      setLoading(true);
      try {
        const remoteTracks = await fetchRemoteTracks();
        await fetchRemoteReleases();
        
        if (remoteTracks.length > 0) {
          console.log(`Loaded ${remoteTracks.length} tracks from ${server.name}`);
        }
      } catch (e) {
        console.error('Failed to load from server:', e);
      } finally {
        setLoading(false);
      }
    }
  }

  function handleAddServer(e: React.FormEvent) {
    e.preventDefault();
    if (newServerName.trim() && newServerUrl.trim()) {
      addServer(newServerName, newServerUrl);
      setNewServerName('');
      setNewServerUrl('');
      setShowForm(false);
    }
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%', maxWidth: 280 }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '10px 12px',
          background: 'var(--surface-1)',
          border: '1px solid var(--border)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--text-primary)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = 'var(--surface-1)';
        }}
      >
        <span style={{ textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
          {activeServer ? activeServer.name : 'Server wählen...'}
        </span>
        <ChevronDown size={14} style={{ flexShrink: 0 }} />
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            zIndex: 1000,
            boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            maxHeight: 300,
            overflowY: 'auto',
          }}
        >
          <div style={{ padding: 8 }}>
            {servers.length === 0 ? (
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', padding: 8, textAlign: 'center' }}>
                Keine Server konfiguriert
              </p>
            ) : (
              servers.map((server) => (
                <button
                  key={server.id}
                  onClick={() => handleSelectServer(server)}
                  disabled={loading}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 10px',
                    background: activeServer?.id === server.id ? 'var(--accent)' : 'transparent',
                    color: activeServer?.id === server.id ? 'var(--surface-0)' : 'var(--text-primary)',
                    border: 'none',
                    borderRadius: 6,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontSize: 12,
                    marginBottom: 4,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.15s',
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <p style={{ fontWeight: 500, marginBottom: 2 }}>{server.name}</p>
                      {server.url && server.url !== 'local' && <Wifi size={10} style={{ opacity: 0.6 }} />}
                    </div>
                    <p style={{ fontSize: 10, opacity: 0.7, wordBreak: 'break-all' }}>{server.url || 'Lokaler Server'}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeServer(server.id);
                    }}
                    style={{
                      background: 'rgba(248, 113, 113, 0.2)',
                      border: 'none',
                      borderRadius: 4,
                      padding: 4,
                      cursor: 'pointer',
                      color: '#f87171',
                      flexShrink: 0,
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </button>
                ))
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border)', padding: 8 }}>
            {!showForm ? (
              <button
                onClick={() => setShowForm(true)}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: 'var(--accent)',
                  fontWeight: 500,
                }}
              >
                <Plus size={14} /> Server hinzufügen
              </button>
            ) : (
              <form onSubmit={handleAddServer} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  type="text"
                  placeholder="Name"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  style={{
                    padding: '6px 8px',
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    fontSize: 11,
                    color: 'var(--text-primary)',
                  }}
                />
                <input
                  type="url"
                  placeholder="URL (z.B. http://localhost:8088)"
                  value={newServerUrl}
                  onChange={(e) => setNewServerUrl(e.target.value)}
                  style={{
                    padding: '6px 8px',
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    fontSize: 11,
                    color: 'var(--text-primary)',
                  }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    type="submit"
                    style={{
                      flex: 1,
                      padding: '6px 0',
                      background: 'var(--accent)',
                      color: 'var(--surface-0)',
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    Hinzufügen
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    style={{
                      flex: 1,
                      padding: '6px 0',
                      background: 'var(--surface-1)',
                      color: 'var(--text-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 11,
                    }}
                  >
                    Abbrechen
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

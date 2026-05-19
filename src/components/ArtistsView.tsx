import { useAppStore } from "../store/useAppStore";
import { appSelectors } from "../store/useAppStore";
import { User } from "lucide-react";

export function ArtistsView() {
  const customTracks = useAppStore((state) => state.customTracks);
  
  const artists = appSelectors.getUniqueArtists(customTracks);
  
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Künstler</h1>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {artists.map((artist) => (
          <button
            key={artist}
            className="p-4 rounded-lg bg-zinc-800 hover:bg-zinc-700 transition-colors text-center"
          >
            <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <User size={24} />
            </div>
            <span className="text-sm font-medium truncate block">{artist}</span>
          </button>
        ))}
      </div>
      
      {artists.length === 0 && (
        <p className="text-zinc-400 text-center py-8">
          Keine Künstler gefunden. Füge Musik hinzu!
        </p>
      )}
    </div>
  );
}
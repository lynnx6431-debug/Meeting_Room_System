import { useEffect, useState } from 'react';

type DevRoom = {
  code: string;
  name: string;
  token: string;
};

export function DevTokenHelper() {
  const [rooms, setRooms] = useState<DevRoom[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadRooms() {
      try {
        const response = await fetch('/api/dev/demo-rooms');
        if (!response.ok) {
          throw new Error(String(response.status));
        }
        const data = (await response.json()) as { rooms?: DevRoom[] };
        if (!cancelled) {
          setRooms(data.rooms || []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : String(loadError));
        }
      }
    }

    void loadRooms();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mt-10 rounded-xl border border-amber-200 bg-amber-50 p-5 text-left shadow-sm">
      <p className="mb-3 text-sm font-medium text-amber-950">Developer shortcut (dev mode only)</p>

      {error ? (
        <div className="rounded-md bg-red-50 p-3 text-xs text-red-700">
          <p>Failed to fetch demo rooms: {error}</p>
          <p className="mt-1">Make sure the backend is running and exposes `/api/dev/demo-rooms`.</p>
          <p className="mt-1">Or query manually:</p>
          <code className="mt-2 block rounded bg-amber-100 p-2 text-[10px] text-amber-900">
            docker exec meeting-room-postgres psql -U meeting -d meeting_room -t -A -c
            "SELECT code, room_token FROM rooms;"
          </code>
        </div>
      ) : null}

      {rooms === null && !error ? (
        <p className="text-xs text-amber-700">Loading demo rooms...</p>
      ) : null}

      {rooms && rooms.length === 0 ? (
        <p className="text-xs text-amber-700">No demo rooms found in DB.</p>
      ) : null}

      {rooms && rooms.length > 0 ? (
        <div className="space-y-1.5">
          <p className="mb-2 text-xs text-amber-700">Click a room to open with its token:</p>
          {rooms.map((room) => (
            <a
              key={room.code}
              href={`/?token=${room.token}`}
              className="block rounded-md border border-amber-100 bg-white px-3 py-2 text-sm transition hover:bg-amber-100"
            >
              <span className="font-medium text-foreground">{room.name}</span>
              <span className="ml-2 text-xs text-amber-700">({room.code})</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

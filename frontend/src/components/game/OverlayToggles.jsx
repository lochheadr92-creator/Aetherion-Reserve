import { useState } from 'react';
import { Leaf, Zap, Eye } from 'lucide-react';

const toggles = [
  { id: 'habitat', icon: Leaf, label: 'Habitat suitability overlay' },
  { id: 'power', icon: Zap, label: 'Power coverage overlay' },
  { id: 'view', icon: Eye, label: 'Viewing range overlay' },
];

export default function OverlayToggles({ rendererRef }) {
  const [active, setActive] = useState(null);
  const set = (id) => {
    const next = active === id ? null : id;
    setActive(next);
    if (rendererRef.current) rendererRef.current.overlay = next;
  };
  return (
    <div className="absolute right-3 top-16 z-20 flex flex-col gap-1" data-testid="overlay-toggles">
      {toggles.map((t) => (
        <button key={t.id} data-testid={`overlay-${t.id}`} title={t.label}
          onClick={() => set(t.id)}
          className="nl-tool w-9 h-9 flex items-center justify-center"
          data-active={active === t.id ? 'true' : 'false'}>
          <t.icon size={15} />
        </button>
      ))}
    </div>
  );
}

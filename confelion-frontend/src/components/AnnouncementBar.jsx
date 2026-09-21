import { useState, useEffect } from 'react';
import { fetchAPI } from '../lib/api';
import { STORE_SETTINGS } from '../data/mockData';

export default function AnnouncementBar() {
  const [text, setText] = useState(STORE_SETTINGS.announcement);

  useEffect(() => {
    fetchAPI('/api/settings').then((s) => {
      if (s?.announcement) setText(s.announcement);
    });
    const handleUpdate = (e) => {
      if (e.detail?.announcement) setText(e.detail.announcement);
    };
    window.addEventListener('settings-updated', handleUpdate);
    return () => window.removeEventListener('settings-updated', handleUpdate);
  }, []);

  return (
    <aside className="w-full bg-black text-white text-center py-2 px-4 border-b border-white/10 z-50 relative">
      <p className="text-[11px] sm:text-xs font-medium uppercase tracking-[0.18em] text-zinc-200">
        {text}
      </p>
    </aside>
  );
}

import { Link } from 'react-router-dom';
import { SearchX, Home, ShoppingBag } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6 selection:bg-white selection:text-black">
      {/* Background ambient subtle glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.03)_0%,transparent_70%)]" />

      <div className="text-center max-w-lg relative z-10 animate-fade-in">
        <div className="w-20 h-20 mx-auto mb-6 flex items-center justify-center border border-white/20 bg-zinc-950">
          <SearchX className="w-10 h-10 text-white stroke-[1.5]" />
        </div>

        <span className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">
          404 ERROR · NOT FOUND
        </span>
        <h1 className="text-3xl sm:text-5xl font-black uppercase tracking-tight text-white mt-2 mb-4">
          PAGE VANISHED
        </h1>
        <p className="text-zinc-400 text-xs sm:text-sm uppercase tracking-wider mb-8 max-w-md mx-auto leading-relaxed">
          The editorial piece or collection you are seeking is either archived, moved, or restricted.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="px-6 py-3.5 bg-white text-black text-xs font-bold uppercase tracking-[0.2em] hover:bg-zinc-200 transition-all flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </Link>
          <Link
            to="/products"
            className="px-6 py-3.5 bg-black text-white text-xs font-bold uppercase tracking-[0.2em] border border-white/20 hover:border-white hover:bg-white/5 transition-all flex items-center justify-center gap-2"
          >
            <ShoppingBag className="w-4 h-4" />
            Explore Pieces
          </Link>
        </div>
      </div>
    </div>
  );
}

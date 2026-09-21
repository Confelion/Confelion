import { Outlet } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import AnnouncementBar from './AnnouncementBar';
import Navigation from './Navigation';
import Footer from './Footer';
import CartDrawer from './CartDrawer';
import QuickAddModal from './QuickAddModal';
import { STORE_SETTINGS } from '../data/mockData';

export default function Layout() {
  return (
    <>
      <Helmet>
        <title>{STORE_SETTINGS.site_name} — {STORE_SETTINGS.tagline}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#000000" />
        <link rel="icon" href="/images/applogo.svg" type="image/svg+xml" />
      </Helmet>

      <div className="min-h-screen bg-black text-white flex flex-col font-sans selection:bg-white selection:text-black">
        <AnnouncementBar />
        <Navigation />

        <main className="flex-1 bg-black">
          <Outlet />
        </main>

        <Footer />
        <CartDrawer />
        <QuickAddModal />
      </div>
    </>
  );
}

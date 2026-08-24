import { Outlet } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';

export default function Layout() {
  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 'var(--navbar-height)', flex: 1 }}>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

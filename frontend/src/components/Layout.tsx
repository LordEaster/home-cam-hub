import { Outlet } from 'react-router-dom';
import { MainLayout } from './layout/MainLayout';

export default function Layout() {
  return (
    <MainLayout>
      <Outlet />
    </MainLayout>
  );
}

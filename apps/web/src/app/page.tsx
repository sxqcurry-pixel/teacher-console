import DashboardPage from './dashboard/page';

/** Root "/" 直接渲染仪表盘，避免 307 redirect 增加首屏延迟。 */
export default function HomePage() {
  return <DashboardPage />;
}

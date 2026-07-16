import { SidebarProvider, useSidebar } from "../context/SidebarContext";
import { Outlet } from "react-router";
import AppHeader from "./AppHeader";
import Backdrop from "./Backdrop";
import AppSidebar from "./AppSidebar";
import type { AccessInfo, SessionUser } from "../lib/api";
import OfflineStatus from "../components/common/OfflineStatus";

type AppLayoutProps = {
  access: AccessInfo;
  user: SessionUser;
  onLogout: () => void;
};

const LayoutContent: React.FC<AppLayoutProps> = ({ access, user, onLogout }) => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  return (
    <div className="min-h-screen overflow-x-hidden xl:flex">
      <div>
        <AppSidebar permissions={access.permissions} />
        <Backdrop />
      </div>
      <div
        className={`min-w-0 flex-1 transition-all duration-300 ease-in-out ${
          isExpanded || isHovered ? "lg:ml-[290px]" : "lg:ml-[90px]"
        } ${isMobileOpen ? "ml-0" : ""}`}
      >
        <AppHeader user={user} onLogout={onLogout} />
        <OfflineStatus />
        <div className="p-4 mx-auto max-w-(--breakpoint-2xl) text-gray-900 md:p-6 dark:text-white/90">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

const AppLayout: React.FC<AppLayoutProps> = (props) => {
  return (
    <SidebarProvider>
      <LayoutContent {...props} />
    </SidebarProvider>
  );
};

export default AppLayout;

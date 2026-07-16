import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";

import { ChevronDownIcon, GridIcon, HorizontaLDots, TableIcon, UserCircleIcon } from "../icons";
import { useSidebar } from "../context/SidebarContext";
import { hasPermission } from "../lib/permissions";

export type NavItem = {
  name: string;
  icon: ReactNode;
  path?: string;
  subItems?: { name: string; path: string }[];
};

export function buildNavItems(permissions: string[]): NavItem[] {
  const items: NavItem[] = hasPermission(permissions, "reports.view") ? [{
    icon: <GridIcon />,
    name: "Tổng quan",
    path: "/",
  }] : [];

  const adminSubItems = [
    ...(hasPermission(permissions, "admin.users.view") ? [{ name: "Người dùng", path: "/admin/users" }] : []),
    ...(hasPermission(permissions, "admin.roles.view") ? [
      { name: "Vai trò", path: "/admin/roles" },
      { name: "Quyền hạn", path: "/admin/permissions" },
    ] : []),
  ];
  if (adminSubItems.length > 0) {
    items.push({
      icon: <UserCircleIcon />,
      name: "Quản trị",
      subItems: adminSubItems,
    });
  }

  const warehouseSubItems = [
    ...(hasPermission(permissions, "locations.view") ? [{ name: "Vị trí kho", path: "/locations" }] : []),
    ...(hasPermission(permissions, "catalog.categories.view") ? [{ name: "Danh mục", path: "/catalog/categories" }] : []),
    ...(hasPermission(permissions, "catalog.units.view") ? [{ name: "Đơn vị", path: "/catalog/units" }] : []),
    ...(hasPermission(permissions, "products.view") ? [{ name: "Sản phẩm", path: "/products" }] : []),
    ...(hasPermission(permissions, "partners.view") ? [{ name: "Đối tác", path: "/partners" }] : []),
    ...(hasPermission(permissions, "purchasing.view") ? [{ name: "Đơn mua", path: "/purchasing" }] : []),
    ...(hasPermission(permissions, "sales.view") ? [{ name: "Bán hàng", path: "/sales" }] : []),
    ...(hasPermission(permissions, "returns.view") ? [{ name: "Trả hàng", path: "/returns" }] : []),
    ...(hasPermission(permissions, "stockCounts.view") ? [{ name: "Kiểm kê", path: "/stock-counts" }] : []),
    ...(hasPermission(permissions, "transfers.view") ? [{ name: "Chuyển kho", path: "/transfers" }] : []),
    ...(hasPermission(permissions, "reports.view") ? [{ name: "Báo cáo", path: "/reports" }] : []),
    ...(hasPermission(permissions, "inventory.view") ? [{ name: "Kiểm tra scanner", path: "/scanner" }] : []),
    ...(hasPermission(permissions, "receipts.view") ? [{ name: "Phiếu nhập", path: "/receipts" }] : []),
    ...(hasPermission(permissions, "outbounds.view") ? [{ name: "Phiếu xuất", path: "/outbounds" }] : []),
    ...(hasPermission(permissions, "picking.view") ? [{ name: "Soạn hàng", path: "/picking" }] : []),
    ...(hasPermission(permissions, "checking.view") ? [{ name: "Kiểm và xuất", path: "/checking" }] : []),
    ...(hasPermission(permissions, "outbound.exceptions.view") ? [{ name: "Ngoại lệ xuất", path: "/outbound-exceptions" }] : []),
    ...(hasPermission(permissions, "inventory.view") ? [{ name: "Tồn kho", path: "/inventory" }] : []),
  ];

  if (warehouseSubItems.length > 0) {
    items.push({
      icon: <TableIcon />,
      name: "Kho hàng",
      subItems: warehouseSubItems,
    });
  }

  return items;
}

export default function AppSidebar({ permissions }: { permissions: string[] }) {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();
  const navItems = useMemo(() => buildNavItems(permissions), [permissions]);

  const [manualOpenSubmenu, setManualOpenSubmenu] = useState<number | null | undefined>(undefined);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<number, number>>({});
  const subMenuRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const isActive = useCallback(
    (path: string) => location.pathname === path,
    [location.pathname],
  );

  const activeSubmenu = useMemo(() => {
    const matchedIndex = navItems.findIndex((nav) =>
      nav.subItems?.some((subItem) => isActive(subItem.path)),
    );
    return matchedIndex >= 0 ? matchedIndex : null;
  }, [isActive, navItems]);
  const openSubmenu = manualOpenSubmenu === undefined ? activeSubmenu : manualOpenSubmenu;

  useEffect(() => {
    if (openSubmenu !== null && subMenuRefs.current[openSubmenu]) {
      setSubMenuHeight((current) => ({
        ...current,
        [openSubmenu]: subMenuRefs.current[openSubmenu]?.scrollHeight || 0,
      }));
    }
  }, [openSubmenu]);

  function handleSubmenuToggle(index: number) {
    setManualOpenSubmenu((current) => {
      const visibleSubmenu = current === undefined ? activeSubmenu : current;
      return visibleSubmenu === index ? null : index;
    });
  }

  return (
    <aside
      className={`fixed mt-16 flex h-screen flex-col border-r border-gray-200 bg-white px-5 text-gray-900 transition-all duration-300 ease-in-out top-0 left-0 z-50 dark:border-gray-800 dark:bg-gray-900 lg:mt-0 ${
        isExpanded || isMobileOpen || isHovered ? "w-[290px]" : "w-[90px]"
      } ${isMobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`flex py-8 ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <Link to="/" aria-label="Warehouse Suite">
          {isExpanded || isHovered || isMobileOpen ? (
            <span className="text-lg font-semibold text-gray-900 dark:text-white">
              Warehouse Suite
            </span>
          ) : (
            <img src="/images/logo/logo-icon.svg" alt="" width={32} height={32} />
          )}
        </Link>
      </div>

      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6" aria-label="Điều hướng chính">
          <h2
            className={`mb-4 flex text-xs uppercase leading-[20px] text-gray-400 ${
              !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
            }`}
          >
            {isExpanded || isHovered || isMobileOpen ? (
              "Menu"
            ) : (
              <>
                <span className="sr-only">Menu</span>
                <HorizontaLDots className="size-6" aria-hidden="true" />
              </>
            )}
          </h2>

          <ul className="flex flex-col gap-4">
            {navItems.map((nav, index) => (
              <li key={nav.name}>
                {nav.subItems ? (
                  <button
                    type="button"
                    aria-label={nav.name}
                    onClick={() => handleSubmenuToggle(index)}
                    className={`menu-item group ${
                      openSubmenu === index ? "menu-item-active" : "menu-item-inactive"
                    } ${!isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"}`}
                  >
                    <span
                      className={`menu-item-icon-size ${
                        openSubmenu === index
                          ? "menu-item-icon-active"
                          : "menu-item-icon-inactive"
                      }`}
                    >
                      {nav.icon}
                    </span>
                    {(isExpanded || isHovered || isMobileOpen) && (
                      <span className="menu-item-text">{nav.name}</span>
                    )}
                    {(isExpanded || isHovered || isMobileOpen) && (
                      <ChevronDownIcon
                        className={`ml-auto h-5 w-5 transition-transform duration-200 ${
                          openSubmenu === index ? "rotate-180 text-brand-500" : ""
                        }`}
                      />
                    )}
                  </button>
                ) : (
                  nav.path && (
                    <Link
                      to={nav.path}
                      aria-label={nav.name}
                      className={`menu-item group ${
                        isActive(nav.path) ? "menu-item-active" : "menu-item-inactive"
                      } ${!isExpanded && !isHovered ? "lg:justify-center" : "lg:justify-start"}`}
                    >
                      <span
                        className={`menu-item-icon-size ${
                          isActive(nav.path)
                            ? "menu-item-icon-active"
                            : "menu-item-icon-inactive"
                        }`}
                      >
                        {nav.icon}
                      </span>
                      {(isExpanded || isHovered || isMobileOpen) && (
                        <span className="menu-item-text">{nav.name}</span>
                      )}
                    </Link>
                  )
                )}

                {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
                  <div
                    ref={(el) => {
                      subMenuRefs.current[index] = el;
                    }}
                    className="overflow-hidden transition-all duration-300"
                    style={{
                      height: openSubmenu === index ? `${subMenuHeight[index]}px` : "0px",
                    }}
                  >
                    <ul className="mt-2 ml-9 space-y-1">
                      {nav.subItems.map((subItem) => (
                        <li key={subItem.path}>
                          <Link
                            to={subItem.path}
                            className={`menu-dropdown-item ${
                              isActive(subItem.path)
                                ? "menu-dropdown-item-active"
                                : "menu-dropdown-item-inactive"
                            }`}
                          >
                            {subItem.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </nav>

        {(isExpanded || isHovered || isMobileOpen) && (
          <div className="rounded-2xl bg-gray-50 p-4 text-sm text-gray-600 dark:bg-white/[0.03] dark:text-gray-400">
            <div className="font-medium text-gray-800 dark:text-white/90">Kho MAIN</div>
            <div className="mt-1 text-theme-xs">Phiên làm việc đang dùng quyền theo kho.</div>
          </div>
        )}
      </div>
    </aside>
  );
}

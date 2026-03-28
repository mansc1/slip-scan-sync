import { LayoutDashboard, Receipt, Download, Settings, Upload } from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar';

const navItems = [
  { title: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { title: 'Upload Slip', icon: Upload, path: '/upload' },
  { title: 'Export', icon: Download, path: '/export' },
  { title: 'Settings', icon: Settings, path: '/settings' },
];

export function AppSidebar() {
  const location = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-lg">
            S
          </div>
          <div>
            <h1 className="text-base font-bold text-sidebar-foreground">SlipSync</h1>
            <p className="text-xs text-sidebar-foreground/60">บันทึกรายจ่ายอัตโนมัติ</p>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === item.path}
                  >
                    <Link to={item.path}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="rounded-lg bg-sidebar-accent p-3">
          <p className="text-xs text-sidebar-accent-foreground/70">Demo Mode</p>
          <p className="text-xs text-sidebar-accent-foreground/50 mt-1">Sign in to connect LINE bot</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

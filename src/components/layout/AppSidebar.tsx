import { LayoutDashboard, Download, Settings, Upload, LogOut, LogIn } from 'lucide-react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
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
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useLineAuth } from '@/contexts/LineAuthContext';

const adminNavItems = [
  { title: 'Dashboard', icon: LayoutDashboard, path: '/' },
  { title: 'Upload Slip', icon: Upload, path: '/upload' },
  { title: 'Export', icon: Download, path: '/export' },
  { title: 'Settings', icon: Settings, path: '/settings' },
];

const userNavItems = [
  { title: 'Dashboard', icon: LayoutDashboard, path: '/' },
];

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, signOut } = useAuth();
  const { isLineUser, lineIdentity, clearLineIdentity } = useLineAuth();

  const navItems = isLineUser ? userNavItems : adminNavItems;

  const handleSignOut = async () => {
    if (isLineUser) {
      clearLineIdentity();
      navigate('/auth');
    } else {
      await signOut();
      navigate('/auth');
    }
  };

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-lg">
            S
          </div>
          <div>
            <h1 className="text-base font-bold text-sidebar-foreground">SlipSync</h1>
            <p className="text-xs text-sidebar-foreground/60">
              {isLineUser ? 'รายจ่ายส่วนตัว' : 'บันทึกรายจ่ายอัตโนมัติ'}
            </p>
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
        {(isAuthenticated || isLineUser) ? (
          <div className="space-y-2">
            <div className="rounded-lg bg-sidebar-accent p-3 flex items-center gap-2">
              {isLineUser && lineIdentity?.pictureUrl && (
                <img src={lineIdentity.pictureUrl} alt="" className="h-8 w-8 rounded-full" />
              )}
              <p className="text-xs text-sidebar-accent-foreground/90 font-medium truncate">
                {isLineUser ? lineIdentity?.displayName : user?.email}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              ออกจากระบบ
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="rounded-lg bg-sidebar-accent p-3">
              <p className="text-xs text-sidebar-accent-foreground/70">Admin Dashboard</p>
              <p className="text-xs text-sidebar-accent-foreground/50 mt-1">ผู้ใช้ทั่วไปใช้ LINE Bot</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground"
              onClick={() => navigate('/auth')}
            >
              <LogIn className="h-4 w-4 mr-2" />
              Admin Login
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Topbar } from './Topbar';

interface AppShellProps {
  children: React.ReactNode;
  onUploadClick?: () => void;
}

export function AppShell({ children, onUploadClick }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="flex flex-col overflow-hidden">
        <Topbar onUploadClick={onUploadClick} />
        <main className="flex min-h-0 flex-1 flex-col overflow-auto">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

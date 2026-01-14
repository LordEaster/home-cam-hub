import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { NavBottom } from "./NavBottom";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <SidebarInset className="flex-1 flex flex-col overflow-hidden pb-20 md:pb-0">
          {/* Desktop Header with Trigger */}
          <header className="hidden md:flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
          </header>
          
          {/* Mobile Header */}
          <header className="flex md:hidden h-14 shrink-0 items-center border-b bg-background px-4">
            <div className="font-bold text-lg">HomeCam Hub</div>
          </header>

          {/* Main Content */}
          <div className="flex-1 overflow-auto flex flex-col">
            <div className="flex-1 flex flex-col gap-4 p-4 pb-23 md:pb-4">
              {children}
            </div>
          </div>
        </SidebarInset>
        
        {/* Mobile Bottom Navigation - outside scrollable area, fixed */}
        <NavBottom />
      </div>
    </SidebarProvider>
  );
}

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Calendar, List, Projector, Volume2, Users, Settings, LayoutDashboard } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navigationItems = [
  {
    title: "Dashboard",
    url: createPageUrl("Dashboard"),
    icon: LayoutDashboard,
  },
  {
    title: "Eventos",
    url: createPageUrl("Events"),
    icon: Calendar,
  },
  {
    title: "Programa General",
    url: createPageUrl("GeneralProgram"),
    icon: List,
  },
  {
    title: "Vista Proyección",
    url: createPageUrl("ProjectionView"),
    icon: Projector,
  },
  {
    title: "Vista Sonido",
    url: createPageUrl("SoundView"),
    icon: Volume2,
  },
  {
    title: "Vista Ujieres",
    url: createPageUrl("UshersView"),
    icon: Users,
  },
  {
    title: "Plantillas",
    url: createPageUrl("Templates"),
    icon: Settings,
  },
];

export default function Layout({ children }) {
  const location = useLocation();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-pdv-dark">
        <Sidebar className="border-r border-slate-800 bg-pdv-charcoal">
          <SidebarHeader className="border-b border-slate-800 p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 gradient-pdv rounded flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-white text-lg uppercase tracking-tight">EventoPro</h2>
                <p className="text-xs text-pdv-green font-medium">Palabras de Vida</p>
              </div>
            </div>
          </SidebarHeader>
          
          <SidebarContent className="p-3">
            <SidebarGroup>
              <SidebarGroupLabel className="text-xs font-bold text-slate-600 uppercase tracking-wider px-3 py-3">
                Navegación
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton 
                        asChild 
                        className={`hover:bg-pdv-teal hover:text-white transition-all duration-200 rounded mb-1 ${
                          location.pathname === item.url ? 'gradient-pdv text-white font-semibold' : 'text-slate-400'
                        }`}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                          <item.icon className="w-5 h-5" />
                          <span className="font-semibold uppercase text-sm tracking-wide">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        <main className="flex-1 flex flex-col bg-pdv-dark">
          <header className="bg-pdv-charcoal border-b border-slate-800 px-6 py-4 lg:hidden">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="hover:bg-slate-800 p-2 rounded transition-colors duration-200 text-white" />
              <h1 className="text-xl font-bold uppercase tracking-tight text-white">EventoPro</h1>
            </div>
          </header>

          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Calendar, Settings, LayoutDashboard, ChevronDown, Menu, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Layout({ children }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 gradient-pdv rounded flex items-center justify-center">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-gray-900 text-lg uppercase tracking-tight">EventoPro</h2>
                <p className="text-xs text-pdv-green font-medium">Palabras de Vida</p>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              <Link
                to={createPageUrl("Dashboard")}
                className={`flex items-center gap-2 px-4 py-2 rounded font-semibold uppercase text-sm tracking-wide transition-colors ${
                  isActive(createPageUrl("Dashboard"))
                    ? "bg-pdv-teal text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger className={`flex items-center gap-2 px-4 py-2 rounded font-semibold uppercase text-sm tracking-wide transition-colors ${
                  isActive(createPageUrl("Events")) || 
                  isActive(createPageUrl("EventDetail")) || 
                  isActive(createPageUrl("SessionDetail")) ||
                  isActive(createPageUrl("Reports"))
                    ? "bg-pdv-teal text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}>
                  <Calendar className="w-4 h-4" />
                  Eventos
                  <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-white">
                  <DropdownMenuItem asChild>
                    <Link to={createPageUrl("Events")} className="cursor-pointer">
                      Gestión de Eventos
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={createPageUrl("Reports")} className="cursor-pointer">
                      Informes de Eventos
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger className={`flex items-center gap-2 px-4 py-2 rounded font-semibold uppercase text-sm tracking-wide transition-colors ${
                  isActive(createPageUrl("People")) || 
                  isActive(createPageUrl("Teams")) || 
                  isActive(createPageUrl("Rooms")) ||
                  isActive(createPageUrl("Templates"))
                    ? "bg-pdv-teal text-white"
                    : "text-gray-700 hover:bg-gray-100"
                }`}>
                  <Settings className="w-4 h-4" />
                  Configuración
                  <ChevronDown className="w-4 h-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="bg-white">
                  <DropdownMenuItem asChild>
                    <Link to={createPageUrl("People")} className="cursor-pointer">
                      Personas
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={createPageUrl("Teams")} className="cursor-pointer">
                      Equipos
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={createPageUrl("Rooms")} className="cursor-pointer">
                      Salas
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to={createPageUrl("Templates")} className="cursor-pointer">
                      Plantillas
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </nav>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded hover:bg-gray-100 text-gray-700"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="md:hidden py-4 border-t border-gray-200">
              <div className="space-y-1">
                <Link
                  to={createPageUrl("Dashboard")}
                  className={`block px-4 py-2 rounded font-semibold uppercase text-sm ${
                    isActive(createPageUrl("Dashboard"))
                      ? "bg-pdv-teal text-white"
                      : "text-gray-700 hover:bg-gray-100"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>

                <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase">Eventos</div>
                <Link
                  to={createPageUrl("Events")}
                  className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Gestión de Eventos
                </Link>
                <Link
                  to={createPageUrl("Reports")}
                  className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Informes de Eventos
                </Link>

                <div className="px-4 py-2 text-xs font-bold text-gray-500 uppercase mt-2">Configuración</div>
                <Link
                  to={createPageUrl("People")}
                  className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Personas
                </Link>
                <Link
                  to={createPageUrl("Teams")}
                  className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Equipos
                </Link>
                <Link
                  to={createPageUrl("Rooms")}
                  className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Salas
                </Link>
                <Link
                  to={createPageUrl("Templates")}
                  className="block px-6 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Plantillas
                </Link>
              </div>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
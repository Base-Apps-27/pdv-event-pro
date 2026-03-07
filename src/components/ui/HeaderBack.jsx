// HeaderBack — Apple HIG breadcrumb-style back button
// 2026-03-07: Simple, focused component for detail page headers
// Usage: <HeaderBack parentPage="Events" />

import React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { createPageUrl } from "@/utils";

export default function HeaderBack({ parentPage, parentLabel }) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(createPageUrl(parentPage), { replace: true })}
      className="flex items-center gap-1 text-sm font-medium text-[#1F8A70] hover:text-[#0F5C4D] transition-colors no-select active:opacity-70"
      title={`Back to ${parentLabel}`}
    >
      <ChevronLeft className="w-4 h-4" />
      <span>{parentLabel}</span>
    </button>
  );
}
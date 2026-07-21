"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface PageHeaderProps {
  title: string;
  icon?: string;
  username?: string;
  onLogout?: () => void;
  showBackLink?: boolean;
  extraHeaderContent?: React.ReactNode;
}

export default function PageHeader({
  title,
  icon,
  username,
  onLogout,
  showBackLink = true,
  extraHeaderContent
}: PageHeaderProps) {
  const router = useRouter();

  const handleLogoutAction = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem("username");
      router.push("/connect");
    }
  };

  return (
    <header className="w-full bg-[#111111] border-b-2 border-[#222222] px-6 py-3 flex items-center justify-between gap-4 text-white text-base font-sans shrink-0">
      <div className="flex items-center gap-4">
        {showBackLink && (
          <Link
            href="/connect"
            className="bg-[#333333] hover:bg-[#444444] text-white border border-[#555555] px-3 py-1 rounded text-xs font-bold transition-colors flex items-center gap-1"
            title="Retour au menu"
          >
            ← Menu
          </Link>
        )}
        <h1 className="text-lg font-bold tracking-wide text-white flex items-center gap-2 m-0">
          {icon && <span>{icon}</span>}
          <span>{title}</span>
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {extraHeaderContent}
        {username && (
          <div className="flex items-center gap-3 text-sm">
            <span>User: <strong>{username}</strong></span>
            <button
              onClick={handleLogoutAction}
              className="bg-[#333333] hover:bg-[#444444] text-white border border-[#555555] px-3 py-1 rounded cursor-pointer text-xs font-bold transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

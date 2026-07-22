"use client";

import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sun, Moon, Clock } from "lucide-react";
import { useTheme } from "../hooks/useTheme";

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
  const { theme, isTimeLocked, toggleTheme, lockToSystemTime } = useTheme();

  const handleLogoutAction = () => {
    if (onLogout) {
      onLogout();
    } else {
      localStorage.removeItem("username");
      router.push("/connect");
    }
  };

  return (
    <header className="w-full bg-[#00000] border-b-2 border-[#222222] px-4 py-1 flex items-center justify-between gap-2 text-white text-base font-sans shrink-0">
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
        <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-lg border border-zinc-800">
          <button
            onClick={toggleTheme}
            aria-label="Changer le thème"
            className="p-1 hover:bg-zinc-800 text-zinc-200 rounded transition-colors cursor-pointer"
            title={theme === "dark" ? "Mode Sombre actif (cliquer pour basculer)" : "Mode Clair actif (cliquer pour basculer)"}
          >
            {theme === "dark" ? <Moon className="w-3.5 h-3.5 text-blue-400" /> : <Sun className="w-3.5 h-3.5 text-amber-400" />}
          </button>
          <button
            onClick={lockToSystemTime}
            aria-label="Synchroniser avec l'heure système"
            className={`p-1 rounded transition-colors cursor-pointer ${
              isTimeLocked ? "bg-cyan-950/80 text-cyan-400 border border-cyan-800" : "text-zinc-500 hover:text-zinc-300"
            }`}
            title={isTimeLocked ? "Thème synchronisé sur l'heure système (07h-19h Jour, 19h-07h Nuit)" : "Cliquer pour synchroniser sur l'heure système"}
          >
            <Clock className="w-3.5 h-3.5" />
          </button>
        </div>
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

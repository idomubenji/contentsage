"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogOut, Sun, Moon, Shield } from "lucide-react";
import { useAuth } from "../lib/auth-context";
import { useTheme } from "../lib/theme-context";

const navItems = [
  { name: "Home", path: "/" },
  { name: "Inspector", path: "/inspector" },
  { name: "Calendar", path: "/calendar" },
  { name: "Organizations", path: "/organizations" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const handleSignOut = async () => {
    try {
      console.log("Sidebar: Signing out...");
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div className="fixed top-0 left-0 w-64 h-screen bg-gray-100 border-r border-gray-200 p-4 flex flex-col dark:bg-gray-800 dark:border-gray-700 transition-colors duration-200 overflow-y-auto">
      <div className="flex items-center gap-2 mb-6">
        <img
          src="/contentsage.jpg"
          alt="ContentSage Logo"
          width={32}
          height={32}
          className="rounded-lg w-[32px] h-[32px]"
          style={{ display: 'block' }}
        />
        <div className="text-xl font-bold dark:text-white">ContentSage</div>
      </div>
      <nav className="space-y-2">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link
              key={item.path}
              href={item.path}
              className={`block px-4 py-2 rounded-md transition-colors ${
                isActive
                  ? "bg-gray-200 text-gray-900 font-medium dark:bg-gray-700 dark:text-white"
                  : "text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>
      
      {/* Bottom controls */}
      <div className="mt-auto space-y-2">
        {/* Privacy Settings */}
        <Link
          href="/privacy-settings"
          className={`flex items-center gap-2 px-4 py-2 w-full text-left rounded-md transition-colors ${
            pathname === "/privacy-settings"
              ? "bg-gray-200 text-gray-900 font-medium dark:bg-gray-700 dark:text-white"
              : "text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
          }`}
        >
          <Shield size={18} />
          <span>Privacy Settings</span>
        </Link>
        
        {/* Theme toggle button */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 px-4 py-2 w-full text-left rounded-md text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white transition-colors"
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
        >
          {theme === 'light' ? (
            <>
              <Moon size={18} />
              <span>Dark Mode</span>
            </>
          ) : (
            <>
              <Sun size={18} />
              <span>Light Mode</span>
            </>
          )}
        </button>
        
        {/* Sign-out button */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2 w-full text-left rounded-md text-gray-600 hover:bg-gray-200 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white transition-colors"
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
} 
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { useAuth } from "../lib/auth-context";

const navItems = [
  { name: "Home", path: "/" },
  { name: "Inspector", path: "/inspector" },
  { name: "Calendar", path: "/calendar" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useAuth();

  const handleSignOut = async () => {
    try {
      console.log("Sidebar: Signing out...");
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <div className="w-64 h-screen bg-gray-100 border-r border-gray-200 p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <Image
          src="/contentsage.jpg"
          alt="ContentSage Logo"
          width={32}
          height={32}
          className="rounded-lg"
        />
        <div className="text-xl font-bold">ContentSage</div>
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
                  ? "bg-gray-200 text-gray-900 font-medium"
                  : "text-gray-600 hover:bg-gray-200 hover:text-gray-900"
              }`}
            >
              {item.name}
            </Link>
          );
        })}
      </nav>
      
      {/* Sign-out button positioned at the bottom */}
      <div className="mt-auto">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-4 py-2 w-full text-left rounded-md text-gray-600 hover:bg-gray-200 hover:text-gray-900 transition-colors"
        >
          <LogOut size={18} />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
} 
"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const navItems = [
  { name: "Home", path: "/" },
  { name: "Inspector", path: "/inspector" },
  { name: "Calendar", path: "/calendar" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 h-screen bg-gray-100 border-r border-gray-200 p-4">
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
    </div>
  );
} 
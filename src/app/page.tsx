'use client';

import { useAuth } from '@/lib/auth-context';

export default function Home() {
  // Remove unused variables
  // const { user, isLoading } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
        <h1 className="text-4xl font-bold mt-20 dark:text-white">
          Welcome to ContentSage
        </h1>
        
        <p className="mt-6 text-xl dark:text-gray-300">
          Your intelligent content management solution
        </p>
      </main>
    </div>
  );
}

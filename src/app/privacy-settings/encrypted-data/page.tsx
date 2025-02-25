"use client";

import { useAuth } from "../../../lib/auth-context";
import EncryptedDataManager from "../../../components/privacy/EncryptedDataManager";
import { ArrowLeft, Shield } from "lucide-react";
import Link from "next/link";

export default function EncryptedDataPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 dark:bg-yellow-900/20 dark:border-yellow-600">
          <div className="flex">
            <div className="flex-shrink-0">
              <Shield className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700 dark:text-yellow-200">
                You need to be signed in to access this page.
                <Link 
                  href="/auth/sign-in" 
                  className="font-medium underline text-yellow-700 hover:text-yellow-600 dark:text-yellow-200 dark:hover:text-yellow-100 ml-1"
                >
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-8 min-h-screen overflow-y-auto">
      <div className="mb-6">
        <Link 
          href="/privacy-settings" 
          className="inline-flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          <ArrowLeft size={16} className="mr-1" />
          Back to Privacy Settings
        </Link>
      </div>
      
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 dark:text-white">Encrypted Personal Data</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Manage your encrypted personal information. This data is stored securely and only accessible to you.
        </p>
      </div>

      <EncryptedDataManager />
      
      <div className="mt-8 bg-blue-50 border-l-4 border-blue-400 p-4 dark:bg-blue-900/20 dark:border-blue-600">
        <div className="flex">
          <div className="flex-shrink-0">
            <Shield className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Encryption Information
            </h3>
            <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
              <p>
                Your personal data is protected using strong encryption. The decryption happens in your browser, 
                so your unencrypted data is never stored on our servers or accessible to our staff.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
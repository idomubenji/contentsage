"use client";

import { useAuth } from "../../lib/auth-context";
import ConsentSettings from "../../components/privacy/ConsentSettings";
import DataDeletionRequest from "../../components/privacy/DataDeletionRequest";
import { Shield, UserCheck, Cookie } from "lucide-react";
import Link from "next/link";

export default function PrivacySettingsPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading privacy settings...</div>
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
                You need to be signed in to access privacy settings.
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 dark:text-white">Privacy & Data Settings</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Manage your privacy preferences and data rights in compliance with GDPR and CCPA regulations.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 pb-12">
        <section>
          <ConsentSettings />
        </section>

        <section>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4 dark:text-white flex items-center">
              <Cookie className="mr-2 h-5 w-5" /> Cookie Preferences
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Manage what cookies we can use when you visit our website. Control which cookies you accept
              beyond the strictly necessary ones required for the site to function.
            </p>
            
            <Link 
              href="/privacy-settings/cookie-preferences"
              className="inline-block px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Manage Cookie Settings
            </Link>
          </div>
        </section>

        <section>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4 dark:text-white">Encrypted Personal Data</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              We protect your sensitive personal information with strong encryption. 
              This data is only accessible to you and cannot be viewed by our staff.
            </p>
            
            <Link 
              href="/privacy-settings/encrypted-data"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Manage Encrypted Data
            </Link>
          </div>
        </section>

        <section>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4 dark:text-white flex items-center">
              <UserCheck className="mr-2 h-5 w-5" /> Your Data Rights
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Under GDPR and CCPA, you have the right to access, export, and request deletion of your personal data.
              Use our Data Rights center to exercise these rights.
            </p>
            
            <Link 
              href="/privacy-settings/data-rights"
              className="inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Manage Data Rights
            </Link>
          </div>
        </section>

        <section>
          <DataDeletionRequest />
        </section>

        <section>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
            <h2 className="text-xl font-semibold mb-4 dark:text-white">Privacy Policy</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              Our privacy policy explains how we collect, use, and protect your personal data.
            </p>
            
            <Link 
              href="/privacy-policy"
              className="inline-block px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              View Privacy Policy
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
} 
import Link from 'next/link';

export default function AuthError() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 text-center">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-900">
            Authentication Error
          </h2>
          <p className="mt-2 text-gray-600">
            There was a problem with the authentication process. Please try again.
          </p>
        </div>
        <div className="mt-4">
          <Link
            href="/auth/sign-in"
            className="font-medium text-indigo-600 hover:text-indigo-500"
          >
            Return to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
} 
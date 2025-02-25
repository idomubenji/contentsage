'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';

export default function Home() {
  // Using useState and useEffect to handle hydration
  const [mounted, setMounted] = useState(false);
  const [url, setUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // Get user information for saving posts
  const { user } = useAuth();
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle URL submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous messages
    setMessage(null);
    
    // Validate URL format
    if (!url.trim()) {
      setMessage({ type: 'error', text: 'Please enter a URL' });
      return;
    }
    
    try {
      // Simple URL validation
      new URL(url); // Will throw if invalid
    } catch (error) {
      setMessage({ type: 'error', text: 'Please enter a valid URL' });
      return;
    }
    
    // Check if user is logged in
    if (!user) {
      setMessage({ type: 'error', text: 'You must be logged in to analyze URLs' });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/analyze-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          userId: user.id,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze URL');
      }
      
      setMessage({
        type: 'success',
        text: `Successfully analyzed and saved "${data.post.title}"`,
      });
      
      // Clear input after successful submission
      setUrl('');
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'An error occurred while analyzing the URL',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-4 sm:px-20 text-center">
        {mounted && (
          <div className="glowing-sphere-container mb-10">
            <div className="glowing-sphere"></div>
          </div>
        )}
        <h1 className="text-4xl font-bold dark:text-white">
          Welcome to ContentSage
        </h1>
        
        <p className="mt-6 text-xl dark:text-gray-300 mb-8">
          Your intelligent content management solution
        </p>

        {/* URL Input Form */}
        <div className="w-full max-w-2xl p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold mb-4 dark:text-white">Analyze Content</h2>
          <p className="mb-6 text-gray-600 dark:text-gray-300">
            Paste a URL to analyze and save the content to your library
          </p>
          
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                placeholder="https://example.com/blog-post"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-grow px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Analyzing...
                  </div>
                ) : (
                  'Analyze'
                )}
              </button>
            </div>
            
            {/* Message display */}
            {message && (
              <div className={`mt-4 p-3 rounded-md ${
                message.type === 'success' 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}>
                {message.text}
              </div>
            )}
            
            {!user && (
              <div className="mt-2 text-amber-600 dark:text-amber-400 text-sm">
                You need to sign in to analyze and save content
              </div>
            )}
          </form>
        </div>

        <style jsx>{`
          .glowing-sphere-container {
            perspective: 1200px;
            height: 160px;
            width: 160px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
          }
          
          .glowing-sphere {
            width: 120px;
            height: 120px;
            border-radius: 50%;
            background: radial-gradient(circle at 30% 30%, 
              rgba(255, 255, 255, 0.9) 0%, 
              rgba(225, 240, 255, 0.8) 20%, 
              rgba(96, 165, 250, 0.7) 50%, 
              rgba(59, 130, 246, 0.8) 100%);
            box-shadow: 0 0 10px 3px rgba(96, 165, 250, 0.4),
                       0 0 20px 5px rgba(96, 165, 250, 0.2);
            animation: glow 3s ease-in-out infinite alternate;
            position: relative;
            transform-style: preserve-3d;
            transform: rotateY(15deg) rotateX(10deg);
          }
          
          /* Enhance highlight reflection */
          .glowing-sphere::before {
            content: '';
            position: absolute;
            top: 15%;
            left: 15%;
            width: 35%;
            height: 35%;
            border-radius: 50%;
            background: radial-gradient(ellipse, 
              rgba(255, 255, 255, 1) 0%, 
              rgba(255, 255, 255, 0.7) 30%, 
              transparent 70%);
            z-index: 2;
            filter: blur(1px);
          }
          
          /* Enhanced shadow beneath the sphere */
          .glowing-sphere::after {
            content: '';
            position: absolute;
            bottom: -25px;
            left: 50%;
            transform: translateX(-50%);
            width: 110%;
            height: 25px;
            background: radial-gradient(ellipse, 
              rgba(0, 0, 0, 0.4) 0%, 
              rgba(0, 0, 0, 0.2) 50%,
              transparent 80%);
            border-radius: 50%;
            z-index: -1;
            filter: blur(6px);
          }
          
          @keyframes glow {
            from { 
              box-shadow: 0 0 10px 3px rgba(96, 165, 250, 0.4),
                         0 0 20px 5px rgba(96, 165, 250, 0.2); 
            }
            to { 
              box-shadow: 0 0 15px 5px rgba(96, 165, 250, 0.5),
                         0 0 30px 8px rgba(96, 165, 250, 0.3); 
            }
          }
        `}</style>
      </main>
    </div>
  );
}

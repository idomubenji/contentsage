'use client';
import { useEffect, useState } from 'react';

// Removed unused import
// import { useAuth } from '@/lib/auth-context';

export default function Home() {
  // Using useState and useEffect to handle hydration
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  // Remove unused variables
  // const { user, isLoading } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <main className="flex flex-col items-center justify-center w-full flex-1 px-20 text-center">
        {mounted && (
          <div className="glowing-sphere-container mb-10">
            <div className="glowing-sphere"></div>
          </div>
        )}
        <h1 className="text-4xl font-bold dark:text-white">
          Welcome to ContentSage
        </h1>
        
        <p className="mt-6 text-xl dark:text-gray-300">
          Your intelligent content management solution
        </p>

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

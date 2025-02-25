'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { format } from 'date-fns';

// Define the Post type to match our Supabase schema
type Post = {
  id: string;
  url: string;
  title: string;
  description: string;
  posted_date: string;
  format: string;
  seo_info?: any;
  seo_score?: any;
  status: 'POSTED' | 'SCHEDULED' | 'SUGGESTED';
  user_id: string;
  organization_id?: string;
  platform: string;
  created_at: string;
};

export default function Inspector() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    async function fetchPosts() {
      if (!user) {
        setIsLoading(false);
        setError("Please sign in to view your content");
        return;
      }

      try {
        console.log("Fetching posts for user:", user.id);
        
        // Debug: Verify the table exists by checking its structure first
        const { data: tableInfo, error: tableError } = await supabase
          .from('posts')
          .select('*')
          .limit(1);
          
        if (tableError) {
          console.error("Error checking table:", tableError);
          throw new Error(`Table error: ${tableError.message || 'Unknown table error'}`);
        }
        
        console.log("Table check successful, proceeding with user query");
        
        // Fetch posts for the current user
        const { data, error: queryError } = await supabase
          .from('posts')
          .select('*')
          .eq('user_id', user.id)
          .order('posted_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (queryError) {
          console.error("Posts query error:", queryError);
          throw new Error(`Query error: ${queryError.message || 'Unknown query error'}`);
        }

        console.log(`Found ${data?.length || 0} posts for user`);
        setPosts(data || []);
      } catch (err: any) {
        console.error('Error fetching posts:', err);
        // Provide more detailed error message
        setError(
          err.message || 
          "Failed to fetch posts. Please check your connection and try again."
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchPosts();
  }, [user]);

  // Function to format date in a readable format
  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM d, yyyy');
    } catch (error) {
      return dateString || 'N/A';
    }
  };

  // Function to truncate text with ellipsis
  const truncateText = (text: string, maxLength: number) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Content Inspector</h1>
      <p className="text-gray-600 mb-6">
        View and manage all your analyzed content in one place.
      </p>

      {isLoading ? (
        <div className="flex justify-center items-center min-h-[200px]">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 text-red-800 p-4 rounded-md">
          <h3 className="font-bold mb-2">Error Loading Content</h3>
          <p>{error}</p>
          <p className="mt-2 text-sm">
            Try going back to the home page and analyzing a URL first, or check if the database is properly set up.
          </p>
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-gray-100 p-8 rounded-md text-center">
          <p className="text-gray-700 mb-4">No content has been analyzed yet.</p>
          <p className="text-gray-600">
            Go to the home page and paste a URL to analyze your first piece of content.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 dark:bg-gray-800">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Title</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Posted Date</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Format</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Platform</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-4">
                    <a 
                      href={post.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {truncateText(post.title, 60) || 'Untitled'}
                    </a>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {formatDate(post.posted_date)}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                    <span className="capitalize">{post.format || 'N/A'}</span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                    <span className="capitalize">{post.platform || 'Website'}</span>
                  </td>
                  <td className="px-4 py-4 text-sm">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium
                      ${post.status === 'POSTED' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 
                        post.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' : 
                        'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'}`}>
                      {post.status}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300">
                    {truncateText(post.description, 80) || 'No description'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
} 
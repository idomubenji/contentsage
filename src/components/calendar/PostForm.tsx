'use client';

import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { useCalendar, Post } from './CalendarContext';

interface PostFormProps {
  date: Date | null;
  post: Post | null;
  onClose: () => void;
}

export default function PostForm({ date, post, onClose }: PostFormProps) {
  const { addPost, refreshPosts } = useCalendar();
  
  const [isViewMode, setIsViewMode] = useState(!!post);
  const [title, setTitle] = useState(post?.title || '');
  const [url, setUrl] = useState(post?.url || '');
  const [description, setDescription] = useState(post?.description || '');
  const [status, setStatus] = useState<'POSTED' | 'SCHEDULED' | 'SUGGESTED'>(
    post?.status || 'SCHEDULED'
  );
  const [format, setFormat] = useState(post?.format || 'article');
  
  const handleClose = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    onClose();
  };
  
  // If viewing an existing post, this opens in view mode
  useEffect(() => {
    if (post) {
      setIsViewMode(true);
    }
  }, [post]);

  const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    
    // For now, we just show what would be submitted
    // In a real implementation, this would save to Supabase
    console.log('Would save post to Supabase:', {
      title,
      url,
      description,
      posted_date: date ? format(date, 'yyyy-MM-dd') : null,
      status,
      format
    });
    
    alert('This would save the post to your database. Integration coming soon!');
    
    // Refresh posts to show the updated list
    await refreshPosts();
    onClose();
  };

  const getStatusBadgeClass = () => {
    switch (status) {
      case 'POSTED':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'SCHEDULED':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'SUGGESTED':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {isViewMode 
            ? post?.title || 'View Post' 
            : date 
              ? `New Post for ${format(date, 'MMMM d, yyyy')}` 
              : 'New Post'}
        </h2>
        <button
          onClick={handleClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Post status badge */}
      {post && (
        <div className="mb-4">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass()}`}>
            {post.status}
          </span>
          
          {post.format && (
            <span className="ml-2 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
              {post.format}
            </span>
          )}
          
          {post.platform && (
            <span className="ml-2 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              {post.platform}
            </span>
          )}
        </div>
      )}

      {isViewMode ? (
        // View mode for existing posts
        <div className="space-y-4">
          {post?.url && (
            <div>
              <a 
                href={post.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-300 break-all"
              >
                {post.url}
              </a>
            </div>
          )}
          
          {post?.description && (
            <div className="mt-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description:</h3>
              <p className="text-gray-600 dark:text-gray-400 whitespace-pre-line">
                {post.description}
              </p>
            </div>
          )}
          
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
            <button
              onClick={() => setIsViewMode(false)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Edit
            </button>
          </div>
        </div>
      ) : (
        // Edit/Create mode
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Post title"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="https://example.com/post"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="Post description"
            ></textarea>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'POSTED' | 'SCHEDULED' | 'SUGGESTED')}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="POSTED">Posted</option>
              <option value="SCHEDULED">Scheduled</option>
              <option value="SUGGESTED">Suggested</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Format
            </label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            >
              <option value="article">Article</option>
              <option value="blog">Blog Post</option>
              <option value="video">Video</option>
              <option value="podcast">Podcast</option>
              <option value="social">Social Media</option>
            </select>
          </div>
          
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
            <button
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              Save
            </button>
          </div>
        </form>
      )}
    </div>
  );
} 
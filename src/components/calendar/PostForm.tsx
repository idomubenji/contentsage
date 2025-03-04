'use client';

import React, { useState, useEffect } from 'react';
import { format as dateFormat } from 'date-fns';
import { useCalendar, Post } from './CalendarContext';
import { downloadPostCalendar } from '@/utils/icsGenerator';
import CalendarExportMenu from './CalendarExportMenu';

interface PostFormProps {
  date: Date | null;
  post: Post | null;
  onClose: () => void;
}

// DeleteConfirmationModal component for better UX
interface DeleteConfirmationModalProps {
  onConfirm: () => void;
  onCancel: () => void;
  title: string;
}

const DeleteConfirmationModal = ({ onConfirm, onCancel, title }: DeleteConfirmationModalProps) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Confirm Deletion</h2>
      
      <p className="text-gray-700 dark:text-gray-300 mb-6">
        Are you sure you want to delete <span className="font-medium">{title}</span>? This action cannot be undone.
      </p>
      
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
        >
          Delete
        </button>
      </div>
    </div>
  </div>
);

export default function PostForm({ date, post, onClose }: PostFormProps) {
  const { addPost, updatePost, deletePost, refreshPosts } = useCalendar();
  
  const [isViewMode, setIsViewMode] = useState(!!post);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
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
    
    // Basic validation
    if (!url || !url.trim()) {
      setFormError('URL is required');
      return;
    }

    if (!title || !title.trim()) {
      setFormError('Title is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setFormError(null);
      
      const postData = {
        title,
        url,
        description,
        posted_date: date ? dateFormat(date, 'yyyy-MM-dd') : undefined,
        status,
        format
      };

      if (post) {
        // Update existing post
        await updatePost(post.id, postData);
      } else {
        // Create new post
        await addPost(postData);
      }
      
      // Refresh posts to show the updated list
      await refreshPosts();
      onClose();
    } catch (error: any) {
      setFormError(error.message || 'An error occurred while saving the post');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setShowDeleteConfirmation(true);
  };

  const confirmDelete = async () => {
    if (!post || !post.id) return;
    
    try {
      setIsDeleting(true);
      setFormError(null);
      
      await deletePost(post.id);
      
      // Refresh posts to show the updated list
      await refreshPosts();
      onClose();
    } catch (error: any) {
      setFormError(error.message || 'An error occurred while deleting the post');
      setShowDeleteConfirmation(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirmation(false);
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

  // Download current post as .ics file
  const handleDownloadICS = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (post && post.posted_date) {
      downloadPostCalendar(post);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-xl w-full max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          {isViewMode 
            ? post?.title || 'View Post' 
            : post 
              ? 'Edit Post' 
              : date 
                ? `New Post for ${dateFormat(date, 'MMMM d, yyyy')}` 
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
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${getStatusBadgeClass()}`}>
            {post.status}
          </span>
          
          {post.format && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
              {post.format}
            </span>
          )}
          
          {post.platform && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
              {post.platform}
            </span>
          )}
          
          {/* Add calendar export menu */}
          {post.posted_date && isViewMode && (
            <CalendarExportMenu
              type="post"
              date={new Date(post.posted_date)}
              posts={post}
              className="ml-auto"
            />
          )}
        </div>
      )}

      {/* Error message */}
      {formError && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded dark:bg-red-900 dark:border-red-600 dark:text-red-100">
          <p>{formError}</p>
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
          
          {/* SEO Information Display */}
          {post?.seo_info && (
            <div className="mt-4 bg-gray-50 dark:bg-gray-700 p-3 rounded-md border border-gray-200 dark:border-gray-600">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">SEO Information:</h3>
              
              {/* Display reasonsData if available */}
              {post.seo_info.reasonsData?.reasons && post.seo_info.reasonsData.reasons.length > 0 ? (
                <>
                  <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1 list-disc list-inside">
                    {post.seo_info.reasonsData.reasons.map((reason: string, idx: number) => (
                      <li key={idx} className="pl-1">{reason}</li>
                    ))}
                  </ul>
                  {post.seo_info.reasonsData.aiConfidence !== undefined && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      AI Confidence: {(post.seo_info.reasonsData.aiConfidence * 100).toFixed(0)}%
                    </div>
                  )}
                </>
              ) : (
                // Display raw seo_info if reasonsData is not properly structured
                <pre className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap overflow-auto max-h-40">
                  {typeof post.seo_info === 'string' 
                    ? post.seo_info 
                    : JSON.stringify(post.seo_info, null, 2)}
                </pre>
              )}
            </div>
          )}
          
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
            <button
              onClick={handleDeleteClick}
              disabled={isDeleting}
              className={`px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 ${isDeleting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
            
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
          
          {post?.derivedFrom && (
            <div className="mt-4">
              <div className="text-sm text-blue-600 dark:text-blue-400 italic font-medium">
                Derived from blog post: "{post.derivedFrom}"
              </div>
            </div>
          )}
          
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex justify-between">
            {post && (
              <button
                onClick={handleDeleteClick}
                disabled={isSubmitting || isDeleting}
                className={`px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600 ${(isSubmitting || isDeleting) ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            )}
            
            <div className="flex gap-2 ml-auto">
              <button
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                disabled={isSubmitting || isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting || isDeleting}
                className={`px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 ${(isSubmitting || isDeleting) ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {isSubmitting ? 'Saving...' : post ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirmation && (
        <DeleteConfirmationModal
          onConfirm={confirmDelete}
          onCancel={cancelDelete}
          title={post?.title || 'this post'}
        />
      )}
    </div>
  );
} 
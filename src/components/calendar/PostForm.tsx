'use client';

import React, { useState } from 'react';
import { format } from 'date-fns';
import { useCalendar, Post } from './CalendarContext';

interface PostFormProps {
  date: Date;
  onClose: () => void;
}

export default function PostForm({ date, onClose }: PostFormProps) {
  const { addPost } = useCalendar();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [color, setColor] = useState('#4f46e5'); // Default: indigo

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newPost: Omit<Post, 'id'> = {
      date,
      title,
      content,
      color
    };
    
    addPost(newPost);
    onClose();
  };

  const colorOptions = [
    { value: '#ef4444', name: 'Red' },
    { value: '#f97316', name: 'Orange' },
    { value: '#eab308', name: 'Yellow' },
    { value: '#10b981', name: 'Emerald' },
    { value: '#3b82f6', name: 'Blue' },
    { value: '#4f46e5', name: 'Indigo' },
    { value: '#8b5cf6', name: 'Violet' },
    { value: '#ec4899', name: 'Pink' },
  ];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md w-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">
          Add Post for {format(date, 'MMMM d, yyyy')}
        </h3>
        <button 
          onClick={onClose}
          className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Title
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            required
          />
        </div>
        
        <div className="mb-4">
          <label htmlFor="content" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Content
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
            required
          />
        </div>
        
        <div className="mb-5">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Color
          </label>
          <div className="flex space-x-2">
            {colorOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`w-8 h-8 rounded-full ${color === option.value ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-600 dark:ring-offset-gray-800' : ''}`}
                style={{ backgroundColor: option.value }}
                onClick={() => setColor(option.value)}
                title={option.name}
              />
            ))}
          </div>
        </div>
        
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 dark:focus:ring-offset-gray-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 dark:bg-indigo-700 rounded-md hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
          >
            Add Post
          </button>
        </div>
      </form>
    </div>
  );
} 
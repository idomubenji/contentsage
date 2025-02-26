'use client';

import { useState, useEffect, useRef } from 'react';
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

// Define filter types
type DateRange = {
  startDate: string | null;
  endDate: string | null;
};

type Filters = {
  format: string[] | null;
  status: string[] | null;
  platform: string[] | null;
  dateRange: DateRange;
};

// Multi-select filter component using capsules/chips
function MultiSelectFilter({
  label,
  options,
  selectedValues,
  onChange,
  colorMap
}: {
  label: string;
  options: string[];
  selectedValues: string[] | null;
  onChange: (values: string[] | null) => void;
  colorMap?: Record<string, string>;
}) {
  // Toggle a value in the selection
  const toggleValue = (value: string) => {
    if (!selectedValues) {
      onChange([value]);
    } else if (selectedValues.includes(value)) {
      const newValues = selectedValues.filter(v => v !== value);
      onChange(newValues.length > 0 ? newValues : null);
    } else {
      onChange([...selectedValues, value]);
    }
  };

  return (
    <div>
      <p className="font-medium text-xs mb-1.5 dark:text-gray-300">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => {
          const isSelected = selectedValues?.includes(option) || false;
          const defaultColorClass = isSelected 
            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
          const colorClass = isSelected && colorMap && colorMap[option] 
            ? colorMap[option] 
            : defaultColorClass;
          
          return (
            <button
              key={option}
              onClick={() => toggleValue(option)}
              className={`${colorClass} border dark:border-gray-600 text-xs px-2 py-0.5 rounded-full flex items-center whitespace-nowrap`}
            >
              {option}
              {isSelected && (
                <span className="ml-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-2.5 h-2.5">
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Pagination component to reuse at top and bottom
function PaginationControls({ 
  currentPage, 
  totalPages,
  totalItems,
  itemsPerPage,
  selectedItems,
  onPageChange,
  onDeleteSelected
}: { 
  currentPage: number, 
  totalPages: number, 
  totalItems: number,
  itemsPerPage: number,
  selectedItems: string[],
  onPageChange: (page: number) => void,
  onDeleteSelected?: () => void
}) {
  return (
    <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 sm:px-6 my-4 rounded-md">
      {/* Mobile view */}
      <div className="flex flex-1 justify-between sm:hidden min-h-[40px]">
        {selectedItems.length > 0 ? (
          <div className="flex items-center justify-between w-full">
            <span className="text-sm text-gray-700 dark:text-gray-300">
              {selectedItems.length} selected
            </span>
            <button
              onClick={onDeleteSelected}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Delete
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className={`relative inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium ${
                currentPage === 1 
                  ? 'border-gray-300 dark:border-gray-600 text-gray-300 dark:text-gray-600 cursor-not-allowed' 
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages || totalPages === 0}
              className={`relative ml-3 inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium ${
                currentPage === totalPages || totalPages === 0
                  ? 'border-gray-300 dark:border-gray-600 text-gray-300 dark:text-gray-600 cursor-not-allowed' 
                  : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              Next
            </button>
          </>
        )}
      </div>
      
      {/* Desktop view */}
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div className="min-h-[24px] flex items-center">
          {selectedItems.length > 0 ? (
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                {selectedItems.length} item{selectedItems.length > 1 ? 's' : ''} selected
              </span>
              <button
                onClick={onDeleteSelected}
                className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Delete Selected
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {totalItems > 0 ? (
                <>
                  Showing <span className="font-medium">{Math.min((currentPage - 1) * itemsPerPage + 1, totalItems)}</span> to{' '}
                  <span className="font-medium">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of{' '}
                  <span className="font-medium">{totalItems}</span> results
                </>
              ) : 'No results'}
            </p>
          )}
        </div>
        
        {/* Only show pagination controls if we have more than one page */}
        {totalPages > 1 && (
          <div>
            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`relative inline-flex items-center rounded-l-md px-2 py-2 text-sm ${
                  currentPage === 1 
                    ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' 
                    : 'text-gray-400 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <span className="sr-only">Previous</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                </svg>
              </button>
              
              {/* Page number buttons */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                // Show 5 pages max centered around current page
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => onPageChange(pageNum)}
                    className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                      currentPage === pageNum 
                        ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600' 
                        : 'text-gray-900 dark:text-white ring-1 ring-inset ring-gray-300 dark:ring-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-offset-0'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              
              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`relative inline-flex items-center rounded-r-md px-2 py-2 text-sm ${
                  currentPage === totalPages 
                    ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' 
                    : 'text-gray-400 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                <span className="sr-only">Next</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </button>
            </nav>
          </div>
        )}
      </div>
    </div>
  );
}

// Filter panel component
function FilterPanel({
  filters,
  onFilterChange,
  formats,
  platforms,
  statuses,
  onClearFilters
}: {
  filters: Filters;
  onFilterChange: (name: string, value: any) => void;
  formats: string[];
  platforms: string[];
  statuses: string[];
  onClearFilters: () => void;
}) {
  // Count active filters
  const activeFilterCount = [
    (filters.format && filters.format.length > 0) ? 1 : 0, 
    (filters.status && filters.status.length > 0) ? 1 : 0, 
    (filters.platform && filters.platform.length > 0) ? 1 : 0, 
    filters.dateRange.startDate ? 1 : 0, 
    filters.dateRange.endDate ? 1 : 0
  ].reduce((sum, count) => sum + count, 0);
  
  // Status color map for the chips
  const statusColorMap: Record<string, string> = {
    'posted': 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900 dark:text-green-200 dark:border-green-800',
    'scheduled': 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-800',
    'suggested': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-800'
  };
  
  return (
    <div className="mb-6 bg-white dark:bg-gray-800 p-5 rounded-md shadow-sm">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-lg font-medium dark:text-white">
          Filter Content
          {activeFilterCount > 0 && (
            <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded-full">
              {activeFilterCount} active
            </span>
          )}
        </h2>
        {activeFilterCount > 0 && (
          <button
            onClick={onClearFilters}
            className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Clear all filters
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-4">
        {/* Format filter - using multi-select capsules */}
        <MultiSelectFilter
          label="Format"
          options={formats}
          selectedValues={filters.format}
          onChange={(values) => onFilterChange('format', values)}
        />

        {/* Status filter - using multi-select capsules with color mapping */}
        <MultiSelectFilter
          label="Status"
          options={statuses.map(s => s.toLowerCase())}
          selectedValues={filters.status}
          onChange={(values) => onFilterChange('status', values)}
          colorMap={statusColorMap}
        />

        {/* Platform filter - using multi-select capsules */}
        <MultiSelectFilter
          label="Platform"
          options={platforms}
          selectedValues={filters.platform}
          onChange={(values) => onFilterChange('platform', values)}
        />

        {/* Date range filter */}
        <div>
          <p className="font-medium text-xs mb-1.5 dark:text-gray-300">Date Range</p>
          <div className="flex space-x-1.5">
            <input
              type="date"
              value={filters.dateRange.startDate || ''}
              onChange={(e) => onFilterChange('dateRange', { 
                ...filters.dateRange, 
                startDate: e.target.value || null 
              })}
              className="w-full px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="From"
            />
            <input
              type="date"
              value={filters.dateRange.endDate || ''}
              onChange={(e) => onFilterChange('dateRange', { 
                ...filters.dateRange, 
                endDate: e.target.value || null 
              })}
              className="w-full px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              placeholder="To"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Inspector() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 25;
  
  // Selection state
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Edit state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  // Filter state
  const [filters, setFilters] = useState<Filters>({
    format: null,
    status: null,
    platform: null,
    dateRange: {
      startDate: null,
      endDate: null
    }
  });
  
  // Available filter options
  const [availableFormats, setAvailableFormats] = useState<string[]>([]);
  const [availablePlatforms, setAvailablePlatforms] = useState<string[]>([]);
  const availableStatuses = ['posted', 'scheduled', 'suggested'];
  
  // Filtered posts
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  
  // Keyboard navigation state
  const [focusedRowIndex, setFocusedRowIndex] = useState<number | null>(null);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  
  // Ref for the table container
  const tableRef = useRef<HTMLDivElement>(null);
  
  // Add row refs to track positions dynamically - moved inside the component
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  
  // Initialize filteredPosts when posts change
  useEffect(() => {
    setFilteredPosts(posts);
  }, [posts]);
  
  // Handle filter changes
  const handleFilterChange = (name: string, value: any) => {
    setFilters(prevFilters => ({
      ...prevFilters,
      [name]: value
    }));
    
    // Reset to first page when filters change
    setCurrentPage(1);
  };
  
  // Clear all filters
  const handleClearFilters = () => {
    setFilters({
      format: null,
      status: null,
      platform: null,
      dateRange: {
        startDate: null,
        endDate: null
      }
    });
    
    // Reset to first page
    setCurrentPage(1);
  };
  
  // Apply filters to posts
  useEffect(() => {
    if (posts.length === 0) {
      setFilteredPosts([]);
      return;
    }
    
    let result = [...posts];
    
    // Apply format filter
    if (filters.format && filters.format.length > 0) {
      result = result.filter(post => 
        filters.format!.includes(post.format?.toLowerCase() || '')
      );
    }
    
    // Apply status filter
    if (filters.status && filters.status.length > 0) {
      result = result.filter(post => 
        filters.status!.includes(post.status.toLowerCase())
      );
    }
    
    // Apply platform filter
    if (filters.platform && filters.platform.length > 0) {
      result = result.filter(post => 
        filters.platform!.includes(post.platform?.toLowerCase() || '')
      );
    }
    
    // Apply date range filter
    if (filters.dateRange.startDate || filters.dateRange.endDate) {
      result = result.filter(post => {
        const postedDate = new Date(post.posted_date);
        
        if (filters.dateRange.startDate) {
          const startDate = new Date(filters.dateRange.startDate);
          startDate.setHours(0, 0, 0, 0);
          if (postedDate < startDate) return false;
        }
        
        if (filters.dateRange.endDate) {
          const endDate = new Date(filters.dateRange.endDate);
          endDate.setHours(23, 59, 59, 999);
          if (postedDate > endDate) return false;
        }
        
        return true;
      });
    }
    
    setFilteredPosts(result);
    
    // Clear selections when filters change
    setSelectedPosts([]);
    
  }, [posts, filters]);
  
  // Handle clicks outside the table to unhighlight rows
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      // Skip if modals are open or if the click is inside the table
      if (isEditModalOpen || isDeleteModalOpen) return;
      
      // If the click is outside the table, clear highlighting
      if (tableRef.current && !tableRef.current.contains(e.target as Node)) {
        setFocusedRowIndex(null);
        setLastSelectedIndex(null);
      }
    };
    
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isEditModalOpen, isDeleteModalOpen]);
  
  // Handle keyboard shortcuts for the edit modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Command+Enter (Mac) or Ctrl+Enter (Windows/Linux)
      if (isEditModalOpen && editingPost && (e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSaveEdit();
      }
      
      // Close modal with Escape key
      if (isEditModalOpen && e.key === 'Escape') {
        e.preventDefault();
        setIsEditModalOpen(false);
        setEditingPost(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditModalOpen, editingPost]);
  
  // Handle keyboard shortcuts for the delete modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close modal with Escape key
      if (isDeleteModalOpen && e.key === 'Escape') {
        e.preventDefault();
        setIsDeleteModalOpen(false);
      }
      
      // Confirm deletion with Command+Enter
      if (isDeleteModalOpen && !isDeleting && (e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleBatchDelete();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDeleteModalOpen, isDeleting]);
  
  // Handle keyboard navigation and selection
  useEffect(() => {
    // Only enable keyboard navigation when there are posts and no modals are open
    if (posts.length === 0 || isEditModalOpen || isDeleteModalOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if we're in an input element or textarea
      if (
        e.target instanceof HTMLInputElement || 
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) return;
      
      // Get current posts for pagination (moved here to fix "used before declaration" error)
      const indexOfLastPost = currentPage * postsPerPage;
      const indexOfFirstPost = indexOfLastPost - postsPerPage;
      const visiblePosts = posts.slice(indexOfFirstPost, indexOfLastPost);
      
      // Arrow navigation
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        
        // Initialize focus if none exists
        if (focusedRowIndex === null) {
          setFocusedRowIndex(0);
          return;
        }
        
        // Calculate new index
        const direction = e.key === 'ArrowDown' ? 1 : -1;
        const newIndex = Math.max(0, Math.min(visiblePosts.length - 1, focusedRowIndex + direction));
        
        // If shift is pressed, extend focus rather than moving it
        if (e.shiftKey) {
          // If this is the first time we're extending focus, set last selected index
          if (lastSelectedIndex === null) {
            setLastSelectedIndex(focusedRowIndex);
          }
          // Just update focused row to extend the visual focus range
          setFocusedRowIndex(newIndex);
        } else {
          // Regular navigation - move focus and reset last selected index
          setFocusedRowIndex(newIndex);
          setLastSelectedIndex(null);
        }
      }
      
      // Toggle selection with Space
      if (e.key === ' ' && focusedRowIndex !== null) {
        e.preventDefault();
        
        // If shift is pressed and we have a last selected index, select all rows in the focus range
        if (lastSelectedIndex !== null) {
          const start = Math.min(lastSelectedIndex, focusedRowIndex);
          const end = Math.max(lastSelectedIndex, focusedRowIndex);
          
          // Get all post IDs in the selected range
          const rangeIds = visiblePosts.slice(start, end + 1).map(p => p.id);
          
          // Toggle selection for all posts in range
          setSelectedPosts(prev => {
            // Check if all posts in range are already selected
            const allSelected = rangeIds.every(id => prev.includes(id));
            
            if (allSelected) {
              // If all selected, remove them
              return prev.filter(id => !rangeIds.includes(id));
            } else {
              // Otherwise, add any that aren't already selected
              return [...new Set([...prev, ...rangeIds])];
            }
          });
        } else {
          // Single row selection toggle
          const postId = visiblePosts[focusedRowIndex].id;
          handleSelectPost(postId);
        }
      }
      
      // Edit with Enter
      if (e.key === 'Enter' && focusedRowIndex !== null) {
        e.preventDefault();
        const postId = visiblePosts[focusedRowIndex].id;
        handleEdit(postId);
      }
      
      // Delete with Command+Backspace
      if ((e.metaKey || e.ctrlKey) && e.key === 'Backspace') {
        e.preventDefault();
        // If posts are selected, delete those
        if (selectedPosts.length > 0) {
          setIsDeleteModalOpen(true);
        } 
        // Otherwise, delete focused row if there is one
        else if (focusedRowIndex !== null) {
          const postId = visiblePosts[focusedRowIndex].id;
          setSelectedPosts([postId]);
          setIsDeleteModalOpen(true);
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    posts,
    currentPage,
    postsPerPage,
    focusedRowIndex, 
    lastSelectedIndex, 
    selectedPosts, 
    isEditModalOpen, 
    isDeleteModalOpen
  ]);
  
  // Reset focus and selection state when page changes
  useEffect(() => {
    setFocusedRowIndex(null);
    setLastSelectedIndex(null);
  }, [currentPage]);
  
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
        
        // Extract unique format and platform values for filters
        if (data) {
          const formats = Array.from(new Set(data
            .map(post => post.format?.toLowerCase() || '')
            .filter(Boolean)))
            .sort();
          
          const platforms = Array.from(new Set(data
            .map(post => post.platform?.toLowerCase() || '')
            .filter(Boolean)))
            .sort();
          
          setAvailableFormats(formats);
          setAvailablePlatforms(platforms);
        }
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
  
  // Get current posts for pagination
  const indexOfLastPost = currentPage * postsPerPage;
  const indexOfFirstPost = indexOfLastPost - postsPerPage;
  const currentPosts = filteredPosts.slice(indexOfFirstPost, indexOfLastPost);
  const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
  
  // Change page
  const handlePageChange = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    // Clear selections when changing pages
    setSelectedPosts([]);
    // Scroll to top of table for better UX
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // Handle checkbox selection
  const handleSelectPost = (postId: string) => {
    setSelectedPosts(prev => 
      prev.includes(postId) 
        ? prev.filter(id => id !== postId) 
        : [...prev, postId]
    );
  };
  
  // Handle select all checkbox
  const handleSelectAll = () => {
    if (selectedPosts.length === currentPosts.length) {
      // If all are selected, deselect all
      setSelectedPosts([]);
    } else {
      // Otherwise, select all current page posts
      setSelectedPosts(currentPosts.map(post => post.id));
    }
  };
  
  // Handle delete selected posts
  const handleBatchDelete = async () => {
    if (selectedPosts.length === 0) return;
    
    setIsDeleting(true);
    
    try {
      // Implement actual delete functionality with Supabase
      const { error } = await supabase
        .from('posts')
        .delete()
        .in('id', selectedPosts);
        
      if (error) {
        throw error;
      }
      
      // Update UI by filtering out the deleted posts
      setPosts(prevPosts => 
        prevPosts.filter(post => !selectedPosts.includes(post.id))
      );
      
      // Clear selections after delete
      setSelectedPosts([]);
      setIsDeleteModalOpen(false);
    } catch (err: any) {
      console.error("Error deleting posts:", err);
      alert(`Failed to delete: ${err.message || 'Unknown error'}`);
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Handle edit single post
  const handleEdit = (postId: string) => {
    const post = posts.find(p => p.id === postId);
    if (post) {
      setEditingPost(post);
      setIsEditModalOpen(true);
    }
  };
  
  // Handle save edited post
  const handleSaveEdit = async () => {
    if (!editingPost) return;
    
    setIsSaving(true);
    
    try {
      const { error } = await supabase
        .from('posts')
        .update({
          title: editingPost.title,
          description: editingPost.description,
          url: editingPost.url,
          format: editingPost.format,
          platform: editingPost.platform,
          status: editingPost.status
        })
        .eq('id', editingPost.id);
        
      if (error) {
        throw error;
      }
      
      // Update the posts list with the edited post
      setPosts(prevPosts => 
        prevPosts.map(post => 
          post.id === editingPost.id ? editingPost : post
        )
      );
      
      // Close the modal and reset editing state
      setIsEditModalOpen(false);
      setEditingPost(null);
    } catch (err: any) {
      console.error("Error updating post:", err);
      alert(`Failed to update: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle form field changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!editingPost) return;
    
    const { name, value } = e.target;
    setEditingPost({
      ...editingPost,
      [name]: value
    });
  };
  
  // Handle delete single post
  const handleDelete = (postId: string) => {
    setSelectedPosts([postId]);
    setIsDeleteModalOpen(true);
  };

  // Reset refs array when posts change
  useEffect(() => {
    // Initialize the refs array with the correct length
    rowRefs.current = rowRefs.current.slice(0, currentPosts.length);
    
    // Fill with nulls if needed
    while (rowRefs.current.length < currentPosts.length) {
      rowRefs.current.push(null);
    }
  }, [currentPosts.length]);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6 dark:text-white">Content Inspector</h1>
      <p className="text-gray-600 dark:text-gray-400 mb-6">
        View and manage all your analyzed content in one place.
      </p>

      {isLoading ? (
        <div className="flex justify-center items-center min-h-[200px]">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-4 rounded-md">
          <h3 className="font-bold mb-2">Error Loading Content</h3>
          <p>{error}</p>
          <p className="mt-2 text-sm">
            Try going back to the home page and analyzing a URL first, or check if the database is properly set up.
          </p>
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-gray-100 dark:bg-gray-800 p-8 rounded-md text-center">
          <p className="text-gray-700 dark:text-gray-300 mb-4">No content has been analyzed yet.</p>
          <p className="text-gray-600 dark:text-gray-400">
            Go to the home page and paste a URL to analyze your first piece of content.
          </p>
        </div>
      ) : (
        <>
          {/* Filter panel */}
          <FilterPanel
            filters={filters}
            onFilterChange={handleFilterChange}
            formats={availableFormats}
            platforms={availablePlatforms}
            statuses={availableStatuses}
            onClearFilters={handleClearFilters}
          />
          
          {filteredPosts.length === 0 ? (
            <div className="bg-gray-100 dark:bg-gray-800 p-8 rounded-md text-center">
              <p className="text-gray-700 dark:text-gray-300 mb-4">No content matches your filter criteria.</p>
              <p className="text-gray-600 dark:text-gray-400">
                Try adjusting your filters or <button onClick={handleClearFilters} className="text-blue-600 dark:text-blue-400 hover:underline">clear all filters</button> to see more results.
              </p>
            </div>
          ) : (
            <div className="relative overflow-x-auto" ref={tableRef}>
              {/* Pagination / Batch action controls - show for both pagination and selection */}
              <PaginationControls 
                currentPage={currentPage} 
                totalPages={totalPages}
                totalItems={filteredPosts.length}
                itemsPerPage={postsPerPage}
                selectedItems={selectedPosts}
                onPageChange={handlePageChange}
                onDeleteSelected={() => setIsDeleteModalOpen(true)}
              />
              
              <table className="w-full border-collapse border-spacing-0">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="px-4 py-3 text-left">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                          checked={selectedPosts.length === currentPosts.length && currentPosts.length > 0}
                          onChange={handleSelectAll}
                        />
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Title</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Posted Date</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Format</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Platform</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Description</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {currentPosts.map((post, index) => {
                    // Determine if this row should be highlighted
                    const isHighlighted = focusedRowIndex !== null && 
                      ((lastSelectedIndex !== null && 
                        index >= Math.min(focusedRowIndex, lastSelectedIndex) && 
                        index <= Math.max(focusedRowIndex, lastSelectedIndex)) ||
                       (lastSelectedIndex === null && index === focusedRowIndex));
                    
                    return (
                      <tr 
                        key={post.id}
                        ref={el => { rowRefs.current[index] = el; }}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 ${
                          isHighlighted ? 'bg-blue-100 dark:bg-blue-900/50 border-blue-400 dark:border-blue-600 rounded-md' : ''
                        }`}
                        onClick={(e) => {
                          // Update focused row
                          setFocusedRowIndex(index);
                          
                          // Handle selection logic with shift and ctrl/cmd keys
                          if (e.shiftKey && lastSelectedIndex !== null) {
                            const start = Math.min(lastSelectedIndex, index);
                            const end = Math.max(lastSelectedIndex, index);
                            const rangeIds = currentPosts.slice(start, end + 1).map(p => p.id);
                            
                            setSelectedPosts(prev => {
                              const outsideRangeSelections = prev.filter(id => 
                                !currentPosts.some((post, idx) => post.id === id && idx >= start && idx <= end)
                              );
                              return [...new Set([...outsideRangeSelections, ...rangeIds])];
                            });
                          } else if ((e.metaKey || e.ctrlKey)) {
                            // Don't reset lastSelectedIndex when ctrl/cmd is pressed
                            handleSelectPost(post.id);
                          } else {
                            // Regular click: set as the only selected if not already selected
                            if (
                              e.target instanceof HTMLElement && 
                              !e.target.closest('input[type="checkbox"]') && 
                              !e.target.closest('button')
                            ) {
                              if (!selectedPosts.includes(post.id)) {
                                setSelectedPosts([post.id]);
                              }
                              setLastSelectedIndex(index);
                            }
                          }
                        }}
                        onDoubleClick={() => handleEdit(post.id)}
                      >
                        <td className="px-4 py-4">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            checked={selectedPosts.includes(post.id)}
                            onChange={() => handleSelectPost(post.id)}
                          />
                        </td>
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
                        <td className="px-4 py-4 text-sm whitespace-nowrap">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleEdit(post.id)}
                              className="px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(post.id)}
                              className="px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              
              {/* Bottom pagination controls */}
              <PaginationControls 
                currentPage={currentPage} 
                totalPages={totalPages}
                totalItems={filteredPosts.length}
                itemsPerPage={postsPerPage}
                selectedItems={selectedPosts}
                onPageChange={handlePageChange}
                onDeleteSelected={() => setIsDeleteModalOpen(true)}
              />
              
              {/* Delete confirmation modal */}
              {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50">
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full">
                    <h3 className="text-lg font-medium mb-4 dark:text-white">Confirm Deletion</h3>
                    <p className="mb-6 dark:text-gray-300">
                      Are you sure you want to delete {selectedPosts.length} selected item{selectedPosts.length > 1 ? 's' : ''}? 
                      This action cannot be undone.
                    </p>
                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={() => setIsDeleteModalOpen(false)}
                        disabled={isDeleting}
                        className={`px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 ${isDeleting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleBatchDelete}
                        disabled={isDeleting}
                        className={`px-4 py-2 bg-red-600 text-white rounded-md ${isDeleting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-700'} flex items-center`}
                      >
                        {isDeleting ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Deleting...
                          </>
                        ) : (
                          <>
                            Delete <span className="ml-2 text-xs opacity-70">⌘⏎</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Edit modal */}
              {isEditModalOpen && editingPost && (
                <div className="fixed inset-0 bg-gray-600 bg-opacity-50 dark:bg-black dark:bg-opacity-70 flex items-center justify-center z-50">
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl max-w-2xl w-full">
                    <h3 className="text-lg font-medium mb-4 dark:text-white">Edit Content</h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          id="title"
                          name="title"
                          value={editingPost.title}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          URL
                        </label>
                        <input
                          type="url"
                          id="url"
                          name="url"
                          value={editingPost.url}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      
                      <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Description
                        </label>
                        <textarea
                          id="description"
                          name="description"
                          rows={3}
                          value={editingPost.description}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="format" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Format
                          </label>
                          <select
                            id="format"
                            name="format"
                            value={editingPost.format}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          >
                            <option value="article">Article</option>
                            <option value="video">Video</option>
                            <option value="podcast">Podcast</option>
                            <option value="infographic">Infographic</option>
                            <option value="social">Social Post</option>
                          </select>
                        </div>
                        
                        <div>
                          <label htmlFor="platform" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Platform
                          </label>
                          <select
                            id="platform"
                            name="platform"
                            value={editingPost.platform}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          >
                            <option value="website">Website</option>
                            <option value="linkedin">LinkedIn</option>
                            <option value="twitter">Twitter</option>
                            <option value="facebook">Facebook</option>
                            <option value="instagram">Instagram</option>
                            <option value="youtube">YouTube</option>
                          </select>
                        </div>
                      </div>
                      
                      <div>
                        <label htmlFor="status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Status
                        </label>
                        <select
                          id="status"
                          name="status"
                          value={editingPost.status}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        >
                          <option value="POSTED">Posted</option>
                          <option value="SCHEDULED">Scheduled</option>
                          <option value="SUGGESTED">Suggested</option>
                        </select>
                      </div>
                    </div>
                    
                    <div className="flex justify-end space-x-3 mt-6">
                      <button
                        onClick={() => {
                          setIsEditModalOpen(false);
                          setEditingPost(null);
                        }}
                        disabled={isSaving}
                        className={`px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveEdit}
                        disabled={isSaving}
                        className={`px-4 py-2 bg-blue-600 text-white rounded-md ${isSaving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-700'} flex items-center`}
                      >
                        {isSaving ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Saving...
                          </>
                        ) : (
                          <>
                            Save Changes <span className="ml-2 text-xs opacity-70">⌘⏎</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
} 
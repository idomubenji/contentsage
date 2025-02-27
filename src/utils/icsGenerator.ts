import { format as formatDate, formatISO, parseISO } from 'date-fns';
import { Post } from '@/components/calendar/CalendarContext';

/**
 * Generate a unique identifier for an iCalendar event
 */
function generateUID(post: Post): string {
  return `${post.id}@contentsage`;
}

/**
 * Escape special characters in iCalendar text fields
 */
function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Generate an iCalendar event from a post
 */
function generateEventFromPost(post: Post): string {
  if (!post.posted_date) {
    return '';
  }

  const postDate = post.posted_date ? new Date(post.posted_date) : new Date();
  const dateString = formatISO(postDate).replace(/[-:]/g, '').split('+')[0];
  const uid = generateUID(post);
  const title = post.title || 'Untitled Post';
  const description = post.description || '';
  const url = post.url || '';
  const status = post.status || 'SCHEDULED';
  const format = post.format || '';

  // Format the description including metadata
  const fullDescription = `${description}\n\nURL: ${url}\nStatus: ${status}\nFormat: ${format}`;

  return `BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dateString}
DTSTART;VALUE=DATE:${formatDate(postDate, 'yyyyMMdd')}
SUMMARY:${escapeICSText(title)}
DESCRIPTION:${escapeICSText(fullDescription)}
URL:${escapeICSText(url)}
STATUS:${status === 'POSTED' ? 'CONFIRMED' : status === 'SCHEDULED' ? 'TENTATIVE' : 'NEEDS-ACTION'}
CATEGORIES:${format}
END:VEVENT
`;
}

/**
 * Generate an iCalendar file (.ics) content from a single post
 */
export function generateICSForPost(post: Post): string {
  const eventContent = generateEventFromPost(post);
  
  if (!eventContent) {
    return '';
  }

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ContentSage//Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
${eventContent}END:VCALENDAR`;
}

/**
 * Generate an iCalendar file (.ics) content from multiple posts
 */
export function generateICSForPosts(posts: Post[]): string {
  // Filter out posts without dates
  const postsWithDates = posts.filter(post => !!post.posted_date);
  
  if (postsWithDates.length === 0) {
    return '';
  }

  const eventsContent = postsWithDates
    .map(post => generateEventFromPost(post))
    .join('');

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ContentSage//Calendar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
${eventsContent}END:VCALENDAR`;
}

// Store a local cache of exported events to avoid duplicates
let exportedEvents: Record<string, boolean> = {};

/**
 * Reset the exported events cache
 */
export function resetExportedEvents(): void {
  exportedEvents = {};
}

/**
 * Track an exported event to prevent duplicates
 */
export function trackExportedEvent(eventId: string): void {
  exportedEvents[eventId] = true;
}

/**
 * Check if an event has been exported
 */
export function hasBeenExported(eventId: string): boolean {
  return !!exportedEvents[eventId];
}

/**
 * Download an iCalendar file with the given filename and content
 */
export function downloadICS(filename: string, content: string): void {
  if (!content) {
    console.error('No content provided for ICS download');
    return;
  }

  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  
  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download calendar for a specific post
 */
export function downloadPostCalendar(post: Post): void {
  const title = post.title || 'untitled-post';
  const safeName = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
  const filename = `content-${safeName}.ics`;
  
  // Track this post as exported
  trackExportedEvent(post.id);
  
  const content = generateICSForPost(post);
  downloadICS(filename, content);
}

/**
 * Download calendar for multiple posts
 */
export function downloadMonthCalendar(posts: Post[], date: Date): void {
  const monthName = formatDate(date, 'yyyy-MMM').toLowerCase();
  const filename = `content-calendar-${monthName}.ics`;
  
  // Track all posts as exported
  posts.forEach(post => trackExportedEvent(post.id));
  
  const content = generateICSForPosts(posts);
  downloadICS(filename, content);
}

/**
 * Download calendar for a specific week
 */
export function downloadWeekCalendar(posts: Post[], date: Date): void {
  const weekName = formatDate(date, 'yyyy-MMM-dd').toLowerCase();
  const filename = `content-week-${weekName}.ics`;
  
  // Track all posts as exported
  posts.forEach(post => trackExportedEvent(post.id));
  
  const content = generateICSForPosts(posts);
  downloadICS(filename, content);
}

/**
 * Download calendar for a specific day
 */
export function downloadDayCalendar(posts: Post[], date: Date): void {
  const dayName = formatDate(date, 'yyyy-MM-dd').toLowerCase();
  const filename = `content-day-${dayName}.ics`;
  
  // Track all posts as exported
  posts.forEach(post => trackExportedEvent(post.id));
  
  const content = generateICSForPosts(posts);
  downloadICS(filename, content);
}

/**
 * Generate a Google Calendar URL for a single post
 */
export function generateGoogleCalendarUrl(post: Post): string {
  if (!post.posted_date) {
    return '';
  }

  // Format dates for Google Calendar (YYYYMMDDTHHMMSSZ)
  const postDate = new Date(post.posted_date);
  const startDate = formatDate(postDate, 'yyyyMMdd');
  
  // Calculate end date (default to same day)
  const endDate = startDate;
  
  const title = encodeURIComponent(post.title || 'Untitled Post');
  const description = encodeURIComponent(
    `${post.description || ''}\n\nURL: ${post.url || ''}\nStatus: ${post.status || ''}\nFormat: ${post.format || ''}`
  );
  
  // Track this post as exported
  trackExportedEvent(post.id);
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${description}`;
}

/**
 * Generate a Google Calendar URL for multiple posts
 * Note: Google Calendar doesn't support adding multiple events at once,
 * so this returns a URL for the first post with a note about multiple events
 */
export function generateGoogleCalendarUrlForPosts(posts: Post[], date: Date): string {
  // Filter out posts without dates
  const postsWithDates = posts.filter(post => !!post.posted_date);
  
  if (postsWithDates.length === 0) {
    return '';
  }
  
  // Track all posts as exported
  postsWithDates.forEach(post => trackExportedEvent(post.id));
  
  // If there's only one post, just use the regular function
  if (postsWithDates.length === 1) {
    return generateGoogleCalendarUrl(postsWithDates[0]);
  }
  
  // For multiple posts, create a summary event
  const dateStr = formatDate(date, 'yyyyMMdd');
  const title = encodeURIComponent(`Content Calendar - ${formatDate(date, 'MMMM d, yyyy')} (${postsWithDates.length} posts)`);
  
  // Create a description that lists all posts
  let description = encodeURIComponent(
    `Content calendar with ${postsWithDates.length} posts for ${formatDate(date, 'MMMM d, yyyy')}:\n\n` +
    postsWithDates.map(post => `- ${post.title || 'Untitled'}: ${post.description || 'No description'}`).join('\n\n')
  );
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateStr}/${dateStr}&details=${description}`;
} 
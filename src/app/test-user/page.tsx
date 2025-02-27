'use client';

import { useEffect, useState } from 'react';

export default function TestUserPage() {
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forcedUserId, setForcedUserId] = useState<string>('');
  
  useEffect(() => {
    async function fetchUserData() {
      try {
        setLoading(true);
        const response = await fetch('/api/test-user');
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        setUserData(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        console.error('Error fetching user data:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchUserData();
  }, []);
  
  // Function to test saving a post
  const testSavePost = async () => {
    try {
      setLoading(true);
      
      // Get the first available organization if any
      const organization = userData?.availableOrganizations?.[0]?.id || 
                          userData?.userOrganizations?.[0]?.organization_id || 
                          'b00816b8-b5d1-46f3-a135-ac4d52a407f2';
      
      console.log('Using organization:', organization);
      
      // Add the userId parameter if provided
      let url = '/api/posts/suggested';
      if (forcedUserId) {
        url += `?userId=${encodeURIComponent(forcedUserId)}`;
      }
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          suggestions: [
            {
              title: 'Browser Test Post',
              description: 'Testing from the browser with auth',
              platform: 'Web',
              posted_date: new Date().toISOString()
            }
          ],
          organizationId: organization
        }),
      });
      
      const result = await response.json();
      alert(`Save result: ${JSON.stringify(result)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      console.error('Error saving post:', err);
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">User Authentication Test</h1>
      
      {loading && <p>Loading...</p>}
      
      {error && (
        <div className="p-4 mb-4 bg-red-100 border border-red-300 rounded">
          <p className="text-red-700">Error: {error}</p>
        </div>
      )}
      
      {userData && (
        <div className="space-y-6">
          <div className="p-4 bg-gray-100 rounded">
            <h2 className="text-xl font-semibold mb-2">Current User</h2>
            {userData.currentUser ? (
              <div>
                <p><strong>User ID:</strong> {userData.currentUser.id}</p>
                <p><strong>Email:</strong> {userData.currentUser.email}</p>
                <p><strong>Is Authenticated:</strong> {userData.hasSession ? 'Yes' : 'No'}</p>
              </div>
            ) : (
              <p>Not logged in. {userData.sessionError ? `Error: ${userData.sessionError}` : ''}</p>
            )}
          </div>
          
          <div className="p-4 bg-gray-100 rounded">
            <h2 className="text-xl font-semibold mb-2">Available Users in Database</h2>
            {userData.availableUsers && userData.availableUsers.length > 0 ? (
              <ul className="list-disc list-inside">
                {userData.availableUsers.map((user: any) => (
                  <li key={user.id} className="mb-1">
                    <strong>ID:</strong> {user.id} - <strong>Email:</strong> {user.email}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No users found in database.</p>
            )}
          </div>
          
          <div className="p-4 bg-gray-100 rounded">
            <h2 className="text-xl font-semibold mb-2">Available Organizations</h2>
            {userData.availableOrganizations && userData.availableOrganizations.length > 0 ? (
              <ul className="list-disc list-inside">
                {userData.availableOrganizations.map((org: any) => (
                  <li key={org.id} className="mb-1">
                    <strong>ID:</strong> {org.id} - <strong>Name:</strong> {org.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No organizations found in database.</p>
            )}
          </div>
          
          {userData.userOrganizations && userData.userOrganizations.length > 0 && (
            <div className="p-4 bg-gray-100 rounded">
              <h2 className="text-xl font-semibold mb-2">User's Organizations</h2>
              <ul className="list-disc list-inside">
                {userData.userOrganizations.map((userOrg: any) => (
                  <li key={userOrg.organization_id} className="mb-1">
                    <strong>Organization ID:</strong> {userOrg.organization_id} 
                    <strong> Role:</strong> {userOrg.role}
                    {userOrg.organizations && (
                      <span> - <strong>Name:</strong> {userOrg.organizations.name}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="p-4 bg-gray-100 rounded">
            <h2 className="text-xl font-semibold mb-2">Force User ID (For Testing)</h2>
            <p className="text-sm text-gray-500 mb-2">
              Enter a user ID to override the authentication and use this ID directly.
              Leave empty to use the authenticated user.
            </p>
            <div className="flex items-center gap-4">
              <input
                type="text"
                value={forcedUserId}
                onChange={(e) => setForcedUserId(e.target.value)}
                placeholder="Enter a user ID to force"
                className="flex-1 p-2 border rounded"
              />
              {forcedUserId && (
                <button
                  onClick={() => setForcedUserId('')}
                  className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Clear
                </button>
              )}
            </div>
            {userData?.availableUsers?.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium">Quick select:</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {userData.availableUsers.map((user: any) => (
                    <button
                      key={user.id}
                      onClick={() => setForcedUserId(user.id)}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
                    >
                      {user.email}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-4">
            <button
              onClick={testSavePost}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Test Save Post
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Download, Trash2, User } from 'lucide-react';
import { useAuthContext } from '@/lib/auth-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Loader2 } from 'lucide-react';

export default function DataRightsPage() {
  const { user, token } = useAuthContext();
  const router = useRouter();
  
  const [deletionReason, setDeletionReason] = useState('');
  const [deletionStatus, setDeletionStatus] = useState<{ type: 'success' | 'error' | null; message: string | null }>({ 
    type: null, 
    message: null 
  });
  const [isLoading, setIsLoading] = useState<{ 
    delete: boolean; 
    access: boolean; 
    export: boolean 
  }>({ 
    delete: false, 
    access: false, 
    export: false 
  });

  if (!user) {
    return (
      <div className="container mx-auto py-10">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Authentication Required</AlertTitle>
          <AlertDescription>
            You must be logged in to access your data rights.
          </AlertDescription>
        </Alert>
        <div className="mt-4">
          <Button onClick={() => router.push('/auth/login')}>Log In</Button>
        </div>
      </div>
    );
  }

  const handleDeleteRequest = async () => {
    if (!token) {
      setDeletionStatus({
        type: 'error',
        message: 'Authentication token not found. Please log in again.'
      });
      return;
    }

    setIsLoading({ ...isLoading, delete: true });
    try {
      const response = await fetch('/api/user/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          reason: deletionReason,
          additionalInfo: ''
        })
      });

      const data = await response.json();

      if (response.ok) {
        setDeletionStatus({
          type: 'success',
          message: data.message || 'Your deletion request has been submitted successfully.'
        });
        setDeletionReason('');
      } else {
        setDeletionStatus({
          type: 'error',
          message: data.error || 'Failed to submit deletion request. Please try again.'
        });
      }
    } catch (error) {
      setDeletionStatus({
        type: 'error',
        message: 'An unexpected error occurred. Please try again later.'
      });
      console.error('Error submitting deletion request:', error);
    } finally {
      setIsLoading({ ...isLoading, delete: false });
    }
  };

  const handleDataAccess = async () => {
    if (!token) {
      setDeletionStatus({
        type: 'error',
        message: 'Authentication token not found. Please log in again.'
      });
      return;
    }

    setIsLoading({ ...isLoading, access: true });
    try {
      window.open(`/api/user/data?token=${encodeURIComponent(token)}`, '_blank');
    } catch (error) {
      console.error('Error accessing data:', error);
    } finally {
      setIsLoading({ ...isLoading, access: false });
    }
  };

  const handleDataExport = async () => {
    if (!token) {
      setDeletionStatus({
        type: 'error',
        message: 'Authentication token not found. Please log in again.'
      });
      return;
    }

    setIsLoading({ ...isLoading, export: true });
    try {
      window.open(`/api/user/export?token=${encodeURIComponent(token)}`, '_blank');
    } catch (error) {
      console.error('Error exporting data:', error);
    } finally {
      setIsLoading({ ...isLoading, export: false });
    }
  };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Manage Your Data Rights</h1>
      <p className="text-muted-foreground mb-6">
        Under privacy regulations like GDPR and CCPA, you have certain rights regarding your personal data.
        Use the options below to exercise these rights.
      </p>

      <Tabs defaultValue="access" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="access">Access Data</TabsTrigger>
          <TabsTrigger value="export">Export Data</TabsTrigger>
          <TabsTrigger value="delete">Delete Data</TabsTrigger>
        </TabsList>

        <TabsContent value="access">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User size={20} /> Access Your Data
              </CardTitle>
              <CardDescription>
                View all the personal data we have stored about you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                This will display all the personal information we have about you, including your profile data, 
                consent history, and other account information.
              </p>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleDataAccess} 
                disabled={isLoading.access}
              >
                {isLoading.access && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                View My Data
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download size={20} /> Export Your Data
              </CardTitle>
              <CardDescription>
                Download a copy of your personal data in a portable format.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                This will generate a downloadable file containing all your personal data in a structured,
                commonly used, and machine-readable format.
              </p>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleDataExport} 
                disabled={isLoading.export}
              >
                {isLoading.export && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Download My Data
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="delete">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 size={20} /> Request Data Deletion
              </CardTitle>
              <CardDescription>
                Request the deletion of your account and personal data.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                This will initiate the process to delete your account and personal data. Please note that:
              </p>
              <ul className="text-sm text-muted-foreground list-disc pl-5 mb-4 space-y-1">
                <li>The deletion process may take up to 30 days to complete</li>
                <li>Some data may be retained for legal, regulatory, or legitimate business purposes</li>
                <li>You will receive a confirmation email when the deletion is complete</li>
              </ul>

              <div className="space-y-4">
                <div>
                  <label htmlFor="deletion-reason" className="block text-sm font-medium mb-1">
                    Please tell us why you want to delete your data (optional)
                  </label>
                  <Textarea
                    id="deletion-reason"
                    placeholder="Your feedback helps us improve our services..."
                    value={deletionReason}
                    onChange={(e) => setDeletionReason(e.target.value)}
                    className="w-full"
                    rows={3}
                  />
                </div>

                {deletionStatus.message && (
                  <Alert variant={deletionStatus.type === 'error' ? 'destructive' : 'default'}>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>{deletionStatus.type === 'error' ? 'Error' : 'Success'}</AlertTitle>
                    <AlertDescription>{deletionStatus.message}</AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                variant="destructive"
                onClick={handleDeleteRequest}
                disabled={isLoading.delete}
              >
                {isLoading.delete && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Request Account Deletion
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      <Separator className="my-8" />

      <div className="text-sm text-muted-foreground">
        <h2 className="text-lg font-semibold mb-2">About Your Privacy Rights</h2>
        <p className="mb-2">
          Under privacy regulations like the General Data Protection Regulation (GDPR) and California Consumer Privacy Act (CCPA),
          you have several rights regarding your personal data:
        </p>
        <ul className="list-disc pl-5 space-y-1 mb-4">
          <li>Right to access your personal data</li>
          <li>Right to rectify inaccurate personal data</li>
          <li>Right to erasure ("right to be forgotten")</li>
          <li>Right to restrict processing of your personal data</li>
          <li>Right to data portability</li>
          <li>Right to object to processing of your personal data</li>
        </ul>
        <p>
          If you have any questions about exercising these rights, please contact our Data Protection Officer at privacy@example.com.
        </p>
      </div>
    </div>
  );
} 
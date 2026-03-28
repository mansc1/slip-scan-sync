import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Sheet, HardDrive, Tags } from 'lucide-react';
import { EXPENSE_CATEGORIES } from '@/types';

export default function SettingsPage() {
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground text-sm">การตั้งค่าระบบ</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" /> LINE Bot
            </CardTitle>
            <CardDescription>Webhook URL and credentials</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Webhook URL</span>
              <code className="text-xs bg-muted px-2 py-1 rounded">
                {`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/line-webhook`}
              </code>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="outline">Not configured</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Set LINE_CHANNEL_SECRET and LINE_CHANNEL_ACCESS_TOKEN as secrets in Lovable Cloud.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sheet className="h-5 w-5 text-primary" /> Google Sheets
            </CardTitle>
            <CardDescription>Auto-sync confirmed transactions</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="outline">Not configured</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Set GOOGLE_SERVICE_ACCOUNT_JSON and GOOGLE_SHEET_ID as secrets. Share the target sheet with the service account email.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-primary" /> Google Drive
            </CardTitle>
            <CardDescription>Auto-backup slip images</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="outline">Not configured</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Set GOOGLE_DRIVE_FOLDER_ID as a secret. Share the target folder with the service account email.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Tags className="h-5 w-5 text-primary" /> Categories
            </CardTitle>
            <CardDescription>Default expense categories</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {EXPENSE_CATEGORIES.map(c => (
                <Badge key={c.value} variant="secondary">{c.labelTh}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

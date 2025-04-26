// src/components/dashboard/share-book-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Copy, Check, Share2, Globe } from 'lucide-react';
import { shareBook } from '@/lib/actions/book.actions';
import { toast } from 'sonner';
import { getURL } from '@/lib/utils';

interface ShareBookModalProps {
  bookId: string;
  bookTitle: string;
  currentShareId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareBookModal({ bookId, bookTitle, currentShareId, isOpen, onClose }: ShareBookModalProps) {
  const [shareUrl, setShareUrl] = useState<string | null>(currentShareId ? `${getURL()}/book/${currentShareId}` : null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    // Update URL if currentShareId changes (e.g., after generation)
    setShareUrl(currentShareId ? `${getURL()}/book/${currentShareId}` : null);
  }, [currentShareId]);

  const handleGenerateLink = async () => {
    setIsLoading(true);
    try {
      const result = await shareBook(bookId);
      if (result.success && result.shareUrl) {
        setShareUrl(result.shareUrl);
        toast.success('Share link generated!');
      } else {
        toast.error(result.error || 'Failed to generate share link.');
      }
    } catch (error: any) {
      toast.error('An error occurred while generating the link.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        setIsCopied(true);
        toast.success('Link copied to clipboard!');
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch(err => {
        toast.error('Failed to copy link.');
        console.error('Clipboard copy failed:', err);
      });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="ghibli-dialog sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl text-primary/90">
             <Share2 className="w-5 h-5" /> Share "{bookTitle}"
          </DialogTitle>
          <DialogDescription className="text-base pt-1">
            {shareUrl
              ? 'Copy the link below to share your storybook with others.'
              : 'Generate a public link to share this storybook.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {shareUrl ? (
            <div className="space-y-2">
              <Label htmlFor="share-link" className="text-base">Public Share Link</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="share-link"
                  value={shareUrl}
                  readOnly
                  className="ghibli-input flex-grow"
                />
                <Button size="icon" variant="ghost" onClick={handleCopyLink} className="h-9 w-9 shrink-0">
                  {isCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={handleGenerateLink} disabled={isLoading} className="w-full ghibli-button">
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating Link...
                </>
              ) : (
                 <>
                   <Globe className="mr-2 h-4 w-4" /> Generate Public Link
                 </>
              )}
            </Button>
          )}
        </div>

        <DialogFooter className="sm:justify-end">
          <DialogClose asChild>
            <Button type="button" variant="secondary" className="ghibli-button-secondary">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

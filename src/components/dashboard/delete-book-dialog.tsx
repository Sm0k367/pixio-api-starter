// src/components/dashboard/delete-book-dialog.tsx
'use client';

import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';
import { deleteBook } from '@/lib/actions/book.actions';
import { toast } from 'sonner';

interface DeleteBookDialogProps {
  bookId: string;
  bookTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export function DeleteBookDialog({ bookId, bookTitle, isOpen, onClose }: DeleteBookDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteBook(bookId);
      if (result.success) {
        toast.success(`"${bookTitle}" deleted successfully.`);
        onClose(); // Close the dialog on success
        // The library will update via Realtime or next fetch
      } else {
        toast.error(result.error || `Failed to delete "${bookTitle}".`);
      }
    } catch (error: any) {
      toast.error('An unexpected error occurred during deletion.');
      console.error(error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="ghibli-dialog border-destructive/30">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-xl text-destructive">
             <AlertTriangle className="w-5 h-5"/> Delete "{bookTitle}"?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base pt-1">
            This action cannot be undone. This will permanently delete the storybook, including all its pages and generated images.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting} className="ghibli-button-secondary">Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteConfirm}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90 ghibli-button-destructive"
          >
            {isDeleting ? (
               <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...
               </>
            ) : (
               <>
                 <Trash2 className="mr-2 h-4 w-4" /> Delete Permanently
               </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

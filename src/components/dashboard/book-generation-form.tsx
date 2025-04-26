// src/components/dashboard/book-generation-form.tsx

'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Loader2, Sparkles, AlertCircle, BookOpen } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { generateBookSchema, TGenerateBookSchema } from '@/lib/validators/book.validators';
import { generateBook } from '@/lib/actions/book.actions';
import { BOOK_GENERATION_COST } from '@/lib/constants/book.constants';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface BookGenerationFormProps {
  userCredits: number;
  onGenerationStart?: (bookId: string) => void; // Callback when generation starts
}

// Define a clear result type for our responses
type GenerationResult = {
  success: boolean;
  bookId?: string;
  error?: string;
  message?: string;
  isTimeout?: boolean; // Flag to identify timeout responses
};

export function BookGenerationForm({ userCredits, onGenerationStart }: BookGenerationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TGenerateBookSchema>({
    resolver: zodResolver(generateBookSchema),
    defaultValues: {
      story_idea: '',
    },
  });

  async function onSubmit(values: TGenerateBookSchema) {
    if (userCredits < BOOK_GENERATION_COST) {
      toast.error("Not enough credits to generate a book.");
      return;
    }

    setIsSubmitting(true);
    let bookIdFromResponse: string | undefined;
    
    try {
      const formData = new FormData();
      formData.append('story_idea', values.story_idea);

      // Start the generation request
      const promise = generateBook(formData);
      
      // Create a timeout promise to stop loading after 3 seconds
      const timeoutPromise = new Promise<GenerationResult>(resolve => {
        setTimeout(() => {
          setIsSubmitting(false);
          resolve({ 
            success: true, 
            message: "Generation started in the background.",
            isTimeout: true
          });
        }, 3000); // Stop loading after 3 seconds max
      });
      
      // Race between the actual request and the timeout
      const result = await Promise.race([
        promise.then(data => {
          setIsSubmitting(false); // Stop loading when request finishes
          if (data.bookId) {
            bookIdFromResponse = data.bookId;
          }
          return data as GenerationResult;
        }),
        timeoutPromise
      ]);
      
      // Show toast message based on result type
      if (result.isTimeout) {
        toast.success("Your storybook generation has started!");
        form.reset(); // Clear the form on timeout - assume success
      } else {
        // This is the actual API result
        if (result.success) {
          toast.success(result.message || 'Your storybook generation has started!');
          form.reset(); // Clear the form on success
          
          if (bookIdFromResponse && onGenerationStart) {
            onGenerationStart(bookIdFromResponse);
          }
        } else {
          toast.error(result.error || 'Failed to start book generation.');
        }
      }
    } catch (error: any) {
      console.error('Submission error:', error);
      toast.error('An unexpected error occurred.');
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="ghibli-card border border-primary/20 shadow-lg overflow-hidden bg-gradient-to-br from-background via-secondary/5 to-primary/5">
       <CardHeader className="pb-4 border-b border-primary/15 bg-gradient-to-b from-white/5 to-transparent">
         <div className="flex items-center gap-4">
           <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/30 to-secondary/30 flex items-center justify-center border border-white/15 shadow-inner">
             <BookOpen className="w-6 h-6 text-primary-foreground" />
           </div>
           <div>
             <CardTitle className="text-2xl md:text-3xl text-primary/90">Create Your Storybook</CardTitle>
             <CardDescription className="text-base text-muted-foreground">
               Enter your story idea and let AI bring it to life!
             </CardDescription>
           </div>
         </div>
       </CardHeader>
       <CardContent className="pt-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <FormField
                control={form.control}
                name="story_idea"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-lg font-medium text-foreground/90">Your Story Idea</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., A brave little squirrel who learns to fly with the help of a wise old owl..."
                        {...field}
                        rows={5}
                        className="resize-none ghibli-input text-base p-3 rounded-lg shadow-inner"
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2"
            >
              <Button
                type="submit"
                disabled={isSubmitting || userCredits < BOOK_GENERATION_COST}
                className="w-full sm:w-auto ghibli-button text-lg py-3 px-8 font-semibold"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-5 w-5" />
                    Generate Storybook ({BOOK_GENERATION_COST} credits)
                  </>
                )}
              </Button>
               <div className="text-base text-muted-foreground text-center sm:text-right">
                 <p>Available Credits: <span className="font-bold text-primary">{userCredits.toLocaleString()}</span></p>
                 {userCredits < BOOK_GENERATION_COST && !isSubmitting && (
                   <p className="text-destructive/80 text-sm flex items-center justify-center sm:justify-end gap-1 pt-1"><AlertCircle className="w-4 h-4"/> Not enough credits.</p>
                 )}
               </div>
            </motion.div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

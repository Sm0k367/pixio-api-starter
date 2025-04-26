import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// --- Configuration ---
const COMFYUI_DEPLOYMENT_ID = '8f96cb86-5cbb-4ad0-9837-8a79eeb5103a';
const COMFYUI_API_KEY = Deno.env.get('COMFY_DEPLOY_API_KEY') ?? '';
const MAX_POLLING_ATTEMPTS = 90;
const POLLING_INTERVAL_MS = 10000;
const MAX_API_RETRIES = 5;

// --- Helper: Delay ---
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// --- Helper: Update Status in DB ---
async function updateGenerationStatus(
  supabaseAdmin: SupabaseClient, 
  bookId: string, 
  pageNumber: number, 
  status: string, 
  details: {
    imageUrl?: string,
    storagePath?: string,
    runId?: string,
    errorMessage?: string
  } = {}
): Promise<void> {
  let pageUpdate: Record<string, any> = {
    generation_status: status
  };
  let bookUpdate: Record<string, any> = {}; // Only update book table for cover or final status
  
  // --- Populate Payloads ---
  if (details.imageUrl) {
    if (pageNumber === -1) bookUpdate.cover_image_url = details.imageUrl;
    else pageUpdate.image_url = details.imageUrl;
  }
  if (details.storagePath) {
    if (pageNumber === -1) bookUpdate.cover_storage_path = details.storagePath;
    else pageUpdate.storage_path = details.storagePath;
  }
  if (details.runId) {
    const runIdMeta = {
      run_id: details.runId
    };
    if (pageNumber === -1) {
      bookUpdate.metadata = {
        ...bookUpdate.metadata || {},
        cover_run_id: details.runId
      };
    } else {
      pageUpdate.metadata = {
        ...pageUpdate.metadata || {},
        ...runIdMeta
      };
    }
  }
  if (details.errorMessage) {
    const truncatedError = details.errorMessage.substring(0, 500);
    const errorMeta = {
      error: truncatedError
    };
    if (pageNumber === -1) {
      bookUpdate.metadata = {
        ...bookUpdate.metadata || {},
        cover_error: truncatedError
      };
      // Also update book's main error if cover fails
      bookUpdate.error_message = `Cover generation failed: ${truncatedError}`;
      bookUpdate.status = 'failed'; // Mark book as failed if cover fails
    } else {
      pageUpdate.metadata = {
        ...pageUpdate.metadata || {},
        ...errorMeta
      };
    }
  }
  
  // --- Execute Updates ---
  try {
    if (pageNumber === -1) {
      // Update cover image fields (and potentially status/error) in the books table
      if (Object.keys(bookUpdate).length > 0) {
        const { error } = await supabaseAdmin.from('books').update(bookUpdate).eq('id', bookId);
        if (error) throw error;
        console.log(`[Book: ${bookId}/Cover] Updated books table. Status: ${status}`);
      }
    } else {
      // Update the specific book_pages record
      const { error } = await supabaseAdmin.from('book_pages').update(pageUpdate).eq('book_id', bookId).eq('page_number', pageNumber);
      if (error) throw error;
      console.log(`[Book: ${bookId}/Page: ${pageNumber}] Updated book_pages table status to ${status}.`);
    }
  } catch (error) {
    console.error(`[Book: ${bookId}/Page: ${pageNumber === -1 ? 'Cover' : pageNumber}] Failed to update DB status to ${status}:`, error);
  }
}

// --- Helper: Check if all book images are completed ---
async function checkBookCompletion(supabaseAdmin: SupabaseClient, bookId: string): Promise<boolean> {
  try {
    const { data: bookData, error: bookError } = await supabaseAdmin.from('books').select('cover_image_url').eq('id', bookId).single();
    if (bookError || !bookData || !bookData.cover_image_url) {
      return false;
    }
    const { count, error: pagesError } = await supabaseAdmin.from('book_pages').select('*', {
      count: 'exact',
      head: true
    }).eq('book_id', bookId).neq('generation_status', 'completed');
    if (pagesError) {
      console.error(`[Book: ${bookId}] Error counting incomplete pages:`, pagesError);
      return false;
    }
    return count === 0;
  } catch (error) {
    console.error(`[Book: ${bookId}] Error in checkBookCompletion:`, error);
    return false;
  }
}

// --- Helper: Update Book Final Status ---
async function updateBookFinalStatus(
  supabaseAdmin: SupabaseClient, 
  bookId: string, 
  status: string, 
  errorMessage?: string
): Promise<void> {
  const payload: {
    status: string;
    error_message?: string;
  } = {
    status
  };
  if (status === 'failed') {
    payload.error_message = errorMessage?.substring(0, 500) ?? 'Unknown failure during image generation phase.';
  }
  const { error } = await supabaseAdmin.from('books').update(payload).eq('id', bookId);
  if (error) {
    console.error(`[Book: ${bookId}] Failed to update final book status to ${status}:`, error);
  } else {
    console.log(`[Book: ${bookId}] Final book status updated to ${status}.`);
  }
}

// --- Main Function Logic ---
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let bookId: string | null = null;
  let pageNumber: number | null = null;
  const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  try {
    // 1. Parse Request Body
    const body = await req.json();
    bookId = body.book_id;
    pageNumber = body.page_number;
    const imagePrompt = body.image_prompt;
    if (!bookId || pageNumber === null || pageNumber === undefined || !imagePrompt) {
      return new Response(JSON.stringify({
        error: 'Missing required parameters: book_id, page_number, image_prompt'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    const identifier = pageNumber === -1 ? 'Cover' : `Page ${pageNumber}`;
    console.log(`[Book: ${bookId}/${identifier}] Received request. Prompt: "${imagePrompt.substring(0, 30)}..."`);
    // 2. Update Status to 'processing'
    await updateGenerationStatus(supabaseAdmin, bookId, pageNumber, 'processing');
    // 3. Trigger ComfyUI API (with retries)
    let triggerResult = null;
    let triggerError = null;
    let run_id: string | null = null;
    if (!COMFYUI_API_KEY) {
      throw new Error("COMFY_DEPLOY_API_KEY environment variable not set.");
    }
    for(let attempt = 1; attempt <= MAX_API_RETRIES; attempt++){
      try {
        console.log(`[Book: ${bookId}/${identifier}] Triggering ComfyUI API (Attempt ${attempt}/${MAX_API_RETRIES})...`);
        const triggerResponse = await fetch("https://api.myapps.ai/api/run", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${COMFYUI_API_KEY}`
          },
          body: JSON.stringify({
            deployment_id: COMFYUI_DEPLOYMENT_ID,
            inputs: {
              "prompt": imagePrompt
            }
          })
        });
        if (!triggerResponse.ok) {
          const errorBody = await triggerResponse.text();
          throw new Error(`ComfyUI trigger API Error ${triggerResponse.status}: ${errorBody}`);
        }
        triggerResult = await triggerResponse.json();
        run_id = triggerResult?.run_id;
        if (!run_id) throw new Error('ComfyUI did not return a run_id');
        triggerError = null;
        console.log(`[Book: ${bookId}/${identifier}] ComfyUI run started: ${run_id}`);
        break;
      } catch (err) {
        // Safely handle unknown error type
        if (err instanceof Error) {
          triggerError = err;
          console.warn(`[Book: ${bookId}/${identifier}] ComfyUI trigger attempt ${attempt} failed: ${err.message}`);
        } else {
          triggerError = new Error(String(err));
          console.warn(`[Book: ${bookId}/${identifier}] ComfyUI trigger attempt ${attempt} failed with non-Error type: ${String(err)}`);
        }
        if (attempt === MAX_API_RETRIES) {
          console.error(`[Book: ${bookId}/${identifier}] ComfyUI trigger failed after ${MAX_API_RETRIES} attempts.`);
          throw triggerError;
        }
        await delay(2000 * attempt);
      }
    }
    // Update DB with run_id immediately
    await updateGenerationStatus(supabaseAdmin, bookId, pageNumber, 'processing', {
      runId: run_id ?? undefined
    }); // Pass undefined if null
    // 4. Polling for Result
    let currentStatus = 'processing';
    let finalOutput = null;
    let pollingAttempts = 0;
    let consecutiveApiErrors = 0;
    const maxConsecutiveApiErrors = 10;
    while([
      'processing',
      'not-started',
      'running',
      'uploading',
      'queued'
    ].includes(currentStatus) && pollingAttempts < MAX_POLLING_ATTEMPTS){
      pollingAttempts++;
      console.log(`[Book: ${bookId}/${identifier}] Polling attempt ${pollingAttempts}/${MAX_POLLING_ATTEMPTS} for run ${run_id}.`);
      await delay(POLLING_INTERVAL_MS);
      try {
        const statusResponse = await fetch(`https://api.myapps.ai/api/run?run_id=${run_id}`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${COMFYUI_API_KEY}`
          }
        });
        if (!statusResponse.ok) {
          consecutiveApiErrors++;
          const errorBody = await statusResponse.text();
          console.warn(`[Book: ${bookId}/${identifier}] Polling API failed (Attempt ${pollingAttempts}, consecutive errors ${consecutiveApiErrors}): ${statusResponse.status} ${statusResponse.statusText}. Body: ${errorBody}`);
          if (consecutiveApiErrors >= maxConsecutiveApiErrors) {
            throw new Error(`Polling API failed ${maxConsecutiveApiErrors} consecutive times.`);
          }
          continue;
        }
        consecutiveApiErrors = 0;
        finalOutput = await statusResponse.json();
        currentStatus = finalOutput.status || 'unknown';
        console.log(`[Book: ${bookId}/${identifier}] Status received: ${currentStatus}`);
        if ([
          'success',
          'complete',
          'failed'
        ].includes(currentStatus)) {
          break;
        }
      } catch (pollError: any) {
        consecutiveApiErrors++;
        console.warn(`[Book: ${bookId}/${identifier}] Network error during polling attempt ${pollingAttempts} (consecutive errors ${consecutiveApiErrors}):`, pollError.message);
        if (consecutiveApiErrors >= maxConsecutiveApiErrors) {
          throw new Error(`Polling network error ${maxConsecutiveApiErrors} consecutive times: ${pollError.message}`);
        }
      }
    } // End polling loop
    // 5. Handle Final Status
    console.log(`[Book: ${bookId}/${identifier}] Polling finished. Final API status: ${currentStatus}`);
    if (currentStatus === 'success' || currentStatus === 'complete') {
      // UPDATED: Using the specified URL format for accessing the generated image
      const cdnUrl = `https://comfy-deploy.nyc3.cdn.digitaloceanspaces.com/outputs/runs/${run_id}/`;
      
      // Get the filename from the API response, or use default if not available
      let filename = "ComfyUI_00001_.png"; // Default ComfyUI output filename
      
      if (finalOutput?.outputs?.[0]?.filename) {
        filename = finalOutput.outputs[0].filename;
      } else if (finalOutput?.outputs?.[0]?.url) {
        // Try to extract filename from the URL if provided
        const urlFilename = finalOutput.outputs[0].url.split('/').pop();
        if (urlFilename) filename = urlFilename;
      }
      
      const remoteMediaUrl = `${cdnUrl}${filename}`;
      console.log(`[Book: ${bookId}/${identifier}] Using image URL: ${remoteMediaUrl}`);
      
      const fileExtension = '.png';
      const contentType = 'image/png';
      console.log(`[Book: ${bookId}/${identifier}] Downloading image from: ${remoteMediaUrl}`);
      const mediaResponse = await fetch(remoteMediaUrl, {
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      if (!mediaResponse.ok) throw new Error(`Failed to download image (${mediaResponse.status}): ${mediaResponse.statusText}`);
      const mediaBuffer = await mediaResponse.arrayBuffer();
      if (mediaBuffer.byteLength === 0) throw new Error('Downloaded image file is empty.');
      console.log(`[Book: ${bookId}/${identifier}] Downloaded image size: ${(mediaBuffer.byteLength / 1024).toFixed(2)} KB`);
      const storageFileName = pageNumber === -1 ? 'cover.png' : `page_${pageNumber}.png`;
      const storagePath = `${bookId}/${storageFileName}`;
      console.log(`[Book: ${bookId}/${identifier}] Uploading to Supabase storage: ${storagePath}`);
      const { data: uploadData, error: uploadError } = await supabaseAdmin.storage.from('book-images').upload(storagePath, mediaBuffer, {
        contentType,
        upsert: true,
        cacheControl: '3600'
      });
      if (uploadError) throw new Error(`Storage upload error: ${uploadError.message}`);
      console.log(`[Book: ${bookId}/${identifier}] Upload successful: ${uploadData?.path}`);
      const { data: publicUrlData } = supabaseAdmin.storage.from('book-images').getPublicUrl(storagePath);
      await updateGenerationStatus(supabaseAdmin, bookId, pageNumber, 'completed', {
        imageUrl: publicUrlData.publicUrl,
        storagePath: storagePath,
        runId: run_id ?? undefined // Pass undefined if null
      });
      console.log(`[Book: ${bookId}/${identifier}] Marked as completed.`);
      const isBookComplete = await checkBookCompletion(supabaseAdmin, bookId);
      if (isBookComplete) {
        await updateBookFinalStatus(supabaseAdmin, bookId, 'completed'); // Use helper
      }
    } else {
      const errorMessage = currentStatus === 'failed' ? finalOutput?.error || 'Generation failed in ComfyUI' : pollingAttempts >= MAX_POLLING_ATTEMPTS ? 'Generation timed out after polling' : `Generation stopped with unexpected status: ${currentStatus}`;
      console.error(`[Book: ${bookId}/${identifier}] Generation failed: ${errorMessage}`);
      await updateGenerationStatus(supabaseAdmin, bookId, pageNumber, 'failed', {
        errorMessage,
        runId: run_id ?? undefined
      }); // Pass undefined if null
      // Mark the main book record as failed
      await updateBookFinalStatus(supabaseAdmin, bookId, 'failed', `Image generation failed for ${identifier}: ${errorMessage}`); // Use helper
    }
    // 6. Return Success
    return new Response(JSON.stringify({
      success: true,
      finalStatus: currentStatus
    }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 200
      });
  } catch (error: any) {
    console.error(`[Book: ${bookId ?? 'UNKNOWN'}/Page: ${pageNumber ?? 'UNKNOWN'}] Function error:`, error);
    if (bookId !== null && pageNumber !== null) {
      try {
        // Use the helper function to mark the specific step as failed
        await updateGenerationStatus(supabaseAdmin, bookId, pageNumber, 'failed', {
          errorMessage: `Function error: ${error.message}`
        });
        // Use the helper function to mark the overall book as failed
        await updateBookFinalStatus(supabaseAdmin, bookId, 'failed', `Function error during image generation for ${pageNumber === -1 ? 'Cover' : `Page ${pageNumber}`}: ${error.message}`);
      } catch (updateErr) {
        console.error(`[Book: ${bookId}/${pageNumber === -1 ? 'Cover' : pageNumber}] Failed to update status to failed on function error:`, updateErr);
      }
    }
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// --- Configuration ---
const TEXT_GENERATION_API_URL = 'https://aitutor-api.vercel.app/api/v1/run/wf_ilady9xrjr3krzt0j8ria7ik';
const TEXT_GENERATION_API_KEY = Deno.env.get('TEXT_GENERATION_API_KEY') ?? '';
const BOOK_GENERATION_COST = 250;

// --- Helper: Delay ---
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// --- Helper: Refund Credits ---
async function refundCredits(
  supabaseAdmin: SupabaseClient,
  userId: string,
  amount: number,
  bookId: string | null
): Promise<void> {
  try {
    const { error: fetchError, data: userData } = await supabaseAdmin.from('users').select('subscription_credits, purchased_credits').eq('id', userId).single();
    if (fetchError || !userData) {
      console.error(`Refund failed for user ${userId} (book: ${bookId ?? 'UNKNOWN'}): Could not fetch user credits.`, fetchError);
      return;
    }
    const newPurchasedCredits = (userData.purchased_credits ?? 0) + amount;
    const { error: updateError } = await supabaseAdmin.from('users').update({
      purchased_credits: newPurchasedCredits
    }).eq('id', userId);
    if (updateError) {
      console.error(`Refund failed for user ${userId} (book: ${bookId ?? 'UNKNOWN'}): Could not update user credits.`, updateError);
    } else {
      await supabaseAdmin.from('credit_usage').insert({
        user_id: userId,
        amount: -amount,
        description: `Refund for failed book generation (Book ID: ${bookId ?? 'N/A'})`
      });
      console.log(`Credits refunded successfully for user ${userId} (book: ${bookId ?? 'UNKNOWN'}). Amount: ${amount}`);
    }
  } catch (e) {
    console.error(`Exception during refund for user ${userId} (book: ${bookId ?? 'UNKNOWN'}):`, e);
  }
}

// --- Helper: Update Book Status ---
async function updateBookStatus(
  supabaseAdmin: SupabaseClient,
  bookId: string,
  status: string,
  errorMessage?: string
): Promise<void> {
  // No longer need null check here as we assert at call site
  const updatePayload: { 
    status: string; 
    error_message?: string;
  } = {
    status
  };
  if (errorMessage) {
    updatePayload.error_message = errorMessage.substring(0, 500);
  }
  const { error } = await supabaseAdmin.from('books').update(updatePayload).eq('id', bookId);
  if (error) {
    console.error(`Failed to update book ${bookId} status to ${status}:`, error);
  }
}

// --- Main Function Logic ---
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  let userId: string | null = null;
  let bookId: string | null = null;
  let creditsDeducted = false;
  const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  try {
    // 1. Authentication & Authorization
    const userSupabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: {
        headers: {
          Authorization: req.headers.get('Authorization') ?? ''
        }
      }
    });
    const { data: { user }, error: authError } = await userSupabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('Auth Error:', authError);
      return new Response(JSON.stringify({
        error: 'Unauthorized'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 401
      });
    }
    userId = user.id;
    // 2. Parse Request Body
    const { story_idea } = await req.json();
    if (!story_idea || typeof story_idea !== 'string' || story_idea.trim().length === 0) {
      return new Response(JSON.stringify({
        error: 'Invalid input: story_idea is required.'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    // 3. Create Initial Book Record
    const { data: newBook, error: bookInsertError } = await supabaseAdmin.from('books').insert({
      user_id: userId,
      title: 'Generating Story...',
      original_prompt: story_idea,
      status: 'pending',
      credits_cost: BOOK_GENERATION_COST
    }).select('id').single();
    if (bookInsertError || !newBook) {
      console.error('Failed to insert initial book record:', bookInsertError);
      throw new Error(`Database error: Could not create book record. ${bookInsertError?.message}`);
    }
    bookId = newBook.id; // bookId is assigned here and guaranteed non-null below
    console.log(`[Book: ${bookId}] Initial record created.`);
    // 4. Deduct Credits
    const { data: userData, error: creditFetchError } = await supabaseAdmin.from('users').select('subscription_credits, purchased_credits').eq('id', userId).single();
    if (creditFetchError || !userData) {
      if (bookId) { // Add null check before using bookId
        await updateBookStatus(supabaseAdmin, bookId, 'failed', 'Failed to fetch user credits.');
      }
      throw new Error('Failed to fetch user credits.');
    }
    const totalCredits = (userData.subscription_credits ?? 0) + (userData.purchased_credits ?? 0);
    if (totalCredits < BOOK_GENERATION_COST) {
      if (bookId) { // Add null check before using bookId
        await updateBookStatus(supabaseAdmin, bookId, 'failed', 'Insufficient credits.');
      }
      return new Response(JSON.stringify({
        error: 'Insufficient credits',
        bookId: bookId
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 402
      });
    }
    let newSubscriptionCredits = userData.subscription_credits ?? 0;
    let newPurchasedCredits = userData.purchased_credits ?? 0;
    if (newSubscriptionCredits >= BOOK_GENERATION_COST) {
      newSubscriptionCredits -= BOOK_GENERATION_COST;
    } else {
      const neededFromPurchased = BOOK_GENERATION_COST - newSubscriptionCredits;
      newSubscriptionCredits = 0;
      newPurchasedCredits -= neededFromPurchased;
    }
    const { error: creditUpdateError } = await supabaseAdmin.from('users').update({
      subscription_credits: newSubscriptionCredits,
      purchased_credits: newPurchasedCredits
    }).eq('id', userId);
    if (creditUpdateError) {
      if (bookId) { // Add null check before using bookId
        await updateBookStatus(supabaseAdmin, bookId, 'failed', 'Failed to deduct credits.');
      }
      throw new Error(`Failed to update credits: ${creditUpdateError.message}`);
    }
    creditsDeducted = true;
    await supabaseAdmin.from('credit_usage').insert({
      user_id: userId,
      amount: BOOK_GENERATION_COST,
      description: `Generate book: ${story_idea.substring(0, 50)}... (ID: ${bookId})`
    });
    console.log(`[Book: ${bookId}] Credits deducted successfully.`);
    // 5. Update Book Status to 'generating_text'
    // Type assertion for bookId since we know it's not null at this point
    if (bookId) {
      await updateBookStatus(supabaseAdmin, bookId, 'generating_text', undefined);
    }
    
    // 6. Call Text Generation API
    console.log(`[Book: ${bookId}] Calling Text Generation API...`);
    if (!TEXT_GENERATION_API_KEY) {
      throw new Error("Text Generation API Key is not configured.");
    }
    const textApiOptions = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TEXT_GENERATION_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        story: story_idea
      })
    };
    const textApiResponse = await fetch(TEXT_GENERATION_API_URL, textApiOptions);
    if (!textApiResponse.ok) {
      const errorBody = await textApiResponse.text();
      console.error(`[Book: ${bookId}] Text Generation API Error: ${textApiResponse.status}`, errorBody);
      throw new Error(`Text Generation API request failed: ${textApiResponse.statusText}. Details: ${errorBody}`);
    }
    const textApiResult = await textApiResponse.json();
    
    // Define interface for story data
    interface StoryData {
      title: string;
      cover_image_prompt: string;
      pages: Array<{
        page_number: number;
        text: string;
        image_prompt: string;
      }>;
    }
    
    let storyData: StoryData;
    try {
      // UPDATED LINE: Using result instead of text property
      const jsonString = textApiResult?.result?.match(/```json\n([\s\S]*?)\n```/)?.[1];
      if (!jsonString) {
        console.error("Could not find JSON block in text API response:", textApiResult);
        throw new Error("Invalid format received from text generation API.");
      }
      storyData = JSON.parse(jsonString);
    } catch (parseError) {
      console.error("Failed to parse JSON from text API response:", parseError);
      // UPDATED LINE: Using result instead of text property
      console.error("Raw response text:", textApiResult?.result);
      throw new Error("Failed to parse story data from text generation API.");
    }
    const { title, cover_image_prompt, pages } = storyData;
    if (!title || !cover_image_prompt || !Array.isArray(pages) || pages.length === 0) {
      console.error("Invalid story data structure received:", storyData);
      throw new Error("Incomplete story data received from text generation API.");
    }
    console.log(`[Book: ${bookId}] Text Generation successful. Title: ${title}`);
    // 7. Update Book Record with Text API results
    const shortDescription = pages[0]?.text?.substring(0, 150) + '...' || 'A wonderful children\'s story.';
    
    if (!bookId) {
      throw new Error("Book ID is unexpectedly null after text generation");
    }
    
    const { error: bookUpdateError } = await supabaseAdmin.from('books').update({
      title: title,
      short_description: shortDescription,
      cover_image_prompt: cover_image_prompt,
      status: 'generating_images'
    }).eq('id', bookId);
    
    if (bookUpdateError) {
      console.error(`[Book: ${bookId}] Failed to update book with text results:`, bookUpdateError);
    }
    
    // 8. Insert Book Pages
    const pageInserts = pages.map((page) => ({
        book_id: bookId,
        page_number: page.page_number,
        text: page.text,
        image_prompt: page.image_prompt,
        generation_status: 'pending'
      }));
    const { error: pageInsertError } = await supabaseAdmin.from('book_pages').insert(pageInserts);
    if (pageInsertError) {
      console.error(`[Book: ${bookId}] Failed to insert book pages:`, pageInsertError);
      throw new Error(`Database error: Could not insert book pages. ${pageInsertError.message}`);
    }
    console.log(`[Book: ${bookId}] ${pages.length} pages inserted.`);
    
    // 9. Fan-out Image Generation Tasks (Asynchronously)
    console.log(`[Book: ${bookId}] Fanning out image generation tasks...`);
    
    // Type for supabaseAdmin.functions.invoke response
    interface FunctionInvokeResponse {
      error?: string;
      data?: any;
    }
    
    // Trigger cover image generation
    supabaseAdmin.functions.invoke('generate-book-image', {
      body: {
        book_id: bookId,
        page_number: -1,
        image_prompt: cover_image_prompt
      }
    }).then((response: FunctionInvokeResponse) => {
      if ('error' in response && response.error) console.error(`[Book: ${bookId}] Error invoking generate-book-image for cover:`, response.error);
      else console.log(`[Book: ${bookId}] Invoked generate-book-image for cover.`);
    }).catch((err: Error) => console.error(`[Book: ${bookId}] Catch invoking generate-book-image for cover:`, err));
    
    // Trigger page image generation
    for (const page of pages){
      if (page.image_prompt) {
        supabaseAdmin.functions.invoke('generate-book-image', {
          body: {
            book_id: bookId,
            page_number: page.page_number,
            image_prompt: page.image_prompt
          }
        }).then((response: FunctionInvokeResponse) => {
          if ('error' in response && response.error) console.error(`[Book: ${bookId}] Error invoking generate-book-image for page ${page.page_number}:`, response.error);
          else console.log(`[Book: ${bookId}] Invoked generate-book-image for page ${page.page_number}.`);
        }).catch((err: Error) => console.error(`[Book: ${bookId}] Catch invoking generate-book-image for page ${page.page_number}:`, err));
        await delay(200);
      }
    }
    console.log(`[Book: ${bookId}] All image generation tasks invoked.`);
    // 10. Return Initial Success Response
    return new Response(JSON.stringify({
      success: true,
      bookId: bookId,
      message: "Book generation started."
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 202
    });
  } catch (error: any) {
    console.error(`[Book: ${bookId ?? 'UNKNOWN'}] Overall generation error:`, error);
    if (bookId) {
      await updateBookStatus(supabaseAdmin, bookId, 'failed', error.message || 'Unknown error during book generation.');
      if (creditsDeducted && userId) {
        console.log(`[Book: ${bookId}] Attempting refund due to error...`);
        await refundCredits(supabaseAdmin, userId, BOOK_GENERATION_COST, bookId);
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

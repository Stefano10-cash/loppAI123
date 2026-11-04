import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_ADS_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_ADS_CLIENT_SECRET");
const REDIRECT_URI = Deno.env.get("GOOGLE_REDIRECT_URI");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const SCOPES = [
  "https://www.googleapis.com/auth/adwords",
].join(" ");

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function htmlResponse(html: string) {
  return new Response(html, {
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "connect";

  // Step 1 — redirect the user to Google's official OAuth consent screen.
  if (action === "connect" && req.method === "GET") {
    if (!GOOGLE_CLIENT_ID || !REDIRECT_URI) {
      return jsonResponse(
        { error: "A integração com o Google Ads ainda não foi configurada. Define GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET e GOOGLE_REDIRECT_URI." },
        503,
      );
    }

    const state = url.searchParams.get("state") ?? "";
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", GOOGLE_CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);

    return Response.redirect(authUrl.toString(), 302);
  }

  // Step 2 — Google redirects back with ?code=... Exchange for tokens and
  // persist the ad account record.
  if (action === "callback" && req.method === "GET") {
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const stateParam = url.searchParams.get("state") ?? "";
    const appUrl = url.searchParams.get("app_url") ?? "/";

    if (error || !code) {
      return htmlResponse(
        `<!doctype html><html><body><script>window.opener?.postMessage({type:'google-oauth',success:false,error:'authorization_failed'},'*');window.close();</script></body></html>`,
      );
    }
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !REDIRECT_URI || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return htmlResponse(
        `<!doctype html><html><body><script>window.opener?.postMessage({type:'google-oauth',success:false,error:'not_configured'},'*');window.close();</script></body></html>`,
      );
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return htmlResponse(
        `<!doctype html><html><body><script>window.opener?.postMessage({type:'google-oauth',success:false,error:'token_exchange_failed'},'*');window.close();</script></body></html>`,
      );
    }

    const grantedScopes = (tokenData.scope as string ?? "").split(" ").filter(Boolean);
    const userId = stateParam;
    if (!userId) {
      return htmlResponse(
        `<!doctype html><html><body><script>window.opener?.postMessage({type:'google-oauth',success:false,error:'missing_user'},'*');window.close();</script></body></html>`,
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Fetch the user's Google Ads customer IDs via the Google Ads API.
    let accountName = "Conta Google Ads";
    let accountId: string | null = null;
    try {
      const devToken = Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN");
      if (devToken && tokenData.access_token) {
        const listRes = await fetch("https://googleads.googleapis.com/v17/customers:listAccessibleCustomers", {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            "developer-token": devToken,
          },
        });
        const listData = await listRes.json();
        const customers: Array<{ resourceName: string; descriptiveName: string; id: string }> =
          listData.resourceNames ? listData.resourceNames.map((rn: string) => {
            const id = rn.split("/").pop() ?? "";
            return { resourceName: rn, descriptiveName: id, id };
          }) : [];
        if (customers.length > 0) {
          accountId = customers[0].id;
          accountName = customers[0].descriptiveName || customers[0].id;
        }
      }
    } catch {
      // If the Ads API call fails, we still record a connected account
      // without a specific account ID — the user can select it later.
    }

    await supabase.from("ad_accounts").insert({
      user_id: userId,
      platform: "google",
      platform_account_id: accountId,
      platform_account_name: accountName,
      scopes: grantedScopes,
      status: "connected",
    });

    return htmlResponse(
      `<!doctype html><html><body><script>window.opener?.postMessage({type:'google-oauth',success:true},'${appUrl}');window.close();</script></body></html>`,
    );
  }

  return jsonResponse({ error: "not_found" }, 404);
});

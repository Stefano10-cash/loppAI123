import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const META_APP_ID = Deno.env.get("META_APP_ID");
const META_APP_SECRET = Deno.env.get("META_APP_SECRET");
const REDIRECT_URI = Deno.env.get("META_REDIRECT_URI");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const SCOPES = [
  "ads_management",
  "ads_read",
  "business_management",
  "instagram_basic",
  "instagram_manage_insights",
  "whatsapp_business_management",
].join(",");

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

  // Step 1 — redirect the user to Meta's official OAuth authorize URL.
  if (action === "connect" && req.method === "GET") {
    if (!META_APP_ID || !REDIRECT_URI) {
      return jsonResponse(
        { error: "A integração com a Meta ainda não foi configurada. Define META_APP_ID, META_APP_SECRET e META_REDIRECT_URI." },
        503,
      );
    }

    const state = url.searchParams.get("state") ?? "";
    const authUrl = new URL("https://www.facebook.com/v19.0/dialog/oauth");
    authUrl.searchParams.set("client_id", META_APP_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("state", state);

    return Response.redirect(authUrl.toString(), 302);
  }

  // Step 2 — Meta redirects back here with ?code=... We exchange the code for
  // an access token using the app secret (server-side only), then persist the
  // ad account record for the authenticated user.
  if (action === "callback" && req.method === "GET") {
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const errorReason = url.searchParams.get("error_reason") ?? "authorization_failed";
    const stateParam = url.searchParams.get("state") ?? "";
    const appUrl = url.searchParams.get("app_url") ?? "/";

    if (error || !code) {
      return htmlResponse(
        `<!doctype html><html><body><script>window.opener?.postMessage({type:'meta-oauth',success:false,error:'${errorReason}'},'${appUrl}');window.close();</script></body></html>`,
      );
    }
    if (!META_APP_ID || !META_APP_SECRET || !REDIRECT_URI || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return htmlResponse(
        `<!doctype html><html><body><script>window.opener?.postMessage({type:'meta-oauth',success:false,error:'not_configured'},'*');window.close();</script></body></html>`,
      );
    }

    // Exchange the code for a user access token.
    const tokenRes = await fetch("https://graph.facebook.com/v19.0/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        redirect_uri: REDIRECT_URI,
        code,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      return htmlResponse(
        `<!doctype html><html><body><script>window.opener?.postMessage({type:'meta-oauth',success:false,error:'token_exchange_failed'},'*');window.close();</script></body></html>`,
      );
    }

    const accessToken = tokenData.access_token as string;
    const grantedScopes = (tokenData.scope as string ?? "").split(",").filter(Boolean);

    // Fetch the user's ad accounts.
    const accountsRes = await fetch(
      `https://graph.facebook.com/v19.0/me/adaccounts?fields=id,name,account_id,currency&limit=100&access_token=${accessToken}`,
    );
    const accountsData = await accountsRes.json();
    const accounts: Array<{ id: string; name: string; account_id: string; currency: string }> =
      accountsData.data ?? [];

    // Decode the user id from the state token (we pass it during connect).
    const userId = stateParam;
    if (!userId) {
      return htmlResponse(
        `<!doctype html><html><body><script>window.opener?.postMessage({type:'meta-oauth',success:false,error:'missing_user'},'*');window.close();</script></body></html>`,
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    if (accounts.length > 0) {
      const rows = accounts.map((acc) => ({
        user_id: userId,
        platform: "meta",
        platform_account_id: acc.account_id ?? acc.id,
        platform_account_name: acc.name ?? acc.account_id,
        scopes: grantedScopes,
        status: "connected",
      }));
      await supabase.from("ad_accounts").insert(rows);
    } else {
      await supabase.from("ad_accounts").insert({
        user_id: userId,
        platform: "meta",
        platform_account_id: null,
        platform_account_name: "Conta Meta",
        scopes: grantedScopes,
        status: "connected",
      });
    }

    return htmlResponse(
      `<!doctype html><html><body><script>window.opener?.postMessage({type:'meta-oauth',success:true},'${appUrl}');window.close();</script></body></html>`,
    );
  }

  return jsonResponse({ error: "not_found" }, 404);
});

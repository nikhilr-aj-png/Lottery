import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-nowpayments-sig",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SUPPORTED_PAY_CURRENCY = "usdttrc20";
const SUPPORTED_NETWORK = "TRC-20";
const MIN_DEPOSIT_USDT = 20;
const MAX_DEPOSIT_USDT = 500;

async function verifyNowPaymentsSignature(payloadText: string, signature: string | null, ipnSecret: string): Promise<boolean> {
  if (!signature || !ipnSecret) return false;
  try {
    const data = JSON.parse(payloadText);
    const sortObject = (obj: Record<string, unknown>): Record<string, unknown> => {
      return Object.keys(obj)
        .sort()
        .reduce((result: Record<string, unknown>, key: string) => {
          const val = obj[key];
          result[key] = val && typeof val === "object" && !Array.isArray(val)
            ? sortObject(val as Record<string, unknown>)
            : val;
          return result;
        }, {});
    };

    const sortedJson = JSON.stringify(sortObject(data));
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(ipnSecret),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );
    const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(sortedJson));
    const computedHex = Array.from(new Uint8Array(sigBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return computedHex.toLowerCase() === signature.toLowerCase();
  } catch (err) {
    console.error("HMAC Verification error:", err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/\/$/, "");

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const nowPaymentsApiKey = Deno.env.get("NOWPAYMENTS_API_KEY") ?? "";
  const nowPaymentsIpnSecret = Deno.env.get("NOWPAYMENTS_IPN_SECRET") ?? "";
  const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://earnflow.in";

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response(JSON.stringify({ error: "Server configuration incomplete." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // -------------------------------------------------------------------------
    // ROUTE 1: Create USDT (TRC-20) Deposit Order via NOWPayments
    // Security: Requires verified JWT Bearer token + strict usdttrc20 validation
    // -------------------------------------------------------------------------
    if (path.endsWith("/create-nowpayments-invoice") && req.method === "POST") {
      const authHeader = req.headers.get("authorization") || "";
      const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!jwt) {
        return new Response(JSON.stringify({ error: "Authentication required to create a deposit." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
      if (userErr || !userData?.user?.id) {
        return new Response(JSON.stringify({ error: "Invalid or expired user session." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const authenticatedUserId = userData.user.id;
      const body = await req.json();
      const rawAmount = Number(body?.amount);
      const requestedCurrency = String(body?.payCurrency || SUPPORTED_PAY_CURRENCY).trim().toLowerCase();
      const requestedNetwork = body?.network ? String(body.network).trim().toUpperCase().replace(/[-_\s]/g, "") : "TRC20";

      // Strict Server-Side Asset & Network Enforcement
      if (requestedCurrency !== SUPPORTED_PAY_CURRENCY) {
        return new Response(
          JSON.stringify({
            error: `Unsupported asset/currency '${requestedCurrency}'. Only USDT on TRON (${SUPPORTED_NETWORK}) is supported.`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!["TRC20", "USDTTRC20", "TRONTRC20"].includes(requestedNetwork)) {
        return new Response(
          JSON.stringify({
            error: `Unsupported network '${body?.network}'. Only TRON (${SUPPORTED_NETWORK}) is supported.`,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!Number.isFinite(rawAmount) || rawAmount < MIN_DEPOSIT_USDT || rawAmount > MAX_DEPOSIT_USDT) {
        return new Response(
          JSON.stringify({ error: `Deposit amount must be between ${MIN_DEPOSIT_USDT} and ${MAX_DEPOSIT_USDT} USDT.` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const amount = Math.round(rawAmount * 100) / 100;

      // Backend rate limiting via atomic Postgres bucket (max 10 deposit creations per 5 min/user)
      const { data: rateRes } = await supabaseAdmin.rpc("_check_rate_limit", {
        p_bucket_key: `dep_create_${authenticatedUserId}`,
        p_max_hits: 10,
        p_window_seconds: 300,
      });
      if (rateRes && rateRes.allowed === false) {
        return new Response(
          JSON.stringify({ error: "Too many deposit requests created recently. Please wait a few minutes." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!nowPaymentsApiKey) {
        return new Response(JSON.stringify({ error: "NOWPayments API key not configured on server." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Resolve authoritative wallet address belonging to authenticated user
      const { data: walletRow } = await supabaseAdmin
        .from("lottery_wallets")
        .select("address")
        .eq("user_id", authenticatedUserId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: profileRow } = await supabaseAdmin
        .from("profiles")
        .select("trc20_address")
        .eq("id", authenticatedUserId)
        .maybeSingle();

      const verifiedUserAddress =
        walletRow?.address || profileRow?.trc20_address || (body?.userAddress ? String(body.userAddress) : "");

      const orderId = `dep_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const npRes = await fetch("https://api.nowpayments.io/v1/payment", {
        method: "POST",
        headers: {
          "x-api-key": nowPaymentsApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          price_amount: amount,
          price_currency: "usd",
          pay_currency: SUPPORTED_PAY_CURRENCY,
          order_id: orderId,
          order_description: `EarnFlow.in Deposit - ${amount} USDT (TRC-20)`,
          ipn_callback_url: `${supabaseUrl}/functions/v1/payment-api/webhook/nowpayments`,
          success_url: `${frontendUrl}/?deposit=success`,
          cancel_url: `${frontendUrl}/?deposit=cancelled`,
        }),
      });

      const npData = await npRes.json();

      if (!npRes.ok) {
        console.error("NOWPayments error:", npData);
        return new Response(JSON.stringify({ error: npData.message || "Failed to generate TRC-20 payment order." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: dbErr } = await supabaseAdmin.from("lottery_deposits").insert({
        id: orderId,
        user_address: verifiedUserAddress,
        user_id: authenticatedUserId,
        amount,
        currency: "USDT",
        pay_currency: SUPPORTED_PAY_CURRENCY,
        payment_id: String(npData.payment_id),
        invoice_id: String(npData.payment_id),
        invoice_url: "",
        status: npData.payment_status || "waiting",
      });

      if (dbErr) {
        console.error("Failed to persist lottery_deposits row:", dbErr);
        return new Response(JSON.stringify({ error: "Failed to record deposit order in database." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(
        JSON.stringify({
          success: true,
          deposit_id: orderId,
          invoice_id: String(npData.payment_id),
          invoice_url: npData.invoice_url || "",
          orderId,
          paymentId: npData.payment_id,
          payAddress: npData.pay_address,
          payAmount: npData.pay_amount,
          payCurrency: SUPPORTED_PAY_CURRENCY,
          network: SUPPORTED_NETWORK,
          priceAmount: amount,
          expirationEstimateDate: npData.expiration_estimate_date,
          paymentStatus: npData.payment_status || "waiting",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -------------------------------------------------------------------------
    // ROUTE 2: Authenticated & Provider-Verified Deposit Status Check
    // -------------------------------------------------------------------------
    if (path.endsWith("/deposit-status") && (req.method === "GET" || req.method === "POST")) {
      const authHeader = req.headers.get("authorization") || "";
      const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
      if (!jwt) {
        return new Response(JSON.stringify({ error: "Authentication required." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(jwt);
      if (userErr || !userData?.user?.id) {
        return new Response(JSON.stringify({ error: "Invalid user session." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let paymentId = url.searchParams.get("paymentId");
      let orderId = url.searchParams.get("orderId") || url.searchParams.get("depositId");
      if (req.method === "POST") {
        try {
          const postBody = await req.json();
          paymentId = paymentId || (postBody?.paymentId ? String(postBody.paymentId) : null);
          orderId = orderId || (postBody?.orderId || postBody?.depositId ? String(postBody.orderId || postBody.depositId) : null);
        } catch {
          // ignore empty body
        }
      }

      if (!paymentId && !orderId) {
        return new Response(JSON.stringify({ error: "Missing paymentId or orderId." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: depRow } = await supabaseAdmin
        .from("lottery_deposits")
        .select("*")
        .eq(orderId ? "id" : "payment_id", orderId || paymentId)
        .maybeSingle();

      if (!depRow) {
        return new Response(JSON.stringify({ error: "Deposit order not found." }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Authorization check: owner or admin only
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .maybeSingle();
      const isAdminUser = prof?.role === "admin" || prof?.role === "super_admin";
      if (depRow.user_id !== userData.user.id && !isAdminUser) {
        return new Response(JSON.stringify({ error: "Forbidden." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Rate-limit live status polls against NOWPayments API
      const { data: rateRes } = await supabaseAdmin.rpc("_check_rate_limit", {
        p_bucket_key: `dep_poll_${userData.user.id}`,
        p_max_hits: 30,
        p_window_seconds: 60,
      });

      const resolvedPid = paymentId || depRow.payment_id;
      if (resolvedPid && nowPaymentsApiKey && (!rateRes || rateRes.allowed !== false) && depRow.status !== "finished") {
        const npRes = await fetch(`https://api.nowpayments.io/v1/payment/${resolvedPid}`, {
          headers: { "x-api-key": nowPaymentsApiKey },
        });

        if (npRes.ok) {
          const npData = await npRes.json();
          const newStatus = String(npData.payment_status || "").toLowerCase();
          if (newStatus && newStatus !== depRow.status) {
            await supabaseAdmin.rpc("process_confirmed_deposit_secure", {
              p_deposit_id: depRow.id,
              p_payment_id: String(npData.payment_id || resolvedPid),
              p_status: newStatus,
              p_paid_amount: Number(npData.actually_paid ?? npData.outcome_amount ?? depRow.amount),
              p_pay_currency: String(npData.pay_currency || depRow.pay_currency),
              p_price_currency: String(npData.price_currency || "usd"),
              p_raw_payload: npData,
            });
          }

          return new Response(
            JSON.stringify({
              status: newStatus || depRow.status,
              actuallyPaid: npData.actually_paid,
              payCurrency: npData.pay_currency,
              network: SUPPORTED_NETWORK,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      return new Response(
        JSON.stringify({
          status: depRow.status,
          payCurrency: depRow.pay_currency,
          network: SUPPORTED_NETWORK,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // -------------------------------------------------------------------------
    // ROUTE 3: Authenticated NOWPayments IPN Webhook (Atomic Ledger + 1st Deposit Bonus)
    // -------------------------------------------------------------------------
    if (path.endsWith("/webhook/nowpayments") && req.method === "POST") {
      const sig = req.headers.get("x-nowpayments-sig");
      const rawBody = await req.text();

      const isValid = await verifyNowPaymentsSignature(rawBody, sig, nowPaymentsIpnSecret);
      if (!isValid) {
        console.warn("Invalid IPN webhook signature received!");
        return new Response(JSON.stringify({ error: "Invalid IPN signature" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const payload = JSON.parse(rawBody);
      const orderId = payload.order_id ? String(payload.order_id) : null;
      const paymentId = payload.payment_id ? String(payload.payment_id) : null;
      const paymentStatus = String(payload.payment_status || "").toLowerCase();
      const payCurrency = String(payload.pay_currency || "").toLowerCase();
      const priceCurrency = String(payload.price_currency || "usd").toLowerCase();
      const paidAmount = Number(payload.outcome_amount || payload.actually_paid || payload.price_amount || 0);

      console.log(`Webhook IPN verified -> order: ${orderId}, payment: ${paymentId}, status: ${paymentStatus}, pay_currency: ${payCurrency}`);

      const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc("process_confirmed_deposit_secure", {
        p_deposit_id: orderId,
        p_payment_id: paymentId,
        p_status: paymentStatus,
        p_paid_amount: paidAmount,
        p_pay_currency: payCurrency,
        p_price_currency: priceCurrency,
        p_raw_payload: payload,
      });

      if (rpcErr) {
        console.error("process_confirmed_deposit_secure RPC error:", rpcErr);
        return new Response(JSON.stringify({ error: rpcErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (rpcRes && rpcRes.success === false) {
        console.warn("Deposit webhook rejected/flagged:", rpcRes);
        return new Response(JSON.stringify({ received: true, processed: false, details: rpcRes }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ received: true, processed: true, result: rpcRes }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    console.error("Edge Function Exception:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

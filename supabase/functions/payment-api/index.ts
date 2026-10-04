// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type JsonRecord = Record<string, unknown>

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-nowpayments-sig',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

const jsonResponse = (body: JsonRecord, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })

/**
 * Verifies NOWPayments IPN signature using standard Web Crypto HMAC-SHA512.
 * Pure Web API compliant (runs natively in Deno/Edge Functions without Node dependencies).
 */
async function verifyNowPaymentsSignature(payload: JsonRecord, signature: string | null, ipnSecret: string): Promise<boolean> {
  if (!signature || !ipnSecret) return false

  try {
    // Sort keys alphabetically and stringify
    const sortedPayload = Object.keys(payload)
      .sort()
      .reduce<JsonRecord>((obj, key) => {
        obj[key] = payload[key]
        return obj
      }, {})

    const payloadStr = JSON.stringify(sortedPayload)
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(ipnSecret),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    )
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadStr))
    const hexSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    // Constant-time string comparison
    if (hexSignature.length !== signature.length) return false
    let mismatch = 0
    for (let i = 0; i < hexSignature.length; i++) {
      mismatch |= hexSignature.charCodeAt(i) ^ signature.charCodeAt(i)
    }
    return mismatch === 0
  } catch (err) {
    console.error('Error verifying signature:', err)
    return false
  }
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const path = url.pathname

    // Route: Health Check
    if (path.endsWith('/health')) {
      return jsonResponse({
        status: 'OK',
        service: 'EarnFlow.In USDT Lottery Payment API (NOWPayments)',
        timestamp: new Date().toISOString(),
      })
    }

    // Initialize Supabase Client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Route: Create NOWPayments Crypto Invoice
    if (path.endsWith('/create-nowpayments-invoice') && req.method === 'POST') {
      try {
        const body = await req.json()
        const {
          amount,
          userAddress,
          userId,
          payCurrency = 'usdttrc20',
        } = body

        if (!amount || Number(amount) <= 0) {
          return jsonResponse({ success: false, error: 'A valid amount is required' }, 400)
        }

        const nowpaymentsApiKey = Deno.env.get('NOWPAYMENTS_API_KEY') ?? ''
        const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'https://earnflow.in'
        const apiUrl = Deno.env.get('API_URL') ?? 'https://earnflow.in'

        if (!nowpaymentsApiKey) {
          return jsonResponse({ success: false, error: 'NOWPayments API key is not configured' }, 500)
        }

        const depositId = `dep_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
        const numAmount = Number(amount)

        // Pre-create deposit entry in Supabase
        const { error: dbInsertError } = await supabase
          .from('lottery_deposits')
          .insert({
            id: depositId,
            user_address: userAddress || null,
            user_id: userId || null,
            amount: numAmount,
            currency: 'USDT',
            pay_currency: payCurrency,
            status: 'waiting',
          })

        if (dbInsertError) {
          console.error('Database insert error:', dbInsertError)
        }

        const payload = {
          price_amount: numAmount,
          price_currency: 'usd',
          pay_currency: payCurrency,
          order_id: depositId,
          order_description: `EarnFlow.In USDT Deposit - ${depositId}`,
          ipn_callback_url: `${apiUrl}/functions/v1/payment-api/webhook/nowpayments`,
          success_url: `${frontendUrl}/?deposit_status=success&deposit_id=${depositId}`,
          cancel_url: `${frontendUrl}/?deposit_status=cancelled&deposit_id=${depositId}`,
        }

        const npRes = await fetch('https://api.nowpayments.io/v1/invoice', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': nowpaymentsApiKey,
          },
          body: JSON.stringify(payload),
        })

        const data = await npRes.json()

        if (!npRes.ok) {
          console.error('NOWPayments API Error:', data)
          return jsonResponse({ success: false, error: data.message || 'NOWPayments error' }, 400)
        }

        // Update with invoice details
        await supabase
          .from('lottery_deposits')
          .update({
            invoice_id: data.id ? String(data.id) : null,
            invoice_url: data.invoice_url || null,
          })
          .eq('id', depositId)

        return jsonResponse({
          success: true,
          deposit_id: depositId,
          invoice_url: data.invoice_url,
          invoice_id: data.id,
        })
      } catch (err: unknown) {
        console.error('Create NOWPayments Invoice Error:', err)
        return jsonResponse({
          success: false,
          error: err instanceof Error ? err.message : 'Internal server error',
        }, 500)
      }
    }

    // Route: NOWPayments Webhook IPN Handler
    if (path.endsWith('/webhook/nowpayments') && req.method === 'POST') {
      try {
        const body = await req.json()
        const {
          payment_status,
          order_id,
          payment_id,
          price_amount,
          actually_paid,
        } = body

        console.log(`NOWPayments IPN received: order=${order_id}, status=${payment_status}, payment_id=${payment_id}`)

        const signature = req.headers.get('x-nowpayments-sig')
        const ipnSecret = Deno.env.get('NOWPAYMENTS_IPN_SECRET') ?? ''

        if (ipnSecret) {
          const isValid = await verifyNowPaymentsSignature(body, signature, ipnSecret)
          if (!isValid) {
            console.error('NOWPayments Webhook: Invalid or Missing Signature')
            return jsonResponse({ error: 'Unauthorized: Invalid signature' }, 401)
          }
        } else {
          console.error('NOWPayments Webhook: IPN Secret is not configured. Refusing webhook.')
          return jsonResponse({ error: 'NOWPayments IPN secret is not configured' }, 500)
        }

        // Handle confirmed/finished payment
        if (payment_status === 'finished' || payment_status === 'confirmed') {
          const { data: deposit, error: fetchError } = await supabase
            .from('lottery_deposits')
            .select('*')
            .eq('id', order_id)
            .single()

          if (fetchError || !deposit) {
            console.error('NOWPayments Webhook: deposit not found for order_id', order_id)
            return new Response('OK', { headers: corsHeaders, status: 200 })
          }

          // Idempotency: avoid double-crediting
          if (deposit.status === 'finished') {
            console.log('NOWPayments Webhook: deposit already processed, skipping', order_id)
            return new Response('OK', { headers: corsHeaders, status: 200 })
          }

          // Mark deposit as finished
          const creditAmount = Number(actually_paid || price_amount || deposit.amount)

          await supabase
            .from('lottery_deposits')
            .update({
              status: 'finished',
              payment_id: String(payment_id),
              updated_at: new Date().toISOString(),
            })
            .eq('id', order_id)

          // Credit the wallet
          const walletAddr = deposit.user_address || '0x71C...49A2'
          const { data: wallet } = await supabase
            .from('lottery_wallets')
            .select('balance')
            .eq('address', walletAddr)
            .single()

          if (wallet) {
            const newBal = Number(wallet.balance || 0) + creditAmount
            await supabase
              .from('lottery_wallets')
              .update({ balance: newBal, updated_at: new Date().toISOString() })
              .eq('address', walletAddr)
          } else {
            await supabase
              .from('lottery_wallets')
              .insert({
                address: walletAddr,
                balance: creditAmount,
                network: 'TRC-20',
              })
          }

          console.log(`Successfully credited ${creditAmount} USDT to wallet ${walletAddr}`)
        } else if (['waiting', 'confirming', 'failed', 'expired', 'refunded'].includes(payment_status)) {
          // Update status in deposits table
          await supabase
            .from('lottery_deposits')
            .update({
              status: payment_status,
              updated_at: new Date().toISOString(),
            })
            .eq('id', order_id)
        }

        return new Response('OK', { headers: corsHeaders, status: 200 })
      } catch (err: unknown) {
        console.error('NOWPayments Webhook Error:', err)
        return new Response('Received with Errors', { headers: corsHeaders, status: 200 })
      }
    }

    // Route: Check Deposit Status
    if (path.endsWith('/deposit-status') && req.method === 'POST') {
      const { depositId } = await req.json()
      if (!depositId) {
        return jsonResponse({ success: false, error: 'depositId is required' }, 400)
      }

      const { data: deposit, error } = await supabase
        .from('lottery_deposits')
        .select('*')
        .eq('id', depositId)
        .single()

      if (error || !deposit) {
        return jsonResponse({ success: false, error: 'Deposit not found' }, 404)
      }

      return jsonResponse({ success: true, deposit })
    }

    return jsonResponse({ error: 'Not found' }, 404)
  } catch (err: unknown) {
    console.error('Error handling request:', err)
    return jsonResponse({
      success: false,
      error: err instanceof Error ? err.message : 'Internal server error',
    }, 500)
  }
})

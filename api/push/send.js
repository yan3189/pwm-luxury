// api/push/send.js
// Vercel Serverless Function untuk mengirim push notification

const webpush = require('web-push'); // Jangan lupa install: npm install web-push
const { createClient } = require('@supabase/supabase-js');

// Inisialisasi web-push dengan environment variables
const vapidKeys = {
  publicKey: process.env.VITE_VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
};

webpush.setVapidDetails(
  'mailto:' + (process.env.VAPID_EMAIL || 'admin@pwm-luxury.vercel.app'),
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

// Supabase admin client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Pastikan ada di environment variables
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user_id, type, title, message, data } = req.body;
  if (!user_id || !title || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Ambil subscription user dari database
    const { data: subscriptionData, error: subError } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', user_id)
      .single();

    if (subError || !subscriptionData) {
      console.log(`No subscription found for user ${user_id}`);
      return res.status(200).json({ success: false, reason: 'no subscription' });
    }

    const subscription = subscriptionData.subscription;

    // Kirim push notification
    const pushPayload = JSON.stringify({
      title,
      body: message,
      data: { ...data, type },
    });

    await webpush.sendNotification(subscription, pushPayload);
    console.log(`Push sent to user ${user_id}`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Push error:', error);
    res.status(500).json({ error: error.message });
  }
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};
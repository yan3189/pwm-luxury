// api/admin/create-user.js
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password, full_name, phone, role, store_id } = req.body;

    console.log('📝 Creating user with email:', email);

    if (!email || !password || !full_name || !role || !store_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // ============================================================
    // 1. BUAT USER DI AUTH
    // ============================================================
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: full_name,
        phone: phone || '',
        role: role,
        store_id: store_id
      }
    });

    if (authError) {
      console.error('❌ Auth error:', authError);
      return res.status(400).json({
        success: false,
        error: 'Gagal membuat user di Auth: ' + authError.message
      });
    }

    const userId = authData.user.id;
    console.log('✅ Auth user created:', userId);

    // ============================================================
    // 2. CEK APAKAH USER SUDAH ADA DI TABEL USERS (OTOMATIS DARI TRIGGER)
    // ============================================================
    const { data: existingUser, error: checkError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (existingUser) {
      // ✅ UPDATE DATA YANG SUDAH ADA (JANGAN INSERT LAGI!)
      console.log('✅ User already exists in users table (trigger), updating...');
      
      const { error: updateError } = await supabaseAdmin
        .from('users')
        .update({
          email: email,
          full_name: full_name,
          phone: phone || '',
          role: role,
          store_id: store_id,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        console.error('❌ Update error:', updateError);
        // Hapus user dari Auth karena update gagal
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return res.status(400).json({
          success: false,
          error: 'Gagal mengupdate data user: ' + updateError.message
        });
      }

      console.log('✅ User updated successfully!');

      return res.status(200).json({
        success: true,
        message: 'User updated successfully (trigger created)',
        user: {
          id: userId,
          email: email,
          full_name: full_name,
          role: role,
          store_id: store_id
        }
      });
    }

    // ============================================================
    // 3. JIKA TIDAK ADA, INSERT MANUAL
    // ============================================================
    console.log('📝 Inserting into users table (manual)...');

    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert([{
        id: userId,
        email: email,
        full_name: full_name,
        phone: phone || '',
        role: role,
        store_id: store_id,
        created_at: new Date().toISOString()
      }]);

    if (userError) {
      console.error('❌ Users table error:', userError);
      
      // Rollback: hapus user dari Auth
      await supabaseAdmin.auth.admin.deleteUser(userId);
      
      return res.status(400).json({
        success: false,
        error: 'Gagal menyimpan data user: ' + userError.message
      });
    }

    console.log('✅ User created successfully!');

    res.status(200).json({
      success: true,
      message: 'User created successfully',
      user: {
        id: userId,
        email: email,
        full_name: full_name,
        role: role,
        store_id: store_id
      }
    });

  } catch (error) {
    console.error('❌ Error creating user:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create user'
    });
  }
}
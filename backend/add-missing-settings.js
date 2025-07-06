const db = require('./db');

async function addMissingSettings() {
  try {
    const client = await db.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Add missing settings
      const missingSettings = [
        {
          key: 'site_logo',
          value: '',
          type: 'string',
          description: 'URL of the site logo',
          is_public: true
        },
        {
          key: 'new_arrivals_days',
          value: '30',
          type: 'number',
          description: 'Number of days to consider products as "new arrivals"',
          is_public: true
        }
      ];
      
      for (const setting of missingSettings) {
        // Check if setting already exists
        const existing = await client.query(
          'SELECT setting_key FROM site_settings WHERE setting_key = $1',
          [setting.key]
        );
        
        if (existing.rows.length === 0) {
          await client.query(`
            INSERT INTO site_settings (setting_key, setting_value, setting_type, setting_description, is_public)
            VALUES ($1, $2, $3, $4, $5)
          `, [setting.key, setting.value, setting.type, setting.description, setting.is_public]);
          
          console.log(`Added setting: ${setting.key}`);
        } else {
          console.log(`Setting already exists: ${setting.key}`);
        }
      }
      
      await client.query('COMMIT');
      console.log('Missing settings added successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error adding missing settings:', error);
  } finally {
    process.exit(0);
  }
}

addMissingSettings(); 
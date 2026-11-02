const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const envPath = fs.existsSync(path.join(__dirname, '..', '..', '.env'))
  ? path.join(__dirname, '..', '..', '.env')
  : path.join(__dirname, '.env');
require('dotenv').config({ path: envPath });

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'ridezone',
    port: Number(process.env.DB_PORT) || 3306
  });

  console.log('[MySQL] Connected to database.');

  const vehiclesToSync = [
    {
      id: 1,
      name: "Ather 450X",
      brand: "Ather",
      image: "/assets/ather.png",
      gallery: ["/assets/ather.png", "/assets/ather-2.png", "/assets/ather-3.png"]
    },
    {
      id: 2,
      name: "Honda Activa 6G",
      brand: "Honda",
      image: "/assets/honda.png",
      gallery: ["/assets/honda.png", "/assets/honda-2.png", "/assets/honda-3.png"]
    },
    {
      id: 3,
      name: "Yamaha MT-15 V2",
      brand: "Yamaha",
      image: "/assets/yamaha.png",
      gallery: ["/assets/yamaha.png", "/assets/yamaha-2.png", "/assets/yamaha-3.png"]
    },
    {
      id: 4,
      name: "KTM RC 390",
      brand: "KTM",
      image: "/assets/ktm.png",
      gallery: ["/assets/ktm.png", "/assets/ktm-2.png", "/assets/ktm-3.png"]
    },
    {
      id: 5,
      name: "Bajaj Pulsar NS200",
      brand: "Bajaj",
      image: "/assets/bajaj.png",
      gallery: ["/assets/bajaj.png", "/assets/bajaj-2.png", "/assets/bajaj-3.png"]
    },
    {
      id: 6,
      name: "Royal Enfield Hunter 350",
      brand: "Royal Enfield",
      image: "/assets/hunter.png",
      gallery: ["/assets/hunter.png", "/assets/hunter-2.png", "/assets/hunter-3.png"]
    },
    {
      id: 7,
      name: "TVS Apache RTR 160 4V",
      brand: "TVS",
      image: "/assets/tvs.png",
      gallery: ["/assets/tvs.png", "/assets/tvs-2.png", "/assets/tvs-3.png"]
    },
    {
      id: 8,
      name: "Suzuki Access 125",
      brand: "Suzuki",
      image: "/assets/suzuki.png",
      gallery: ["/assets/suzuki.png", "/assets/suzuki-2.png", "/assets/suzuki-3.png"]
    },
    {
      id: 9,
      name: "Kawasaki Ninja 300",
      brand: "Kawasaki",
      image: "/assets/kawasaki.png",
      gallery: ["/assets/kawasaki.png", "/assets/kawasaki-2.png", "/assets/kawasaki-3.png"]
    }
  ];

  for (const v of vehiclesToSync) {
    await conn.query(
      `UPDATE vehicles 
       SET image = ?, gallery_json = ?
       WHERE id = ? OR name = ?`,
      [v.image, JSON.stringify(v.gallery), v.id, v.name]
    );
    console.log(`[Synced] ${v.name} -> Image: ${v.image}`);
  }

  const [vehicles] = await conn.query('SELECT id, name, brand, image, deposit_amount, vehicle_reg_no FROM vehicles ORDER BY id ASC');
  console.log('\n--- ALL AUTHORITATIVE VEHICLES IN MYSQL ---');
  console.table(vehicles);

  await conn.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});


// ============================================================
//  properti.js — Sistem Properti, Aset & KPK (Anti Korupsi)
// ============================================================
require("./config");
const cfg = global.botConfig;
const db  = require("./db");

// ══════════════════════════════════════════════════════════════
//  KATALOG PROPERTI
// ══════════════════════════════════════════════════════════════
const PROPERTI_CATALOG = [
  // KENDARAAN
  { id: "motor_bebek",           nama: "Motor Bebek",               emoji: "🛵", kategori: "kendaraan", harga: 3000,    income: 50,    sitaPermanen: false, dendaSita: 1500 },
  { id: "motor_matic",           nama: "Motor Matic",               emoji: "🛵", kategori: "kendaraan", harga: 4500,    income: 70,    sitaPermanen: false, dendaSita: 2200 },
  { id: "motor_sport",           nama: "Motor Sport",               emoji: "🏍️", kategori: "kendaraan", harga: 8000,    income: 120,   sitaPermanen: false, dendaSita: 4000 },
  { id: "ninja",                  nama: "Kawasaki Ninja",            emoji: "🏍️", kategori: "kendaraan", harga: 12000,   income: 170,   sitaPermanen: false, dendaSita: 6000 },
  { id: "yamaha_r6",              nama: "Yamaha R6",                 emoji: "🏍️", kategori: "kendaraan", harga: 18000,   income: 240,   sitaPermanen: false, dendaSita: 9000 },
  { id: "honda_cbr1000rr",        nama: "Honda CBR1000RR",           emoji: "🏍️", kategori: "kendaraan", harga: 25000,   income: 320,   sitaPermanen: false, dendaSita: 12500 },

  { id: "hatchback",              nama: "Mobil Hatchback",           emoji: "🚗", kategori: "kendaraan", harga: 10000,   income: 150,   sitaPermanen: false, dendaSita: 5000 },
  { id: "toyota_agya",            nama: "Toyota Agya",               emoji: "🚙", kategori: "kendaraan", harga: 12000,   income: 180,   sitaPermanen: false, dendaSita: 6000 },
  { id: "honda_brio",             nama: "Honda Brio",                emoji: "🚙", kategori: "kendaraan", harga: 13000,   income: 190,   sitaPermanen: false, dendaSita: 6500 },
  { id: "toyota_avanza",          nama: "Toyota Avanza",             emoji: "🚐", kategori: "kendaraan", harga: 16000,   income: 230,   sitaPermanen: false, dendaSita: 8000 },
  { id: "toyota_innova",          nama: "Toyota Innova",             emoji: "🚐", kategori: "kendaraan", harga: 24000,   income: 320,   sitaPermanen: false, dendaSita: 12000 },
  { id: "honda_civic",            nama: "Honda Civic",               emoji: "🚗", kategori: "kendaraan", harga: 26000,   income: 350,   sitaPermanen: false, dendaSita: 13000 },
  { id: "toyota_camry",           nama: "Toyota Camry",              emoji: "🚗", kategori: "kendaraan", harga: 32000,   income: 430,   sitaPermanen: false, dendaSita: 16000 },
  { id: "bmw_320i",               nama: "BMW 320i",                  emoji: "🚘", kategori: "kendaraan", harga: 40000,   income: 520,   sitaPermanen: false, dendaSita: 20000 },
  { id: "bmw_m3",                 nama: "BMW M3",                    emoji: "🏁", kategori: "kendaraan", harga: 70000,   income: 900,   sitaPermanen: false, dendaSita: 35000 },
  { id: "bmw_m4_competition",     nama: "BMW M4 Competition",        emoji: "🏁", kategori: "kendaraan", harga: 110000,  income: 1300,  sitaPermanen: false, dendaSita: 55000 },
  { id: "audi_rs5",               nama: "Audi RS5",                  emoji: "🏎️", kategori: "kendaraan", harga: 95000,   income: 1150,  sitaPermanen: false, dendaSita: 47500 },
  { id: "mercedes_c300",          nama: "Mercedes C300",             emoji: "🚘", kategori: "kendaraan", harga: 85000,   income: 1050,  sitaPermanen: false, dendaSita: 42500 },
  { id: "mercedes_e63_amg",       nama: "Mercedes E63 AMG",          emoji: "🏎️", kategori: "kendaraan", harga: 140000,  income: 1650,  sitaPermanen: false, dendaSita: 70000 },
  { id: "mercedes_amg_g63",       nama: "Mercedes AMG G63",          emoji: "🚙", kategori: "kendaraan", harga: 160000,  income: 1800,  sitaPermanen: false, dendaSita: 80000 },

  { id: "toyota_supra",           nama: "Toyota Supra",              emoji: "🏎️", kategori: "kendaraan", harga: 88000,   income: 1050,  sitaPermanen: false, dendaSita: 45000 },
  { id: "nissan_370z",            nama: "Nissan 370Z",               emoji: "🏎️", kategori: "kendaraan", harga: 76000,   income: 980,   sitaPermanen: false, dendaSita: 38000 },
  { id: "nissan_gtr",             nama: "Nissan GT-R",               emoji: "🏎️", kategori: "kendaraan", harga: 140000,  income: 1700,  sitaPermanen: false, dendaSita: 70000 },
  { id: "porsche_cayman",         nama: "Porsche Cayman",            emoji: "🏎️", kategori: "kendaraan", harga: 95000,   income: 1100,  sitaPermanen: false, dendaSita: 50000 },
  { id: "porsche_boxster",        nama: "Porsche Boxster",           emoji: "🏎️", kategori: "kendaraan", harga: 90000,   income: 1080,  sitaPermanen: false, dendaSita: 45000 },
  { id: "porsche_911_carrera",    nama: "Porsche 911 Carrera",       emoji: "🏎️", kategori: "kendaraan", harga: 125000,  income: 1450,  sitaPermanen: false, dendaSita: 65000 },
  { id: "porsche_911_turbo_s",    nama: "Porsche 911 Turbo S",       emoji: "🏎️", kategori: "kendaraan", harga: 175000,  income: 2000,  sitaPermanen: false, dendaSita: 87500 },
  { id: "corvette_c8",            nama: "Chevrolet Corvette C8",     emoji: "🏎️", kategori: "kendaraan", harga: 155000,  income: 1850,  sitaPermanen: false, dendaSita: 77500 },
  { id: "huracan",                nama: "Lamborghini Huracan",       emoji: "🔥", kategori: "kendaraan", harga: 240000,  income: 2600,  sitaPermanen: true,  dendaSita: 0 },
  { id: "aventador",              nama: "Lamborghini Aventador",     emoji: "🔥", kategori: "kendaraan", harga: 320000,  income: 3400,  sitaPermanen: true,  dendaSita: 0 },
  { id: "ferrari_488_gtb",        nama: "Ferrari 488 GTB",           emoji: "🟥", kategori: "kendaraan", harga: 260000,  income: 2800,  sitaPermanen: true,  dendaSita: 0 },
  { id: "ferrari_f8_tributo",     nama: "Ferrari F8 Tributo",        emoji: "🟥", kategori: "kendaraan", harga: 300000,  income: 3100,  sitaPermanen: true,  dendaSita: 0 },
  { id: "mclaren_720s",           nama: "McLaren 720S",              emoji: "🟠", kategori: "kendaraan", harga: 280000,  income: 3000,  sitaPermanen: true,  dendaSita: 0 },
  { id: "bugatti_chiron",         nama: "Bugatti Chiron",            emoji: "💠", kategori: "kendaraan", harga: 850000,  income: 7000,  sitaPermanen: true,  dendaSita: 0 },
  { id: "koenigsegg_jesko",       nama: "Koenigsegg Jesko",          emoji: "⚡", kategori: "kendaraan", harga: 950000,  income: 7800,  sitaPermanen: true,  dendaSita: 0 },
  { id: "rolls_royce_ghost",      nama: "Rolls-Royce Ghost",         emoji: "👑", kategori: "kendaraan", harga: 210000,  income: 2200,  sitaPermanen: false, dendaSita: 105000 },
  { id: "rolls_royce_phantom",    nama: "Rolls-Royce Phantom",       emoji: "👑", kategori: "kendaraan", harga: 350000,  income: 3600,  sitaPermanen: true,  dendaSita: 0 },
  { id: "bentley_continental_gt", nama: "Bentley Continental GT",    emoji: "✨", kategori: "kendaraan", harga: 240000,  income: 2500,  sitaPermanen: false, dendaSita: 120000 },
  { id: "heli_pribadi",           nama: "Helikopter Pribadi",        emoji: "🚁", kategori: "kendaraan", harga: 220000,  income: 2400,  sitaPermanen: true,  dendaSita: 0 },
  { id: "private_jet_vehicle",    nama: "Private Jet",               emoji: "✈️", kategori: "kendaraan", harga: 500000,  income: 5000,  sitaPermanen: true,  dendaSita: 0 },

  // PROPERTI
  { id: "kontrakan_kecil",        nama: "Kontrakan Kecil",           emoji: "🏚️", kategori: "properti",  harga: 8000,    income: 180,   sitaPermanen: false, dendaSita: 4000 },
  { id: "kos_4_kamar",            nama: "Kos 4 Kamar",               emoji: "🏠", kategori: "properti",  harga: 15000,   income: 400,   sitaPermanen: false, dendaSita: 8000 },
  { id: "kos_8_kamar",            nama: "Kos 8 Kamar",               emoji: "🏠", kategori: "properti",  harga: 22000,   income: 550,   sitaPermanen: false, dendaSita: 11000 },
  { id: "kos_16_kamar",           nama: "Kos 16 Kamar",              emoji: "🏠", kategori: "properti",  harga: 38000,   income: 780,   sitaPermanen: false, dendaSita: 19000 },
  { id: "rumah_subsidi",          nama: "Rumah Subsidi",             emoji: "🏡", kategori: "properti",  harga: 18000,   income: 380,   sitaPermanen: false, dendaSita: 9000 },
  { id: "rumah_minimalis",        nama: "Rumah Minimalis",           emoji: "🏡", kategori: "properti",  harga: 25000,   income: 500,   sitaPermanen: false, dendaSita: 12000 },
  { id: "rumah_cluster",          nama: "Rumah Cluster",             emoji: "🏘️", kategori: "properti",  harga: 42000,   income: 720,   sitaPermanen: false, dendaSita: 21000 },
  { id: "rumah_mewah",            nama: "Rumah Mewah",               emoji: "🏘️", kategori: "properti",  harga: 60000,   income: 950,   sitaPermanen: false, dendaSita: 30000 },
  { id: "townhouse",              nama: "Townhouse",                 emoji: "🏘️", kategori: "properti",  harga: 90000,   income: 1300,  sitaPermanen: false, dendaSita: 45000 },
  { id: "villa_pegunungan",       nama: "Villa Pegunungan",          emoji: "🏔️", kategori: "properti",  harga: 110000,  income: 1550,  sitaPermanen: false, dendaSita: 55000 },
  { id: "villa_pinggir_pantai",   nama: "Villa Pinggir Pantai",      emoji: "🏖️", kategori: "properti",  harga: 120000,  income: 1700,  sitaPermanen: false, dendaSita: 60000 },
  { id: "apartemen_studio",       nama: "Apartemen Studio",          emoji: "🏢", kategori: "properti",  harga: 30000,   income: 600,   sitaPermanen: false, dendaSita: 15000 },
  { id: "apartemen_2br",          nama: "Apartemen 2BR",             emoji: "🏙️", kategori: "properti",  harga: 50000,   income: 820,   sitaPermanen: false, dendaSita: 25000 },
  { id: "apartemen_penthouse",    nama: "Apartemen Penthouse",       emoji: "🌆", kategori: "properti",  harga: 180000,  income: 2400,  sitaPermanen: false, dendaSita: 90000 },
  { id: "ruko_1_lantai",          nama: "Ruko 1 Lantai",             emoji: "🏪", kategori: "properti",  harga: 35000,   income: 650,   sitaPermanen: false, dendaSita: 17500 },
  { id: "ruko_2_lantai",          nama: "Ruko 2 Lantai",             emoji: "🏬", kategori: "properti",  harga: 55000,   income: 900,   sitaPermanen: false, dendaSita: 27500 },
  { id: "ruko_3_lantai",          nama: "Ruko 3 Lantai",             emoji: "🏬", kategori: "properti",  harga: 80000,   income: 1200,  sitaPermanen: false, dendaSita: 40000 },
  { id: "gudang_kecil",           nama: "Gudang Kecil",              emoji: "📦", kategori: "properti",  harga: 40000,   income: 700,   sitaPermanen: false, dendaSita: 20000 },
  { id: "gudang_besar",           nama: "Gudang Besar",              emoji: "🏭", kategori: "properti",  harga: 85000,   income: 1300,  sitaPermanen: false, dendaSita: 42500 },
  { id: "gedung_perkantoran",     nama: "Gedung Perkantoran",        emoji: "🏢", kategori: "properti",  harga: 300000,  income: 4000,  sitaPermanen: true,  dendaSita: 0 },
  { id: "hotel_budget",           nama: "Hotel Budget",              emoji: "🏨", kategori: "properti",  harga: 70000,   income: 1200,  sitaPermanen: false, dendaSita: 35000 },
  { id: "hotel_bintang_3",        nama: "Hotel Bintang 3",           emoji: "🏨", kategori: "properti",  harga: 120000,  income: 1800,  sitaPermanen: false, dendaSita: 60000 },
  { id: "hotel_bintang_5",        nama: "Hotel Bintang 5",           emoji: "🏨", kategori: "properti",  harga: 220000,  income: 3000,  sitaPermanen: true,  dendaSita: 0 },
  { id: "mall_kecil",             nama: "Mall Kecil",                emoji: "🛍️", kategori: "properti",  harga: 180000,  income: 2500,  sitaPermanen: false, dendaSita: 90000 },
  { id: "mall_besar",             nama: "Mall Besar",                emoji: "🏬", kategori: "properti",  harga: 450000,  income: 5200,  sitaPermanen: true,  dendaSita: 0 },
  { id: "resort_wisata",          nama: "Resort Wisata",             emoji: "🏝️", kategori: "properti",  harga: 250000,  income: 3200,  sitaPermanen: true,  dendaSita: 0 },
  { id: "kawasan_industri",       nama: "Kawasan Industri",          emoji: "🏭", kategori: "properti",  harga: 500000,  income: 6000,  sitaPermanen: true,  dendaSita: 0 },
  { id: "komplek_perumahan",      nama: "Komplek Perumahan",         emoji: "🏘️", kategori: "properti",  harga: 180000,  income: 2300,  sitaPermanen: false, dendaSita: 90000 },
  { id: "istana_pribadi",         nama: "Istana Pribadi",            emoji: "🏰", kategori: "properti",  harga: 900000,  income: 9000,  sitaPermanen: true,  dendaSita: 0 },
  { id: "pulau_pribadi_prop",     nama: "Pulau Pribadi",             emoji: "🏝️", kategori: "properti",  harga: 800000,  income: 7000,  sitaPermanen: true,  dendaSita: 0 },

  // BISNIS
  { id: "warung_kopi",            nama: "Warung Kopi",               emoji: "☕", kategori: "bisnis",     harga: 4000,    income: 120,   sitaPermanen: false, dendaSita: 2000 },
  { id: "warung_makan",           nama: "Warung Makan",              emoji: "🍜", kategori: "bisnis",     harga: 5000,    income: 150,   sitaPermanen: false, dendaSita: 2500 },
  { id: "angkringan",             nama: "Angkringan",                emoji: "🍢", kategori: "bisnis",     harga: 6000,    income: 160,   sitaPermanen: false, dendaSita: 3000 },
  { id: "toko_kelontong",         nama: "Toko Kelontong",            emoji: "🏪", kategori: "bisnis",     harga: 8000,    income: 180,   sitaPermanen: false, dendaSita: 4000 },
  { id: "laundry",                nama: "Laundry",                   emoji: "🧺", kategori: "bisnis",     harga: 10000,   income: 220,   sitaPermanen: false, dendaSita: 5000 },
  { id: "barbershop",             nama: "Barbershop",                emoji: "✂️", kategori: "bisnis",     harga: 12000,   income: 250,   sitaPermanen: false, dendaSita: 6000 },
  { id: "warnet",                 nama: "Warnet",                    emoji: "🖥️", kategori: "bisnis",     harga: 15000,   income: 300,   sitaPermanen: false, dendaSita: 7500 },
  { id: "rental_ps",              nama: "Rental PS",                 emoji: "🎮", kategori: "bisnis",     harga: 15000,   income: 320,   sitaPermanen: false, dendaSita: 7500 },
  { id: "cafe_kekinian",          nama: "Cafe Kekinian",             emoji: "☕", kategori: "bisnis",     harga: 25000,   income: 600,   sitaPermanen: false, dendaSita: 12000 },
  { id: "bakery",                 nama: "Bakery",                    emoji: "🥐", kategori: "bisnis",     harga: 22000,   income: 500,   sitaPermanen: false, dendaSita: 11000 },
  { id: "restoran_cepat_saji",    nama: "Restoran Cepat Saji",       emoji: "🍔", kategori: "bisnis",     harga: 45000,   income: 800,   sitaPermanen: false, dendaSita: 22500 },
  { id: "restoran_jepang",        nama: "Restoran Jepang",           emoji: "🍣", kategori: "bisnis",     harga: 55000,   income: 900,   sitaPermanen: false, dendaSita: 27500 },
  { id: "restoran_steak",         nama: "Restoran Steak",            emoji: "🥩", kategori: "bisnis",     harga: 65000,   income: 1000,  sitaPermanen: false, dendaSita: 32500 },
  { id: "bengkel_motor",          nama: "Bengkel Motor",             emoji: "🔧", kategori: "bisnis",     harga: 25000,   income: 500,   sitaPermanen: false, dendaSita: 12500 },
  { id: "bengkel_mobil",          nama: "Bengkel Mobil",             emoji: "🛠️", kategori: "bisnis",     harga: 40000,   income: 850,   sitaPermanen: false, dendaSita: 20000 },
  { id: "dealer_motor",           nama: "Dealer Motor",              emoji: "🏍️", kategori: "bisnis",     harga: 45000,   income: 900,   sitaPermanen: false, dendaSita: 22500 },
  { id: "dealer_mobil",           nama: "Dealer Mobil",              emoji: "🚘", kategori: "bisnis",     harga: 70000,   income: 1200,  sitaPermanen: false, dendaSita: 35000 },
  { id: "showroom_mewah",         nama: "Showroom Mobil Mewah",      emoji: "✨", kategori: "bisnis",     harga: 120000,  income: 1800,  sitaPermanen: false, dendaSita: 60000 },
  { id: "minimarket",             nama: "Minimarket",                emoji: "🏪", kategori: "bisnis",     harga: 35000,   income: 700,   sitaPermanen: false, dendaSita: 17000 },
  { id: "supermarket",            nama: "Supermarket",               emoji: "🛒", kategori: "bisnis",     harga: 90000,   income: 1400,  sitaPermanen: false, dendaSita: 45000 },
  { id: "toko_elektronik",        nama: "Toko Elektronik",           emoji: "📺", kategori: "bisnis",     harga: 50000,   income: 900,   sitaPermanen: false, dendaSita: 25000 },
  { id: "toko_hp",                nama: "Toko HP",                   emoji: "📱", kategori: "bisnis",     harga: 45000,   income: 850,   sitaPermanen: false, dendaSita: 22500 },
  { id: "toko_komputer",          nama: "Toko Komputer",             emoji: "💻", kategori: "bisnis",     harga: 65000,   income: 1100,  sitaPermanen: false, dendaSita: 32500 },
  { id: "percetakan",             nama: "Percetakan",                emoji: "🖨️", kategori: "bisnis",     harga: 30000,   income: 650,   sitaPermanen: false, dendaSita: 15000 },
  { id: "apotek",                 nama: "Apotek",                    emoji: "💊", kategori: "bisnis",     harga: 60000,   income: 1000,  sitaPermanen: false, dendaSita: 30000 },
  { id: "klinik",                 nama: "Klinik",                    emoji: "🏥", kategori: "bisnis",     harga: 85000,   income: 1400,  sitaPermanen: false, dendaSita: 42500 },
  { id: "gym",                    nama: "Gym",                       emoji: "🏋️", kategori: "bisnis",     harga: 55000,   income: 900,   sitaPermanen: false, dendaSita: 27500 },
  { id: "hotel_bisnis",           nama: "Hotel",                     emoji: "🏨", kategori: "bisnis",     harga: 120000,  income: 1800,  sitaPermanen: false, dendaSita: 60000 },
  { id: "spbu",                   nama: "SPBU",                      emoji: "⛽", kategori: "bisnis",     harga: 140000,  income: 2000,  sitaPermanen: false, dendaSita: 70000 },
  { id: "perusahaan_logistik",    nama: "Perusahaan Logistik",       emoji: "🚚", kategori: "bisnis",     harga: 160000,  income: 2200,  sitaPermanen: false, dendaSita: 80000 },
  { id: "perusahaan_bus",         nama: "Perusahaan Bus",            emoji: "🚌", kategori: "bisnis",     harga: 180000,  income: 2500,  sitaPermanen: false, dendaSita: 90000 },
  { id: "perusahaan_taksi",       nama: "Perusahaan Taksi",          emoji: "🚕", kategori: "bisnis",     harga: 140000,  income: 1900,  sitaPermanen: false, dendaSita: 70000 },
  { id: "pabrik_makanan",         nama: "Pabrik Makanan",            emoji: "🏭", kategori: "bisnis",     harga: 200000,  income: 2800,  sitaPermanen: true,  dendaSita: 0 },
  { id: "pabrik_tekstil",         nama: "Pabrik Tekstil",            emoji: "🧵", kategori: "bisnis",     harga: 180000,  income: 2500,  sitaPermanen: true,  dendaSita: 0 },
  { id: "pabrik_otomotif",        nama: "Pabrik Otomotif",           emoji: "🚗", kategori: "bisnis",     harga: 320000,  income: 4200,  sitaPermanen: true,  dendaSita: 0 },
  { id: "startup_teknologi",      nama: "Startup Teknologi",         emoji: "💡", kategori: "bisnis",     harga: 140000,  income: 2100,  sitaPermanen: true,  dendaSita: 0 },
  { id: "data_center",            nama: "Data Center",               emoji: "🖧", kategori: "bisnis",     harga: 260000,  income: 3600,  sitaPermanen: true,  dendaSita: 0 },
  { id: "bank_cabang",            nama: "Bank Cabang",               emoji: "🏦", kategori: "bisnis",     harga: 200000,  income: 2800,  sitaPermanen: true,  dendaSita: 0 },
  { id: "bank_nasional",          nama: "Bank Nasional",             emoji: "🏛️", kategori: "bisnis",     harga: 450000,  income: 5500,  sitaPermanen: true,  dendaSita: 0 },
  { id: "bursa_saham",            nama: "Bursa Saham",               emoji: "📈", kategori: "bisnis",     harga: 600000,  income: 7200,  sitaPermanen: true,  dendaSita: 0 },

  // LUXURY / END GAME
  { id: "super_yacht",            nama: "Super Yacht",               emoji: "🛳️", kategori: "luxury",     harga: 250000,  income: 3500,  sitaPermanen: true,  dendaSita: 0 },
  { id: "mega_yacht",             nama: "Mega Yacht",                emoji: "🛳️", kategori: "luxury",     harga: 450000,  income: 5200,  sitaPermanen: true,  dendaSita: 0 },
  { id: "private_jet",            nama: "Private Jet",               emoji: "✈️", kategori: "luxury",     harga: 500000,  income: 5000,  sitaPermanen: true,  dendaSita: 0 },
  { id: "jet_gulfstream",         nama: "Jet Gulfstream",            emoji: "✈️", kategori: "luxury",     harga: 650000,  income: 6200,  sitaPermanen: true,  dendaSita: 0 },
  { id: "boeing_business_jet",    nama: "Boeing Business Jet",       emoji: "✈️", kategori: "luxury",     harga: 900000,  income: 8000,  sitaPermanen: true,  dendaSita: 0 },
  { id: "heli_vip",               nama: "Helikopter VIP",            emoji: "🚁", kategori: "luxury",     harga: 280000,  income: 3200,  sitaPermanen: true,  dendaSita: 0 },
  { id: "koleksi_mobil_klasik",   nama: "Koleksi Mobil Klasik",      emoji: "🚘", kategori: "luxury",     harga: 180000,  income: 1800,  sitaPermanen: false, dendaSita: 90000 },
  { id: "museum_pribadi",         nama: "Museum Pribadi",            emoji: "🏛️", kategori: "luxury",     harga: 220000,  income: 2600,  sitaPermanen: false, dendaSita: 110000 },
  { id: "arena_balap",            nama: "Arena Balap",               emoji: "🏁", kategori: "luxury",     harga: 300000,  income: 3600,  sitaPermanen: true,  dendaSita: 0 },
  { id: "sirkuit_pribadi",        nama: "Sirkuit Pribadi",           emoji: "🏎️", kategori: "luxury",     harga: 420000,  income: 4800,  sitaPermanen: true,  dendaSita: 0 },
  { id: "tim_formula_racing",     nama: "Tim Formula Racing",        emoji: "🏎️", kategori: "luxury",     harga: 550000,  income: 6500,  sitaPermanen: true,  dendaSita: 0 },
  { id: "klub_sepak_bola",        nama: "Klub Sepak Bola",           emoji: "⚽", kategori: "luxury",     harga: 600000,  income: 7000,  sitaPermanen: true,  dendaSita: 0 },
  { id: "maskapai_penerbangan",   nama: "Maskapai Penerbangan",      emoji: "🛫", kategori: "luxury",     harga: 850000,  income: 8500,  sitaPermanen: true,  dendaSita: 0 },
  { id: "pelabuhan_pribadi",      nama: "Pelabuhan Pribadi",         emoji: "⚓", kategori: "luxury",     harga: 700000,  income: 7800,  sitaPermanen: true,  dendaSita: 0 },
  { id: "pulau_pribadi_lux",      nama: "Pulau Pribadi",             emoji: "🏝️", kategori: "luxury",     harga: 800000,  income: 7000,  sitaPermanen: true,  dendaSita: 0 },
  { id: "kastil_eropa",           nama: "Kastil Eropa",              emoji: "🏰", kategori: "luxury",     harga: 650000,  income: 7200,  sitaPermanen: true,  dendaSita: 0 },
  { id: "mansion_beverly_hills",  nama: "Mansion Beverly Hills",     emoji: "🏡", kategori: "luxury",     harga: 900000,  income: 9000,  sitaPermanen: true,  dendaSita: 0 },
  { id: "gedung_pencakar_langit",  nama: "Gedung Pencakar Langit",    emoji: "🌃", kategori: "luxury",     harga: 1200000, income: 12000, sitaPermanen: true,  dendaSita: 0 },
  { id: "negara_mikro_pribadi",   nama: "Negara Mikro Pribadi",      emoji: "🗺️", kategori: "luxury",     harga: 2500000, income: 20000, sitaPermanen: true,  dendaSita: 0 },
  { id: "stasiun_luar_angkasa",   nama: "Stasiun Luar Angkasa Pribadi", emoji: "🛰️", kategori: "luxury", harga: 5000000, income: 40000, sitaPermanen: true, dendaSita: 0 },

  // INVESTASI PASIF
  { id: "mesin_atm",              nama: "Mesin ATM",                 emoji: "🏧", kategori: "pasif",      harga: 35000,   income: 650,   sitaPermanen: false, dendaSita: 17500 },
  { id: "mesin_vending",          nama: "Mesin Vending",             emoji: "🥤", kategori: "pasif",      harga: 20000,   income: 300,   sitaPermanen: false, dendaSita: 10000 },
  { id: "mesin_arcade",           nama: "Mesin Arcade",              emoji: "🎮", kategori: "pasif",      harga: 25000,   income: 380,   sitaPermanen: false, dendaSita: 12500 },
  { id: "server_hosting",         nama: "Server Hosting",            emoji: "🖥️", kategori: "pasif",      harga: 45000,   income: 750,   sitaPermanen: false, dendaSita: 22500 },
  { id: "mining_farm",            nama: "Mining Farm",               emoji: "⛏️", kategori: "pasif",      harga: 120000,  income: 1800,  sitaPermanen: true,  dendaSita: 0 },
  { id: "pembangkit_listrik",     nama: "Pembangkit Listrik",        emoji: "⚡", kategori: "pasif",      harga: 180000,  income: 2600,  sitaPermanen: true,  dendaSita: 0 },
  { id: "tower_bts",              nama: "Tower BTS",                 emoji: "📡", kategori: "pasif",      harga: 150000,  income: 2200,  sitaPermanen: true,  dendaSita: 0 },
  { id: "satelit_komunikasi",     nama: "Satelit Komunikasi",        emoji: "🛰️", kategori: "pasif",      harga: 300000,  income: 4200,  sitaPermanen: true,  dendaSita: 0 },
  { id: "pusat_data_ai",          nama: "Pusat Data AI",             emoji: "🤖", kategori: "pasif",      harga: 260000,  income: 3800,  sitaPermanen: true,  dendaSita: 0 },
  { id: "platform_streaming",     nama: "Platform Streaming",        emoji: "🎬", kategori: "pasif",      harga: 220000,  income: 3000,  sitaPermanen: true,  dendaSita: 0 },
  { id: "marketplace_online",     nama: "Marketplace Online",        emoji: "🛍️", kategori: "pasif",      harga: 240000,  income: 3200,  sitaPermanen: true,  dendaSita: 0 },
  { id: "ride_hailing",           nama: "Aplikasi Ride Hailing",     emoji: "🚕", kategori: "pasif",      harga: 280000,  income: 3600,  sitaPermanen: true,  dendaSita: 0 },
];

function getPropertiById(id) {
  return PROPERTI_CATALOG.find(p => p.id === id);
}

// ══════════════════════════════════════════════════════════════
//  HELPER DB PROPERTI
// ══════════════════════════════════════════════════════════════
function getPlayerProperti(jid) {
  const p = db.getPlayer(jid);
  if (!p.properti) p.properti = [];
  if (!p.kpk_status) p.kpk_status = { terkena: false, denda_pending: 0, riwayat: [] };
  if (!p.last_income) p.last_income = null;
  return p;
}

// ══════════════════════════════════════════════════════════════
//  CMD: LIHAT TOKO PROPERTI
// ══════════════════════════════════════════════════════════════
function cmdTokoProperti(filter) {
  const validFilter = ["kendaraan", "properti", "bisnis", "luxury"];
  const kategori = validFilter.includes(filter) ? filter : null;

  const items = kategori
    ? PROPERTI_CATALOG.filter(p => p.kategori === kategori)
    : PROPERTI_CATALOG;

  const header = `🏘️ *TOKO PROPERTI & ASET*\n${kategori ? `Kategori: ${kategori.toUpperCase()}` : "Semua Kategori"}\n\n`;

  const rows = items.map(p => {
    const sitaInfo = p.sitaPermanen
      ? "⚠️ *BERISIKO TINGGI* — Luxury, jika disita KPK: PERMANEN"
      : `Denda sita: ${p.dendaSita.toLocaleString()} koin`;
    return `${p.emoji} *${p.nama}* [${p.id}]\n   💵 Harga: ${p.harga.toLocaleString()} koin\n   💰 Passive income: +${p.income}/jam\n   ${sitaInfo}`;
  }).join("\n\n");

  const footer = `\n\n📌 Beli: *!beliproperti [id]*\n📌 Jual: *!jualproperti [id]*\n📌 Aset saya: *!asetku*\n📌 Klaim income: *!klaimincome*`;
  return header + rows + footer;
}

// ══════════════════════════════════════════════════════════════
//  CMD: BELI PROPERTI
// ══════════════════════════════════════════════════════════════
function cmdBeliProperti(jid, id) {
  const prop = getPropertiById(id);
  if (!prop) return `❌ Properti tidak ditemukan. Gunakan *!tokoaset* untuk lihat daftar.`;

  const p = getPlayerProperti(jid);
  if (p.kpk_status.terkena) return `🚔 *KPK memblokir transaksimu!* Selesaikan urusan dulu: *!statuskpk*`;

  // Cek sudah punya
  if (p.properti.find(a => a.id === id))
    return `❌ Kamu sudah punya *${prop.nama}*. Tidak bisa beli dua.`;

  if (p.balance < prop.harga)
    return `❌ Saldo tidak cukup. Butuh *${prop.harga.toLocaleString()}*, punya *${p.balance.toLocaleString()} koin*.`;

  p.balance -= prop.harga;
  p.properti.push({ id, beli_at: Date.now(), nama: prop.nama, emoji: prop.emoji });
  db.savePlayers();

  // KPK Watch: jika beli barang luxury, chance diinvestigasi
  let kpkMsg = "";
  if (prop.kategori === "luxury" && Math.random() < 0.35) {
    kpkMsg = `\n\n🚨 *KPK mulai mencurigaimu!* Pembelian luxury ini masuk radar investigasi...`;
  }

  return `✅ *Berhasil beli ${prop.emoji} ${prop.nama}!*\n-${prop.harga.toLocaleString()} koin\n💰 Passive income: *+${prop.income} koin/jam*\n💳 Saldo: ${p.balance.toLocaleString()} koin${kpkMsg}`;
}

// ══════════════════════════════════════════════════════════════
//  CMD: JUAL PROPERTI
// ══════════════════════════════════════════════════════════════
function cmdJualProperti(jid, id) {
  const prop = getPropertiById(id);
  if (!prop) return `❌ ID properti tidak valid.`;

  const p = getPlayerProperti(jid);
  const idx = p.properti.findIndex(a => a.id === id);
  if (idx === -1) return `❌ Kamu tidak punya *${prop.nama}*.`;

  // Jual dengan harga 70% (depresiasi)
  const hargaJual = Math.floor(prop.harga * 0.7);
  p.properti.splice(idx, 1);
  db.addBalance(jid, hargaJual);
  db.savePlayers();

  return `💸 *${prop.emoji} ${prop.nama} Terjual!*\n+${hargaJual.toLocaleString()} koin (70% dari harga beli)\n💳 Saldo: ${db.getPlayer(jid).balance.toLocaleString()} koin`;
}

// ══════════════════════════════════════════════════════════════
//  CMD: LIHAT ASET MILIK
// ══════════════════════════════════════════════════════════════
function cmdAsetku(jid) {
  const p = getPlayerProperti(jid);
  if (!p.properti || p.properti.length === 0)
    return `🏘️ Kamu belum punya properti. Beli di *!tokoaset*`;

  const totalIncome = p.properti.reduce((acc, a) => {
    const prop = getPropertiById(a.id);
    return acc + (prop ? prop.income : 0);
  }, 0);

  const rows = p.properti.map(a => {
    const prop = getPropertiById(a.id);
    const tgl  = new Date(a.beli_at).toLocaleDateString("id-ID");
    return `${a.emoji} *${a.nama}* — +${prop?.income || 0}/jam (beli: ${tgl})`;
  }).join("\n");

  const kpkWarn = p.kpk_status.terkena
    ? `\n\n🚔 *STATUS KPK: TERKENA!* Denda pending: ${p.kpk_status.denda_pending.toLocaleString()} koin\nGunakan *!bayardenda* untuk bebas.`
    : "";

  return `🏘️ *ASET MILIKMU*\n\n${rows}\n\n💰 Total passive income: *+${totalIncome} koin/jam*\n📌 Klaim: *!klaimincome*${kpkWarn}`;
}

// ══════════════════════════════════════════════════════════════
//  CMD: KLAIM PASSIVE INCOME
// ══════════════════════════════════════════════════════════════
const INCOME_INTERVAL_MS = 60 * 60 * 1000; // 1 jam

function cmdKlaimIncome(jid) {
  const p = getPlayerProperti(jid);
  if (!p.properti || p.properti.length === 0)
    return `❌ Kamu belum punya properti. Beli di *!tokoaset*`;

  const sekarang = Date.now();
  const lastClaim = p.last_income ? new Date(p.last_income).getTime() : 0;
  const elapsed = sekarang - lastClaim;

  if (elapsed < INCOME_INTERVAL_MS) {
    const sisa = INCOME_INTERVAL_MS - elapsed;
    const mnt  = Math.ceil(sisa / 60000);
    return `⏳ Income bisa diklaim lagi *${mnt} menit* lagi.`;
  }

  // Hitung jam yang berlalu (max 24 jam kumulatif)
  const jamElapsed = Math.min(Math.floor(elapsed / INCOME_INTERVAL_MS), 24);

  const totalPerJam = p.properti.reduce((acc, a) => {
    const prop = getPropertiById(a.id);
    return acc + (prop ? prop.income : 0);
  }, 0);

  const total = totalPerJam * jamElapsed;
  p.last_income = new Date().toISOString();
  db.addBalance(jid, total);
  db.savePlayers();

  return `💰 *Passive Income Diklaim!*\n+${total.toLocaleString()} koin (${jamElapsed} jam × ${totalPerJam}/jam)\n💳 Saldo: ${db.getPlayer(jid).balance.toLocaleString()} koin`;
}

// ══════════════════════════════════════════════════════════════
//  SISTEM KPK — Komisi Pemberantasan Koin
// ══════════════════════════════════════════════════════════════

// Dipanggil dari games.js / economy.js saat menang besar dari kasino
function triggerKPKCheck(jid, amount, chatId) {
  const p = getPlayerProperti(jid);
  if (p.kpk_status.terkena) return null; // Sudah kena, skip

  // KPK curiga jika:
  // 1. Menang kasino > 50.000 koin sekaligus
  // 2. Random 5% chance tiap transaksi besar
  const threshold  = cfg.kpkInvestigasiThreshold || 50000;
  const randomCatch = Math.random() < 0.05 && amount > 10000;

  if (amount < threshold && !randomCatch) return null;

  // Tentukan denda dan aset yang disita
  const dendaPersen = Math.random() < 0.5 ? 0.3 : 0.5; // 30% atau 50% dari aset total
  const totalAset   = p.balance + (p.crypto_balance || 0) * db.getCryptoPrice();
  const denda       = Math.floor(totalAset * dendaPersen);

  // Sita aset luxury permanen
  const disitaPermanen = [];
  const disitaTebus    = [];
  p.properti = p.properti.filter(a => {
    const prop = getPropertiById(a.id);
    if (!prop) return true;
    if (prop.sitaPermanen) { disitaPermanen.push(a); return false; }
    disitaTebus.push(a); return false; // semua non-permanen juga disita sementara
  });

  // Simpan info penyitaan
  p.kpk_status = {
    terkena: true,
    denda_pending: denda,
    disita_permanen: disitaPermanen,
    disita_tebus: disitaTebus,
    tangkap_at: Date.now(),
    riwayat: [...(p.kpk_status.riwayat || []), {
      waktu: new Date().toISOString(),
      alasan: `Menang kasino ${amount.toLocaleString()} koin — terindikasi uang haram`,
      denda
    }]
  };

  // Bekukan saldo (potong 20% langsung sebagai agunan)
  const potongLangsung = Math.floor(p.balance * 0.2);
  p.balance = Math.max(0, p.balance - potongLangsung);
  db.savePlayers();

  const permaList = disitaPermanen.length > 0
    ? `\n🔴 *DISITA PERMANEN:* ${disitaPermanen.map(a => `${a.emoji} ${a.nama}`).join(", ")}`
    : "";
  const tebsList = disitaTebus.length > 0
    ? `\n🟡 *DISITA (tebus):* ${disitaTebus.map(a => `${a.emoji} ${a.nama}`).join(", ")}`
    : "";

  return (
    `\n\n🚔🚔🚔 *KPK TURUN!* 🚔🚔🚔\n` +
    `@${jid.split("@")[0]} tertangkap basah operasi kasino ilegal!\n` +
    `💸 Agunan langsung dipotong: *-${potongLangsung.toLocaleString()} koin*\n` +
    `💰 Denda tersisa: *${denda.toLocaleString()} koin*${permaList}${tebsList}\n\n` +
    `📌 Gunakan *!statuskpk* dan *!bayardenda* untuk bebas.`
  );
}

// ── Cek KPK Status ─────────────────────────────────────────
function cmdStatusKPK(jid) {
  const p = getPlayerProperti(jid);
  const kpk = p.kpk_status;

  if (!kpk || !kpk.terkena)
    return `✅ *Status KPK: Bersih*\nKamu tidak sedang dalam investigasi.\n🏛️ Jaga diri dan main dengan wajar!`;

  const tebsList = (kpk.disita_tebus || []).map(a => `${a.emoji} ${a.nama}`).join(", ") || "-";
  const permaList = (kpk.disita_permanen || []).map(a => `${a.emoji} ${a.nama}`).join(", ") || "-";
  const tglTangkap = new Date(kpk.tangkap_at).toLocaleString("id-ID");

  return (
    `🚔 *STATUS KPK — TERKENA INVESTIGASI*\n\n` +
    `📅 Ditangkap: ${tglTangkap}\n` +
    `💰 Denda pending: *${kpk.denda_pending.toLocaleString()} koin*\n` +
    `🔴 Disita permanen: ${permaList}\n` +
    `🟡 Disita (bisa ditebus): ${tebsList}\n\n` +
    `📌 Bayar denda: *!bayardenda [jumlah]*\n` +
    `📌 Tebus properti: *!tebusaset [id]*\n` +
    `⚠️ Selama kena KPK: kasino, transfer & properti diblokir.`
  );
}

// ── Bayar Denda KPK ────────────────────────────────────────
function cmdBayarDenda(jid, amount) {
  const p = getPlayerProperti(jid);
  const kpk = p.kpk_status;

  if (!kpk || !kpk.terkena) return `✅ Kamu tidak punya denda KPK.`;
  if (!Number.isInteger(amount) || amount <= 0) return `❌ Jumlah tidak valid.`;
  if (p.balance < amount) return `❌ Saldo tidak cukup. Punya: *${p.balance.toLocaleString()} koin*.`;

  const bayar = Math.min(amount, kpk.denda_pending);
  p.balance       -= bayar;
  kpk.denda_pending -= bayar;

  if (kpk.denda_pending <= 0) {
    kpk.denda_pending = 0;
    // Kembalikan aset yang bisa ditebus (belum ditebus, dikembalikan otomatis)
    const kembali = kpk.disita_tebus || [];
    p.properti = [...p.properti, ...kembali];
    kpk.terkena = false;
    kpk.disita_tebus = [];
    db.savePlayers();
    return (
      `🎉 *DENDA LUNAS! Kasus KPK Ditutup!*\n` +
      `-${bayar.toLocaleString()} koin dibayarkan.\n` +
      (kembali.length > 0 ? `✅ Properti dikembalikan: ${kembali.map(a => `${a.emoji} ${a.nama}`).join(", ")}\n` : "") +
      `💳 Saldo: ${p.balance.toLocaleString()} koin\n` +
      `⚠️ Hati-hati! KPK masih memantau.`
    );
  }

  db.savePlayers();
  return `🏛️ Bayar denda *-${bayar.toLocaleString()} koin*. Sisa denda: *${kpk.denda_pending.toLocaleString()} koin*.`;
}

// ── Tebus Aset Satu Per Satu ────────────────────────────────
function cmdTebusAset(jid, id) {
  const prop = getPropertiById(id);
  if (!prop) return `❌ ID tidak valid.`;
  if (prop.sitaPermanen) return `🔴 Aset ini *disita permanen* oleh KPK. Tidak bisa ditebus.`;

  const p = getPlayerProperti(jid);
  const kpk = p.kpk_status;
  if (!kpk || !kpk.terkena) return `✅ Kamu tidak sedang dalam kasus KPK.`;

  const idx = (kpk.disita_tebus || []).findIndex(a => a.id === id);
  if (idx === -1) return `❌ Aset ini tidak ada dalam daftar sita KPK.`;

  const biayaTebus = prop.dendaSita;
  if (p.balance < biayaTebus) return `❌ Butuh *${biayaTebus.toLocaleString()} koin* untuk tebus. Saldo: *${p.balance.toLocaleString()} koin*.`;

  p.balance -= biayaTebus;
  const [aset] = kpk.disita_tebus.splice(idx, 1);
  p.properti.push(aset);
  db.savePlayers();

  return `✅ *${aset.emoji} ${aset.nama} Ditebus!*\n-${biayaTebus.toLocaleString()} koin.\n💳 Saldo: ${p.balance.toLocaleString()} koin`;
}

// ══════════════════════════════════════════════════════════════
//  EXPORT
// ══════════════════════════════════════════════════════════════
module.exports = {
  cmdTokoProperti,
  cmdBeliProperti,
  cmdJualProperti,
  cmdAsetku,
  cmdKlaimIncome,
  cmdStatusKPK,
  cmdBayarDenda,
  cmdTebusAset,
  triggerKPKCheck,
  getPlayerProperti,
};
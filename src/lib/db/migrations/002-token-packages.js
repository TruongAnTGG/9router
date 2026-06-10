// Add tokenPackages and orders tables for token purchase feature
export default {
  version: 2,
  name: "token-packages",
  up(db) {
    // Token packages configured by admin
    db.exec(`
      CREATE TABLE IF NOT EXISTS tokenPackages (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        tokenAmount INTEGER NOT NULL,
        price REAL NOT NULL,
        currency TEXT DEFAULT 'VND',
        isActive INTEGER DEFAULT 1,
        displayOrder INTEGER DEFAULT 0,
        features TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);
    db.exec("CREATE INDEX IF NOT EXISTS idx_tp_active ON tokenPackages(isActive, displayOrder)");

    // Orders/purchases made by customers
    db.exec(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        apiKeyId TEXT NOT NULL,
        packageId TEXT NOT NULL,
        packageName TEXT NOT NULL,
        tokenAmount INTEGER NOT NULL,
        price REAL NOT NULL,
        currency TEXT DEFAULT 'VND',
        status TEXT DEFAULT 'pending',
        paymentMethod TEXT,
        paymentTransactionId TEXT,
        paymentData TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        completedAt TEXT,
        FOREIGN KEY (apiKeyId) REFERENCES apiKeys(id)
      )
    `);
    db.exec("CREATE INDEX IF NOT EXISTS idx_orders_apikey ON orders(apiKeyId)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(createdAt DESC)");
  },
};

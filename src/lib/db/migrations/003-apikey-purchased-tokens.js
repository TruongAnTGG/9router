export default {
  version: 3,
  name: "apikey-purchased-tokens",
  up(db) {
    const existing = new Set(db.all("PRAGMA table_info(apiKeys)").map((row) => row.name));
    if (!existing.has("purchasedTokenLimit")) {
      db.exec("ALTER TABLE apiKeys ADD COLUMN purchasedTokenLimit INTEGER DEFAULT 0");
    }
    if (!existing.has("usedPurchasedTokens")) {
      db.exec("ALTER TABLE apiKeys ADD COLUMN usedPurchasedTokens INTEGER DEFAULT 0");
    }
    if (!existing.has("purchasedExpiresAt")) {
      db.exec("ALTER TABLE apiKeys ADD COLUMN purchasedExpiresAt TEXT");
    }
  },
};

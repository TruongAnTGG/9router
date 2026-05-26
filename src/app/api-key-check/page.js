import ApiKeyCheckClient from "./ApiKeyCheckClient";

export const metadata = {
  title: "API Key Check",
  description: "Inspect API key quota, reset time, cost, and expiry.",
};

export default function ApiKeyCheckPage() {
  return <ApiKeyCheckClient />;
}

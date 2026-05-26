import Link from "next/link";
import Image from "next/image";
import { connection } from "next/server";
import { getSettings } from "@/lib/localDb";
import LeadForm from "./landing/components/LeadForm";

const providerLogos = [
  { name: "OpenAI", src: "/providers/openai.png" },
  { name: "Anthropic", src: "/providers/anthropic.png" },
  { name: "Gemini", src: "/providers/gemini.png" },
  { name: "OpenRouter", src: "/providers/openrouter.png" },
  { name: "DeepSeek", src: "/providers/deepseek.png" },
  { name: "Groq", src: "/providers/groq.png" },
];

const features = [
  {
    icon: "shopping_bag",
    title: "Sell token packages",
    text: "Create token packs for customers, students, teams, or reseller channels.",
  },
  {
    icon: "paid",
    title: "Show remaining balance",
    text: "Give every buyer a clean usage page with quota, reset, cost, and expiry.",
  },
  {
    icon: "key",
    title: "Deliver API access",
    text: "Send one OpenAI-compatible endpoint and an API key after purchase.",
  },
];

const steps = [
  "Buyer chooses a token package or custom volume.",
  "You issue an API key with token amount, expiry, and reset policy.",
  "Buyer uses the endpoint and checks remaining tokens anytime.",
];

function normalizePricingPlans(value) {
  if (!Array.isArray(value) || value.length === 0) return [];
  return value
    .map((plan) => ({
      name: String(plan?.name || "").trim(),
      price: String(plan?.price || "").trim(),
      period: String(plan?.period || "").trim(),
      description: String(plan?.description || "").trim(),
      badge: String(plan?.badge || "").trim(),
      cta: String(plan?.cta || "").trim() || "Contact sales",
      highlighted: plan?.highlighted === true,
      features: Array.isArray(plan?.features)
        ? plan.features.map((item) => String(item || "").trim()).filter(Boolean)
        : [],
    }))
    .filter((plan) => plan.name && plan.price);
}

function normalizeUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw) || /^mailto:/i.test(raw) || /^tel:/i.test(raw)) return raw;
  return `https://${raw}`;
}

function buildContactLinks(settings) {
  const links = [];
  const email = String(settings?.landingContactEmail || "").trim();
  const phone = String(settings?.landingContactPhone || "").trim();
  const zalo = String(settings?.landingContactZalo || "").trim();
  const telegram = String(settings?.landingContactTelegram || "").trim();
  const url = normalizeUrl(settings?.landingContactUrl);

  if (email) links.push({ label: "Email", href: `mailto:${email}`, icon: "mail", value: email });
  if (phone) links.push({ label: "Phone", href: `tel:${phone.replace(/\s+/g, "")}`, icon: "call", value: phone });
  if (zalo) links.push({ label: "Zalo", href: normalizeUrl(zalo), icon: "chat", value: "Chat on Zalo" });
  if (telegram) {
    const telegramHref = telegram.startsWith("@") ? `https://t.me/${telegram.slice(1)}` : normalizeUrl(telegram);
    links.push({ label: "Telegram", href: telegramHref, icon: "send", value: "Message on Telegram" });
  }
  if (url) links.push({ label: settings?.landingContactCtaLabel || "Contact sales", href: url, icon: "open_in_new", value: url });

  return links;
}

export default async function LakeTokenLanding() {
  await connection();

  let settings = {};
  try {
    settings = await getSettings();
  } catch {}

  const contactLinks = buildContactLinks(settings);
  const primaryContact = contactLinks[0];
  const ctaLabel = settings?.landingContactCtaLabel || "Contact sales";
  const pricingPlans = normalizePricingPlans(settings?.landingPricingPlans);

  return (
    <main className="min-h-screen bg-[#101214] text-white">
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#101214]/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-[#E56A4A] text-white">
              <span className="material-symbols-outlined text-[21px]">token</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">LakeToken</span>
          </Link>
          <div className="flex items-center gap-3">
            <a href="#flow" className="hidden text-sm text-white/70 transition-colors hover:text-white md:inline">
              Flow
            </a>
            <a href="#docs" className="hidden text-sm text-white/70 transition-colors hover:text-white sm:inline">
              API
            </a>
            <a href="#pricing" className="hidden text-sm text-white/70 transition-colors hover:text-white sm:inline">
              Pricing
            </a>
            <a href="#request" className="hidden text-sm text-white/70 transition-colors hover:text-white md:inline">
              Request
            </a>
            <a
              href="#contact"
              className="hidden h-9 items-center justify-center rounded-lg border border-white/15 px-4 text-sm font-medium text-white transition-colors hover:bg-white/10 sm:inline-flex"
            >
              Contact
            </a>
            <a
              href="#request"
              className="inline-flex h-9 items-center justify-center rounded-lg bg-[#E56A4A] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#cc5236]"
            >
              Buy tokens
            </a>
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden border-b border-white/10">
        <div className="landing-aurora absolute inset-0" />
        <div className="landing-grid-motion absolute inset-0 opacity-35" />
        <div className="relative mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8 lg:py-14">
          <div className="flex flex-col justify-center">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-[#E56A4A]/30 bg-[#E56A4A]/10 px-3 py-1 text-sm text-[#F4B59C]">
              <span className="material-symbols-outlined text-[17px]">bolt</span>
              AI token supply for buyers and resellers
            </div>
            <h1 className="max-w-4xl text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Sell AI tokens with instant API access.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
              LakeToken helps you provide token packages, issue customer API keys, and show buyers exactly how many tokens they have left.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                href={primaryContact?.href || "#contact"}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-[#E56A4A] px-6 text-sm font-semibold text-white shadow-[0_18px_50px_-20px_rgba(229,106,74,0.95)] transition-colors hover:bg-[#cc5236]"
              >
                <span className="material-symbols-outlined text-[19px]">handshake</span>
                {ctaLabel}
              </a>
              <a
                href="#docs"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/14 bg-white/5 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10"
              >
                <span className="material-symbols-outlined text-[19px]">code</span>
                See how it works
              </a>
            </div>
            <div className="mt-7 grid grid-cols-3 gap-3">
              <HeroStat label="Token packs" value="100K+" />
              <HeroStat label="Delivery" value="API key" />
              <HeroStat label="Balance" value="Live" />
            </div>
          </div>

          <div className="flex items-center">
            <TokenSalesVisual />
          </div>
        </div>
      </section>

      <section id="request" className="relative border-b border-white/10 bg-[#141719] py-12">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 sm:px-6 lg:grid-cols-[0.62fr_1.38fr] lg:px-8">
          <div className="flex flex-col justify-center">
            <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-[#E56A4A]/30 bg-[#E56A4A]/10 px-3 py-1 text-sm text-[#F4B59C]">
              <span className="material-symbols-outlined text-[17px]">assignment</span>
              Fast request
            </div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Request token supply.</h2>
            <p className="mt-4 max-w-xl text-white/62">
              Tell us the package, volume, and contact method. Admin receives it in Customer Leads.
            </p>
          </div>
          <LeadForm plans={pricingPlans} />
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#141719] py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {providerLogos.map((provider) => (
              <div key={provider.name} className="landing-provider-card flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3">
                <Image src={provider.src} alt={provider.name} width={28} height={28} className="rounded-full" />
                <span className="truncate text-sm text-white/72">{provider.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="flow" className="border-b border-white/10 bg-[#101214] py-16">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div className="flex flex-col justify-center">
            <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-white/60">
              <span className="material-symbols-outlined text-[17px]">account_tree</span>
              Visual sales flow
            </div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">From payment to usable tokens.</h2>
            <p className="mt-4 max-w-xl text-white/62">
              Buyers do not need to understand providers. They buy a token package, receive an API key, and watch their balance.
            </p>
          </div>
          <SalesFlowDiagram />
        </div>
      </section>

      <section id="pricing" className="border-b border-white/10 bg-[#101214] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Token packages ready to sell.</h2>
              <p className="mt-4 text-white/62">Configure package names, prices, volume, CTA, and features from admin.</p>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/58">
              Configurable in admin
            </div>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {pricingPlans.map((plan, index) => (
              <div
                key={`${plan.name}-${index}`}
                className={`landing-price-card relative overflow-hidden rounded-[16px] border p-6 ${
                  plan.highlighted
                    ? "border-[#E56A4A]/55 bg-[#E56A4A]/10 shadow-[0_24px_80px_-48px_rgba(229,106,74,0.95)]"
                    : "border-white/10 bg-white/[0.035]"
                }`}
                style={{ animationDelay: `${index * 120}ms` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-12 items-center justify-center rounded-full bg-white/8 text-[#F4B59C]">
                    <span className="material-symbols-outlined">token</span>
                  </div>
                  {plan.badge ? (
                    <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs font-medium text-white/72">
                      {plan.badge}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-6 text-xl font-semibold">{plan.name}</h3>
                <div className="mt-4 flex items-end gap-1">
                  <span className="text-4xl font-semibold tracking-tight">{plan.price}</span>
                  {plan.period ? <span className="pb-1 text-sm text-white/48">{plan.period}</span> : null}
                </div>
                {plan.description ? <p className="mt-3 min-h-12 text-sm leading-6 text-white/58">{plan.description}</p> : null}
                <a
                  href={primaryContact?.href || "#contact"}
                  className={`mt-6 inline-flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    plan.highlighted ? "bg-[#E56A4A] text-white hover:bg-[#cc5236]" : "border border-white/12 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  {plan.cta}
                </a>
                <div className="mt-6 space-y-3">
                  {plan.features.slice(0, 5).map((item) => (
                    <div key={item} className="flex items-center gap-3 text-sm text-white/68">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/8 text-[#F4B59C]">
                        <span className="material-symbols-outlined text-[16px]">check</span>
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-[#141719] py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {features.map((feature, index) => (
              <div key={feature.title} className="landing-feature-card rounded-[16px] border border-white/10 bg-white/[0.035] p-6" style={{ animationDelay: `${index * 100}ms` }}>
                <div className="flex size-12 items-center justify-center rounded-full bg-[#E56A4A]/12 text-[#F4B59C]">
                  <span className="material-symbols-outlined">{feature.icon}</span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-3 text-sm leading-6 text-white/60">{feature.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="docs" className="bg-[#141719] py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">A simple token delivery workflow.</h2>
            <div className="mt-8 space-y-4">
              {steps.map((step, index) => (
                <div key={step} className="flex gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/8 text-sm font-semibold text-[#F4B59C]">
                    {index + 1}
                  </div>
                  <p className="pt-1 text-sm leading-6 text-white/68">{step}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-[12px] border border-white/10 bg-[#101214] p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">How buyers receive tokens</h3>
                <p className="mt-1 text-sm text-white/54">Each token package becomes an API key with quota, expiry, and a public balance page.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <WorkflowCard icon="shopping_cart" title="Sell package" text="Choose token amount and price." />
              <WorkflowCard icon="key" title="Issue key" text="Deliver API key after purchase." />
              <WorkflowCard icon="speed" title="Track balance" text="Show remaining tokens and usage." />
              <WorkflowCard icon="link" title="Share page" text="Give buyers a public check link." />
            </div>
          </div>
        </div>
      </section>

      <section id="contact" className="border-t border-white/10 bg-[#101214] py-20">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:px-8">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Start selling AI token packages.</h2>
            <p className="mt-4 max-w-xl text-white/62">
              Contact us for token supply, bulk package pricing, API delivery, or reseller setup.
            </p>
            {settings?.landingContactName ? (
              <div className="mt-6 text-lg font-semibold">{settings.landingContactName}</div>
            ) : null}
            {contactLinks.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 gap-3">
                {contactLinks.slice(0, 3).map((link) => (
                  <a
                    key={`${link.label}-${link.href}`}
                    href={link.href}
                    target={link.href.startsWith("http") ? "_blank" : undefined}
                    rel={link.href.startsWith("http") ? "noopener noreferrer" : undefined}
                    className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.035] p-4 transition-colors hover:border-[#E56A4A]/55"
                  >
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#E56A4A]/12 text-[#F4B59C]">
                      <span className="material-symbols-outlined text-[20px]">{link.icon}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{link.label}</div>
                      <div className="truncate text-sm text-white/55">{link.value}</div>
                    </div>
                  </a>
                ))}
              </div>
            ) : null}
          </div>
          <div className="rounded-[18px] border border-white/10 bg-white/[0.035] p-5">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-full bg-[#E56A4A]/12 text-[#F4B59C]">
                <span className="material-symbols-outlined">assignment_turned_in</span>
              </div>
              <div>
                <h3 className="font-semibold">Requests go to admin</h3>
                <p className="mt-1 text-sm text-white/55">Open Dashboard → Customer Leads to review and update status.</p>
              </div>
            </div>
            <a
              href="#request"
              className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-[#E56A4A] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#cc5236]"
            >
              Submit token request
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}

function HeroStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <div className="text-lg font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-white/45">{label}</div>
    </div>
  );
}

function TokenSalesVisual() {
  return (
    <div className="landing-float w-full rounded-[22px] border border-white/12 bg-[#171a1d]/92 p-5 shadow-2xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm text-white/45">Token sales desk</div>
          <div className="mt-1 text-xl font-semibold">Package delivery</div>
        </div>
        <div className="rounded-full border border-[#E56A4A]/35 bg-[#E56A4A]/12 px-3 py-1 text-sm text-[#F4B59C]">Live</div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[18px] border border-white/10 bg-[#101214] p-4">
          <div className="relative mx-auto flex size-40 items-center justify-center rounded-full border border-white/10 bg-white/[0.035]">
            <div className="absolute inset-3 rounded-full border-[12px] border-[#E56A4A]/75 border-b-white/10 border-r-white/10" />
            <div className="text-center">
              <div className="text-3xl font-semibold">1M</div>
              <div className="text-xs uppercase tracking-wide text-white/45">tokens sold</div>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-center">
            <MiniStat label="Price" value="$59" />
            <MiniStat label="Expiry" value="30d" />
          </div>
        </div>

        <div className="space-y-3">
          <BuyerRow name="SaaS App" tokens="420K left" status="Active" />
          <BuyerRow name="Agency Client" tokens="88K left" status="Low" tone="warning" />
          <BuyerRow name="Student Team" tokens="12d left" status="Trial" />
          <div className="rounded-[16px] border border-white/10 bg-white/[0.035] p-4">
            <div className="mb-3 flex items-center justify-between text-xs text-white/45">
              <span>Buyer request</span>
              <span>Provider pool</span>
            </div>
            <div className="landing-route-line relative h-2 overflow-hidden rounded-full bg-white/8">
              <span className="landing-route-pulse absolute top-0 h-2 w-24 rounded-full bg-[#E56A4A]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="rounded-xl bg-white/[0.045] px-3 py-2">
      <div className="text-sm font-semibold">{value}</div>
      <div className="text-xs text-white/42">{label}</div>
    </div>
  );
}

function BuyerRow({ name, tokens, status, tone = "default" }) {
  return (
    <div className="flex items-center gap-3 rounded-[16px] border border-white/10 bg-white/[0.035] p-3">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#E56A4A]/12 text-[#F4B59C]">
        <span className="material-symbols-outlined text-[19px]">person</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="text-xs text-white/45">{tokens}</div>
      </div>
      <div className={`rounded-full px-2.5 py-1 text-xs ${tone === "warning" ? "bg-amber-500/12 text-amber-300" : "bg-green-500/12 text-green-300"}`}>
        {status}
      </div>
    </div>
  );
}

function SalesFlowDiagram() {
  const items = [
    { icon: "payments", title: "Payment", text: "Customer buys token pack" },
    { icon: "token", title: "Quota", text: "Tokens are assigned" },
    { icon: "vpn_key", title: "API key", text: "Access is delivered" },
    { icon: "monitoring", title: "Balance", text: "Usage stays visible" },
  ];

  return (
    <div className="rounded-[22px] border border-white/10 bg-white/[0.035] p-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {items.map((item, index) => (
          <div key={item.title} className="relative">
            {index < items.length - 1 ? (
              <div className="landing-flow-connector absolute left-[calc(50%+2rem)] top-8 hidden h-px w-[calc(100%-2rem)] bg-white/12 md:block">
                <span className="landing-flow-dot absolute -top-1 size-2 rounded-full bg-[#E56A4A]" />
              </div>
            ) : null}
            <div className="relative rounded-[18px] border border-white/10 bg-[#101214] p-4 text-center">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[#E56A4A]/12 text-[#F4B59C]">
                <span className="material-symbols-outlined text-[28px]">{item.icon}</span>
              </div>
              <h3 className="mt-4 font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-5 text-white/54">{item.text}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 rounded-[18px] border border-white/10 bg-[#101214] p-4 sm:grid-cols-3">
        <MiniStat label="Buyer sees" value="Remaining tokens" />
        <MiniStat label="Seller controls" value="Quota + expiry" />
        <MiniStat label="Apps use" value="/v1 endpoint" />
      </div>
    </div>
  );
}

function WorkflowCard({ icon, title, text }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <span className="material-symbols-outlined text-[#F4B59C]">{icon}</span>
      <div className="mt-3 font-medium">{title}</div>
      <p className="mt-1 text-sm text-white/55">{text}</p>
    </div>
  );
}

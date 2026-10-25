import { usePageMeta } from "../../hooks/usePageMeta";

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  usePageMeta({ title });
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1 text-sm text-subtle">Last updated October 25, 2026</p>
      <div className="mt-6 space-y-4 text-muted [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-fg [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </main>
  );
}

// Starter text in plain language. It has not been reviewed by a lawyer; get it
// reviewed before relying on it for a public launch.

export function TermsPage() {
  return (
    <Page title="Terms of use">
      <p>
        Car Market lets private sellers advertise used vehicles and lets buyers contact them. We are not a
        party to any sale, we do not inspect vehicles, and we do not handle payments.
      </p>
      <h2>Your account</h2>
      <p>You sign in with Google or GitHub. You are responsible for activity on your account.</p>
      <h2>Listing a car</h2>
      <ul>
        <li>Only list vehicles you own or are authorized to sell, with accurate details and photos.</li>
        <li>Do not post scams, stolen vehicles, misleading prices, or other people’s photos.</li>
        <li>We may remove listings or accounts that break these rules.</li>
      </ul>
      <h2>Buying a car</h2>
      <p>
        Verify the vehicle, its VIN and title yourself. Meet in a public place, and never send money for a car
        you have not seen. Recall and price information on this site is informational only.
      </p>
      <h2>Liability</h2>
      <p>The service is provided as is. To the extent allowed by law, we are not liable for transactions between users.</p>
    </Page>
  );
}

export function PrivacyPage() {
  return (
    <Page title="Privacy policy">
      <p>This page explains what Car Market collects and why.</p>
      <h2>What we store</h2>
      <ul>
        <li>Account details from your sign-in provider (email address, name).</li>
        <li>Listings you create, including photos, ZIP code and the approximate location derived from it.</li>
        <li>Messages you send to sellers, and cars you save.</li>
      </ul>
      <h2>Services we call from your browser</h2>
      <ul>
        <li>NHTSA (vehicle makes, models, VIN decoding, recalls) — receives the make, model, year or VIN you look up.</li>
        <li>Zippopotam.us — receives a ZIP code to convert it to coordinates.</li>
        <li>Supabase — hosts our database, file storage and sign-in.</li>
      </ul>
      <h2>Your choices</h2>
      <p>
        You can hide or delete your listings at any time. To delete your account and data, contact us from the
        address you signed up with.
      </p>
      <h2>Local storage</h2>
      <p>We store your theme choice, a cache of vehicle lookups and your last ZIP code in your browser. We do not use advertising cookies.</p>
    </Page>
  );
}

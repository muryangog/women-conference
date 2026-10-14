import Image from "next/image";
import RegistrationForm from "@/components/RegistrationForm";
import { EVENT } from "@/lib/config";

const Chip = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-2 rounded-full border border-creme/25 bg-white/5 px-3 py-1 text-xs font-medium text-creme backdrop-blur sm:px-3.5 sm:py-1.5 sm:text-sm">
    {children}
  </span>
);

export default function Home() {
  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#2b0716] text-creme">
      {/* lueurs décoratives */}
      <div aria-hidden className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-rose/50 blur-[110px]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-rose-deep/60 blur-[120px]" />

      <div className="relative mx-auto grid min-h-[100dvh] max-w-6xl content-center gap-3 px-4 py-3 sm:gap-5 sm:px-6 lg:grid-cols-[1fr_460px] lg:items-center lg:gap-14 lg:py-8">
        {/* ---------- marque ---------- */}
        <section className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <div className="flex w-full items-center justify-between gap-3 lg:mb-8 lg:justify-start">
            <span className="rounded-xl bg-white px-3 py-1.5 shadow-lg shadow-black/20">
              <Image src="/aletheia-logo.png" alt="Aletheia Truth Revealed" width={439} height={166} className="h-7 w-auto sm:h-9" priority />
            </span>
            <span className="text-[11px] font-semibold uppercase tracking-[.18em] text-creme/70 lg:hidden">Conférence des femmes</span>
          </div>

          <Image
            src="/urugori-logo.png"
            alt="Urugori rw'igisagara"
            width={1200}
            height={598}
            priority
            className="mt-3 w-[190px] sm:w-[300px] lg:mt-0 lg:w-[540px]"
          />

          <p className="mt-1 font-display text-xl font-semibold italic text-creme sm:text-2xl lg:mt-6 lg:text-4xl">
            {EVENT.theme}
          </p>

          <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:gap-2 lg:mt-6 lg:justify-start">
            <Chip><b className="text-white">24 oct. 2026</b> · {EVENT.time}</Chip>
            <Chip>{EVENT.place}</Chip>
            <Chip><span className="h-2 w-2 rounded-full bg-rose shadow-[0_0_8px_2px_#B8205A]" /> Live</Chip>
          </div>
          <p className="mt-2 hidden text-sm text-creme/70 lg:block">{EVENT.placeDetail}</p>

          <ul className="mt-8 hidden gap-x-8 gap-y-3 border-t border-creme/15 pt-6 text-sm lg:grid lg:grid-cols-3">
            {EVENT.speakers.map((s) => (
              <li key={s.name}>
                <p className="font-semibold text-white">{s.name}</p>
                <p className="mt-0.5 text-xs leading-snug text-creme/65">{s.role}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------- formulaire ---------- */}
        <section className="rounded-3xl bg-creme-soft p-3.5 text-bordeaux shadow-2xl shadow-black/40 sm:p-6">
          <RegistrationForm />
        </section>

        <p className="text-center text-[11px] text-creme/60 sm:text-xs lg:col-span-2 lg:text-left">
          Participation gratuite · Une question ? <a className="underline" href={EVENT.whatsappLink}>WhatsApp {EVENT.whatsapp}</a>
        </p>
      </div>
    </main>
  );
}

export const EVENT = {
  organizer: "Aletheia Truth Revealed",
  kicker: "Ishengero ry'ukuri guhishuwe irabatumira mu gikorane ngarukamwaka c'abakenyezi",
  name: "Urugori rw'igisagara",
  theme: "Ijwi risamirana ku marembo",
  dateLabel: "Samedi 24 octobre 2026",
  dateShort: "24 Gitugutu 2026",
  time: "14h00",
  place: "Kinindo / Large",
  placeDetail: "Impande y'i Hoteri King's Conference Center",
  whatsapp: "+257 79 006 007",
  whatsappLink: "https://wa.me/25779006007",
  // Colle ici le lien du live (YouTube, Facebook, Zoom…) : il s'affichera sur la page de confirmation des inscrites en ligne.
  liveLink: "",
  speakers: [
    { name: "Dr Kandanga Hezagirwa Michaella", role: "Panéliste, gynécologue-obstétricienne" },
    { name: "Prophète Sinagaye Evrard", role: "Pasteur et porteur de la vision d'Aletheia Truth Revealed" },
    { name: "Ngendakuriyo Athanase", role: "Panéliste, psychothérapeute" },
  ],
};

export type Transport = "yes" | "no" | "unsure";

export const TRANSPORT_LABELS: Record<Transport, string> = {
  yes: "Oui",
  no: "Non",
  unsure: "Je ne sais pas encore",
};

export type Attendance = "onsite" | "online";

/** Pays proposés pour la participation en ligne : [nom, indicatif]. Ajoute-en librement. */
export const COUNTRIES: [string, string][] = [
  ["Burundi", "257"], ["Rwanda", "250"], ["RDC (Congo-Kinshasa)", "243"], ["Tanzanie", "255"],
  ["Ouganda", "256"], ["Kenya", "254"], ["Congo-Brazzaville", "242"], ["Afrique du Sud", "27"],
  ["Zambie", "260"], ["Éthiopie", "251"], ["Cameroun", "237"], ["Côte d'Ivoire", "225"],
  ["Sénégal", "221"], ["Nigeria", "234"], ["Ghana", "233"], ["Maroc", "212"], ["Égypte", "20"],
  ["France", "33"], ["Belgique", "32"], ["Suisse", "41"], ["Allemagne", "49"], ["Royaume-Uni", "44"],
  ["Pays-Bas", "31"], ["Suède", "46"], ["Norvège", "47"], ["Danemark", "45"], ["Italie", "39"],
  ["Espagne", "34"], ["Irlande", "353"], ["Luxembourg", "352"],
  ["Canada", "1"], ["États-Unis", "1"], ["Brésil", "55"],
  ["Émirats arabes unis", "971"], ["Qatar", "974"], ["Arabie saoudite", "966"], ["Turquie", "90"],
  ["Inde", "91"], ["Chine", "86"], ["Australie", "61"], ["Nouvelle-Zélande", "64"],
  ["Autre pays", ""],
];

export function dialCode(country: string): string {
  return COUNTRIES.find(([n]) => n === country)?.[1] ?? "";
}

/**
 * Normalise un numéro au format international (+XXXXXXXX).
 * - saisi avec « + » ou « 00 » : pris tel quel ;
 * - sinon : on ajoute l'indicatif du pays choisi (le 0 de tête est retiré).
 * Burundi : exactement 8 chiffres.
 */
export function normalizePhone(input: string, country = "Burundi"): string | null {
  const raw = input.trim();
  let d = raw.replace(/\D/g, "");
  if (raw.startsWith("+") || raw.startsWith("00")) {
    if (raw.startsWith("00")) d = d.slice(2);
    return d.length >= 7 && d.length <= 15 ? `+${d}` : null;
  }
  const dial = dialCode(country);
  if (country === "Burundi") {
    if (d.startsWith("257") && d.length === 11) d = d.slice(3);
    return d.length === 8 ? `+257${d}` : null;
  }
  if (!dial) return null; // « Autre pays » : le numéro doit commencer par +
  d = d.replace(/^0+/, "");
  return d.length >= 6 && d.length <= 12 ? `+${dial}${d}` : null;
}

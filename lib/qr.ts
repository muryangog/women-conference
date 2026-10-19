/** Contenu du QR code d'une participante : lu par l'application mobile, même hors ligne. */
export const qrPayload = (registrationId: string) => `URUGORI:${registrationId}`;

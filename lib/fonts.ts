import { Inter, Instrument_Serif, JetBrains_Mono, Libre_Caslon_Text, Public_Sans } from "next/font/google";

/** Polices globales (layout racine). */
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
export const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });
export const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

/** Polices de la page QASyn (chargées uniquement sur /qasyn). */
export const libreCaslon = Libre_Caslon_Text({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-libre-caslon",
  display: "swap",
});
export const publicSans = Public_Sans({ subsets: ["latin"], variable: "--font-public-sans", display: "swap" });

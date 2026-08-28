import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Central Inteligente de Cotacoes e Ativos",
  description:
    "Painel academico que integra cotacoes de moedas tradicionais e criptoativos, com regras e alertas informativos. Nao realiza recomendacao de investimento.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0c11",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {/* Atalho de teclado: primeiro elemento focavel da pagina. */}
        <a className="skip-link" href="#conteudo">
          Pular para o conteudo principal
        </a>
        {children}
      </body>
    </html>
  );
}
